/** Compatibility intent probe, backed by the independent Agent planner. */
import { planStudioRequest } from "./kernel/planner.ts";
export type StudioIntent = "suite-detourer" | "unrecognized";
const probe = { id: "suite-detourer", label: "Détourer", description: "BiRefNet", enabled: true, inputKinds: ["image"] as const, outputKind: "image" as const, requiresPrompt: false };
export function routeStudioIntent(message: string): StudioIntent {
  const decision = planStudioRequest(message, { capabilities: [probe], selectedAsset: { id: "probe", kind: "image" } });
  return decision.kind === "propose" ? decision.capabilityId as StudioIntent : "unrecognized";
}
