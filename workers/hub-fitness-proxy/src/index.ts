/**
 * hub.vectracargo.com.br → HUB-FITNESS (Express + SPA) em Cloudflare Containers.
 *
 * O Worker sanitiza headers (IP real do cliente, sem spoof) e encaminha para
 * uma instância única do container. Instância única é obrigatória enquanto a
 * intranet/comex usam SQLite local: dados vivem no disco do container e são
 * perdidos quando ele reinicia (deploy ou sleep). Ver ADR / PgIntranetStore.
 */
import { Container, getContainer } from "@cloudflare/containers";

interface Env {
  HUB_APP: DurableObjectNamespace<HubApp>;
  // vars
  APP_URL: string;
  GEMINI_MODEL: string;
  INTRANET_EMAIL_LIVE: string;
  RESEND_FROM: string;
  PUCOMEX_ENV: string;
  PUCOMEX_ROLE_TYPE: string;
  PUCOMEX_LIVE: string;
  PUCOMEX_CNPJ_LABEL: string;
  PUCOMEX_USE_VECTRA_HUB_CERT: string;
  COMEX_CLIENT_SLUG?: string;
  // secrets (opcionais: app sobe sem eles, com fallbacks)
  GEMINI_API_KEY?: string;
  OPERATOR_DATABASE_URL?: string;
  DATABASE_URL?: string;
  RESEND_API_KEY?: string;
  PUCOMEX_CERT_PASSWORD?: string;
  PUCOMEX_CERT_PFX_B64_1?: string;
  PUCOMEX_CERT_PFX_B64_2?: string;
  PUCOMEX_CERT_PFX_B64_3?: string;
}

const PASSTHROUGH_ENV = [
  "APP_URL",
  "GEMINI_MODEL",
  "INTRANET_EMAIL_LIVE",
  "RESEND_FROM",
  "PUCOMEX_ENV",
  "PUCOMEX_ROLE_TYPE",
  "PUCOMEX_LIVE",
  "PUCOMEX_CNPJ_LABEL",
  "PUCOMEX_USE_VECTRA_HUB_CERT",
  "COMEX_CLIENT_SLUG",
  "GEMINI_API_KEY",
  "OPERATOR_DATABASE_URL",
  "DATABASE_URL",
  "RESEND_API_KEY",
  "PUCOMEX_CERT_PASSWORD",
  "PUCOMEX_CERT_PFX_B64_1",
  "PUCOMEX_CERT_PFX_B64_2",
  "PUCOMEX_CERT_PFX_B64_3",
] as const satisfies readonly (keyof Env)[];

export class HubApp extends Container<Env> {
  defaultPort = 3000;
  // Sleep apaga o SQLite local → manter acordado o máximo possível até a
  // migração para Postgres.
  sleepAfter = "720h";

  constructor(ctx: ConstructorParameters<typeof Container<Env>>[0], env: Env) {
    super(ctx, env);
    const vars: Record<string, string> = {};
    for (const key of PASSTHROUGH_ENV) {
      const value = env[key];
      if (typeof value === "string" && value !== "") vars[key] = value;
    }
    this.envVars = vars;
  }

  override onError(error: unknown): never {
    console.error("hub-fitness container error", error);
    throw error;
  }
}

// Internal origin used to address the container; never exposed to clients.
const CONTAINER_ORIGIN = "http://hub-app.internal";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

// Client-IP / forwarding headers: never trust the client's copy. The Worker
// sets x-forwarded-* itself from Cloudflare's verified values.
const SPOOFABLE = new Set([
  "cf-connecting-ip",
  "cf-connecting-ipv6",
  "cf-ray",
  "cf-visitor",
  "cf-ipcountry",
  "true-client-ip",
  "x-real-ip",
  "forwarded",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-client-ip",
  "x-cluster-client-ip",
]);

function buildUpstreamHeaders(request: Request, publicHost: string): Headers {
  const headers = new Headers();
  for (const [key, value] of request.headers) {
    const k = key.toLowerCase();
    if (!HOP_BY_HOP.has(k) && !SPOOFABLE.has(k)) {
      headers.set(key, value);
    }
  }
  const clientIp = request.headers.get("cf-connecting-ip");
  if (clientIp) {
    headers.set("x-forwarded-for", clientIp);
    headers.set("x-real-ip", clientIp);
  }
  headers.set("x-forwarded-proto", "https");
  headers.set("x-forwarded-host", publicHost);
  return headers;
}

/**
 * Builds the container URL by string concatenation so that a pathname like
 * "//evil.com/x" stays a path (never a protocol-relative URL).
 */
function buildTarget(incoming: URL): URL {
  const target = new URL(CONTAINER_ORIGIN + incoming.pathname + incoming.search);
  if (target.origin !== CONTAINER_ORIGIN) {
    throw new Error("target escaped origin");
  }
  return target;
}

/** Rewrites absolute redirects pointing at the internal origin to the public host. */
function rewriteLocation(location: string, incoming: URL): string {
  let loc: URL;
  try {
    loc = new URL(location, CONTAINER_ORIGIN);
  } catch {
    return location;
  }
  const internal =
    loc.origin === CONTAINER_ORIGIN ||
    loc.hostname === "localhost" ||
    loc.hostname === "127.0.0.1" ||
    loc.hostname === "0.0.0.0";
  if (!internal) return location;
  return incoming.origin + loc.pathname + loc.search + loc.hash;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const incoming = new URL(request.url);
      const init: RequestInit = {
        method: request.method,
        headers: buildUpstreamHeaders(request, incoming.host),
        redirect: "manual",
      };
      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = request.body;
      }

      const upstream = await getContainer(env.HUB_APP).fetch(
        new Request(buildTarget(incoming).toString(), init),
      );

      const responseHeaders = new Headers(upstream.headers);
      responseHeaders.set("x-hub-fitness-proxy", "cloudflare-workers");
      const location = responseHeaders.get("location");
      if (location) {
        responseHeaders.set("location", rewriteLocation(location, incoming));
      }

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error("hub-fitness proxy error", error);
      return Response.json(
        { error: "origin_unreachable", message: "Upstream unavailable" },
        { status: 502 },
      );
    }
  },
} satisfies ExportedHandler<Env>;
