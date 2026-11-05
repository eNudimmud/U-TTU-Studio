import assert from "node:assert/strict";
import test from "node:test";
import { mayFocusPlanField } from "../src/lib/agent/plan-focus.ts";

const plan = { id: "plan" };
const typing = { matches: (selector: string) => selector.includes("textarea") };

test("the plan field takes focus only when the visitor is not already typing", () => {
  assert.equal(mayFocusPlanField(null, plan), true);
  assert.equal(mayFocusPlanField({ matches: () => false }, plan), true);
  assert.equal(mayFocusPlanField(plan, plan), true);
  assert.equal(mayFocusPlanField(typing, plan), false);
  assert.equal(mayFocusPlanField(typing, null), false);
});
