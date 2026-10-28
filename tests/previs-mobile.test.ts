import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { initialMaquette, undoMaquette } from "../src/lib/maquette/state.ts";
import { addKeyframe, addProp, decimation, moveProp, nextKeyTime, orbitAt, PHONE_TRIANGLES } from "../src/lib/maquette/scene.ts";
import { composeScene, readPhrase } from "../src/lib/maquette/phrase-scene.ts";
import { meshGesteGraph, MOBILE_FACES } from "../src/lib/render/mesh-gestes.ts";
import { meshOutput } from "../src/lib/render/client.ts";
import { gesteParId, gesteOuvert } from "../src/lib/workflows/registre.ts";

const CAST = [{ id: "uttu", name: "Uttu" }, { id: "kael", name: "Kael" }];

describe("previs mobile", () => {
  it("records keyframes with their time and eases between them", () => {
    let state = initialMaquette(CAST);
    state = addKeyframe(state, 0);
    state = { ...state, orbit: { ...state.orbit, radius: 10 } };
    state = addKeyframe(state, 5);
    assert.deepEqual(state.path?.map(key => key.t), [0, 5]);
    assert.equal(nextKeyTime(state.path), 5);
    const mid = orbitAt(state.path ?? [], 2.5, state.orbit);
    assert.ok(mid.radius > 4 && mid.radius < 10);
    assert.equal(orbitAt(state.path ?? [], 9, state.orbit).radius, 10);
  });

  it("reads one sentence in four languages, without any model", () => {
    for (const phrase of [
      "Uttu et Kael dans une ruelle la nuit, une voiture et deux lampadaires, travelling avant",
      "Uttu and Kael in an alley at night, a car and two streetlights, push in",
      "Uttu und Kael in einer Gasse bei Nacht, ein Auto und zwei Laternen, Fahrt näher",
      "Uttu y Kael en un callejón de noche, un coche y dos farolas, acercamiento",
    ]) {
      const reading = readPhrase(phrase, CAST);
      assert.deepEqual(reading.names, ["uttu", "kael"], phrase);
      assert.ok(reading.props.includes("voiture") && reading.props.includes("lampadaire"), phrase);
      assert.equal(reading.move, "avant", phrase);
      assert.equal(reading.night, true, phrase);
    }
  });

  it("lays out the scene in one undo step", () => {
    const start = initialMaquette(CAST);
    const { state } = composeScene(start, "trois personnages autour d'une table, la caméra tourne autour", CAST, "Personnage");
    assert.equal(state.figures.length, 3);
    assert.equal(state.figures[0].id, "uttu");
    assert.deepEqual(state.props?.map(item => item.kind), ["table"]);
    assert.equal(state.path?.length, 3);
    assert.equal(undoMaquette(state).figures.length, 1);
  });

  it("moves props on the floor and keeps the phone budget", () => {
    const state = moveProp(addProp(initialMaquette(), "caisse"), "caisse-1", 99, 0);
    assert.equal(state.props?.[0].x, 5);
    assert.equal(decimation(PHONE_TRIANGLES, 10_000, true), 0);
    assert.equal(decimation(PHONE_TRIANGLES * 4, 40_000, true), 30_000);
  });

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
