import test from "node:test";
import assert from "node:assert/strict";
import { studioAgentSnapshot } from "../src/lib/agent/capabilities.ts";
import { outilParId, outilEtat, outilsPublics } from "../src/lib/outils/catalogue.ts";

test("BiRefNet bridge matches actual public tool and gesture", () => {
  const tool = outilParId("ret-detourer");
  assert.ok(tool);
  assert.equal(tool.geste, "suite-detourer");
  const snapshot = studioAgentSnapshot();
  const capability = snapshot.capabilities.find(item => item.id === "suite-detourer");
  assert.ok(capability);
  assert.equal(capability.enabled, outilEtat(tool).kind === "pret" && outilsPublics().some(item => item.id === tool.id));
});
test("agent snapshot is read-only metadata, never an execution token", () => {
  const snapshot = studioAgentSnapshot();
  assert.deepEqual(snapshot.capabilities.map(item => item.id), ["suite-detourer"]);
  assert.equal("token" in snapshot, false);
  assert.equal("execute" in snapshot, false);
});
test("open-weights filter does not enable unavailable tools", () => {
  const snapshot = studioAgentSnapshot({ openWeightsOnly: true });
  assert.equal(snapshot.capabilities.length, 1);
  assert.equal(typeof snapshot.capabilities[0]?.enabled, "boolean");
});
