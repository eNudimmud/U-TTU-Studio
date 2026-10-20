import test from "node:test";
import assert from "node:assert/strict";
import { decideStudioRequest } from "../src/lib/agent/decision.ts";
import type { AgentCapability } from "../src/lib/agent/capabilities.ts";

const capability: AgentCapability = {
  id: "suite-detourer", label: "Détourer", description: "BiRefNet", enabled: true,
  inputKinds: ["image"], outputKind: "image", requiresPrompt: false,
};
// Keep this corpus aligned with tests/conformance.test.ts in Uttu-studio-AGENT.
const corpus = [["Détoure cette image","propose"],["Enlève le fond","propose"],["Supprimer l'arrière-plan","propose"],["Remove the background","propose"],["Cut out this image","propose"],["Anime cette image","unrecognized"],["","unrecognized"]];
test("Studio planner matches standalone agent intent corpus", () => {
  for (const [message, expected] of corpus) {
    assert.equal(decideStudioRequest(message, [capability], { id: "asset:1", kind: "image" }).kind, expected, message);
  }
});
test("Studio planner does not bypass the disabled-tool gate", () => {
  assert.equal(decideStudioRequest("Détoure cette image", [{ ...capability, enabled: false }], { id: "asset:1", kind: "image" }).kind, "unavailable");
});
