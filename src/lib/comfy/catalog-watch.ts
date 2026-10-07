// Last Comfy Cloud catalog read for two parked gestures.
// Discovery only: get_node, search_nodes, search_templates. No estimate, no dry_run, no run.

export const CATALOG_WATCH = {
  readAt: "2026-10-07T16:47:36.385Z",
  nodeCount: 3772,
  /** Exact class names looked up. All of them came back missing. */
  saveLoraNames: ["SaveLoRA", "SaveLora", "SaveLoRANode", "LoraSave", "SaveLoraNode"] as const,
  saveLoraPresent: false,
  trainLoraId: "TrainLoraNode",
  trainLoraOutputs: ["LORA_MODEL", "LOSS_MAP", "INT"] as const,
  /** TrainLoraNode is not an output node. A new LoRA lives only for that run. */
  trainLoraWritesFile: false,
  /** A whole-run number, in credits, once a file node exists and a quote is measured. */
  comfyFileQuote: null as number | null,
  /** Cloud template name for a still built from a place file. Null until one is named. */
  placeStillTemplate: null as string | null,
  /** A whole-run number for that template. Null until it is measured. */
  placeStillQuote: null as number | null,
  /** Environment templates read this day and refused: they do not start from the place file. */
  seenAndRejected: [
    "templates_text_prompt_to_360hdr.app",
    "template_qwen_Image_2512_360_lora",
    "3d_moge_panorama_to_mesh",
  ] as const,
  /**
   * Output nodes that touch a LoRA file and were refused.
   * Neither one keeps the LORA_MODEL that TrainLoraNode returns.
   */
  refusedLoraNodes: ["LoraExtractKJ", "LoraReduceRankKJ"] as const,
} as const;

/** A Comfy trained file can be wired only when a named node writes it and the run has a number. */
export function catalogAllowsComfyFile(): boolean {
  return CATALOG_WATCH.saveLoraPresent && CATALOG_WATCH.trainLoraWritesFile && CATALOG_WATCH.comfyFileQuote !== null;
}

/** Image d’un lieu can return only when a named template has a whole-run quote. */
export function catalogAllowsPlaceStill(): boolean {
  return CATALOG_WATCH.placeStillTemplate !== null && CATALOG_WATCH.placeStillQuote !== null;
}
