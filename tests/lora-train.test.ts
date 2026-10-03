import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FalClient, FalHandle } from "../src/lib/fal/client.ts";
import { LORA_TRAINER } from "../src/lib/fal/prices.ts";
import { isSafetensors } from "../src/lib/lora/follow.ts";
import { followTraining, submitTraining, trainingRequest } from "../src/lib/lora/train.ts";
import { readZip } from "../src/lib/zip.ts";

const handle: FalHandle = {
  requestId: "abc12345-def",
  statusUrl: "https://queue.fal.run/minimax/h3/ref2va/trainer/requests/abc12345-def/status",
  responseUrl: "https://queue.fal.run/minimax/h3/ref2va/trainer/requests/abc12345-def",
  cancelUrl: "https://queue.fal.run/minimax/h3/ref2va/trainer/requests/abc12345-def/cancel",
};

function weights(): Blob {
  const header = new TextEncoder().encode('{"format":"pt"}');
  const bytes = new Uint8Array(8 + header.length);
  new DataView(bytes.buffer).setUint32(0, header.length, true);
  bytes.set(header, 8);
  return new Blob([bytes], { type: "application/octet-stream" });
}

describe("formation du double", () => {
  it("packs the clips with the look's photos and queues the H3 trainer", async () => {
    const captured: { archived: Blob | null; body: Record<string, unknown> | null; endpoint: string } = { archived: null, body: null, endpoint: "" };
    const fal = {
      async upload(file: Blob) {
        captured.archived = file;
        return "https://v3.fal.media/files/dataset.zip";
      },
      async submit(id: string, input: Record<string, unknown>) {
        captured.endpoint = id;
        captured.body = input;
        return handle;
      },
    } as unknown as FalClient;
    const sent = await submitTraining(fal, {
      clips: [{ blob: new Blob(["clip-a"]), format: "mp4" }, { blob: new Blob(["clip-b"]), format: "mov" }],
      refs: [new Blob(["look"])],
      trigger: "mira_uttu",
      steps: 1000,
      aspect: "9:16",
    }, () => {});
    assert.equal(sent.requestId, handle.requestId);
    assert.equal(captured.endpoint, LORA_TRAINER);
    assert.deepEqual(captured.body, trainingRequest("https://v3.fal.media/files/dataset.zip", { trigger: "mira_uttu", steps: 1000, aspect: "9:16" }));
    assert.equal(captured.body?.split_input_into_scenes, false);
    assert.equal(captured.body?.auto_scale_input, true);
    const names = readZip(new Uint8Array(await captured.archived!.arrayBuffer())).map(entry => entry.name);
    assert.deepEqual(names, ["clip01.mp4", "clip01.ref_1.jpg", "clip02.mov", "clip02.ref_1.jpg"]);
  });

  it("brings back a .safetensors file and the charge fal booked", async () => {
    const file = weights();
    assert.equal(await isSafetensors(file), true);
    assert.equal(await isSafetensors(new Blob(["nope"])), false);
    const fal = {
      async status() {
        return { state: "done", error: null, errorType: null, seconds: 90 };
      },
      async result() {
        return { lora_file: { url: "https://v3.fal.media/files/lora.safetensors" }, config_file: { url: "https://v3.fal.media/files/config.json" } };
      },
      async download() {
        return file;
      },
      async charged() {
        return 15;
      },
      async account() {
        return { username: "mira", usd: 25 };
      },
      async cancel() {},
    } as unknown as FalClient;
    const result = await followTraining(fal, handle, 40, () => {}, { sleep: async () => {}, measureTries: 1 });
    assert.equal(result.costUsd, 15);
    assert.equal(result.costSource, "billing");
    assert.equal(result.balanceAfter, 25);
    assert.equal(result.lora.size, file.size);
    assert.equal(result.seconds, 90);
  });
});
