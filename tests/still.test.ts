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
    // FLUX 3 Image Klein by default (open weights).
    const text = stillGraph({ kind: "texte-cast", prompt: "Uttu", images: [], seed: 1 });
    assert.equal(text.klein_unet?.inputs.unet_name, "flux3_image_klein_base_int8_convrot.safetensors");
    assert.equal(text.klein_sampler?.inputs.steps, 50);
    assert.equal(text.save?.class_type, "SaveImageAdvanced");
    assert.deepEqual(text.save?.inputs.images, ["klein_decode", 0]);
    const place = stillGraph({ kind: "texte-decor", prompt: "Un quai", images: [], seed: 2 });
    assert.equal(place.klein_size?.inputs.aspect_ratio, "16:9 (Widescreen)");
    const edit = stillGraph({ kind: "photo-decor", prompt: "Le même lieu", images: ["lieu.png"], seed: 3 });
    assert.equal(edit.load?.class_type, "LoadImage");
    assert.deepEqual(edit.klein_refs?.inputs["images.image0"], ["load", 0]);
    // Nano Banana stays available as an option.
    const nano = stillGraph({ kind: "texte-decor", prompt: "Un quai", images: [], seed: 2, template: "api_nano_banana_2_1_t2i" });
    assert.equal(nano.still?.class_type, "GeminiNanoBanana2V2");
    assert.equal(nano.still?.inputs["model.aspect_ratio"], "16:9");
    // FLUX 3 Image (partner) for several references and the sheet.
    const multi = stillGraph({ kind: "photo-cast", prompt: "Uttu", images: ["a.png", "b.png", "c.png"], seed: 5, template: "api_bfl_flux3_image_edit" });
    assert.equal(multi.still?.class_type, "Flux3ImageNode");
    assert.deepEqual(multi.still?.inputs["images.image_3"], ["load3", 0]);
    const sheet = stillGraph({ kind: "planche", prompt: "La coursière", images: ["face.png"], seed: 4, template: "api_bfl_flux3_image_edit" });
    assert.equal(sheet.close?.class_type, "Flux3ImageNode");
    assert.equal(sheet.body?.class_type, "Flux3ImageNode");
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
    assert.equal(fake.graph()?.klein_unet?.class_type, "UNETLoader");
  });
});
