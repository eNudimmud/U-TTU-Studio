// Comfy Cloud sets `__Host-comfy_session` as host-only, Secure, SameSite=Lax.
// Chrome does not send that cookie from a cross-site iframe. vercel.app is a
// public suffix, so the Sphère frame on cloud.comfy.org is a different site
// from the studio: Générés and Sorties still receive filenames over the
// Bearer API, then <img> and <video> get 401 from /api/view.
// Serving the app from this host makes the media request same-site. The
// full-tab link stays on cloud.comfy.org. After the visitor clicks load,
// Comfy's scripts run on the studio origin — that is the tradeoff, because
// a sandbox without allow-same-origin drops the cookie again.

import { resolveComfyShare } from "./comfy-stack.ts";

export const COMFY_ORIGIN = "https://cloud.comfy.org";

const PREFIXES = ["assets", "fonts", "api", "website", "extensions", "templates", "internal", "models", "vhs", "flags", "cdn-cgi"];
const EXACT = new Set(["/materialdesignicons.min.css", "/ws"]);
const METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const REQUEST_HEADERS = ["accept", "accept-language", "authorization", "content-type", "range", "user-agent", "x-api-key"];
const DROPPED_RESPONSE_HEADERS = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers", "transfer-encoding", "upgrade",
  "content-encoding", "content-length", "alt-svc", "strict-transport-security",
]);
// Comfy hides Google and GitHub unless the host ends in .comfy.org. Firebase
// already authorizes vercel.app, so the same check has to pass here or a
// Google account cannot mint the media cookie.
const COMFY_ORG_HOST_RE = "/\\.comfy\\.org$/";
const STUDIO_HOST_RE = "/\\.(?:comfy\\.org|vercel\\.app)$/";

type Route = { kind: "ignore" } | { kind: "deny" } | { kind: "proxy"; upstream: URL };

export function comfyEmbedHref(shareUrl: string): string | null {
  const resolved = resolveComfyShare(shareUrl);
  if (!resolved) return null;
  const share = new URL(resolved).searchParams.get("share");
  return share ? `/comfy-embed?share=${encodeURIComponent(share)}` : null;
}

export function classifyComfy(url: URL): Route {
  if (url.pathname === "/comfy-embed" || url.pathname === "/comfy-embed/") {
    const share = url.searchParams.get("share") ?? "";
    const canonical = resolveComfyShare(`${COMFY_ORIGIN}/?share=${share}`);
    return canonical ? { kind: "proxy", upstream: new URL(canonical) } : { kind: "deny" };
  }
  if (!allowedPath(url.pathname)) return { kind: "ignore" };
  return { kind: "proxy", upstream: new URL(`${url.pathname}${url.search}`, COMFY_ORIGIN) };
}

function allowedPath(pathname: string): boolean {
  if (pathname.includes("\\") || pathname.includes("\0") || pathname.split("/").includes("..")) return false;
  if (EXACT.has(pathname)) return true;
  return PREFIXES.some(prefix => pathname === `/${prefix}` || pathname.startsWith(`/${prefix}/`));
}

export function comfyCookieHeader(header: string | null): string | null {
  if (!header) return null;
  const kept = header.split(";").map(part => part.trim()).filter(part => {
    const name = part.split("=", 1)[0]?.trim() ?? "";
    return name === "fe_canary" || name.toLowerCase().includes("comfy");
  });
  return kept.length ? kept.join("; ") : null;
}

export function rewriteLocation(value: string, publicOrigin: string): string {
  try {
    const url = new URL(value, COMFY_ORIGIN);
    if (url.hostname !== "cloud.comfy.org") return url.toString();
    return new URL(`${url.pathname}${url.search}${url.hash}`, publicOrigin).toString();
  } catch {
    return value;
  }
}

export function stripCookieDomain(cookie: string): string {
  return cookie.replace(/;\s*domain=[^;]*/ig, "");
}

function requestTarget(request: Request): URL {
  const nextUrl = (request as Request & { nextUrl?: URL }).nextUrl;
  return new URL((nextUrl ?? new URL(request.url)).href);
}

function refererForUpstream(referer: string, publicOrigin: string): string | null {
  try {
    const url = new URL(referer);
    if (url.origin !== publicOrigin) return `${COMFY_ORIGIN}/`;
    return new URL(`${url.pathname}${url.search}`, COMFY_ORIGIN).toString();
  } catch {
    return null;
  }
}

function mediaType(header: string | null): string {
  return header?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function textPairs(type: string, publicOrigin: string): ReadonlyArray<readonly [string, string]> {
  if (type === "text/html" || type === "application/json" || type.endsWith("+json")) {
    const escaped = publicOrigin.replaceAll("/", "\\/");
    return [
      ["https://cloud.comfy.org", publicOrigin],
      ["https:\\/\\/cloud.comfy.org", escaped],
    ];
  }
  if (type === "text/javascript" || type === "application/javascript" || type === "application/x-javascript" || type === "text/ecmascript") {
    return [[COMFY_ORG_HOST_RE, STUDIO_HOST_RE]];
  }
  return [];
}

export function rewriteProxiedText(text: string, pairs: ReadonlyArray<readonly [string, string]>): string {
  return pairs.reduce((out, [from, to]) => out.replaceAll(from, to), text);
}

function rewriteStream(input: ReadableStream<Uint8Array>, pairs: ReadonlyArray<readonly [string, string]>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const hold = Math.max(...pairs.map(([from]) => from.length)) - 1;
  let pending = "";
  const overlapping = (text: string, cut: number) => {
    let emitEnd = cut;
    for (const [needle] of pairs) {
      let at = text.indexOf(needle, Math.max(0, cut - needle.length + 1));
      while (at >= 0 && at < cut) {
        if (at + needle.length > cut) emitEnd = Math.min(emitEnd, at);
        at = text.indexOf(needle, at + 1);
      }
    }
    return emitEnd;
  };
  return new ReadableStream({
    async start(controller) {
      const reader = input.getReader();
      const push = (text: string, cut: number) => {
        const emitEnd = overlapping(text, cut);
        const emit = rewriteProxiedText(text.slice(0, emitEnd), pairs);
        pending = text.slice(emitEnd);
        if (emit) controller.enqueue(encoder.encode(emit));
      };
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          if (pending.length <= hold) continue;
          push(pending, pending.length - hold);
        }
        pending += decoder.decode();
        if (pending) controller.enqueue(encoder.encode(rewriteProxiedText(pending, pairs)));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

function clientHeaders(upstream: Response, publicOrigin: string): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (DROPPED_RESPONSE_HEADERS.has(key) || key === "set-cookie") return;
    if (key === "location") {
      headers.set(key, rewriteLocation(value, publicOrigin));
      return;
    }
    headers.append(key, value);
  });
  for (const cookie of upstream.headers.getSetCookie()) headers.append("set-cookie", stripCookieDomain(cookie));
  return headers;
}

function emptyStatus(status: number): boolean {
  return status === 204 || status === 205 || status === 304 || (status >= 300 && status < 400);
}

async function toClientResponse(upstream: Response, publicOrigin: string): Promise<Response> {
  const headers = clientHeaders(upstream, publicOrigin);
  if (emptyStatus(upstream.status) || !upstream.body) return new Response(null, { status: upstream.status, headers });
  const pairs = textPairs(mediaType(upstream.headers.get("content-type")), publicOrigin);
  const body = pairs.length ? rewriteStream(upstream.body, pairs) : upstream.body;
  if (pairs.length) {
    headers.delete("etag");
    headers.delete("content-md5");
  }
  return new Response(body, { status: upstream.status, headers });
}

export async function proxyComfy(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response | null> {
  const target = requestTarget(request);
  const route = classifyComfy(target);
  if (route.kind === "ignore") return null;
  if (route.kind === "deny") return new Response("Partage Comfy refusé.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  if (!METHODS.has(request.method)) return new Response("Méthode refusée.", { status: 405, headers: { "allow": [...METHODS].join(", ") } });

  const headers = new Headers();
  headers.set("origin", COMFY_ORIGIN);
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const cookie = comfyCookieHeader(request.headers.get("cookie"));
  if (cookie) headers.set("cookie", cookie);
  const referer = request.headers.get("referer");
  if (referer) {
    const rewritten = refererForUpstream(referer, target.origin);
    if (rewritten) headers.set("referer", rewritten);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetchImpl(route.upstream, {
      method: request.method,
      headers,
      redirect: "manual",
      body: hasBody ? request.body : undefined,
      ...(hasBody ? { duplex: "half" } : {}),
    } as RequestInit);
  } catch {
    return new Response("Comfy est injoignable.", { status: 502, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
  return toClientResponse(upstream, target.origin);
}
