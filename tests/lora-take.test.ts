import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FalClient, FalHandle } from "../src/lib/fal/client.ts";
import { LORA_TAKE } from "../src/lib/fal/prices.ts";
import { followLoraTake, submitLoraTake } from "../src/lib/lora/take.ts";

const handle: FalHandle = {
  requestId: "take1234-abcd",
  statusUrl: "https://queue.fal.run/minimax/h3/reference-to-video/lora/requests/take1234-abcd/status",
  responseUrl: "https://queue.fal.run/minimax/h3/reference-to-video/lora/requests/take1234-abcd",
  cancelUrl: "https://queue.fal.run/minimax/h3/reference-to-video/lora/requests/take1234-abcd/cancel",
};

function weights(mark: string): Blob {
  return new Blob([mark], { type: "application/octet-stream" });
}

describe("prise qui recharge le fichier", () => {
  it("uploads the vault file and passes that address as the LoRA path", async () => {
    const file = weights("vault-lora-bytes");
    const uploaded: { name: string; text: string }[] = [];
    const captured: { endpoint: string; body: Record<string, unknown> | null } = { endpoint: "", body: null };
    const fal = {
      async upload(blob: Blob, name: string) {
        uploaded.push({ name, text: await blob.text() });
        return `https://v3.fal.media/files/${name}`;
      },
      async alive() {
        return false;
      },
      async submit(id: string, input: Record<string, unknown>) {
        captured.endpoint = id;
        captured.body = input;
        return handle;
      },
    } as unknown as FalClient;
    const sent = await submitLoraTake(fal, {
      lora: { id: "mira", blob: file, url: null, urlUntil: null },
      pictures: [{ blob: new Blob(["photo"]), name: "uttu-1.jpg" }],
      prompt: "Image 1 shows mira_uttu, the same person.",
      seconds: 5,
      aspect: "9:16",
      resolution: "768P",
      seed: 7,
    }, () => {}, { now: () => 1_000 });
    assert.equal(captured.endpoint, LORA_TAKE);
    assert.equal(sent.loraUrl, "https://v3.fal.media/files/mira.safetensors");
    assert.deepEqual(captured.body?.loras, [{ path: sent.loraUrl, scale: 1 }]);
    assert.deepEqual(captured.body?.reference_image_urls, ["https://v3.fal.media/files/uttu-1.jpg"]);
    assert.equal(uploaded.find(item => item.name === "mira.safetensors")?.text, "vault-lora-bytes");
  });

  it("reuses a copy fal still holds, and sends the vault file again once that copy is about to expire", async () => {
    const now = 10_000_000;
    const file = weights("again");
    let uploads = 0;
    const fal = {
      async upload() {
        uploads += 1;
        return "https://v3.fal.media/files/fresh.safetensors";
      },
      async alive(url: string) {
        return url.includes("still-there");
      },
      async submit() {
        return handle;
      },
    } as unknown as FalClient;
    const input = {
      lora: { id: "mira", blob: file, url: "https://v3.fal.media/files/still-there.safetensors", urlUntil: now + 3 * 3600 * 1000 },
      pictures: [{ blob: new Blob(["photo"]), name: "uttu-1.jpg" }],
      prompt: "Image 1 shows mira_uttu.",
      seconds: 5,
      aspect: "9:16" as const,
      resolution: "480P" as const,
      seed: 1,
    };
    const reused = await submitLoraTake(fal, input, () => {}, { now: () => now });
    assert.equal(reused.loraUrl, input.lora.url);
    assert.equal(uploads, 1, "the photo goes up, the LoRA stays");
    const resent = await submitLoraTake(fal, { ...input, lora: { ...input.lora, urlUntil: now + 30 * 60 * 1000 } }, () => {}, { now: () => now });
    assert.equal(resent.loraUrl, "https://v3.fal.media/files/fresh.safetensors");
    assert.equal(uploads, 3);
  });

  it("returns the video fal rendered for that request", async () => {
    const video = new Blob(["mp4"], { type: "video/mp4" });
    const fal = {
      async status() {
        return { state: "done", error: null, errorType: null, seconds: 20 };
      },
      async result() {
        return { video: { url: "https://v3.fal.media/files/out.mp4" } };
      },
      async download(url: string) {
        assert.equal(url, "https://v3.fal.media/files/out.mp4");
        return video;
      },
      async charged() {
        return null;
      },
      async account() {
        return { username: "mira", usd: 19.62 };
      },
      async cancel() {},
    } as unknown as FalClient;
    const result = await followLoraTake(fal, handle, 20, () => {}, { sleep: async () => {}, measureTries: 1 });
    assert.equal(await result.video.text(), "mp4");
    assert.equal(result.costSource, "balance");
    assert.equal(result.costUsd, 0.38);
    assert.equal(result.balanceAfter, 19.62);
  });
});
