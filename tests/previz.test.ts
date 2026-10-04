import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { imageOutput } from "../src/lib/render/client.ts";
import { buildPrevizGlb, previzFaces, previzGate, previzGraph, readPrevizJson } from "../src/lib/render/previz.ts";
import { referencePaths } from "../src/lib/render/references.ts";

describe("préviz", () => {
  it("writes a real GLB of volumes, not a painted frame", () => {
    const piece = buildPrevizGlb("piece");
    const quai = buildPrevizGlb("quai");
    assert.equal(readPrevizJson(piece)?.nodes, 5);
    assert.equal(readPrevizJson(quai)?.nodes, 4);
    assert.equal(previzFaces("piece"), 60);
    assert.notEqual(piece[0], 0xff, "a GLB is not a JPEG");
    assert.ok(piece.byteLength > 200);
  });

  it("asks the cloud to ray-cast the file, and does not invent a trainer or a paint node", () => {
    const graph = previzGraph("3d/uttu-piece.glb");
    assert.equal(graph.load.class_type, "Load3DAdvanced");
    assert.equal(graph.load.inputs.model_file, "3d/uttu-piece.glb");
    assert.deepEqual(graph.load.inputs.viewport_state, {});
    assert.equal(graph.parts.class_type, "Get3DComponents");
    assert.equal(graph.view.class_type, "RenderMesh");
    assert.equal(graph.view.inputs.mode, "solid");
    assert.deepEqual(graph.view.inputs.camera_info, ["camera", 0]);
    assert.equal(graph.save.class_type, "SaveImage");
    const types = Object.values(graph).map(node => node.class_type).join(" ");
    assert.doesNotMatch(types, /Flux|LoraLoader|Hunyuan|Meshy|Rodin|Blender|SaveVideo/);
    assert.throws(() => previzGraph("none"));
  });

  it("refuses a render when the balance cannot be read, and names no invented price", () => {
    assert.equal(previzGate(null).allowed, false);
    assert.equal(previzGate(0).allowed, false);
    assert.equal(previzGate(12).allowed, true);
    assert.match(previzGate(12).line, /pas connu/);
    assert.doesNotMatch(previzGate(12).line, /\d+[,.]\d+/);
  });

  it("gives La prise the rendered still after the place photos", () => {
    assert.deepEqual(referencePaths(["refs/a.jpg"], { stills: ["scenes/q.jpg"], render: "scenes/q-rendu.png" }), ["refs/a.jpg", "scenes/q.jpg", "scenes/q-rendu.png"]);
    assert.deepEqual(referencePaths(["refs/a.jpg"], { stills: ["scenes/q.jpg"], render: null }), ["refs/a.jpg", "scenes/q.jpg"]);
    const saved = imageOutput({ save: { images: [{ filename: "uttu/previz_00001_.png", subfolder: "", type: "output" }] } });
    assert.equal(saved?.filename, "uttu/previz_00001_.png");
    assert.equal(imageOutput({ save: { images: [{ filename: "clip.mp4" }] } }), null);
  });
});
