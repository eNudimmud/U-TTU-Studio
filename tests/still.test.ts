import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { creationAllowed, spendAllowed } from "../src/lib/creation/quotes.ts";
import { runStill, stillGraph, type StillKind } from "../src/lib/creation/still.ts";
import type { RenderClient } from "../src/lib/render/client.ts";

const png = new Blob([Uint8Array.from([137, 80, 78, 71])], { type: "image/png" });

function fakeClient() {
  const calls: string[] = [];
  let graph: ReturnType<typeof stillGraph> | null = null;
  const client = {
    async upload() {
      calls.push("upload");
      return "photo.png";
    },
    async submit(next: ReturnType<typeof stillGraph>) {
      calls.push("submit");
      graph = next;
      return "job-1";
    },
    async status() {
      calls.push("status");
      return "success";
    },
    async job() {
      return { status: "success", outputs: { save: { images: [{ filename: "uttu-planche_00001_.png", subfolder: "", type: "output" }] } } };
    },
    async file() {
      calls.push("file");
      return png;
    },
    async balance() {
      calls.push("balance");
      return 88;
    },
    async cancel() {
      calls.push("cancel");
    },
    async user() {
      return {};
    },
  };
  return { client: client as unknown as RenderClient, calls, graph: () => graph };
}

describe("rendu CAST et DÉCOR", () => {
  it("keeps the button off without an account or under the ceiling", () => {
    assert.equal(creationAllowed(false, 100, 18), false);
    assert.equal(creationAllowed(true, null, 18), false);
    assert.equal(creationAllowed(true, 17, 18), false);
    assert.equal(creationAllowed(true, 18, 18), true);
    assert.equal(spendAllowed(12, false), false);
  });

  it("builds the text, photo and sheet graphs without calling out", () => {
    const text = stillGraph({ kind: "texte-cast", prompt: "Mira", images: [], seed: 1 });
    assert.equal(text.still?.class_type, "GeminiNanoBanana2V2");
    assert.equal(text.save?.class_type, "SaveImageAdvanced");
    const place = stillGraph({ kind: "texte-decor", prompt: "Un quai", images: [], seed: 2 });
    assert.equal(place.still?.inputs["model.aspect_ratio"], "16:9");
    const edit = stillGraph({ kind: "photo-decor", prompt: "Le même lieu", images: ["lieu.png"], seed: 3 });
    assert.equal(edit.load?.class_type, "LoadImage");
    assert.deepEqual(edit.still?.inputs["model.images.image_1"], ["load", 0]);
    const sheet = stillGraph({ kind: "planche", prompt: "La coursière", images: ["face.png"], seed: 4 });
    assert.equal(sheet.close?.class_type, "GeminiImage2Node");
    assert.equal(sheet.close?.inputs.resolution, "2K");
    assert.equal(sheet.body?.class_type, "GeminiImage2Node");
    assert.equal(sheet.body?.inputs.resolution, "2K");
    assert.equal(sheet.stitch?.class_type, "ImageStitch");
    assert.equal(sheet.save?.inputs.filename_prefix, "uttu-planche");
  });

  it("files the image and the measured cost from a mock account", async () => {
    const fake = fakeClient();
    const result = await runStill(fake.client, {
      kind: "texte-decor" satisfies StillKind,
      prompt: "Un quai la nuit",
      pictures: [],
      seed: 7,
      clientId: "client",
      balanceBefore: 100,
    }, { sleep: async () => {}, now: () => 0, pollMs: 0, timeoutMs: 10 });
    assert.deepEqual(fake.calls, ["submit", "status", "file", "balance"]);
    assert.equal(result.jobId, "job-1");
    assert.equal(result.costCredits, 12);
    assert.equal(result.image, png);
    assert.equal(fake.graph()?.still?.class_type, "GeminiNanoBanana2V2");
  });
});
