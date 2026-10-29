import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { UPLOAD_MAX_BYTES, UPLOAD_HEAVY, POSE_FPS, POSE_FRAMES, poseVideoTarget, uploadTooHeavy } from "../src/lib/render/upload-limit.ts";
import { createRenderClient } from "../src/lib/render/client.ts";
import { PREPARE_FAILED } from "../src/lib/render/prepare-upload.ts";
import { outilParId } from "../src/lib/outils/catalogue.ts";
import { outilGraph } from "../src/lib/outils/graphs.ts";

// Every upload goes through the studio's same-origin relay (src/proxy.ts). On Vercel a
// request body above ~4 MB is refused with 413 before it reaches Comfy Cloud; a 5 s phone
// clip (1080p, 30 fps) weighs 8 to 20 MB. That is the 29.10 « Copier un mouvement » failure.
test("the upload ceiling stays under Vercel's 4 MB request limit, multipart overhead included", () => {
  assert.ok(UPLOAD_MAX_BYTES <= 4_000_000 - 64_000);
  assert.equal(uploadTooHeavy(UPLOAD_MAX_BYTES), false);
  assert.equal(uploadTooHeavy(UPLOAD_MAX_BYTES + 1), true);
});

test("the pose video is cut to one 81-frame window at 16 fps, so the quote (one window) is the real cost", () => {
  assert.equal(POSE_FPS, 16);
  assert.equal(POSE_FRAMES, 81);
  const phone = poseVideoTarget({ width: 1080, height: 1920, seconds: 5.2 });
  assert.equal(phone.frameRate, 16);
  assert.ok(Math.abs(phone.end - 81 / 16) < 1e-9);
  // Same framing the graph crops to (482×854 centre), never smaller than that box.
  assert.ok(phone.width >= 482 && phone.height >= 854);
  assert.equal(phone.width % 2, 0); assert.equal(phone.height % 2, 0);
  assert.ok(phone.width * phone.height <= 482 * 2 * 854 * 2);
  const landscape = poseVideoTarget({ width: 1920, height: 1080, seconds: 3 });
  assert.ok(landscape.height >= 854 && landscape.width >= 482);
  assert.ok(Math.abs(landscape.width / landscape.height - 16 / 9) < 0.02);
  assert.ok(Math.abs(landscape.end - 3) < 1e-9, "a short clip is not stretched");
  // 81 frames at 16 fps → floor((81-2)/80)+1 = 1 loop iteration in the Wan Animate graph.
  assert.equal(Math.floor((POSE_FRAMES - 2) / 80) + 1, 1);
});

test("client.upload refuses a too-heavy file it cannot prepare, before sending it, with a clear message", async () => {
  let calls = 0;
  const client = createRenderClient({ auth: { kind: "key", key: "k".repeat(24) }, fetch: (async () => { calls++; return new Response("{}"); }) as typeof fetch });
  const big = new Blob([new Uint8Array(UPLOAD_MAX_BYTES + 10)], { type: "video/mp4" });
  await assert.rejects(client.upload(big, "plan.mp4"), (error: Error) => error.message === PREPARE_FAILED);
  assert.equal(calls, 0);
});

test("a 413 from the relay says the file is too heavy, not « refusé la prise »", async () => {
  const client = createRenderClient({ auth: { kind: "key", key: "k".repeat(24) }, fetch: (async () => new Response("Request Entity Too Large", { status: 413 })) as typeof fetch });
  await assert.rejects(client.upload(new Blob(["x"], { type: "video/mp4" }), "plan.mp4"), (error: Error) => error.message === UPLOAD_HEAVY);
});

test("the message exists in FR, EN, DE and ES", () => {
  for (const lang of ["fr", "en", "de", "es"]) {
    const messages = JSON.parse(readFileSync(`messages/${lang}.json`, "utf8"));
    assert.ok(messages.runtime.uploadHeavy, lang);
    for (const key of ["uploadHeavy", "prepareFailed", "videoTooLong", "audioTooLong", "finalTooHeavy", "finalImageTooHeavy"]) {
      assert.ok(messages.runtime[key], `${lang} ${key}`);
      assert.doesNotMatch(messages.runtime[key], /gratuit|free|kostenlos|gratis/i);
    }
  }
});

test("Copier un mouvement still wires the reference photo and the pose video", () => {
  const graph = outilGraph(outilParId("vid-mouvement")!, { files: { images: ["uttu.png"], video: "pose.mp4" }, prompt: "", seed: 7 }) as Record<string, { inputs: Record<string, unknown> }>;
  assert.equal(graph["189"].inputs.image, "uttu.png");
  assert.equal(graph["240"].inputs.file, "pose.mp4");
});
