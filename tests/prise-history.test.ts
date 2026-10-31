import { test } from "node:test";
import assert from "node:assert/strict";

import { emptyPlan } from "../src/lib/prise/decision.ts";
import { buildPrompt } from "../src/lib/prise/prompt.ts";
import { planFromJson, planJson, planMarkdown } from "../src/lib/prise/vault.ts";
import { ltxTakeGraph } from "../src/lib/render/ltx-graph.ts";

type Plan = { id: string; name: string; action: string; takes: string[] };
const blank = (id: string): Plan => ({ id, name: id, action: "", takes: [] });
const decode = (data: unknown): Plan | null => data && typeof data === "object" && typeof (data as Plan).id === "string" ? data as Plan : null;

test("PRISE edition: complete settings round-trip through the shot note and reach the prompt", () => {
  const input = { ...emptyPlan(), action: "avance", duree: 10 as const, cadrage: "rapproche" as const, camera: "dolly" as const, angle: "contre-plongee" as const, cameraPosition: "2 m à gauche", framingRef: "Projets/atelier/Assets/cadre.png", manualCamera: true, manualFraming: true };
  const restored = planFromJson(planJson(input), emptyPlan());
  for (const key of ["duree", "cadrage", "camera", "angle", "cameraPosition", "framingRef", "manualCamera", "manualFraming"] as const) assert.equal(restored[key], input[key]);
  const prompt = buildPrompt(restored, { graph: null, son: false }).text;
  assert.match(prompt, /medium close-up/);
  assert.match(prompt, /camera dolly move/);
  assert.match(prompt, /low angle/);
  assert.match(prompt, /2 m à gauche/);
  assert.match(prompt, /10s/);
  const note = planMarkdown({ id: "plan-02", name: "La porte", ordre: 1, etat: "prise", input, graph: "", pourquoi: "", takeIds: ["a", "b"], garde: "a", imageCle: "", imageFin: "", finalVideo: "" });
  assert.match(note, /nom: "La porte"/);
  assert.match(note, /prises:\n  - "a"\n  - "b"/);
  assert.equal(planFromJson('{"duree":8}', emptyPlan()).duree, 8);
});

test("PRISE framing reference: LTX sends ten seconds and never mistakes the last guide for the set", () => {
  const graph = ltxTakeGraph({ pictures: ["character.png", "set.png", "framing.png"], prompt: "image 1 = character, image 2 = set.\n[framing reference] image 3 guides composition only.", seed: 42, seconds: 10, aspect: "horizontal" });
  assert.equal(Object.values(graph).find(node => node._meta?.title === "Duration")?.inputs.value, 10);
  assert.deepEqual(Object.values(graph).filter(node => node.class_type === "LoadImage").map(node => node.inputs.image), ["character.png", "set.png", "framing.png"]);
  const texts = Object.values(graph).flatMap(node => Object.values(node.inputs).filter(value => typeof value === "string")).join("\n");
  assert.match(texts, /framing guide controls composition only/);
  assert.doesNotMatch(texts, /stands in the place from <ref_image_2>/);
});
