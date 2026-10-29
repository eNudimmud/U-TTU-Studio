import { test } from "node:test";
import assert from "node:assert/strict";
import { historyJson, planHistory, planReducer, readPlanHistory } from "../src/lib/prise/history.ts";
import { duplicatePlan, nextPlanId, removePlan, stepMove } from "../src/lib/prise/plans.ts";
import { emptyPlan } from "../src/lib/prise/decision.ts";
import { buildPrompt } from "../src/lib/prise/prompt.ts";
import { planFromJson, planJson, planMarkdown } from "../src/lib/prise/vault.ts";
import { ltxTakeGraph } from "../src/lib/render/ltx-graph.ts";

type Plan = { id: string; name: string; action: string; takes: string[] };
const blank = (id: string): Plan => ({ id, name: id, action: "", takes: [] });
const decode = (data: unknown): Plan | null => data && typeof data === "object" && typeof (data as Plan).id === "string" ? data as Plan : null;

test("PRISE reducer: add three, edit second, delete/undo third, move, persist and reload", () => {
  let state = planHistory([blank("plan-01")]);
  for (const id of ["plan-02", "plan-03"]) state = planReducer(state, { type: "replace", plans: [...state.plans, blank(id)], currentId: id });
  state = planReducer(state, { type: "replace", plans: state.plans.map(plan => plan.id === "plan-02" ? { ...plan, name: "La porte", action: "Ouvre la porte", takes: ["take-01", "take-02"] } : plan), currentId: "plan-02" });
  const edited = state;
  state = planReducer(state, { type: "replace", plans: removePlan(state.plans, "plan-03").next });
  state = planReducer(state, { type: "undo" });
  assert.deepEqual(state.plans, edited.plans);
  state = planReducer(state, { type: "replace", plans: stepMove(state.plans, "plan-02", 1) });
  const loaded = readPlanHistory(historyJson(state), decode)!;
  assert.deepEqual(loaded.plans.map(plan => plan.id), ["plan-01", "plan-03", "plan-02"]);
  assert.equal(loaded.currentId, "plan-02");
  assert.deepEqual(loaded.plans[2].takes, ["take-01", "take-02"]);
  assert.deepEqual(planReducer(loaded, { type: "undo" }).plans, edited.plans);
});

test("PRISE reducer: duplicate is independent; IDs stay unique after a deletion", () => {
  const original = { ...blank("plan-01"), takes: ["take-01"] };
  let state = planHistory([original, blank("plan-03")]);
  const copy = duplicatePlan(state.plans, original.id, (source, id) => ({ ...structuredClone(source), id, takes: [] }));
  state = planReducer(state, { type: "replace", plans: copy.next, currentId: copy.id! });
  assert.equal(new Set(state.plans.map(plan => plan.id)).size, 3);
  assert.deepEqual(state.plans[1].takes, []);
  assert.deepEqual(original.takes, ["take-01"]);
  assert.equal(nextPlanId(["plan-01", "plan-03"]), "plan-04");
  assert.deepEqual(planReducer(state, { type: "undo" }).plans, [original, blank("plan-03")]);
  const reserved = duplicatePlan([blank("plan-01")], "plan-01", (source, id) => ({ ...source, id }), ["plan-01", "plan-02", "plan-03"]);
  assert.equal(reserved.id, "plan-04", "a deleted or running plan must not give its id to a new duplicate");
});

test("PRISE reducer: at least twenty edits undo after reload; runtime sync does not use history", () => {
  let state = planHistory([blank("plan-01")]);
  for (let n = 1; n <= 25; n++) state = planReducer(state, { type: "replace", plans: [{ ...state.plans[0], action: String(n) }] });
  state = planReducer(state, { type: "replace", plans: [{ ...state.plans[0], takes: ["landed"] }], record: false });
  assert.equal(state.past.length, 25);
  state = readPlanHistory(historyJson(state), decode)!;
  for (let n = 0; n < 20; n++) state = planReducer(state, { type: "undo" });
  assert.equal(state.plans[0].action, "5");
});

test("PRISE reducer: a typed word is grouped; changing field starts another step", () => {
  let state = planHistory([blank("plan-01")]);
  for (const [at, action] of [[100, "o"], [200, "ou"], [300, "ouvre"]] as const) state = planReducer(state, { type: "replace", plans: [{ ...state.plans[0], action }], group: "action", at });
  assert.equal(state.past.length, 1);
  assert.equal(planReducer(state, { type: "undo" }).plans[0].action, "");
  state = planReducer(state, { type: "replace", plans: [{ ...state.plans[0], name: "Porte" }], group: "name", at: 400 });
  assert.equal(state.past.length, 2);
});

test("PRISE history: malformed and duplicate snapshots fall back without losing files", () => {
  for (const raw of ["{", "null", '{"version":2}', '{"version":1,"plans":[],"past":[]}', '{"version":1,"plans":[{"id":"a"},{"id":"a"}],"past":[]}']) assert.equal(readPlanHistory(raw, decode), null);
});

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
