// Text and filenames painted onto the official H3 reference graph.
// The template address accepts an id only. Bytes never travel in that URL.
// Node 137 is Picture 1 (the held person). Node 139 is Picture 2 (the place,
// or a second photo of the person). Node 138 is the prompt. Nodes 145 and 146
// stay as the template shipped them.

export const TAKE_PROMPT_MAX = 1600;

const ASSET_UNSAFE = /[\\/\u0000-\u001f]/;

export type PictureRole = "place" | "second-look" | "none";

export type TakePromptInput = {
  trigger: string;
  invariants: string;
  placeName: string;
  placeNote: string;
  takeLine: string;
  picture2: PictureRole;
};

export type TakeImageNames = {
  "137"?: string;
  "139"?: string;
};

export type TakeGraphPatch = {
  prompt: string;
  images: TakeImageNames;
};

type WidgetNode = {
  id?: number | string;
  widgets_values?: unknown[];
  widgets_values_named?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
};

/** A Comfy asset name the graph may store. Anything else stays off the node. */
export function safeAssetName(name: unknown): string {
  if (typeof name !== "string") return "";
  const clean = name.trim();
  if (!clean || clean.length > 180) return "";
  if (ASSET_UNSAFE.test(clean) || clean === "." || clean === "..") return "";
  return clean;
}

function clip(value: string, max: number): string {
  return value.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Prompt for node 138. Picture tags follow the stock link order. */
export function buildTakePrompt(input: TakePromptInput): string {
  const lines = ["<Picture 1> keeps the same person for the whole shot."];
  const trigger = clip(input.trigger, 40);
  if (/^[a-z][a-z0-9_]{3,23}$/.test(trigger)) lines.push(`The call word is ${trigger}.`);
  const invariants = clip(input.invariants, 400);
  if (invariants) lines.push(`What does not change: ${invariants}.`);
  if (input.picture2 === "place") {
    const place = clip(input.placeName, 80) || "the set";
    lines.push(`<Picture 2> is the place, ${place}.`);
    const note = clip(input.placeNote, 280);
    if (note) lines.push(`The place holds: ${note}.`);
  } else if (input.picture2 === "second-look") {
    lines.push("<Picture 2> is another photo of the same person.");
  }
  const shot = clip(input.takeLine, 180);
  if (shot) lines.push(`The shot: ${shot}.`);
  return lines.join(" ").slice(0, TAKE_PROMPT_MAX);
}

function paintWidgets(node: WidgetNode, kind: "prompt" | "image", value: string) {
  if (kind === "prompt") {
    if (!Array.isArray(node.widgets_values)) node.widgets_values = [value];
    else node.widgets_values[0] = value;
    if (!node.widgets_values_named || typeof node.widgets_values_named !== "object") node.widgets_values_named = {};
    node.widgets_values_named.value = value;
    return;
  }
  if (!Array.isArray(node.widgets_values)) node.widgets_values = [value, "image"];
  else node.widgets_values[0] = value;
  if (!node.widgets_values_named || typeof node.widgets_values_named !== "object") node.widgets_values_named = {};
  node.widgets_values_named.image = value;
  if (typeof node.widgets_values_named.upload !== "string") node.widgets_values_named.upload = "image";
}

function paintApi(node: WidgetNode, id: string, patch: TakeGraphPatch) {
  if (!node.inputs || typeof node.inputs !== "object") node.inputs = {};
  if (id === "138" && patch.prompt) node.inputs.value = patch.prompt;
  const image = id === "137" || id === "139" ? safeAssetName(patch.images[id]) : "";
  if (image) node.inputs.image = image;
}

/** Copy of the template graph with the brief painted. Other nodes are left alone. */
export function applyTakeToTemplate(graph: unknown, patch: TakeGraphPatch): unknown {
  if (!graph || typeof graph !== "object") return graph;
  const clone = structuredClone(graph) as Record<string, unknown> & { nodes?: unknown[] };
  const prompt = clip(patch.prompt, TAKE_PROMPT_MAX);
  const images: TakeImageNames = {
    "137": safeAssetName(patch.images["137"]) || undefined,
    "139": safeAssetName(patch.images["139"]) || undefined,
  };
  const safePatch: TakeGraphPatch = { prompt, images };
  if (Array.isArray(clone.nodes)) {
    for (const item of clone.nodes) {
      if (!item || typeof item !== "object") continue;
      const node = item as WidgetNode;
      const id = String(node.id ?? "");
      if (id === "138" && prompt) paintWidgets(node, "prompt", prompt);
      if ((id === "137" || id === "139") && images[id]) paintWidgets(node, "image", images[id]);
    }
    return clone;
  }
  for (const id of ["137", "138", "139"]) {
    const node = clone[id];
    if (!node || typeof node !== "object") continue;
    paintApi(node as WidgetNode, id, safePatch);
  }
  return clone;
}
