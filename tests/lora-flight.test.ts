import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanFalKey, readFalKey, saveFalKey } from "../src/lib/fal/link.ts";
import { LORA_UPLOADS_KEY, readLoraTakeFlight, readLoraUploads, readTrainingFlight, saveLoraTakeFlight, saveLoraUploads, saveTrainingFlight } from "../src/lib/lora/flight.ts";

function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

const handle = {
  requestId: "abc12345-def",
  statusUrl: "https://queue.fal.run/minimax/h3/ref2va/trainer/requests/abc12345-def/status",
  responseUrl: "https://queue.fal.run/minimax/h3/ref2va/trainer/requests/abc12345-def",
  cancelUrl: "https://queue.fal.run/minimax/h3/ref2va/trainer/requests/abc12345-def/cancel",
};

describe("ce que l’appareil retient", () => {
  it("keeps a fal key on the device and drops one that has the wrong shape", () => {
    const store = memory();
    assert.equal(cleanFalKey("  Key abcd1234:secret_key-1  "), "abcd1234:secret_key-1");
    assert.equal(cleanFalKey("short:x"), null);
    assert.equal(cleanFalKey("no-colon-here-at-all"), null);
    saveFalKey(store, "abcd1234:secret_key-1");
    assert.equal(readFalKey(store), "abcd1234:secret_key-1");
    saveFalKey(store, null);
    assert.equal(readFalKey(store), null);
  });

  it("round-trips a training and refuses a handle that is not on fal's queue", () => {
    const store = memory();
    const flight = { handle, at: "2026-10-03T16:00:00.000Z", name: "Mira", trigger: "mira_uttu", steps: 1000, aspect: "9:16" as const, clips: 10, balanceBefore: 40 };
    saveTrainingFlight(store, flight);
    assert.deepEqual(readTrainingFlight(store), flight);
    saveTrainingFlight(store, { ...flight, handle: { ...handle, statusUrl: "https://evil.example/status" } });
    assert.equal(readTrainingFlight(store), null);
    saveTrainingFlight(store, null);
    assert.equal(readTrainingFlight(store), null);
  });

  it("round-trips a LoRA take and only remembers fal.media copies of the file", () => {
    const store = memory();
    const flight = {
      handle,
      at: "2026-10-03T17:00:00.000Z",
      sceneId: "quai",
      sceneName: "Le quai",
      line: "Elle avance.",
      prompt: "Image 1 shows mira_uttu.",
      settings: { seconds: 5 as const, quality: "rapide" as const, aspect: "vertical" as const },
      resolution: "768P" as const,
      loraId: "mira",
      balanceBefore: 20,
    };
    saveLoraTakeFlight(store, flight);
    assert.equal(readLoraTakeFlight(store)?.loraId, "mira");
    saveLoraUploads(store, {
      mira: { url: "https://v3.fal.media/files/mira.safetensors", until: 99 },
      other: { url: "https://example.com/mira.safetensors", until: 99 },
    });
    assert.deepEqual(readLoraUploads(store), { mira: { url: "https://v3.fal.media/files/mira.safetensors", until: 99 } });
    assert.equal(store.getItem(LORA_UPLOADS_KEY)?.includes("example.com"), true);
    assert.equal(readLoraUploads(store).other, undefined);
  });
});
