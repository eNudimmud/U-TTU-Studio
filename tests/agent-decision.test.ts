import test from "node:test";
import assert from "node:assert/strict";
import { decideStudioRequest } from "../src/lib/agent/decision.ts";
import type { AgentCapability } from "../src/lib/agent/capabilities.ts";

const capability: AgentCapability = {
  id: "suite-detourer", label: "Détourer", description: "BiRefNet", enabled: true,
  inputKinds: ["image"], outputKind: "image", requiresPrompt: false,
};
test("returns a proposal only for an available image workflow", () => {
  const result = decideStudioRequest("Détoure cette image", [capability], { id: "vault:42", kind: "image" });
  assert.deepEqual(result, {
    kind: "propose", capabilityId: "suite-detourer", assetId: "vault:42",
    message: "Détourage prêt. Vérifie le devis avant de lancer.",
  });
});
test("asks for an image if none is selected", () => {
  assert.equal(decideStudioRequest("Enlève le fond", [capability]).kind, "missing_asset");
  assert.equal(decideStudioRequest("Enlève le fond", [capability], { id: "video", kind: "video" }).kind, "missing_asset");
});
test("does not propose disabled or unknown actions", () => {
  assert.equal(decideStudioRequest("Détoure cette image", [{ ...capability, enabled: false }], { id: "x", kind: "image" }).kind, "unavailable");
  assert.equal(decideStudioRequest("Anime cette image", [capability], { id: "x", kind: "image" }).kind, "unrecognized");
});
