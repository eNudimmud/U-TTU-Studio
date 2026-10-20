/** Pinned source from Uttu-studio-AGENT commit d8474e39042c355dfe1029a531f88895ba45f9e6. */
import type { AgentDecision, StudioContext } from "./contracts.ts";

/** Pure, deterministic first intent adapter. Never executes or incurs charges. */
export function planStudioRequest(message: string, context: StudioContext): AgentDecision {
  const input = message.normalize("NFKC").toLocaleLowerCase("fr").trim();
  const wantsCutout = /(?:d[eé]tour(?:e|er|age)|supprim(?:e|er) (?:le |l['’])?(?:fond|arri[eè]re.plan)|enl[eè]v(?:e|er) (?:le |l['’])?(?:fond|arri[eè]re.plan)|remove (?:the )?background|cut ?out)/u.test(input);
  if (!wantsCutout) return { kind: "unrecognized", message: "Précise l'opération créative à réaliser dans le Studio." };
  const capability = context.capabilities.find(c => c.id === "suite-detourer" && c.enabled && c.inputKinds.includes("image") && c.outputKind === "image");
  if (!capability) return { kind: "unavailable", message: "Le détourage n'est pas disponible dans le Studio actuellement." };
  if (!context.selectedAsset || context.selectedAsset.kind !== "image")
    return { kind: "missing_asset", message: "Sélectionne une image à détourer." };
  return { kind: "propose", capabilityId: capability.id, assetId: context.selectedAsset.id, message: "Détourage prêt. Vérifie le devis avant de lancer." };
}
