// The proxy side of src/lib/studio-origin.ts: turns a decision into a Response.

import { isLocale, LOCALE_COOKIE, requestLocaleFrom } from "./i18n/config.ts";
import { contactEmail } from "./site.ts";
import { gateDecision, HOP_COOKIE, HOP_COOKIE_SECONDS, STUDIO_ORIGIN_CONFIG, type StudioOriginConfig } from "./studio-origin.ts";
import { loopPage } from "./studio-origin-page.ts";

function cookieValue(header: string | null, name: string): string | null {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function withBase(basePath: string, pathAndQuery: string): string {
  return basePath ? `${basePath}${pathAndQuery}` : pathAndQuery;
}

/**
 * A page load, as opposed to a fetch, an image or a frame. Browsers say so with Sec-Fetch-Dest.
 * Without it (curl, link checkers, crawlers, older browsers), only a request that clearly wants
 * something other than a page passes: Accept `*\/*` or no Accept is a page too.
 */
export function isDocumentRequest(headers: Headers): boolean {
  const dest = headers.get("sec-fetch-dest");
  if (dest) return dest === "document";
  if (headers.has("x-requested-with")) return false;
  const accept = (headers.get("accept") ?? "").trim().toLowerCase();
  return accept === "" || accept.includes("text/html") || accept.includes("*/*");
}

/** Null when the request is not concerned. Never a redirect to the same host, never a loop. */
export function studioOriginGate(request: Request, options: { basePath?: string; config?: StudioOriginConfig } = {}): Response | null {
  const basePath = options.basePath ?? process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const config = options.config ?? STUDIO_ORIGIN_CONFIG;
  const raw = new URL(request.url);
  const path = basePath && raw.pathname.startsWith(basePath) ? raw.pathname.slice(basePath.length) || "/" : raw.pathname;
  const url = new URL(`${path}${raw.search}`, raw.origin);
  const headers = request.headers;
  const cookies = headers.get("cookie");
  const explicit = cookieValue(cookies, LOCALE_COOKIE);
  const isDocument = isDocumentRequest(headers);
  const decision = gateDecision({
    url,
    host: headers.get("x-forwarded-host") ?? headers.get("host") ?? raw.host,
    method: request.method,
    isDocument,
    hopCookie: cookieValue(cookies, HOP_COOKIE) === "1",
    locale: isLocale(explicit) ? explicit : null,
  }, config);
  if (decision.kind === "pass") return null;
  const noStore = { "cache-control": "no-store" };
  if (decision.kind === "hop") {
    const target = new URL(decision.location);
    target.pathname = withBase(basePath, target.pathname);
    return new Response(null, { status: 307, headers: { ...noStore, location: target.toString(), "set-cookie": `${HOP_COOKIE}=1; Path=/; Max-Age=${HOP_COOKIE_SECONDS}; SameSite=Lax; Secure; HttpOnly` } });
  }
  if (decision.kind === "land") {
    const response = new Response(null, { status: 307, headers: { ...noStore, location: new URL(withBase(basePath, decision.location), raw).toString() } });
    if (decision.locale) response.headers.append("set-cookie", `${LOCALE_COOKIE}=${decision.locale}; Path=/; Max-Age=31536000; SameSite=Lax`);
    return response;
  }
  const locale = requestLocaleFrom(explicit, headers.get("accept-language"));
  const retry = new URL(decision.retry);
  retry.pathname = withBase(basePath, retry.pathname);
  const html = loopPage({ locale, retry: retry.toString(), home: withBase(basePath, "/"), origin: config.origin, email: contactEmail });
  return new Response(request.method === "HEAD" ? null : html, {
    status: 508,
    headers: { ...noStore, "content-type": "text/html; charset=utf-8", "set-cookie": `${HOP_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly` },
  });
}
