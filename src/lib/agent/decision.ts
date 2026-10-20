/** Studio adapter for the pinned independent Agent planner. No duplicated intent logic. */
import { planStudioRequest } from "./kernel/planner.ts";
import type { AgentCapability } from "./capabilities.ts";
import type { AgentDecision, StudioAsset } from "./kernel/contracts.ts";
export type StudioAgentAsset = StudioAsset;
export type StudioAgentDecision = AgentDecision;
export function decideStudioRequest(
  message: string,
  capabilities: readonly AgentCapability[],
  selectedAsset?: StudioAgentAsset,
): StudioAgentDecision {
  return planStudioRequest(message, { capabilities, selectedAsset });
}
