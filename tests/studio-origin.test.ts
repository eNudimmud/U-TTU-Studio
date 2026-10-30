import test from "node:test";
import assert from "node:assert/strict";
import { authorizedUrl, gateDecision, hostnameOf, isLoginAuthorizedHost, studioHref, studioOriginConfig, HOP_PARAM, LANG_PARAM } from "../src/lib/studio-origin.ts";
import { isDocumentRequest, studioOriginGate } from "../src/lib/studio-origin-gate.ts";
import { loopCopy } from "../src/lib/studio-origin-page.ts";

const config = studioOriginConfig({});
const req = (url: string, init: { host?: string; method?: string; dest?: string; cookie?: string; accept?: string; xhr?: boolean } = {}) => {
  const headers = new Headers();
  headers.set("host", init.host ?? new URL(url).host);
  if (init.dest) headers.set("sec-fetch-dest", init.dest);
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.accept) headers.set("accept", init.accept);
  if (init.xhr) headers.set("x-requested-with", "XMLHttpRequest");
  return new Request(url, { method: init.method ?? "GET", headers });
};

test("defaults: the studio origin is the authorized vercel.app host", () => {
  assert.equal(config.origin, "https://u-ttu-studio.vercel.app");
  assert.equal(studioOriginConfig({ origin: "not a url" }).origin, "https://u-ttu-studio.vercel.app");
  assert.equal(studioOriginConfig({ origin: "https://uttu-studio.app/studio" }).origin, "https://uttu-studio.app");
});

test("authorized hosts: vercel.app (and previews), localhost; not uttu-studio.app", () => {
  for (const host of ["u-ttu-studio.vercel.app", "u-ttu-studio-git-x-enudimmud.vercel.app", "localhost:3000", "127.0.0.1:3000", "[::1]:3000", "U-TTU-STUDIO.VERCEL.APP."]) assert.equal(isLoginAuthorizedHost(host, config), true, host);
  for (const host of ["uttu-studio.app", "www.uttu-studio.app", "uttu-studio.app:443", "evilvercel.app", "vercel.app.evil.com"]) assert.equal(isLoginAuthorizedHost(host, config), false, host);
  assert.equal(hostnameOf("[::1]:3000"), "[::1]");
});

test("the allowlist is configurable: once Comfy adds uttu-studio.app, no more hop", () => {
  const later = studioOriginConfig({ hosts: ".vercel.app,uttu-studio.app,www.uttu-studio.app" });
  assert.equal(isLoginAuthorizedHost("uttu-studio.app", later), true);
  assert.equal(studioHref("/studio", "uttu-studio.app", "fr", later), "/studio");
});

test("landing links: relative where login works, absolute with language elsewhere", () => {
  assert.equal(studioHref("/studio", "u-ttu-studio.vercel.app", "de", config), "/studio");
  const href = new URL(studioHref("/studio?uttu=1", "uttu-studio.app", "de", config));
  assert.equal(href.origin, "https://u-ttu-studio.vercel.app");
  assert.equal(href.pathname, "/studio");
  assert.equal(href.searchParams.get("uttu"), "1");
  assert.equal(href.searchParams.get(HOP_PARAM), "1");
  assert.equal(href.searchParams.get(LANG_PARAM), "de");
});

test("gate: unauthorized host sends /studio, /mon-studio and Comfy login pages to the authorized origin", () => {
  const base = { method: "GET", hopCookie: false, locale: "es" as const };
  const hop = gateDecision({ ...base, url: new URL("https://uttu-studio.app/studio?step=prise"), host: "uttu-studio.app", isDocument: true }, config);
  assert.equal(hop.kind, "hop");
  if (hop.kind === "hop") assert.equal(hop.location, "https://u-ttu-studio.vercel.app/studio?step=prise&uttu_hop=1&uttu_lang=es");
  for (const path of ["/studio/", "/mon-studio", "/cloud/login", "/oauth/x", "/login"]) {
    assert.equal(gateDecision({ ...base, url: new URL(`https://uttu-studio.app${path}`), host: "uttu-studio.app", isDocument: true }, config).kind, "hop", path);
  }
  // The landing, assets and APIs stay on the public domain.
  for (const path of ["/", "/studios", "/api/view", "/images/a.webp", "/studio-agent/chat"]) {
    assert.equal(gateDecision({ ...base, url: new URL(`https://uttu-studio.app${path}`), host: "uttu-studio.app", isDocument: true }, config).kind, "pass", path);
  }
  assert.equal(gateDecision({ ...base, url: new URL("https://uttu-studio.app/cloud/login"), host: "uttu-studio.app", isDocument: false }, config).kind, "pass");
  assert.equal(gateDecision({ ...base, method: "POST", url: new URL("https://uttu-studio.app/studio"), host: "uttu-studio.app", isDocument: true }, config).kind, "pass");
});

test("gate: a hop that comes straight back is an explicit error, never a second redirect", () => {
  const back = gateDecision({ url: new URL("https://uttu-studio.app/studio?uttu_hop=1&uttu_lang=fr"), host: "uttu-studio.app", method: "GET", isDocument: true, hopCookie: false, locale: null }, config);
  assert.equal(back.kind, "loop");
  if (back.kind === "loop") assert.equal(back.retry, "https://u-ttu-studio.vercel.app/studio?uttu_hop=1");
  // Query dropped by the bounce: the short-lived cookie still catches it.
  assert.equal(gateDecision({ url: new URL("https://uttu-studio.app/studio"), host: "uttu-studio.app", method: "GET", isDocument: true, hopCookie: true, locale: null }, config).kind, "loop");
});

test("gate: a misconfigured origin on the same host never redirects to itself", () => {
  const self = studioOriginConfig({ origin: "https://uttu-studio.app", hosts: ".vercel.app" });
  assert.equal(gateDecision({ url: new URL("https://uttu-studio.app/studio"), host: "uttu-studio.app", method: "GET", isDocument: true, hopCookie: false, locale: null }, self).kind, "pass");
});

test("gate: on the authorized origin the markers are dropped and the language kept", () => {
  const land = gateDecision({ url: new URL("https://u-ttu-studio.vercel.app/studio?uttu=1&uttu_hop=1&uttu_lang=en"), host: "u-ttu-studio.vercel.app", method: "GET", isDocument: true, hopCookie: false, locale: null }, config);
  assert.deepEqual(land, { kind: "land", location: "/studio?uttu=1", locale: "en" });
  assert.equal(gateDecision({ url: new URL("https://u-ttu-studio.vercel.app/studio"), host: "u-ttu-studio.vercel.app", method: "GET", isDocument: true, hopCookie: false, locale: null }, config).kind, "pass");
});

test("proxy responses: 307 with marker cookie, landing sets language, loop page is 508 with two 44px actions", async () => {
  const hop = studioOriginGate(req("https://uttu-studio.app/studio#prise", { dest: "document", cookie: "u-ttu-locale=de" }), { basePath: "", config });
  assert.equal(hop?.status, 307);
  assert.equal(hop?.headers.get("location"), "https://u-ttu-studio.vercel.app/studio?uttu_hop=1&uttu_lang=de");
  assert.match(hop?.headers.get("set-cookie") ?? "", /u-ttu-hop=1; Path=\/; Max-Age=20/);

  const land = studioOriginGate(req("https://u-ttu-studio.vercel.app/studio?uttu_hop=1&uttu_lang=de"), { basePath: "", config });
  assert.equal(land?.status, 307);
  assert.equal(land?.headers.get("location"), "https://u-ttu-studio.vercel.app/studio");
  assert.match(land?.headers.get("set-cookie") ?? "", /u-ttu-locale=de/);

  const loop = studioOriginGate(req("https://uttu-studio.app/studio?uttu_hop=1", { dest: "document", cookie: "u-ttu-locale=es" }), { basePath: "", config });
  assert.equal(loop?.status, 508);
  const html = await loop!.text();
  assert.ok(html.includes(loopCopy("es").title));
  assert.ok(html.includes('data-loop-retry="" href="https://u-ttu-studio.vercel.app/studio?uttu_hop=1&amp;uttu_lang=es"'));
  assert.match(html, /min-height:44px/);

  assert.equal(studioOriginGate(req("https://uttu-studio.app/"), { basePath: "", config }), null);
  assert.equal(studioOriginGate(req("http://127.0.0.1:3000/studio"), { basePath: "", config }), null);
});

test("loop copy exists in FR, EN, DE, ES", () => {
  for (const locale of ["fr", "en", "de", "es"] as const) {
    const copy = loopCopy(locale);
    for (const value of Object.values(copy)) assert.ok(value.trim().length > 0);
  }
  assert.notEqual(loopCopy("fr").title, loopCopy("en").title);
});

test("login pages on the public domain redirect without browser headers too (curl, link checkers)", () => {
  const paths = ["/cloud", "/cloud/login", "/cloud/signup", "/oauth/callback?code=x", "/login", "/user-select", "/mon-studio", "/studio"];
  for (const path of paths) {
    for (const accept of [undefined, "*/*", "text/html,application/xhtml+xml,*/*;q=0.8"]) {
      const response = studioOriginGate(req(`https://uttu-studio.app${path}`, { accept }), { basePath: "", config });
      assert.equal(response?.status, 307, `${path} accept=${accept}`);
      const location = new URL(response!.headers.get("location")!);
      assert.equal(location.origin, "https://u-ttu-studio.vercel.app");
      assert.equal(location.pathname, path.split("?")[0]);
    }
  }
  // A fetch, a frame or an explicit non-page request stays on the proxy.
  for (const init of [{ dest: "empty" }, { dest: "iframe" }, { accept: "application/json" }, { xhr: true, accept: "*/*" }]) {
    assert.equal(studioOriginGate(req("https://uttu-studio.app/cloud/login", init), { basePath: "", config }), null, JSON.stringify(init));
  }
  assert.equal(studioOriginGate(req("https://uttu-studio.app/"), { basePath: "", config }), null);
  assert.equal(studioOriginGate(req("https://uttu-studio.app/api/x", { accept: "*/*" }), { basePath: "", config }), null);
});

test("document detection", () => {
  const h = (init: Record<string, string>) => new Headers(init);
  assert.equal(isDocumentRequest(h({ "sec-fetch-dest": "document" })), true);
  assert.equal(isDocumentRequest(h({ "sec-fetch-dest": "image", accept: "text/html" })), false);
  assert.equal(isDocumentRequest(h({})), true);
  assert.equal(isDocumentRequest(h({ accept: "*/*" })), true);
  assert.equal(isDocumentRequest(h({ accept: "image/webp" })), false);
});
