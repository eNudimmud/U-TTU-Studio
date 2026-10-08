import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAST_SHEET_QUOTE } from "../src/lib/creation/quotes.ts";
import { runStem, stemGraph } from "../src/lib/creation/stem.ts";
import { musicQuote } from "../src/lib/montage/quotes.ts";
import type { RenderClient } from "../src/lib/render/client.ts";

describe("sons branchés", () => {
  it("builds the paid sound graphs and does not call the network by itself", () => {
    const voice = stemGraph({ kind: "voix", text: "Bonjour.", seed: 3 });
    assert.equal(voice.stem?.class_type, "ElevenLabsTextToSpeech");
    assert.equal(voice.stem?.inputs.model, "eleven_v4");
    assert.equal(voice.voice?.class_type, "ElevenLabsVoiceSelector");
    const effect = stemGraph({ kind: "effet", text: "Une porte.", seed: 1 });
    assert.equal(effect.stem?.class_type, "ElevenLabsTextToSoundEffects");
    assert.equal(effect.stem?.inputs["model.duration"], 5);
    const music = stemGraph({ kind: "musique", text: "Nappe douce.", seed: 9 });
    assert.equal(music.stem?.class_type, "SoniloTextToMusic");
    assert.equal(music.stem?.inputs.duration, 30);
    assert.equal(musicQuote().credits, 16);
    assert.equal(musicQuote().high, 24);
    assert.equal(CAST_SHEET_QUOTE.credits, 71);
    assert.equal(CAST_SHEET_QUOTE.kind, "mesure");
  });

  it("reads an audio file from a mock job", async () => {
    const mp3 = new Blob([Uint8Array.from([1, 2, 3])], { type: "audio/mpeg" });
    const calls: string[] = [];
    const client = {
      async upload() { throw new Error("pas d’envoi"); },
      async submit() { calls.push("submit"); return "job-son"; },
      async status() { calls.push("status"); return "success"; },
      async job() {
        return { status: "success", outputs: { save: { audio: [{ filename: "uttu-voix_00001_.mp3", subfolder: "", type: "output" }] } } };
      },
      async file() { calls.push("file"); return mp3; },
      async balance() { calls.push("balance"); return 80; },
      async cancel() {},
      async user() { return {}; },
    } as unknown as RenderClient;
    const result = await runStem(client, {
      kind: "voix", text: "Bonjour.", seed: 1, clientId: "c", balanceBefore: 100,
    }, { sleep: async () => {}, now: () => 0, pollMs: 0, timeoutMs: 10 });
    assert.deepEqual(calls, ["submit", "status", "file", "balance"]);
    assert.equal(result.costCredits, 20);
    assert.equal(result.filename, "uttu-voix.mp3");
  });
});
