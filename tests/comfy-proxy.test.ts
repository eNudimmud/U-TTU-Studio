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
    for (const path of ["/", "/studio", "/comfy/c-micro-train-image.json", "/images/look.png", "/api/../studio", "/assets/../comfy/c-micro-prompt-test.json", "/?share=../secret"]) {
      assert.equal(await proxyComfy(new Request(`${STUDIO}${path}`), fetchImpl), null, path);
    }
    assert.equal(calls.length, 0);
  });

  it("loads only the validated share, and refuses anything else on that path", async () => {
    const { calls, fetchImpl } = install(() => new Response("<html></html>", { headers: { "content-type": "text/html" } }));
    const ok = await proxyComfy(new Request(`${STUDIO}/comfy-embed?share=${SHARE}&next=https://evil.example`), fetchImpl);
    assert.equal(ok?.status, 200);
    assert.equal(calls[0].url, `https://cloud.comfy.org/?share=${SHARE}`);
    assert.equal(calls[0].redirect, "manual");
    const denied = await proxyComfy(new Request(`${STUDIO}/comfy-embed?share=../secret`), fetchImpl);
    assert.equal(denied?.status, 404);
    assert.equal(calls.length, 1);
    const returned = await proxyComfy(new Request(`${STUDIO}/?share=${SHARE}`), fetchImpl);
    assert.equal(returned?.status, 200);
    assert.equal(calls.at(-1)?.url, `https://cloud.comfy.org/?share=${SHARE}`);
    const login = await proxyComfy(new Request(`${STUDIO}/cloud/login?previousFullPath=%2F`), fetchImpl);
    assert.equal(login?.status, 200);
    assert.equal(calls.at(-1)?.url, "https://cloud.comfy.org/cloud/login?previousFullPath=%2F");
  });

  it("injects the media worker boot into the Comfy document and echoes this origin", async () => {
    const html = "<!doctype html><html><head><title>Comfy</title><script type=\"module\" crossorigin src=\"/assets/index-abc.js\"></script></head><body></body></html>";
    const { fetchImpl } = install(new Response(html, {
      headers: {
        "content-type": "text/html",
        "access-control-allow-origin": "https://cloud.comfy.org",
        "access-control-allow-credentials": "true",
      },
    }));
    const response = await proxyComfy(new Request(`${STUDIO}/comfy-embed?share=${SHARE}`), fetchImpl);
    const text = await response?.text() ?? "";
    assert.match(text, /serviceWorker\.register\("\/comfy-media-sw\.js"\)/);
    assert.ok(text.indexOf("serviceWorker.register") < text.indexOf("<title>"));
    assert.equal(response?.headers.get("access-control-allow-origin"), STUDIO);
    assert.equal(response?.headers.get("access-control-allow-credentials"), "true");
    const worker = readFileSync("public/comfy-media-sw.js", "utf8");
    assert.match(worker, /\/api\/view/);
    assert.match(worker, /\/api\/assets\//);
    assert.match(worker, /\/api\/s\//);
    assert.match(text, /comfy-token-ack/);
    assert.match(text, /firebaseLocalStorageDb/);
    assert.match(text, /__Host-uttu_media/);
    assert.match(text, /createObjectURL/);
    assert.match(text, /comfy-media-file/);
    assert.match(text, /\?filename=/);
    assert.match(text, /uttu-media-note/);
    assert.match(text, /x-api-key/);
    assert.match(text, /el\.preload = "auto"/);
    assert.ok(text.indexOf("hookFetch()") < text.indexOf("import("), "the list Authorization is captured before Comfy starts");
    assert.ok(text.indexOf("__Host-uttu_media") < text.indexOf("import("), "the media cookie is written before Comfy starts");
    assert.match(text, /script\[data-comfy-main\]/);
    assert.match(text, /type="text\/plain" data-comfy-main crossorigin src="\/assets\/index-abc\.js"/);
    assert.doesNotMatch(text, /type="module" crossorigin src=/);
    assert.match(worker, /Bearer /);
    assert.doesNotMatch(worker, /no-cors/);
    assert.doesNotMatch(worker, /x-comfy-media-redirect/);
    assert.doesNotMatch(worker, /https:\/\/cloud\.comfy\.org/);
    const panel = readFileSync("src/components/guide/comfy-run-panel.tsx", "utf8");
    assert.match(panel, /serviceWorker\.register\(COMFY_MEDIA_SW\)/);
  });

  it("streams a storage redirect as same-origin bytes for cookie and bearer", async () => {
    const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    const signed = "https://storage.googleapis.com/bucket/file.png?X-Goog-Signature=abc";
    const calls: { url: string; headers: Headers }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      calls.push({ url: String(input), headers });
      if (String(input) === signed) {
        return new Response(png, { status: 206, headers: { "content-type": "image/png", "content-length": String(png.byteLength), "content-range": "bytes 0-2/3", "accept-ranges": "bytes" } });
      }
      const redirect = new Headers({ location: signed });
      redirect.append("set-cookie", "__Host-comfy_session=abc; HttpOnly; Secure; Path=/; SameSite=Lax; Domain=cloud.comfy.org");
      return new Response(null, { status: 302, headers: redirect });
    };
    const authed = await proxyComfy(new Request(`${STUDIO}/api/view?filename=a.png&type=output`, {
      headers: { authorization: "Bearer firebase-token", range: "bytes=0-2", accept: "image/png" },
    }), fetchImpl);
    assert.equal(authed?.status, 206);
    assert.equal(authed?.headers.get("content-type"), "image/png");
    assert.equal(authed?.headers.get("location"), null);
    assert.equal(authed?.headers.get("x-comfy-media-redirect"), null);
    assert.deepEqual(new Uint8Array(await authed?.arrayBuffer() ?? new ArrayBuffer(0)), png);
    assert.equal(calls[1]?.url, signed);
    assert.equal(calls[1]?.headers.get("range"), "bytes=0-2");
    assert.equal(calls[1]?.headers.get("authorization"), null);
    assert.equal(calls[1]?.headers.get("cookie"), null);
    const cookie = authed?.headers.getSetCookie() ?? [];
    assert.match(cookie[0] ?? "", /__Host-comfy_session=abc/);
    assert.doesNotMatch(cookie[0] ?? "", /domain=/i);
    const login = await proxyComfy(new Request(`${STUDIO}/login`, {
      headers: { authorization: "Bearer firebase-token" },
    }), fetchImpl);
    assert.equal(login?.status, 302);
    assert.equal(login?.headers.get("content-type"), null);
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

  it("turns the page media cookie into a bearer on thumbnail and video GETs", async () => {
    const png = new Uint8Array([137, 80, 78, 71, 9, 9, 9]);
    const mp4 = new Uint8Array([0, 0, 0, 32, 102, 116, 121, 112]);
    const signed = "https://storage.googleapis.com/bucket/thumb.png?X-Goog-Signature=abc";
    const calls: { url: string; headers: Headers }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      calls.push({ url: String(input), headers });
      if (String(input) === signed) return new Response(png, { headers: { "content-type": "image/png" } });
      if (headers.get("authorization") !== "Bearer good.token") {
        return new Response(JSON.stringify({ message: "authentication required" }), { status: 401, headers: { "content-type": "application/json" } });
      }
      if (String(input).includes("/content")) return new Response(mp4, { headers: { "content-type": "video/mp4", "accept-ranges": "bytes" } });
      return new Response(null, { status: 302, headers: { location: signed } });
    };
    const thumb = await proxyComfy(new Request(`${STUDIO}/api/view?filename=ComfyUI_00002_.png&type=output`, {
      headers: { cookie: "__session=clerk; __Host-uttu_media=good.token" },
    }), fetchImpl);
    assert.equal(thumb?.status, 200);
    assert.equal(thumb?.headers.get("content-type"), "image/png");
    assert.deepEqual(new Uint8Array(await thumb?.arrayBuffer() ?? new ArrayBuffer(0)), png);
    assert.equal(calls[0]?.headers.get("authorization"), "Bearer good.token");
    assert.equal(calls[0]?.headers.get("cookie"), null);
    assert.equal(calls[1]?.headers.get("authorization"), null);
    const video = await proxyComfy(new Request(`${STUDIO}/api/assets/wan-id/content?disposition=inline`, {
      headers: { cookie: "__Host-uttu_media=" + encodeURIComponent("good.token") },
    }), fetchImpl);
    assert.equal(video?.status, 200);
    assert.equal(video?.headers.get("content-type"), "video/mp4");
    assert.deepEqual(new Uint8Array(await video?.arrayBuffer() ?? new ArrayBuffer(0)), mp4);
    const list = await proxyComfy(new Request(`${STUDIO}/api/settings`, {
      headers: { cookie: "__Host-uttu_media=good.token" },
    }), fetchImpl);
    assert.equal(list?.status, 401);
    assert.equal(calls.at(-1)?.headers.get("authorization"), null);
  });

  it("serves a signed storage thumbnail from this origin and refuses other hosts", async () => {
    const png = new Uint8Array([137, 80, 78, 71, 4, 4, 4]);
    const signed = "https://storage.googleapis.com/bucket/thumb.png?X-Goog-Signature=abc";
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push(String(input));
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), null);
      assert.equal(headers.get("cookie"), null);
      if (String(input) === signed) return new Response(png, { headers: { "content-type": "image/png" } });
      return new Response("no", { status: 404 });
    };
    const ok = await proxyComfy(new Request(`${STUDIO}/comfy-media-file?u=${encodeURIComponent(signed)}`), fetchImpl);
    assert.equal(ok?.status, 200);
    assert.equal(ok?.headers.get("content-type"), "image/png");
    assert.deepEqual(new Uint8Array(await ok?.arrayBuffer() ?? new ArrayBuffer(0)), png);
    assert.deepEqual(calls, [signed]);
    for (const blocked of ["https://evil.example/file.png", "https://169.254.169.254/latest", "http://storage.googleapis.com/bucket/a.png", "https://cloud.comfy.org/api/view?filename=a.png", "https://storage.googleapis.com.evil.example/a.png"]) {
      const denied = await proxyComfy(new Request(`${STUDIO}/comfy-media-file?u=${encodeURIComponent(blocked)}`), fetchImpl);
      assert.equal(denied?.status, 400, blocked);
    }
    assert.equal(calls.length, 1);
  });

  it("streams storage bytes and rewrites a redirect back onto this host", async () => {
    const mp4 = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);
    const signed = "https://storage.googleapis.com/bucket/ComfyUI_00002_.png?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Signature=abc";
    const fetchImpl: typeof fetch = async (input) => {
      if (String(input) === signed) return new Response(mp4, { headers: { "content-type": "video/mp4", "accept-ranges": "bytes" } });
      const gcs = new Headers({ location: signed });
      gcs.append("set-cookie", "__Host-comfy_session=abc; HttpOnly; Secure; Path=/; SameSite=Lax");
      gcs.append("set-cookie", "fe_canary=stable.11; Domain=cloud.comfy.org; Path=/; HttpOnly; Secure; SameSite=Lax");
      gcs.set("content-encoding", "gzip");
      return new Response(null, { status: 302, headers: gcs });
    };
    const view = await proxyComfy(new Request(`${STUDIO}/api/view?filename=video/MiniMax_H3_00001_.mp4&type=output&subfolder=`), fetchImpl);
    assert.equal(view?.status, 200);
    assert.equal(view?.headers.get("content-type"), "video/mp4");
    assert.equal(view?.headers.get("location"), null);
    assert.equal(view?.headers.get("content-encoding"), null);
    assert.deepEqual(new Uint8Array(await view?.arrayBuffer() ?? new ArrayBuffer(0)), mp4);
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
    const internal = install(() => new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest" } }));
    const blocked = await proxyComfy(new Request(`${STUDIO}/api/view?filename=a.png`), internal.fetchImpl);
    assert.equal(blocked?.status, 302);
    assert.equal(internal.calls.length, 1);
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
    assert.equal(followed, 3);
    assert.equal(redirected?.status, 502);
  });

  it("rejoins a subfolder onto a 404 /api/view and does not search assets", async () => {
    const png = new Uint8Array([137, 80, 78, 71, 7, 7, 7]);
    const signed = "https://storage.googleapis.com/bucket/c-micro/avec-lora_00001_.png?X-Goog-Signature=abc";
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push(String(input));
      const url = new URL(String(input));
      if (url.pathname === "/api/view" && url.searchParams.get("filename") === "c-micro/avec-lora_00001_.png") {
        return new Response(null, { status: 302, headers: { location: signed } });
      }
      if (String(input) === signed) {
        assert.equal(new Headers(init?.headers).get("authorization"), null);
        return new Response(png, { headers: { "content-type": "image/png" } });
      }
      return new Response(JSON.stringify({ error: "File not found or unauthorized" }), { status: 404, headers: { "content-type": "application/json" } });
    };
    const response = await proxyComfy(new Request(`${STUDIO}/api/view?filename=avec-lora_00001_.png&type=output&subfolder=c-micro`, {
      headers: { authorization: "Bearer firebase-token" },
    }), fetchImpl);
    assert.equal(response?.status, 200);
    assert.equal(response?.headers.get("content-type"), "image/png");
    assert.deepEqual(new Uint8Array(await response?.arrayBuffer() ?? new ArrayBuffer(0)), png);
    assert.equal(calls.some(url => url.includes("/api/assets")), false);
    assert.match(calls[1] ?? "", /filename=c-micro%2Favec-lora_00001_\.png/);
  });

  it("loads a missed /api/view from the same-auth asset content", async () => {
    const png = new Uint8Array([137, 80, 78, 71, 8, 8, 8]);
    const id = "11111111-1111-4111-8111-111111111111";
    const calls: { url: string; headers: Headers }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      const url = String(input);
      calls.push({ url, headers });
      if (url.startsWith("https://cloud.comfy.org/api/view")) {
        return new Response(JSON.stringify({ error: "File not found or unauthorized" }), { status: 404, headers: { "content-type": "application/json" } });
      }
      if (url.startsWith("https://cloud.comfy.org/api/assets?")) {
        assert.equal(headers.get("authorization"), "Bearer firebase-token");
        assert.equal(headers.get("x-api-key"), null);
        return new Response(JSON.stringify({
          assets: [
            { id: "not-a-uuid", name: "c-micro/loss_00001_.png" },
            { id, name: "c-micro/loss_00001_.png" },
          ],
        }), { headers: { "content-type": "application/json" } });
      }
      if (url === `https://cloud.comfy.org/api/assets/${id}/content?disposition=inline`) {
        assert.equal(headers.get("authorization"), "Bearer firebase-token");
        return new Response(png, { headers: { "content-type": "image/png" } });
      }
      return new Response("no", { status: 500 });
    };
    const response = await proxyComfy(new Request(`${STUDIO}/api/view?filename=loss_00001_.png&type=output&subfolder=c-micro`, {
      headers: { authorization: "Bearer firebase-token" },
    }), fetchImpl);
    assert.equal(response?.status, 200);
    assert.deepEqual(new Uint8Array(await response?.arrayBuffer() ?? new ArrayBuffer(0)), png);
    assert.equal(calls.filter(call => call.url.includes("/api/assets?")).length, 1);
    const listed = new URL(calls.find(call => call.url.includes("/api/assets?"))?.url ?? "");
    assert.equal(listed.searchParams.get("name_contains"), "c-micro/loss_00001_.png");
  });

  it("keeps a real /api/view 404 when the asset body is not a file", async () => {
    const miss = JSON.stringify({ error: "File not found or unauthorized" });
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.startsWith("https://cloud.comfy.org/api/assets?")) {
        return new Response(JSON.stringify({
          assets: [{ id: "22222222-2222-4222-8222-222222222222", name: "missing.png" }],
        }), { headers: { "content-type": "application/json" } });
      }
      if (url.includes("/content")) {
        return new Response(JSON.stringify({ error: "nope" }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(miss, { status: 404, headers: { "content-type": "application/json" } });
    };
    const response = await proxyComfy(new Request(`${STUDIO}/api/view?filename=missing.png&type=output`, {
      headers: { "x-api-key": "workspace-key" },
    }), fetchImpl);
    assert.equal(response?.status, 404);
    assert.equal(await response?.text(), miss);
    assert.equal(calls[0], "https://cloud.comfy.org/api/view?filename=missing.png&type=output");
    const open = await proxyComfy(new Request(`${STUDIO}/api/view?filename=missing.png&type=output`), fetchImpl);
    assert.equal(open?.status, 404);
    assert.equal(calls.filter(url => url.includes("filename=missing.png")).length, 2);
    const climbed = await proxyComfy(new Request(`${STUDIO}/api/view?filename=..%2Fsecret.png`, {
      headers: { authorization: "Bearer firebase-token" },
    }), fetchImpl);
    assert.equal(climbed?.status, 404);
    assert.equal(calls.filter(url => url.includes("secret")).length, 1);
  });

  it("retries a bearer 404 with the Comfy cookie before listing assets", async () => {
    const png = new Uint8Array([137, 80, 78, 71, 6, 6, 6]);
    const calls: { url: string; authorization: string | null; cookie: string | null }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      calls.push({ url: String(input), authorization: headers.get("authorization"), cookie: headers.get("cookie") });
      if (headers.get("authorization")) {
        return new Response(JSON.stringify({ error: "File not found or unauthorized" }), { status: 404, headers: { "content-type": "application/json" } });
      }
      return new Response(png, { headers: { "content-type": "image/png" } });
    };
    const response = await proxyComfy(new Request(`${STUDIO}/api/viewvideo?filename=clip.mp4&type=output`, {
      headers: { authorization: "Bearer firebase-token", cookie: "__Host-comfy_session=media; __session=clerk" },
    }), fetchImpl);
    assert.equal(response?.status, 200);
    assert.deepEqual(new Uint8Array(await response?.arrayBuffer() ?? new ArrayBuffer(0)), png);
    assert.equal(calls[1]?.authorization, null);
    assert.equal(calls[1]?.cookie, "__Host-comfy_session=media");
    assert.equal(calls.some(call => call.url.includes("/api/assets")), false);
  });
});
