import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { comfyEmbedHref, proxyComfy, rewriteProxiedText } from "../src/lib/comfy-proxy.ts";

const STUDIO = "https://u-ttu-studio.vercel.app";
const SHARE = "25954f3b0278";

interface Call { url: string; method: string; headers: Headers; redirect?: RequestRedirect; body?: string }

function install(response: Response | (() => Response | Promise<Response>)) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers,
      redirect: init?.redirect,
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    return typeof response === "function" ? response() : response;
  };
  return { calls, fetchImpl };
}

describe("Comfy same-origin embed", () => {
  it("keeps the full-tab link on cloud.comfy.org and points the frame at this host", () => {
    assert.equal(comfyEmbedHref(`https://cloud.comfy.org/?share=${SHARE}`), `/comfy-embed?share=${SHARE}`);
    assert.equal(comfyEmbedHref("https://evil.example/?share=25954f3b0278"), null);
    assert.equal(comfyEmbedHref("https://cloud.comfy.org/"), null);
    const panel = readFileSync("src/components/guide/comfy-run-panel.tsx", "utf8");
    assert.match(panel, /comfyEmbedHref/);
    assert.match(panel, /href=\{url\}/);
    assert.doesNotMatch(panel, /src=\{url\}/);
    const proxy = readFileSync("src/proxy.ts", "utf8");
    assert.ok(proxy.indexOf("proxyComfy") < proxy.indexOf("withClerk"), "Comfy runs before Clerk");
    assert.match(proxy, /\/assets\/:path\*/);
    assert.match(proxy, /\/fonts\/:path\*/);
  });

  it("does not proxy the studio, its workflow files, or a path that climbs out", async () => {
    const { calls, fetchImpl } = install(new Response("no"));
    for (const path of ["/studio", "/comfy/c-micro-train-image.json", "/images/look.png", "/api/../studio", "/assets/../comfy/c-micro-prompt-test.json"]) {
      assert.equal(await proxyComfy(new Request(`${STUDIO}${path}`), fetchImpl), null, path);
    }
    assert.equal(calls.length, 0);
  });

  it("loads only the validated share, and refuses anything else on that path", async () => {
    const { calls, fetchImpl } = install(new Response("<html></html>", { headers: { "content-type": "text/html" } }));
    const ok = await proxyComfy(new Request(`${STUDIO}/comfy-embed?share=${SHARE}&next=https://evil.example`), fetchImpl);
    assert.equal(ok?.status, 200);
    assert.equal(calls[0].url, `https://cloud.comfy.org/?share=${SHARE}`);
    assert.equal(calls[0].redirect, "manual");
    const denied = await proxyComfy(new Request(`${STUDIO}/comfy-embed?share=../secret`), fetchImpl);
    assert.equal(denied?.status, 404);
    assert.equal(calls.length, 1);
  });

  it("forwards the Comfy media cookie and the bearer token, not the Clerk session", async () => {
    const { calls, fetchImpl } = install(new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } }));
    const response = await proxyComfy(new Request(`${STUDIO}/api/view?filename=ComfyUI_00002_.png&type=output&subfolder=`, {
      headers: {
        cookie: "__session=clerk-secret; __Host-comfy_session=media; fe_canary=stable.11; __clerk_db_jwt=jwt",
        authorization: "Bearer firebase-token",
        origin: STUDIO,
        referer: `${STUDIO}/comfy-embed?share=${SHARE}`,
      },
    }), fetchImpl);
    assert.equal(response?.status, 200);
    assert.equal(calls[0].url, "https://cloud.comfy.org/api/view?filename=ComfyUI_00002_.png&type=output&subfolder=");
    assert.equal(calls[0].headers.get("cookie"), "__Host-comfy_session=media; fe_canary=stable.11");
    assert.equal(calls[0].headers.get("authorization"), "Bearer firebase-token");
    assert.equal(calls[0].headers.get("origin"), "https://cloud.comfy.org");
    assert.equal(calls[0].headers.get("referer"), `https://cloud.comfy.org/comfy-embed?share=${SHARE}`);
    assert.equal(await response?.text(), "{\"ok\":true}");
  });

  it("passes a storage redirect through and rewrites a redirect back onto this host", async () => {
    const gcs = new Headers({ location: "https://storage.googleapis.com/bucket/ComfyUI_00002_.png?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Signature=abc" });
    gcs.append("set-cookie", "__Host-comfy_session=abc; HttpOnly; Secure; Path=/; SameSite=Lax");
    gcs.append("set-cookie", "fe_canary=stable.11; Domain=cloud.comfy.org; Path=/; HttpOnly; Secure; SameSite=Lax");
    gcs.set("content-encoding", "gzip");
    const { calls, fetchImpl } = install(new Response(null, { status: 302, headers: gcs }));
    const view = await proxyComfy(new Request(`${STUDIO}/api/view?filename=video/MiniMax_H3_00001_.mp4&type=output&subfolder=`), fetchImpl);
    assert.equal(view?.status, 302);
    assert.equal(calls.length, 1);
    assert.equal(view?.headers.get("location"), "https://storage.googleapis.com/bucket/ComfyUI_00002_.png?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Signature=abc");
    assert.equal(view?.headers.get("content-encoding"), null);
    const cookies = view?.headers.getSetCookie() ?? [];
    assert.equal(cookies.length, 2);
    assert.match(cookies[0], /__Host-comfy_session=abc/);
    assert.doesNotMatch(cookies[0], /domain=/i);
    assert.match(cookies[1], /fe_canary=stable\.11/);
    assert.doesNotMatch(cookies[1], /domain=/i);

    const back = new Headers({ location: "https://cloud.comfy.org/api/auth/session" });
    const again = install(new Response(null, { status: 302, headers: back }));
    const login = await proxyComfy(new Request(`${STUDIO}/api/auth/session`, { method: "POST" }), again.fetchImpl);
    assert.equal(login?.headers.get("location"), `${STUDIO}/api/auth/session`);
  });

  it("rewrites absolute Comfy media URLs in JSON and leaves signed storage URLs alone", async () => {
    const payload = JSON.stringify({
      name: "c-micro/test-prompt_00001_.png",
      preview_url: "https://cloud.comfy.org/api/view?filename=c-micro%2Ftest-prompt_00001_.png&type=output&subfolder=",
      signed: "https://storage.googleapis.com/bucket/c-micro/test-prompt_00001_.png?X-Goog-Signature=abc",
    }).replaceAll("https://cloud.comfy.org", "https:\\/\\/cloud.comfy.org");
    const { fetchImpl } = install(new Response(payload, { headers: { "content-type": "application/json; charset=utf-8", etag: "\"abc\"", "content-encoding": "gzip" } }));
    const response = await proxyComfy(new Request(`${STUDIO}/api/assets`), fetchImpl);
    const text = await response?.text();
    assert.equal(text, payload.replaceAll("https:\\/\\/cloud.comfy.org", "https:\\/\\/u-ttu-studio.vercel.app"));
    assert.match(text ?? "", /storage\.googleapis\.com\/bucket\/c-micro/);
    assert.equal(text?.includes("cloud.comfy.org"), false);
    const plain = JSON.stringify({ preview_url: "https://cloud.comfy.org/api/view?filename=ComfyUI_00002_.png&type=output&subfolder=" });
    const direct = install(new Response(plain, { headers: { "content-type": "application/json" } }));
    const rendered = await (await proxyComfy(new Request(`${STUDIO}/api/assets`), direct.fetchImpl))?.text();
    assert.equal(rendered, plain.replaceAll("https://cloud.comfy.org", STUDIO));
    assert.equal(response?.headers.get("content-encoding"), null);
    assert.equal(response?.headers.get("etag"), null);
  });

  it("lets Google sign-in render on a vercel.app host without rewriting other comfy.org URLs", async () => {
    const source = "var U=/\\.comfy\\.org$/;var docs=`https://docs.comfy.org/interface/user`";
    const parts = [source.slice(0, 12), source.slice(12)];
    const stream = new ReadableStream({
      start(controller) {
        for (const part of parts) controller.enqueue(new TextEncoder().encode(part));
        controller.close();
      },
    });
    const { fetchImpl } = install(new Response(stream, { headers: { "content-type": "text/javascript" } }));
    const response = await proxyComfy(new Request(`${STUDIO}/assets/SignInContent.js`), fetchImpl);
    const text = await response?.text();
    assert.equal(text, source.replace("/\\.comfy\\.org$/", "/\\.(?:comfy\\.org|vercel\\.app)$/"));
    assert.match(text ?? "", /https:\/\/docs\.comfy\.org\/interface\/user/);
    assert.equal(rewriteProxiedText("plain", []), "plain");
  });

  it("proxies icon fonts and streams an image without reading it as text", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 0, 255]);
    const { calls, fetchImpl } = install(new Response(bytes, { headers: { "content-type": "image/png", "content-encoding": "gzip" } }));
    const font = await proxyComfy(new Request(`${STUDIO}/fonts/materialdesignicons-webfont.woff2?v=7.4.47`), fetchImpl);
    assert.equal(font?.status, 200);
    assert.equal(calls[0].url, "https://cloud.comfy.org/fonts/materialdesignicons-webfont.woff2?v=7.4.47");
    assert.deepEqual([...(new Uint8Array(await font?.arrayBuffer() ?? new ArrayBuffer(0)))], [...bytes]);
    assert.equal(font?.headers.get("content-encoding"), null);
  });

  it("returns 502 when Comfy cannot be reached and does not follow its redirect", async () => {
    const failing: typeof fetch = async () => { throw new Error("down"); };
    const down = await proxyComfy(new Request(`${STUDIO}/assets/index.js`), failing);
    assert.equal(down?.status, 502);
    let followed = 0;
    const once: typeof fetch = async () => {
      followed += 1;
      return new Response(null, { status: 302, headers: { location: "https://storage.googleapis.com/bucket/x.png" } });
    };
    const redirected = await proxyComfy(new Request(`${STUDIO}/api/view?filename=ComfyUI_00002_.png`), once);
    assert.equal(followed, 1);
    assert.equal(redirected?.status, 302);
  });
});
