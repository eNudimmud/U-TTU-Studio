import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { AUDIO_TOO_LONG, FINAL_IMAGE_TOO_HEAVY, FINAL_TOO_HEAVY, PREPARE_FAILED, VIDEO_TOO_LONG, kindOf, needForTemplate, planUpload, prepareUpload } from "../src/lib/render/prepare-upload.ts";
import { UPLOAD_MAX_BYTES } from "../src/lib/render/upload-limit.ts";
import { createRenderClient } from "../src/lib/render/client.ts";
import { phrase } from "../src/lib/i18n/phrase.ts";

const MB = 1_000_000;
const bitsOf = (plan: { videoBitrate: number; audioBitrate: number }, seconds: number) => (plan.videoBitrate + plan.audioBitrate) * seconds;

// Realistic phone files, against the relay's ~4 MB ceiling.
test("a 6–12 MB phone photo is re-encoded to 2048 px jpg; a light photo goes as it is", () => {
  assert.deepEqual(planUpload({ bytes: 2 * MB, type: "image/jpeg", width: 4032, height: 3024 }, { kind: "image" }), { action: "keep" });
  for (const bytes of [6 * MB, 12 * MB]) {
    const plan = planUpload({ bytes, type: "image/jpeg", width: 4032, height: 3024 }, { kind: "image" });
    assert.equal(plan.action, "image");
    if (plan.action === "image") assert.equal(plan.attempts[0].maxSide, 2048);
  }
});

test("a 5–10 s phone clip of 10–40 MB is re-encoded at 1280 px, 30 fps at most, same length, sound kept, under the ceiling", () => {
  for (const [seconds, bytes] of [[5, 10 * MB], [10, 40 * MB]] as const) {
    const plan = planUpload({ bytes, type: "video/mp4", width: 1080, height: 1920, seconds, fps: 60, hasAudio: true }, { kind: "video" });
    assert.equal(plan.action, "video");
    if (plan.action !== "video") continue;
    assert.equal(Math.max(plan.width, plan.height), 1280);
    assert.equal(plan.frameRate, 30);
    assert.equal(plan.end, undefined, "the clip keeps its length");
    assert.ok(plan.audio);
    assert.ok(bitsOf(plan, seconds) / 8 < UPLOAD_MAX_BYTES * 0.95);
  }
});

test("Fluidifier keeps the source frame rate; Copier un mouvement is cut to one 16 fps window even when light", () => {
  const fluid = planUpload({ bytes: 20 * MB, type: "video/mp4", width: 1920, height: 1080, seconds: 6, fps: 30, hasAudio: false }, needForTemplate("utility_video_frame_interpolation", "video"));
  assert.ok(fluid.action === "video" && fluid.frameRate === undefined);
  const pose = planUpload({ bytes: 1 * MB, type: "video/mp4", width: 1080, height: 1920, seconds: 5.2, fps: 30 }, needForTemplate("video_wan_animate2", "video"));
  assert.ok(pose.action === "video" && pose.frameRate === 16 && !pose.audio && Math.abs((pose.end ?? 0) - 81 / 16) < 1e-9);
});

test("Finaliser never degrades its video: above the ceiling it is refused with a clear line", () => {
  for (const template of ["utility_seedvr2_3b_int8_upscale_video", "RTXVideoSuperResolution"]) {
    const need = needForTemplate(template, "video");
    assert.deepEqual(planUpload({ bytes: 3 * MB, type: "video/mp4", seconds: 10 }, need), { action: "keep" });
    assert.deepEqual(planUpload({ bytes: 9 * MB, type: "video/mp4", width: 1920, height: 1080, seconds: 12 }, need), { action: "refuse", message: FINAL_TOO_HEAVY });
  }
});

test("Finaliser image keeps its resolution: only the jpg quality moves, and stays high", () => {
  const plan = planUpload({ bytes: 9 * MB, type: "image/png", width: 2048, height: 2048 }, needForTemplate("utility_seedvr2_3b_int8_upscale_image", "image"));
  assert.equal(plan.action, "image");
  if (plan.action === "image") for (const attempt of plan.attempts) { assert.equal(attempt.maxSide, 2048); assert.ok(attempt.quality >= 0.92); }
});

test("too long to fit is refused clearly instead of being sent to a 413", () => {
  assert.deepEqual(planUpload({ bytes: 300 * MB, type: "video/mp4", width: 1920, height: 1080, seconds: 600, hasAudio: true }, { kind: "video" }), { action: "refuse", message: VIDEO_TOO_LONG });
  assert.deepEqual(planUpload({ bytes: 80 * MB, type: "audio/wav", seconds: 3600 }, { kind: "audio" }), { action: "refuse", message: AUDIO_TOO_LONG });
});

test("a 40 MB wav voice is re-encoded to compressed audio that fits", () => {
  const plan = planUpload({ bytes: 40 * MB, type: "audio/wav", seconds: 230 }, { kind: "audio" });
  assert.equal(plan.action, "audio");
  if (plan.action === "audio") assert.ok(plan.bitrate * 230 / 8 < UPLOAD_MAX_BYTES && plan.bitrate >= 64_000);
});

test("the need follows the file type when the template asks nothing special", () => {
  assert.equal(kindOf("image/heic"), "image");
  assert.equal(kindOf("video/quicktime"), "video");
  assert.equal(kindOf("audio/x-m4a"), "audio");
  assert.deepEqual(needForTemplate("video_ltx2_3_i2v", "video"), { kind: "video" });
});

test("a light file goes untouched, with its name, through the one shared function", async () => {
  const file = await prepareUpload(new Blob(["abc"], { type: "image/png" }), "uttu-1.png");
  assert.equal(file.name, "uttu-1.png");
  assert.equal(file.size, 3);
  await assert.rejects(prepareUpload(new Blob([new Uint8Array(UPLOAD_MAX_BYTES + 1)], { type: "video/mp4" }), "f.mp4", { kind: "video", keepQuality: true }), (error: Error) => error.message === FINAL_TOO_HEAVY);
});

test("every upload of the studio goes through client.upload, which prepares the file", async () => {
  let sent = 0;
  const client = createRenderClient({ auth: { kind: "key", key: "k".repeat(24) }, fetch: (async (_url: unknown, init?: RequestInit) => { sent = ((init?.body as FormData).get("image") as File).size; return Response.json({ name: "x.png" }); }) as typeof fetch });
  assert.equal(await client.upload(new Blob(["abcd"], { type: "image/png" }), "a.png"), "x.png");
  assert.equal(sent, 4);
  const sources = ["src/components/app/studio-session.tsx", "src/lib/creation/still.ts", "src/lib/render/run.ts"].map(path => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(sources, /\/api\/upload\/image/, "no upload bypasses client.upload");
});

test("each refusal line has a translation key", () => {
  for (const line of [PREPARE_FAILED, VIDEO_TOO_LONG, AUDIO_TOO_LONG, FINAL_TOO_HEAVY, FINAL_IMAGE_TOO_HEAVY]) assert.match(phrase(key => key, line), /^runtime\./, line);
});
