// Comfy's login (Firebase project `dreamboothy`, served on our origin by src/proxy.ts) only works on
// hosts that Comfy allowlists. `*.vercel.app` is on that list; the public domain `uttu-studio.app`
// is not yet (docs/DECISIONS.md, 2026-10-30). The landing stays on whatever host the visitor used,
// but the studio, Mon studio and Comfy's login pages run on one authorized origin, so the Comfy
// session (stored per origin in localStorage) is always where the studio looks for it.
// Pure functions only: the proxy (server) and the landing links (browser) share them.

import { isLocale, type Locale } from "./i18n/config.ts";

/** Where the studio runs when the current host cannot log in to Comfy. */
export const DEFAULT_STUDIO_ORIGIN = "https://u-ttu-studio.vercel.app";
/** Hosts Comfy accepts for its login. A leading dot means « this domain and its subdomains ». */
export const DEFAULT_AUTHORIZED_HOSTS = ".vercel.app,localhost,127.0.0.1,[::1]";

/** Added to every hop, so a hop that comes straight back is recognised instead of looping. */
export const HOP_PARAM = "uttu_hop";
/** Carries the visitor's language across origins (the language cookie is per origin). */
export const LANG_PARAM = "uttu_lang";
/** Fallback loop marker, in case a redirect drops the query string. */
export const HOP_COOKIE = "u-ttu-hop";
export const HOP_COOKIE_SECONDS = 20;

export type StudioOriginConfig = { origin: string; authorized: readonly string[] };

export function studioOriginConfig(env: { origin?: string | null; hosts?: string | null } = {}): StudioOriginConfig {
  const origin = normalizeOrigin(env.origin) ?? DEFAULT_STUDIO_ORIGIN;
  const authorized = parseHosts(env.hosts?.trim() ? env.hosts : DEFAULT_AUTHORIZED_HOSTS);
  return { origin, authorized };
}

/** The build's config (NEXT_PUBLIC_* so the landing links and the proxy agree). */
export const STUDIO_ORIGIN_CONFIG = studioOriginConfig({
  origin: process.env.NEXT_PUBLIC_STUDIO_ORIGIN,
  hosts: process.env.NEXT_PUBLIC_LOGIN_AUTHORIZED_HOSTS,
});

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

function parseHosts(value: string | null | undefined): string[] {
  return (value ?? "").split(",").map(item => item.trim().toLowerCase()).filter(Boolean);
}

/** `Host` header or `location.host` → bare lowercase hostname (no port, no trailing dot). */
export function hostnameOf(host: string | null | undefined): string {
  const raw = (host ?? "").trim().toLowerCase();
  if (raw.startsWith("[")) return raw.slice(0, raw.indexOf("]") + 1);
  return raw.split(":")[0].replace(/\.$/, "");
}

export function isLoginAuthorizedHost(host: string | null | undefined, config: StudioOriginConfig = STUDIO_ORIGIN_CONFIG): boolean {
  const name = hostnameOf(host);
  if (!name) return true; // Unknown host: never send anyone away on a guess.
  return config.authorized.some(entry => entry.startsWith(".") ? name === entry.slice(1) || name.endsWith(entry) : name === entry);
}

/** Pages that need the Comfy session: they must run on an authorized origin. */
export function needsAuthorizedOrigin(pathname: string, isDocument: boolean): boolean {
  if (/^\/(studio|mon-studio)(\/|$)/.test(pathname)) return true;
  // Comfy's own pages (login, sign-up, user check, post-login return) are proxied here.
  return isDocument && (/^\/(cloud|oauth)(\/|$)/.test(pathname) || pathname === "/login" || pathname === "/user-select");
}

/** `/studio?x=1#prise` on the authorized origin, with the hop marker and the language. */
export function authorizedUrl(pathAndQuery: string, locale: Locale | null, config: StudioOriginConfig = STUDIO_ORIGIN_CONFIG): string {
  const url = new URL(pathAndQuery || "/", config.origin);
  url.searchParams.set(HOP_PARAM, "1");
  if (locale) url.searchParams.set(LANG_PARAM, locale);
  return url.toString();
}

export type GateDecision =
  | { kind: "pass" }
  /** Unauthorized host: go to the authorized origin. */
  | { kind: "hop"; location: string }
  /** The hop came straight back (the authorized origin redirects here): explicit error, no loop. */
  | { kind: "loop"; retry: string }
  /** Authorized origin reached through a hop: drop the markers, keep the language. */
  | { kind: "land"; location: string; locale: Locale | null };

/**
 * One request, one decision. `url` is the request URL without basePath; `host` is the Host header.
 * Never returns a hop to the same host (a misconfigured origin cannot loop either).
 */
export function gateDecision(input: { url: URL; host: string | null; method: string; isDocument: boolean; hopCookie: boolean; locale: Locale | null }, config: StudioOriginConfig = STUDIO_ORIGIN_CONFIG): GateDecision {
  const { url, host, method } = input;
  if (method !== "GET" && method !== "HEAD") return { kind: "pass" };
  const marked = url.searchParams.has(HOP_PARAM);
  if (isLoginAuthorizedHost(host, config)) {
    if (!marked) return { kind: "pass" };
    const clean = new URL(url.toString());
    const lang = clean.searchParams.get(LANG_PARAM);
    clean.searchParams.delete(HOP_PARAM);
    clean.searchParams.delete(LANG_PARAM);
    return { kind: "land", location: `${clean.pathname}${clean.search}`, locale: isLocale(lang) ? lang : null };
  }
  if (!needsAuthorizedOrigin(url.pathname, input.isDocument)) return { kind: "pass" };
  const rest = new URL(url.toString());
  rest.searchParams.delete(HOP_PARAM);
  rest.searchParams.delete(LANG_PARAM);
  const target = authorizedUrl(`${rest.pathname}${rest.search}`, input.locale, config);
  if (hostnameOf(new URL(target).host) === hostnameOf(host)) return { kind: "pass" };
  if (marked || input.hopCookie) return { kind: "loop", retry: target };
  return { kind: "hop", location: target };
}

/** Landing links: the same path, made absolute on the authorized origin only when this host cannot log in. */
export function studioHref(path: string, currentHost: string | null, locale: Locale | null, config: StudioOriginConfig = STUDIO_ORIGIN_CONFIG): string {
  if (isLoginAuthorizedHost(currentHost, config)) return path;
  return authorizedUrl(path, locale, config);
}
