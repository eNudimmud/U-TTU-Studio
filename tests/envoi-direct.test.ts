import assert from "node:assert/strict";
import test from "node:test";
import { handleUpload } from "@vercel/blob/client";
import { DIRECT_MAX_BYTES, DIRECT_TYPES, authenticate, directConfigured, handToComfy, pathAllowed, tokenRules, type BlobOps } from "../src/lib/envoi-direct/server.ts";
import { DIRECT_FAILED, directName, directType } from "../src/lib/envoi-direct/client.ts";
import { createRenderClient } from "../src/lib/render/client.ts";
import { FINAL_TOO_HEAVY } from "../src/lib/render/prepare-upload.ts";
import { UPLOAD_MAX_BYTES } from "../src/lib/render/upload-limit.ts";
import { phrase } from "../src/lib/i18n/phrase.ts";

// A made-up read-write token, shaped like Vercel's: never a real secret.
const FAKE_TOKEN = "vercel_blob_rw_teststore123_" + "x".repeat(32);
const KEY = "k".repeat(24);
const SCOPE_RE = /^[a-f0-9]{24}$/;
const userOk = (async (url: unknown) => String(url).endsWith("/api/user") ? Response.json({ id: "user-42" }) : new Response("no", { status: 500 })) as typeof fetch;
const req = (path: string, init: RequestInit = {}) => new Request(`https://studio.test${path}`, init);

test("without BLOB_READ_WRITE_TOKEN the direct send is off (relay path kept)", () => {
  assert.equal(directConfigured({}), false);
  assert.equal(directConfigured({ BLOB_READ_WRITE_TOKEN: FAKE_TOKEN }), true);
});

test("the visitor is authenticated by a Comfy credential Comfy accepts; cross-site or anonymous is refused", async () => {
  const scope = await authenticate(req("/envoi-direct/jeton", { headers: { "x-api-key": KEY } }), userOk);
  assert.match(scope ?? "", SCOPE_RE);
  assert.equal(await authenticate(req("/x", { headers: { "x-api-key": KEY } }), (async () => new Response("", { status: 401 })) as typeof fetch), null);
  assert.equal(await authenticate(req("/x"), userOk), null);
  assert.equal(await authenticate(req("/x", { headers: { "x-api-key": KEY, origin: "https://evil.test" } }), userOk), null);
});

test("the client token is limited to the visitor's folder, image/* and video mp4/mov/webm, 200 Mo", async () => {
  const scope = (await authenticate(req("/x", { headers: { "x-api-key": KEY } }), userOk))!;
  assert.ok(pathAllowed(`envoi/${scope}/plan.mp4`, scope));
  assert.ok(!pathAllowed(`envoi/autre/plan.mp4`, scope));
  assert.ok(!pathAllowed(`envoi/${scope}/../x.mp4`, scope));
  assert.throws(() => tokenRules(scope, "ailleurs/plan.mp4"));
  const rules = tokenRules(scope, `envoi/${scope}/plan.mp4`);
  assert.deepEqual(rules.allowedContentTypes, ["image/*", "video/mp4", "video/quicktime", "video/webm"]);
  assert.equal(rules.maximumSizeInBytes, 200 * 1024 * 1024);
  assert.equal(DIRECT_MAX_BYTES, 200 * 1024 * 1024);
  assert.deepEqual(DIRECT_TYPES, rules.allowedContentTypes);
  // The real handleUpload signs those rules into the client token (offline, fake token).
  const request = req("/envoi-direct/jeton", { method: "POST", headers: { "x-api-key": KEY } });
  const result = await handleUpload({
    token: FAKE_TOKEN,
    request,
    body: { type: "blob.generate-client-token", payload: { pathname: `envoi/${scope}/plan.mp4`, multipart: true, clientPayload: null } },
    onBeforeGenerateToken: async pathname => tokenRules(scope, pathname),
  });
  assert.equal(result.type, "blob.generate-client-token");
  const clientToken = (result as { clientToken: string }).clientToken;
  assert.ok(!clientToken.includes(FAKE_TOKEN.slice(-32)), "the read-write secret never reaches the browser");
  const payload = JSON.parse(Buffer.from(Buffer.from(clientToken.split("_").pop()!, "base64").toString().split(".")[1], "base64").toString());
  assert.equal(payload.pathname, `envoi/${scope}/plan.mp4`);
  assert.equal(payload.maximumSizeInBytes, 200 * 1024 * 1024);
  assert.deepEqual(payload.allowedContentTypes, DIRECT_TYPES);
});

test("the server hands the private blob to Comfy with the visitor's credential, then deletes it, even on failure", async () => {
  const scope = "a".repeat(24);
  const deleted: string[] = [];
  const blobs: BlobOps = { get: async () => ({ blob: new Blob([new Uint8Array(9_000_000)]), contentType: "video/mp4" }), del: async path => { deleted.push(path); } };
  let sentKey = ""; let sentSize = 0;
  const comfy = (async (_url: unknown, init?: RequestInit) => { sentKey = new Headers(init?.headers).get("x-api-key") ?? ""; sentSize = ((init?.body as FormData).get("image") as File).size; return Response.json({ name: "plan.mp4" }); }) as typeof fetch;
  const request = req("/envoi-direct/comfy", { method: "POST", headers: { "x-api-key": KEY } });
  const ok = await handToComfy(request, { pathname: `envoi/${scope}/plan-x1.mp4`, filename: "plan.mp4" }, scope, blobs, comfy);
  assert.deepEqual(await ok.json(), { name: "plan.mp4", subfolder: "" });
  assert.equal(sentKey, KEY); assert.equal(sentSize, 9_000_000);
  assert.deepEqual(deleted, [`envoi/${scope}/plan-x1.mp4`]);
  const failing = (async () => new Response("", { status: 500 })) as typeof fetch;
  const ko = await handToComfy(request, { pathname: `envoi/${scope}/plan-x2.mp4`, filename: "plan.mp4" }, scope, blobs, failing);
  assert.equal(ko.status, 502);
  assert.equal(deleted.length, 2, "deleted after a Comfy failure too");
  const other = await handToComfy(request, { pathname: `envoi/${"b".repeat(24)}/plan.mp4`, filename: "plan.mp4" }, scope, blobs, comfy);
  assert.equal(other.status, 400);
});

function studio(state: unknown, uploads: { path: string; size: number }[], calls: string[]) {
  return createRenderClient({
    auth: { kind: "key", key: KEY },
    fetch: (async (url: unknown, init?: RequestInit) => {
      const path = String(url); calls.push(path);
      if (path.endsWith("/envoi-direct/etat")) return Response.json(state);
      if (path.endsWith("/envoi-direct/comfy")) return Response.json({ name: JSON.parse(String(init?.body)).filename });
      if (path.endsWith("/api/upload/image")) return Response.json({ name: "relais.png" });
      return new Response("{}");
    }) as typeof fetch,
    blobUpload: async (pathname, file) => { uploads.push({ path: pathname, size: file.size }); return { pathname: pathname.replace(/\.mp4$/, "-r4nd.mp4") }; },
  });
}

test("Finaliser goes direct at its original quality when the store is connected", async () => {
  const uploads: { path: string; size: number }[] = []; const calls: string[] = [];
  const scope = "c".repeat(24);
  const client = studio({ direct: true, scope }, uploads, calls);
  const montage = new Blob([new Uint8Array(30_000_000)], { type: "video/mp4" });
  const name = await client.upload(montage, "uttu-montage.mp4", { kind: "video", keepQuality: true });
  assert.equal(name, "uttu-montage.mp4");
  assert.deepEqual(uploads, [{ path: `envoi/${scope}/uttu-montage.mp4`, size: 30_000_000 }]);
  assert.ok(!calls.some(path => path.endsWith("/api/upload/image")), "nothing heavy through the relay");
});

test("without the store, Finaliser keeps today's clear refusal and a light file never asks for Blob", async () => {
  const uploads: { path: string; size: number }[] = []; const calls: string[] = [];
  const client = studio({ direct: false }, uploads, calls);
  await assert.rejects(client.upload(new Blob([new Uint8Array(UPLOAD_MAX_BYTES + 1)], { type: "video/mp4" }), "m.mp4", { kind: "video", keepQuality: true }), (error: Error) => error.message === FINAL_TOO_HEAVY);
  assert.equal(uploads.length, 0);
  calls.length = 0;
  assert.equal(await client.upload(new Blob(["abc"], { type: "image/png" }), "a.png"), "relais.png");
  assert.deepEqual(calls.map(path => path.replace(/^.*(\/[^/]+\/[^/]+)$/, "$1")), ["/upload/image"]);
});

test("a heavy file the browser cannot reduce goes direct; audio is never sent to Blob", async () => {
  const uploads: { path: string; size: number }[] = []; const calls: string[] = [];
  const client = studio({ direct: true, scope: "d".repeat(24) }, uploads, calls);
  assert.equal(await client.upload(new Blob([new Uint8Array(12_000_000)], { type: "video/mp4" }), "clip.mp4"), "clip.mp4");
  assert.equal(uploads[0].size, 12_000_000);
  await assert.rejects(client.upload(new Blob([new Uint8Array(12_000_000)], { type: "audio/wav" }), "voix.wav"));
  assert.equal(uploads.length, 1);
});

test("file names are made safe for Blob and Comfy; types follow the token rules", () => {
  assert.equal(directName("Léa à la gare (1).MOV"), "Lea-a-la-gare-1.mov");
  assert.ok(directType("image/heic") && directType("video/quicktime") && !directType("audio/wav") && !directType("video/x-matroska"));
  assert.match(phrase(key => key, DIRECT_FAILED), /^runtime\./);
});
