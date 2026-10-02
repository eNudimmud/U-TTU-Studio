// Comfy Cloud sets `__Host-comfy_session` as host-only, Secure, SameSite=Lax.
// Chrome does not send that cookie from a cross-site iframe. vercel.app is a
// public suffix, so the Sphère frame on cloud.comfy.org is a different site
// from the studio: Générés and Sorties still receive filenames over the
// Bearer API, then <img> and <video> get 401 from /api/view.
// Serving the app from this host makes the media request same-site. The
// full-tab link stays on cloud.comfy.org. After the visitor clicks load,
// Comfy's scripts run on the studio origin — that is the tradeoff, because
// a sandbox without allow-same-origin drops the cookie again.
// A media GET that Comfy answers with a storage redirect is fetched here
// and returned as bytes. <img> and <video> then stay on this origin: a
// cross-origin opaque response does not paint on mobile Chrome.
// A hard reload does not consult the service worker, so the page also stores
// the signed-in token in `__Host-uttu_media` before Comfy starts. That cookie
// is not forwarded. This proxy turns it into Authorization on media GETs.

import { COMFY_MEDIA_BOOT } from "./comfy-media.ts";
import { resolveComfyShare } from "./comfy-stack.ts";

export const COMFY_ORIGIN = "https://cloud.comfy.org";

const PREFIXES = ["assets", "fonts", "api", "website", "extensions", "templates", "internal", "models", "vhs", "flags", "cdn-cgi"];
const EXACT = new Set(["/materialdesignicons.min.css", "/ws"]);
// Vue routes. A refresh or the post-login return must still be the Comfy document, not the studio page.
const SPA_EXACT = new Set(["/login", "/user-select"]);
const SPA_PREFIXES = ["cloud", "oauth"];
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
  if (url.pathname === "/") {
    const canonical = resolveComfyShare(`${COMFY_ORIGIN}/?share=${url.searchParams.get("share") ?? ""}`);
    return canonical ? { kind: "proxy", upstream: new URL(canonical) } : { kind: "ignore" };
  }
  if (spaPath(url.pathname)) return { kind: "proxy", upstream: new URL(`${url.pathname}${url.search}`, COMFY_ORIGIN) };
  if (!allowedPath(url.pathname)) return { kind: "ignore" };
  return { kind: "proxy", upstream: new URL(`${url.pathname}${url.search}`, COMFY_ORIGIN) };
}

function spaPath(pathname: string): boolean {
  if (SPA_EXACT.has(pathname)) return true;
  return SPA_PREFIXES.some(prefix => pathname === `/${prefix}` || pathname.startsWith(`/${prefix}/`));
}

function allowedPath(pathname: string): boolean {
  if (pathname.includes("\\") || pathname.includes("\0") || pathname.split("/").includes("..")) return false;
  if (EXACT.has(pathname)) return true;
  return PREFIXES.some(prefix => pathname === `/${prefix}` || pathname.startsWith(`/${prefix}/`));
}

// Set by the embed boot from the Firebase (or workspace) token. It is not a
// Comfy cookie: Comfy would treat an unknown session cookie as invalid.
export const COMFY_MEDIA_TOKEN_COOKIE = "__Host-uttu_media";

export function mediaBearerFromCookie(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0 || trimmed.slice(0, eq) !== COMFY_MEDIA_TOKEN_COOKIE) continue;
    let value = trimmed.slice(eq + 1);
    try {
      value = decodeURIComponent(value);
    } catch {
      return null;
    }
    if (!value || value.length > 4096 || /[\r\n\0]/.test(value) || !/^[A-Za-z0-9\-._~+/]+=*$/.test(value)) return null;
    return value;
  }
  return null;
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

export function rewriteAllowOrigin(value: string, publicOrigin: string): string {
  try {
    if (new URL(value).hostname === "cloud.comfy.org") return publicOrigin;
  } catch {
    return value;
  }
  return value;
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
    const pairs: Array<readonly [string, string]> = [
      ["https://cloud.comfy.org", publicOrigin],
      ["https:\\/\\/cloud.comfy.org", escaped],
    ];
    // <img> and <video> cannot attach the Firebase bearer. The boot script
    // registers a same-origin worker that does, before Comfy paints thumbnails.
    if (type === "text/html") pairs.push(["<head>", `<head>${COMFY_MEDIA_BOOT}`]);
    return pairs;
  }
  if (type === "text/javascript" || type === "application/javascript" || type === "application/x-javascript" || type === "text/ecmascript") {
    return [[COMFY_ORG_HOST_RE, STUDIO_HOST_RE]];
  }
  return [];
}

export function rewriteProxiedText(text: string, pairs: ReadonlyArray<readonly [string, string]>): string {
  return pairs.reduce((out, [from, to]) => out.replaceAll(from, to), text);
}

// Sibling module scripts do not wait for the boot's top-level await, so Comfy
// was requesting thumbnails before the worker had the Firebase token. The
// entry stays inert until the boot imports it.
export function deferComfyEntry(html: string): string {
  return html.replace(
    /<script\b([^>]*?)\btype="module"([^>]*?)\bsrc="([^"]+)"([^>]*)><\/script>/,
    `<script$1type="text/plain" data-comfy-main$2src="$3"$4></script>`,
  );
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
    if (key === "access-control-allow-origin") {
      headers.set(key, rewriteAllowOrigin(value, publicOrigin));
      return;
    }
    headers.append(key, value);
  });
  for (const cookie of upstream.headers.getSetCookie()) headers.append("set-cookie", stripCookieDomain(cookie));
  return headers;
}

function signedStorageHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, "");
  return host === "storage.googleapis.com"
    || host === "storage.cloud.google.com"
    || host.endsWith(".storage.googleapis.com")
    || host.endsWith(".googleusercontent.com");
}

function workerMediaPath(pathname: string): boolean {
  return pathname === "/api/view"
    || pathname === "/api/viewvideo"
    || pathname.startsWith("/api/assets/")
    || pathname.startsWith("/api/s/");
}

function blockedStorageHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "metadata.google.internal") return true;
  const ip = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (ip === "::1" || ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) return true;
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function storageTarget(location: string | null, publicOrigin: string): URL | null {
  if (!location) return null;
  let url: URL;
  try {
    url = new URL(rewriteLocation(location, publicOrigin));
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.origin === publicOrigin || url.hostname === "cloud.comfy.org") return null;
  if (blockedStorageHost(url.hostname)) return null;
  return url;
}

function mediaFileResponse(upstream: Response, file: Response, method: string): Response {
  const headers = new Headers();
  const contentType = file.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  for (const name of ["content-length", "content-range", "accept-ranges"]) {
    const value = file.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("cache-control", "private, no-store");
  if (contentType) headers.set("x-content-type-options", "nosniff");
  for (const cookie of upstream.headers.getSetCookie()) headers.append("set-cookie", stripCookieDomain(cookie));
  return new Response(method === "HEAD" ? null : file.body, { status: file.status, headers });
}

// Comfy's /api/view 302s to a signed storage URL. The browser cannot paint
// that hop from a service worker (manual redirects hide Location; a no-cors
// body stays opaque). Fetch the file here and return it on this origin.
async function streamStorageRedirect(request: Request, upstream: Response, publicOrigin: string, fetchImpl: typeof fetch): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (!workerMediaPath(requestTarget(request).pathname)) return null;
  let current = upstream;
  for (let hop = 0; hop < 2; hop++) {
    if (current.status < 300 || current.status >= 400) return hop === 0 ? null : mediaFileResponse(upstream, current, request.method);
    const next = storageTarget(current.headers.get("location"), publicOrigin);
    if (!next) return hop === 0 ? null : new Response("Redirection média refusée.", { status: 502, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
    const headers = new Headers();
    const range = request.headers.get("range");
    if (range && request.method === "GET") headers.set("range", range);
    const accept = request.headers.get("accept");
    if (accept) headers.set("accept", accept);
    try {
      current = await fetchImpl(next, { method: request.method, headers, redirect: "manual" });
    } catch {
      return new Response("Fichier Comfy injoignable.", { status: 502, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
    }
  }
  if (current.status >= 300 && current.status < 400) {
    return new Response("Redirection média trop longue.", { status: 502, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
  return mediaFileResponse(upstream, current, request.method);
}

const ASSET_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function viewPath(pathname: string): boolean {
  return pathname === "/api/view" || pathname === "/api/viewvideo";
}

// Cloud stores an output under one name and ignores `subfolder`. Sorties still
// asks for the OSS pair (basename + folder), which is a 404 JSON body.
function viewLookupNames(url: URL): string[] {
  const names: string[] = [];
  const push = (value: string) => {
    const name = value.trim().replace(/^\/+|\/+$/g, "");
    if (!name || name.length > 512 || names.includes(name)) return;
    if (name.includes("\\") || name.includes("\0") || name.startsWith("/")) return;
    if (name.split("/").includes("..")) return;
    names.push(name);
  };
  push(url.searchParams.get("filename") ?? "");
  if (!names.length) return names;
  const folder = (url.searchParams.get("subfolder") ?? "").trim().replace(/^\/+|\/+$/g, "");
  const filename = names[0];
  if (folder && !filename.startsWith(`${folder}/`)) push(`${folder}/${filename}`);
  const slash = filename.lastIndexOf("/");
  if (slash >= 0) push(filename.slice(slash + 1));
  return names;
}

function fileMedia(upstream: Response): boolean {
  if (!upstream.ok) return false;
  const type = mediaType(upstream.headers.get("content-type"));
  return !type.includes("json") && !type.startsWith("text/");
}

async function acceptViewMedia(request: Request, upstream: Response, publicOrigin: string, fetchImpl: typeof fetch): Promise<Response | null> {
  if (upstream.status >= 300 && upstream.status < 400) {
    return streamStorageRedirect(request, upstream, publicOrigin, fetchImpl);
  }
  if (!fileMedia(upstream)) return null;
  return mediaFileResponse(upstream, upstream, request.method);
}

async function readAssetRows(response: Response): Promise<Array<{ id: string; name: string }>> {
  if (!response.ok) return [];
  const type = mediaType(response.headers.get("content-type"));
  if (type && !type.includes("json")) return [];
  const text = await response.text();
  if (text.length > 1_000_000) return [];
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return [];
  }
  const record = payload && typeof payload === "object" ? payload as { assets?: unknown } : null;
  const list = Array.isArray(payload) ? payload : Array.isArray(record?.assets) ? record.assets : [];
  const rows: Array<{ id: string; name: string }> = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const id = (item as { id?: unknown }).id;
    const name = (item as { name?: unknown }).name;
    if (typeof id !== "string" || typeof name !== "string" || !ASSET_ID.test(id)) continue;
    rows.push({ id, name });
  }
  return rows;
}

function pickAsset(rows: Array<{ id: string; name: string }>, candidates: string[]): string | null {
  let bestId: string | null = null;
  let best = -1;
  for (const row of rows) {
    for (const candidate of candidates) {
      const exact = row.name === candidate;
      const nested = row.name.endsWith(`/${candidate}`) || candidate.endsWith(`/${row.name}`);
      if (!exact && !nested) continue;
      const score = (exact ? 1000 : 0) + candidate.length;
      if (score > best) {
        best = score;
        bestId = row.id;
      }
    }
  }
  return bestId;
}

async function findViewAsset(candidates: string[], headers: Headers, fetchImpl: typeof fetch): Promise<string | null> {
  const ordered = [...candidates].sort((a, b) => b.length - a.length);
  const lookups = [ordered[0]];
  const short = ordered.find(name => !name.includes("/"));
  if (short && short !== lookups[0]) lookups.push(short);
  const listHeaders = new Headers();
  for (const name of ["authorization", "x-api-key", "cookie", "origin", "referer"]) {
    const value = headers.get(name);
    if (value) listHeaders.set(name, value);
  }
  listHeaders.set("accept", "application/json");
  for (const query of lookups) {
    const url = new URL("/api/assets", COMFY_ORIGIN);
    url.searchParams.set("name_contains", query);
    url.searchParams.set("limit", "50");
    let response: Response;
    try {
      response = await fetchImpl(url, { method: "GET", headers: listHeaders, redirect: "manual" });
    } catch {
      continue;
    }
    const id = pickAsset(await readAssetRows(response), candidates);
    if (id) return id;
  }
  return null;
}

// A 200 or 302 from /api/view is unchanged. A 404 is retried with the joined
// folder name, then loaded from the same account's asset bytes.
async function recoverViewMiss(request: Request, upstream: Response, upstreamUrl: URL, headers: Headers, publicOrigin: string, fetchImpl: typeof fetch): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (!viewPath(requestTarget(request).pathname) || upstream.status !== 404) return null;
  const token = headers.has("authorization") || headers.has("x-api-key");
  if (!token && !headers.has("cookie")) return null;
  const candidates = viewLookupNames(upstreamUrl);
  if (!candidates.length) return null;
  const attempt = async (name: string, attemptHeaders: Headers) => {
    const url = new URL(upstreamUrl);
    url.searchParams.set("filename", name);
    try {
      const retry = await fetchImpl(url, { method: request.method, headers: attemptHeaders, redirect: "manual" });
      return acceptViewMedia(request, retry, publicOrigin, fetchImpl);
    } catch {
      return null;
    }
  };
  for (const name of candidates.slice(1)) {
    const hit = await attempt(name, headers);
    if (hit) return hit;
  }
  if (token && headers.has("cookie")) {
    const cookieHeaders = new Headers(headers);
    cookieHeaders.delete("authorization");
    cookieHeaders.delete("x-api-key");
    for (const name of candidates) {
      const hit = await attempt(name, cookieHeaders);
      if (hit) return hit;
    }
  }
  const id = await findViewAsset(candidates, headers, fetchImpl);
  if (!id) return null;
  const content = new URL(`/api/assets/${id}/content`, COMFY_ORIGIN);
  content.searchParams.set("disposition", "inline");
  let file: Response;
  try {
    file = await fetchImpl(content, { method: request.method, headers, redirect: "manual" });
  } catch {
    return null;
  }
  return acceptViewMedia(request, file, publicOrigin, fetchImpl);
}

// A tile whose src is already a signed storage URL never hits /api/view.
// Fetch that URL here and return the bytes on this origin.
async function streamSignedMedia(request: Request, target: URL, fetchImpl: typeof fetch): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Méthode refusée.", { status: 405, headers: { "allow": "GET, HEAD", "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
  const raw = target.searchParams.get("u");
  let current = raw && raw.length <= 8000 ? storageTarget(raw, target.origin) : null;
  if (!current || !signedStorageHost(current.hostname)) {
    return new Response("URL média refusée.", { status: 400, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
  let file: Response | null = null;
  for (let hop = 0; hop < 2; hop++) {
    const headers = new Headers();
    const range = request.headers.get("range");
    if (range && request.method === "GET") headers.set("range", range);
    const accept = request.headers.get("accept");
    if (accept) headers.set("accept", accept);
    try {
      file = await fetchImpl(current, { method: request.method, headers, redirect: "manual" });
    } catch {
      return new Response("Fichier Comfy injoignable.", { status: 502, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
    }
    if (file.status < 300 || file.status >= 400) break;
    const next = storageTarget(file.headers.get("location"), target.origin);
    if (!next || !signedStorageHost(next.hostname)) {
      return new Response("Redirection média refusée.", { status: 502, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
    }
    current = next;
  }
  if (!file || (file.status >= 300 && file.status < 400)) {
    return new Response("Redirection média trop longue.", { status: 502, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
  return mediaFileResponse(new Response(null), file, request.method);
}

function emptyStatus(status: number): boolean {
  return status === 204 || status === 205 || status === 304 || (status >= 300 && status < 400);
}

async function toClientResponse(upstream: Response, publicOrigin: string): Promise<Response> {
  const headers = clientHeaders(upstream, publicOrigin);
  if (emptyStatus(upstream.status) || !upstream.body) return new Response(null, { status: upstream.status, headers });
  const type = mediaType(upstream.headers.get("content-type"));
  const pairs = textPairs(type, publicOrigin);
  if (type === "text/html" && pairs.length) {
    headers.delete("etag");
    headers.delete("content-md5");
    const html = deferComfyEntry(rewriteProxiedText(await upstream.text(), pairs));
    return new Response(html, { status: upstream.status, headers });
  }
  const body = pairs.length ? rewriteStream(upstream.body, pairs) : upstream.body;
  if (pairs.length) {
    headers.delete("etag");
    headers.delete("content-md5");
  }
  return new Response(body, { status: upstream.status, headers });
}

export async function proxyComfy(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response | null> {
  const target = requestTarget(request);
  if (target.pathname === "/comfy-media-file") return streamSignedMedia(request, target, fetchImpl);
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
  const rawCookie = request.headers.get("cookie");
  const cookie = comfyCookieHeader(rawCookie);
  if (cookie) headers.set("cookie", cookie);
  if (!headers.has("authorization") && (request.method === "GET" || request.method === "HEAD") && workerMediaPath(target.pathname)) {
    const token = mediaBearerFromCookie(rawCookie);
    if (token) headers.set("authorization", `Bearer ${token}`);
  }
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
  return await recoverViewMiss(request, upstream, route.upstream, headers, target.origin, fetchImpl)
    ?? await streamStorageRedirect(request, upstream, target.origin, fetchImpl)
    ?? toClientResponse(upstream, target.origin);
}
