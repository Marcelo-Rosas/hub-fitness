/**
 * Reverse proxy: hub.vectracargo.com.br → Railway ORIGIN_URL
 * Streaming duplex for POST/PUT/PATCH bodies (approve forms, APIs).
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
  "cf-connecting-ip",
  "cf-ray",
  "cf-visitor",
  "x-forwarded-proto",
  "x-forwarded-for",
]);

function buildUpstreamHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const [key, value] of request.headers) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  }
  headers.set("x-forwarded-proto", "https");
  headers.set("x-forwarded-host", new URL(request.url).host);
  return headers;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.ORIGIN_URL) {
      return Response.json(
        { error: "misconfigured", message: "ORIGIN_URL binding missing" },
        { status: 500 },
      );
    }

    try {
      const incoming = new URL(request.url);
      const originBase = env.ORIGIN_URL.replace(/\/$/, "");
      const target = new URL(incoming.pathname + incoming.search, originBase);

      const init: RequestInit = {
        method: request.method,
        headers: buildUpstreamHeaders(request),
        redirect: "manual",
      };

      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = request.body;
        // @ts-expect-error Workers streaming duplex for request bodies
        init.duplex = "half";
      }

      const upstream = await fetch(target.toString(), init);
      const responseHeaders = new Headers(upstream.headers);
      responseHeaders.set("x-hub-fitness-proxy", "cloudflare-workers");

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
          message: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 502 },
      );
    }
  },
} satisfies ExportedHandler<Env>;
