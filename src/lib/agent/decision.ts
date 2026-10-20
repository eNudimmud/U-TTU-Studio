/**
 * Studio-side decision adapter, contract-compatible with the standalone agent's
 * planStudioRequest. Pure and side-effect free.
 */
import { routeStudioIntent } from "./intent.ts";
import type { AgentCapability } from "./capabilities.ts";

export interface StudioAgentAsset { id: string; kind: "image" | "video" | "audio" }
export type StudioAgentDecision =
  | { kind: "unrecognized"; message: string }
  | { kind: "unavailable"; message: string }
  | { kind: "missing_asset"; message: string }
  | { kind: "propose"; capabilityId: string; assetId: string; message: string };

export function decideStudioRequest(
  message: string,
  capabilities: readonly AgentCapability[],
  selectedAsset?: StudioAgentAsset,
): StudioAgentDecision {
  if (routeStudioIntent(message) !== "suite-detourer") {
    return { kind: "unrecognized", message: "Précise l'opération créative à réaliser dans le Studio." };
  }
  const capability = capabilities.find(c => c.id === "suite-detourer" && c.enabled && c.inputKinds.includes("image") && c.outputKind === "image");
  if (!capability) {
    return { kind: "unavailable", message: "Le détourage n'est pas disponible dans le Studio actuellement." };
  }
  if (!selectedAsset || selectedAsset.kind !== "image") {
    return { kind: "missing_asset", message: "Sélectionne une image à détourer." };
  }
  return {
    kind: "propose", capabilityId: capability.id, assetId: selectedAsset.id,
    message: "Détourage prêt. Vérifie le devis avant de lancer.",
  };
}
