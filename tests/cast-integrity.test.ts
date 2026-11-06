import assert from "node:assert/strict";
import test from "node:test";
import { runStill, stillGraph, stillOutput } from "../src/lib/creation/still.ts";
import { recoverableClient, readPending } from "../src/lib/render/recovery.ts";
import type { PendingRender } from "../src/lib/render/recovery.ts";
import type { RenderClient } from "../src/lib/render/client.ts";
import { QWEN_EDIT, QWEN_TEXT } from "../src/lib/render/qwen-image.ts";

const file = (filename: string, type = "output") => ({ images: [{ filename, type, subfolder: "" }] });
test("only the named final image is accepted, including old CAST receipts", () => {
  const outputs = { preview: file("preview.png", "temp"), load: file("uttu-planche-ref.png", "input"), save: file("result.png"), "461": file("qwen.png") };
  assert.equal(stillOutput(outputs)?.filename, "result.png");
  assert.equal(stillOutput(outputs, "461")?.filename, "qwen.png");
  assert.equal(stillOutput({ preview: outputs.preview, load: outputs.load }), null);
  assert.equal(stillOutput({ save: file("preview.png", "temp") }), null);
  assert.equal(stillOutput(outputs, "missing"), null);
});

test("Qwen uses its paired VAE, requested dimensions, references and declared final output", () => {
  for (const edit of [false, true]) {
    const graph = stillGraph({ kind: edit ? "photo-cast" : "texte-cast", prompt: "Harbour portrait", images: edit ? ["u1.jpg", "u2.jpg"] : [], seed: 14, template: edit ? QWEN_EDIT : QWEN_TEXT });
    assert.equal(graph["459:454"].inputs.vae_name, "qwen_image_2.1_vae_bf16.safetensors");
    assert.deepEqual(graph["459:456"].inputs, { width: 1920, height: 1088, batch_size: 1 });
    assert.deepEqual(graph["461"].inputs.images, ["459:457", 0]);
    if (edit) {
      assert.equal(graph["459:468"].inputs.switch, true);
      assert.deepEqual(graph["459:474"].inputs["images.image_2"], ["475", 0]);
    }
    assert.equal(Object.values(graph).some(n => /Flux|Gemini|Higgsfield/.test(n.class_type)), false);
  }
});

test("an invalid still never reaches the cost read", async () => {
  let measured = false;
  const client = { submit: async () => "job-12345678", status: async () => "success", job: async () => ({ status: "success", outputs: { "461": file("bad.png") } }), file: async () => new Blob(["broken"]), balance: async () => { measured = true; return 96; } } as unknown as RenderClient;
  await assert.rejects(runStill(client, { kind: "texte-cast", prompt: "Portrait", pictures: [], seed: 1, template: QWEN_TEXT, clientId: "c", balanceBefore: 100 }, { invalidImage: async () => true }), /vide, illisible ou corrompu/);
  assert.equal(measured, false);
});

test("recovery records the actual save node before the paid request", async () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  const receipt = { version: 1, kind: "cast", project: "film", id: "portrait", name: "Portrait", prompt: "Portrait", at: "2026-11-04", account: "test", refs: [], template: QWEN_TEXT, quote: 4, balanceBefore: 100, jobId: null } satisfies PendingRender;
  const client = { submit: async () => { assert.equal(readPending(storage)?.outputNode, "461"); return "job-12345678"; } } as unknown as RenderClient;
  await recoverableClient(client, storage, receipt).submit(stillGraph({ kind: "texte-cast", prompt: "Portrait", images: [], seed: 1, template: QWEN_TEXT }), "c");
  assert.equal(readPending(storage)?.outputNode, "461");
});
