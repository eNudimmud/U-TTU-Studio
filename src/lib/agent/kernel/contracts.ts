/** Vendored verbatim from Uttu-studio-AGENT/src/contracts.ts at d8474e39042c355dfe1029a531f88895ba45f9e6. */
/** Capability metadata supplied by Studio; never a grant to execute. */
export interface StudioCapability {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  inputKinds: readonly ("image" | "video" | "audio" | "text")[];
  outputKind: "image" | "video" | "audio" | "text";
  requiresPrompt: boolean;
}
export interface StudioAsset { id: string; kind: "image" | "video" | "audio"; }
export interface StudioContext { capabilities: readonly StudioCapability[]; selectedAsset?: StudioAsset; }
export type AgentDecision =
  | { kind: "propose"; capabilityId: string; assetId: string; message: string }
  | { kind: "missing_asset"; message: string }
  | { kind: "unavailable"; message: string }
  | { kind: "unrecognized"; message: string };
