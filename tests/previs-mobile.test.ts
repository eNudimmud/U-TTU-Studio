import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { meshGesteGraph, MOBILE_FACES } from "../src/lib/render/mesh-gestes.ts";
import { meshOutput } from "../src/lib/render/client.ts";
import { gesteParId, gesteOuvert } from "../src/lib/workflows/registre.ts";

const CAST = [{ id: "uttu", name: "Uttu" }, { id: "kael", name: "Kael" }];

describe("previs mobile", () => {

  it("sends the two official 3D templates with an estimated quote", () => {
    for (const id of ["prise-volume-perso", "prise-volume-objet"] as const) {
      const row = gesteParId(id)!;
      assert.ok(row.nature === "hypothese" || row.nature === "mesure", id);
      assert.ok(gesteOuvert(row));
      const graph = meshGesteGraph({ geste: id, image: "uttu-photo.png", seed: 7 });
      const load = Object.values(graph).filter(node => node.class_type === "LoadImage");
      assert.equal(load.length, 1);
      assert.equal(load[0].inputs.image, "uttu-photo.png");
      assert.ok(Object.values(graph).some(node => /^Save(GLB|3DAdvanced)$/.test(node.class_type)));
    }
    assert.equal(gesteParId("prise-volume-perso")!.template, "3d_hunyuan3d-v2.1");
    const trellis = meshGesteGraph({ geste: "prise-volume-objet", image: "a.png", seed: 1 });
    assert.equal(Object.values(trellis).find(node => node.class_type === "DecimateMesh")?.inputs.target_face_count, MOBILE_FACES);
    assert.deepEqual(meshOutput({ "10": { "3d": [{ filename: "uttu.glb", subfolder: "mesh", type: "output" }] } }), { filename: "uttu.glb", subfolder: "mesh", type: "output" });
  });
});
