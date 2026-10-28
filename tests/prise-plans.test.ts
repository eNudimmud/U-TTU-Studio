import { test } from "node:test";
import assert from "node:assert/strict";
import { duplicatePlan, nextPlanId, removePlan, restorePlan, stepMove } from "../src/lib/prise/plans.ts";

const list = [{ id: "plan-01", name: "Plan 1" }, { id: "plan-02", name: "Plan 2" }, { id: "plan-03", name: "Plan 3" }];

test("PRISE: delete then « Annuler » puts the plan back at its place", () => {
  const { next, removed } = removePlan(list, "plan-02");
  assert.deepEqual(next.map(p => p.id), ["plan-01", "plan-03"]);
  assert.deepEqual(restorePlan(next, removed!).map(p => p.id), ["plan-01", "plan-02", "plan-03"]);
  assert.deepEqual(restorePlan(list, removed!).map(p => p.id), ["plan-01", "plan-02", "plan-03"]);
});

test("PRISE: duplicate inserts a fresh copy right after, with a free id", () => {
  const { next, id } = duplicatePlan(list, "plan-01", (s, id) => ({ ...s, id, name: `${s.name} bis` }));
  assert.equal(id, "plan-04");
  assert.deepEqual(next.map(p => p.id), ["plan-01", "plan-04", "plan-02", "plan-03"]);
  assert.equal(next[1].name, "Plan 1 bis");
  assert.equal(nextPlanId(["plan-01", "plan-03"]), "plan-04");
});

test("PRISE: step moves for touch, bounded at both ends", () => {
  assert.deepEqual(stepMove(list, "plan-03", -1).map(p => p.id), ["plan-01", "plan-03", "plan-02"]);
  assert.deepEqual(stepMove(list, "plan-01", -1).map(p => p.id), ["plan-01", "plan-02", "plan-03"]);
  assert.deepEqual(stepMove(list, "plan-03", 1).map(p => p.id), ["plan-01", "plan-02", "plan-03"]);
});
