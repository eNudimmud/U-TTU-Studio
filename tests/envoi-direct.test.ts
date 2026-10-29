import assert from "node:assert/strict";
import test from "node:test";
import { handleUpload } from "@vercel/blob/client";
import { DIRECT_MAX_BYTES, DIRECT_TYPES, authenticate, directConfigured, handToComfy, pathAllowed, tokenRules, type BlobOps } from "../src/lib/envoi-direct/server.ts";
import { DIRECT_FAILED, directContentType, directName, directType } from "../src/lib/envoi-direct/client.ts";
import { createRenderClient } from "../src/lib/render/client.ts";
import { FINAL_TOO_HEAVY, planUpload } from "../src/lib/render/prepare-upload.ts";
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

test("the client token is limited to the visitor's folder, image/*, video mp4/mov/webm and audio/*, 200 Mo", async () => {
  const scope = (await authenticate(req("/x", { headers: { "x-api-key": KEY } }), userOk))!;
  assert.ok(pathAllowed(`envoi/${scope}/plan.mp4`, scope));
  assert.ok(!pathAllowed(`envoi/autre/plan.mp4`, scope));
  assert.ok(!pathAllowed(`envoi/${scope}/../x.mp4`, scope));
  assert.throws(() => tokenRules(scope, "ailleurs/plan.mp4"));
  const rules = tokenRules(scope, `envoi/${scope}/plan.mp4`);
  assert.deepEqual(rules.allowedContentTypes, ["image/*", "video/mp4", "video/quicktime", "video/webm", "audio/*"]);
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

type Received = { path: string; size: number; bytes: Uint8Array; type: string };
function studio(state: unknown, uploads: Received[], calls: string[], failBlob = false) {
  return createRenderClient({
    auth: { kind: "key", key: KEY },
    fetch: (async (url: unknown, init?: RequestInit) => {
      const path = String(url); calls.push(path);
      if (path.endsWith("/envoi-direct/etat")) return Response.json(state);
      if (path.endsWith("/envoi-direct/comfy")) return Response.json({ name: JSON.parse(String(init?.body)).filename });
      if (path.endsWith("/api/upload/image")) return Response.json({ name: "relais.png" });
      return new Response("{}");
    }) as typeof fetch,
    blobUpload: async (pathname, file, options) => {
      if (failBlob) throw new Error("blob down");
      uploads.push({ path: pathname, size: file.size, bytes: new Uint8Array(await file.arrayBuffer()), type: options.contentType });
      return { pathname: pathname.replace(/(\.[a-z0-9]+)$/, "-r4nd$1") };
    },
  });
}

function filled(bytes: number, seed: number) {
  const data = new Uint8Array(bytes);
  for (let index = 0; index < bytes; index += 4093) data[index] = (index * seed) & 255;
  return data;
}
const equalBytes = (left: Uint8Array, right: Uint8Array) => left.length === right.length && left.every((value, index) => value === right[index]);

test("with Blob connected, every family goes as the original: Blob receives the same bytes, nothing through the relay", async () => {
  const uploads: Received[] = []; const calls: string[] = [];
  const scope = "c".repeat(24);
  const client = studio({ direct: true, scope }, uploads, calls);
  const cases: { name: string; type: string; bytes: number; need?: Parameters<typeof client.upload>[2]; expect: string }[] = [
    { name: "lea.jpg", type: "image/jpeg", bytes: 9_000_000, need: { kind: "image" }, expect: "image/jpeg" },                       // CAST / DÉCOR / bulle / PRISE
    { name: "retouche.png", type: "image/png", bytes: 7_000_000, need: { kind: "image", keepQuality: true }, expect: "image/png" },   // Retoucher, upscale
    { name: "IMG_0042.HEIC", type: "", bytes: 5_000_000, expect: "image/heic" },                                                    // HEIC without a browser type
    { name: "petite.jpg", type: "image/jpeg", bytes: 300_000, expect: "image/jpeg" },                                               // light: Blob too
    { name: "clip.mp4", type: "video/mp4", bytes: 12_000_000, need: { kind: "video" }, expect: "video/mp4" },                       // video tools
    { name: "fluide.mov", type: "video/quicktime", bytes: 14_000_000, need: { kind: "video", keepFps: true }, expect: "video/quicktime" }, // Fluidifier
    { name: "uttu-montage.mp4", type: "video/mp4", bytes: 30_000_000, need: { kind: "video", keepQuality: true }, expect: "video/mp4" }, // Finaliser
    { name: "voix.wav", type: "audio/wav", bytes: 12_000_000, need: { kind: "audio" }, expect: "audio/wav" },                       // audio tools
  ];
  for (const [index, item] of cases.entries()) {
    const original = filled(item.bytes, index + 3);
    const name = await client.upload(new Blob([original], { type: item.type }), item.name, item.need);
    const got = uploads[index];
    assert.equal(got.size, item.bytes, item.name);
    assert.ok(equalBytes(got.bytes, original), `${item.name}: Blob got the original bytes`);
    assert.equal(got.type, item.expect, item.name);
    assert.ok(got.path.startsWith(`envoi/${scope}/`));
    assert.equal(name, got.path.split("/").pop());
  }
  assert.ok(!calls.some(path => path.endsWith("/api/upload/image")), "nothing through the relay");
  assert.equal(calls.filter(path => path.endsWith("/envoi-direct/etat")).length, 1, "the state is asked once per account");
});

test("without Blob, today's reduction path: Finaliser's clear refusal, a light file through the relay, nothing to Blob", async () => {
  const uploads: Received[] = []; const calls: string[] = [];
  const client = studio({ direct: false, store: false }, uploads, calls);
  await assert.rejects(client.upload(new Blob([new Uint8Array(UPLOAD_MAX_BYTES + 1)], { type: "video/mp4" }), "m.mp4", { kind: "video", keepQuality: true }), (error: Error) => error.message === FINAL_TOO_HEAVY);
  assert.equal(await client.upload(new Blob(["abc"], { type: "image/png" }), "a.png"), "relais.png");
  assert.equal(uploads.length, 0);
});

test("if Blob fails, the relay path takes over silently", async () => {
  const uploads: Received[] = []; const calls: string[] = [];
  const client = studio({ direct: true, scope: "d".repeat(24) }, uploads, calls, true);
  assert.equal(await client.upload(new Blob(["abc"], { type: "image/png" }), "a.png"), "relais.png");
  await assert.rejects(client.upload(new Blob([new Uint8Array(UPLOAD_MAX_BYTES + 1)], { type: "video/mp4" }), "m.mp4", { kind: "video", keepQuality: true }), (error: Error) => error.message === FINAL_TOO_HEAVY);
});

test("Copier un mouvement with Blob: re-timed to 16 i/s and 81 images covering the 482×854 the graph crops to, high bitrate, sound kept", () => {
  const phone = { bytes: 20_000_000, type: "video/mp4", width: 1080, height: 1920, seconds: 9, fps: 30, hasAudio: true };
  const direct = planUpload(phone, { kind: "video", pose: true }, "direct");
  assert.deepEqual(direct, { action: "video", width: 482, height: 858, frameRate: 16, end: 81 / 16, videoBitrate: 8_000_000, audio: true, audioBitrate: 192_000 });
  const relay = planUpload(phone, { kind: "video", pose: true }, "relay");
  assert.equal(relay.action === "video" && relay.audio, true, "the graph puts the source sound back (CreateVideo 672:245)");
  assert.equal(relay.action === "video" && relay.videoBitrate, 1_500_000);
  // Already at the graph's cadence and length: the original goes untouched.
  assert.deepEqual(planUpload({ ...phone, fps: 16, seconds: 5 }, { kind: "video", pose: true }, "direct"), { action: "keep" });
  // Never upscaled.
  const small = planUpload({ ...phone, width: 360, height: 640 }, { kind: "video", pose: true }, "direct");
  assert.equal(small.action === "video" && small.width, 360);
  // Every other need keeps the original in direct mode.
  for (const need of [{ kind: "image" }, { kind: "image", keepQuality: true }, { kind: "video" }, { kind: "video", keepFps: true }, { kind: "video", keepQuality: true }, { kind: "audio" }] as const) {
    assert.deepEqual(planUpload({ ...phone, bytes: 90_000_000 }, need, "direct"), { action: "keep" });
  }
});

test("file names are made safe for Blob and Comfy; types follow the token rules", () => {
  assert.equal(directName("Léa à la gare (1).MOV"), "Lea-a-la-gare-1.mov");
  assert.ok(directType("image/heic") && directType("video/quicktime") && directType("audio/wav") && !directType("video/x-matroska"));
  assert.equal(directContentType(new Blob([]), "IMG_1.HEIC"), "image/heic");
  assert.equal(directContentType(new Blob([], { type: "application/octet-stream" }), "voix.m4a"), "audio/mp4");
  assert.equal(directContentType(new Blob([], { type: "video/x-matroska" }), "a.mkv"), null);
  assert.match(phrase(key => key, DIRECT_FAILED), /^runtime\./);
});

test("the free test reads the blob and deletes it, Comfy's upload is never called", async () => {
  const scope = "f".repeat(24);
  const stored = new Set([`envoi/${scope}/essai-x.mp4`]);
  const blobs: BlobOps = { get: async () => ({ blob: new Blob([new Uint8Array(6_000_000)]), contentType: "video/mp4" }), del: async path => { stored.delete(path); }, exists: async path => stored.has(path) };
  let comfyCalls = 0;
  const comfy = (async () => { comfyCalls++; return Response.json({ name: "x" }); }) as typeof fetch;
  const response = await handToComfy(req("/envoi-direct/comfy", { method: "POST", headers: { "x-api-key": KEY } }), { pathname: `envoi/${scope}/essai-x.mp4`, filename: "essai.mp4", essai: true }, scope, blobs, comfy);
  assert.deepEqual(await response.json(), { essai: true, received: true, bytes: 6_000_000, deleted: true });
  assert.equal(comfyCalls, 0);
  assert.equal(stored.size, 0);
});
