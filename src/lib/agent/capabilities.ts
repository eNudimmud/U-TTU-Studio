/**
 * U*TTU Studio Agent capability projection.
 * The Studio's live tool catalogue is authoritative; the agent never owns this list.
 * No network, tokens, generation, or billing side effects.
 */
import { outilEtat, outilParId, outilsPublics } from "../outils/catalogue.ts";
import { gesteParId, type FiltreGestes } from "../workflows/registre.ts";

export interface AgentCapability {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  inputKinds: readonly ("image" | "video" | "audio" | "text")[];
  outputKind: "image" | "video" | "audio" | "text";
  requiresPrompt: boolean;
}
export interface AgentQuoteHint {
  credits: number;
  high: number;
  nature: "mesure" | "hypothese";
}
export interface AgentSnapshot {
  capabilities: AgentCapability[];
  quotes: Record<string, AgentQuoteHint>;
}

/** The first verified bridge action: Suite BiRefNet → public tool ret-detourer. */
const BRIDGED = [{
  gesture: "suite-detourer", tool: "ret-detourer", label: "Détourer",
  description: "Retirer le fond d'une image avec BiRefNet",
  inputKinds: ["image"] as const, outputKind: "image" as const, requiresPrompt: false,
}] as const;

export function studioAgentSnapshot(filters: FiltreGestes = {}): AgentSnapshot {
  const publicIds = new Set(outilsPublics(filters).map(tool => tool.id));
  const capabilities: AgentCapability[] = [];
  const quotes: Record<string, AgentQuoteHint> = Object.create(null);
  for (const bridge of BRIDGED) {
    const tool = outilParId(bridge.tool);
    const row = gesteParId(bridge.gesture);
    const enabled = Boolean(
      tool && tool.geste === bridge.gesture && row &&
      outilEtat(tool, filters).kind === "pret" &&
      publicIds.has(tool.id),
    );
    capabilities.push({
      id: bridge.gesture, label: bridge.label, description: bridge.description,
      enabled, inputKinds: bridge.inputKinds, outputKind: bridge.outputKind,
      requiresPrompt: bridge.requiresPrompt,
    });
    if (enabled && row && row.credits !== null && row.high !== null && row.nature !== "non-mesure") {
      quotes[bridge.gesture] = { credits: row.credits, high: row.high, nature: row.nature };
    }
  }
  return { capabilities, quotes };
}
