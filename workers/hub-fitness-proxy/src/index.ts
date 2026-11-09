/**
 * Reverse proxy: hub.vectracargo.com.br → Railway ORIGIN_URL
 * Streams request bodies (approve forms, APIs) and rewrites origin redirects
 * back to the public host.
 */

interface Env {
  ORIGIN_URL: string;
}

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
 * Builds the upstream URL by string concatenation on a parsed origin so that
 * a pathname like "//evil.com/x" stays a path on the origin host (never a
 * protocol-relative URL) and any ORIGIN_URL path prefix is preserved.
 */
function buildTarget(origin: URL, incoming: URL): URL {
  const basePath = origin.pathname.replace(/\/+$/, "");
  const target = new URL(
    origin.origin + basePath + incoming.pathname + incoming.search,
  );
  if (target.origin !== origin.origin) {
    throw new Error("target escaped origin");
  }
  return target;
}

/** Rewrites absolute redirects pointing at the origin back to the public host. */
function rewriteLocation(
  location: string,
  origin: URL,
  incoming: URL,
): string {
  let loc: URL;
  try {
    loc = new URL(location, origin);
  } catch {
    return location;
  }
  if (loc.origin !== origin.origin) return location;
  const basePath = origin.pathname.replace(/\/+$/, "");
  let path = loc.pathname;
  if (basePath && (path === basePath || path.startsWith(basePath + "/"))) {
    path = path.slice(basePath.length) || "/";
  }
  return incoming.origin + path + loc.search + loc.hash;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let origin: URL;
    try {
      origin = new URL(env.ORIGIN_URL);
    } catch {
      console.error("hub-fitness proxy: ORIGIN_URL missing or invalid");
      return Response.json(
        { error: "misconfigured", message: "Proxy misconfigured" },
        { status: 500 },
      );
    }

    try {
      const incoming = new URL(request.url);
      const target = buildTarget(origin, incoming);

      const init: RequestInit = {
        method: request.method,
        headers: buildUpstreamHeaders(request, incoming.host),
        redirect: "manual",
      };

      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = request.body;
      }

      const upstream = await fetch(target.toString(), init);
      const responseHeaders = new Headers(upstream.headers);
      responseHeaders.set("x-hub-fitness-proxy", "cloudflare-workers");

      const location = responseHeaders.get("location");
      if (location) {
        responseHeaders.set(
          "location",
          rewriteLocation(location, origin, incoming),
        );
      }

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error("hub-fitness proxy error", error);
      return Response.json(
        {
          error: "origin_unreachable",
          message: "Upstream unavailable",
        },
        { status: 502 },
      );
    }
  },
} satisfies ExportedHandler<Env>;
