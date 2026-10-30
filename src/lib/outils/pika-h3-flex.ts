// Pika H3 Flex Ref2VA: the official Comfy template `video_pika_h3_flex_ref2va`, a LoRA by Pika on
// MiniMax H3 (MiniMax H3 Community License: the UI names « MiniMax H3 » wherever the model shows).
// Test run of 30.10.2026 (docs/mesures/pika-h3-flex-2026-10-30.md, job 5f7c6344): 0.4 MP 480×864, 5 s, two named
// references, 6 fixed sigmas with lcm, 7,54 crédits. The turbo LoRA of the studio's H3 take must
// never be stacked on it: the template has one LoRA, Pika's, and nothing else.
// Pure: nothing here opens a network or touches storage except the session note below.

export const PIKA_TEMPLATE = "video_pika_h3_flex_ref2va";
export const PIKA_OUTIL = "vid-pika";

/** Every weight the graph loads. If Comfy says one is missing, the model leaves the menu. */
export const PIKA_MODELS = {
  unet: "minimax_h3_ref2va_pruned_int8_convrot.safetensors",
  lora: "pika_h3_flex_ref2va_v1_bf16.safetensors",
  clip: "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors",
  videoVae: "minimax_h3_video_vae_int8_convrot.safetensors",
  audioVae: "minimax_h3_audio_vae_fp32.safetensors",
} as const;

/** The studio's H3 turbo LoRA: known to break Pika's output when stacked. */
export const PIKA_FORBIDDEN_LORA = "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors";

/** The template's six sigmas (Pika's 1000/750/500/250/100/40 steps, video shift 12). */
export const PIKA_SIGMAS = "1.0, 0.972973, 0.923077, 0.8, 0.571429, 0.333333, 0.0";

type Graph = Record<string, { class_type: string; inputs: Record<string, unknown> }>;

/** The graph is Pika's and only Pika's: its LoRA once, every weight present, no turbo LoRA. */
export function pikaGraphProblem(graph: Graph): string | null {
  const values = Object.values(graph).flatMap(node => Object.values(node.inputs)).filter((value): value is string => typeof value === "string");
  if (values.includes(PIKA_FORBIDDEN_LORA)) return "LoRA turbo H3 interdit sur Pika.";
  const loras = Object.values(graph).filter(node => /^Lora/.test(node.class_type));
  if (loras.length !== 1 || loras[0].inputs.lora_name !== PIKA_MODELS.lora) return "Un seul LoRA attendu : celui de Pika.";
  const missing = Object.values(PIKA_MODELS).filter(name => !values.includes(name));
  return missing.length ? `Modèles absents du graphe : ${missing.join(", ")}.` : null;
}

/**
 * A Comfy refusal that says a weight or the reference node is not there today. The client keeps
 * « <class_type> : <message> » per node error (render/client.ts), so a loader's « Value not in list »
 * is enough; a line that names a file or the template counts too.
 */
export function pikaRefusModele(detail: string): boolean {
  if (!detail) return false;
  if ([PIKA_TEMPLATE, ...Object.values(PIKA_MODELS)].some(name => detail.includes(name))) return true;
  if (/\b(?:UNETLoader|LoraLoaderModelOnly|CLIPLoader|VAELoader)\s*:\s*Value not in list/i.test(detail)) return true;
  return /\bMiniMaxH3ReferenceToVideo\b.*(?:does not exist|not found|missing)|(?:does not exist|not found|missing).*\bMiniMaxH3ReferenceToVideo\b/i.test(detail);
}

// Models Comfy refused for missing weights, for this tab's session. Hidden from « Changer de modèle ».
const ABSENTS_KEY = "u-ttu-modeles-absents";
const absents = new Set<string>();
let loaded = false;

function storage(): Storage | null {
  try { return typeof sessionStorage === "undefined" ? null : sessionStorage; } catch { return null; }
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const saved = JSON.parse(storage()?.getItem(ABSENTS_KEY) ?? "[]") as unknown;
    if (Array.isArray(saved)) for (const id of saved) if (typeof id === "string") absents.add(id);
  } catch { /* memory only */ }
}

export function modeleAbsent(id: string): boolean {
  load();
  return absents.has(id);
}

export function marquerModeleAbsent(id: string): void {
  load();
  absents.add(id);
  try { storage()?.setItem(ABSENTS_KEY, JSON.stringify([...absents])); } catch { /* memory only */ }
}

/** Tests only. */
export function oublierModelesAbsents(): void {
  absents.clear();
  loaded = true;
  try { storage()?.removeItem(ABSENTS_KEY); } catch { /* memory only */ }
}
