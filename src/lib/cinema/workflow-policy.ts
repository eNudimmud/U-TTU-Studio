// Open-weights policy for every paid route (CINEMA_LOTS CE0, ADR-02, CINEMA_WORKFLOWS « Agent »).
// One guard decides whether a graph or a hosted-model call may leave the studio while the contest
// mode is on. It reads the graph itself, not a label: API format, UI format, nested subgraphs and
// group nodes. A preference saved before the mode (GPT-5 Nano agent, Nano Banana engine) never
// reaches the network: it is refused here, not just hidden in a menu.
//
// Paid routes of the studio (docs/implementation/CE0_NATIVE_AGENT.md has the table):
//   1. render client `submit` (src/lib/render/client.ts): every Comfy Cloud graph → assertSubmittable
//   2. /studio-agent/chat (src/lib/agent/uttu-comfy.ts): Comfy Router, hosted GPT-5 Nano → assertRouteAllowed

import { OPEN_WEIGHTS_MODE, LICENCE_RESTREINTE } from "../open-weights.ts";
import { CinemaError } from "./types.ts";

/**
 * Partner (paid API) node classes. A superset of every `partnerNodes` of workflows/index.json
 * (tests/cinema-workflow-policy.test.ts checks it), plus the closed hosted LLM nodes Comfy ships.
 */
export const PARTNER_NODE = /(?:Gemini|NanoBanana|Kling|Vidu|Tripo|Meshy|OpenAI|Ideogram|ByteDance|Seedream|Seedance|Flux3Image|ElevenLabs|Sonilo|Hailuo|Minimax(?:Hailuo|Video|Image|Speech|Music)|Bria|SyncSo|SyncLipSync|Veed|Grok|Higgsfield|Mirelo|Magnific|Wavespeed|Tencent|Runway|Luma|Pika(?:Text|Image|Scenes|Swaps|Additions|Frames)|Pixverse|Recraft|Stability|Moonvalley|Topaz|Rodin|Hunyuan3DApi|Anthropic|Claude|OpenRouter|ComfyRouter|Router|Vertex|Veo|Sora|Wan(?:Text|Image)ToVideoApi|BFL|FluxPro|FluxKontextPro|Midjourney|Hitpaw|Krea|Ltxv(?:Api)|Api(?:Node)?$)/;

/**
 * Native nodes that run closed weights on the provider (no public model). Hidden in the contest
 * mode the same way: RTX Video was replaced by SeedVR2 for the finishing pass (#220).
 */
export const CLOSED_NATIVE_NODES: Readonly<Record<string, string>> = {
  RTXVideoSuperResolution: "NVIDIA RTX Video SDK, closed weights",
};

/** Hosted closed models a node input or a route may name. */
export const CLOSED_MODEL = /(?:^|[\/\s_-])(?:gpt-?[345](?:[.\-_]\w+)*|gpt-image|o[134]-(?:mini|pro)|dall-?e|gemini|nano[-_ ]?banana|claude|grok-|veo-?\d|sora|kling|seedream|seedance|ideogram|imagen|midjourney)(?:$|[\/\s_.-])|^(?:openai|anthropic|google|x-ai|xai)\//i;

/** Model files with an open licence the studio checked (README / model card at the source). */
export const OPEN_MODEL_LICENCES: ReadonlyArray<{ match: RegExp; license: string; source: string }> = [
  { match: /^qwen3vl_/i, license: "Apache-2.0", source: "https://huggingface.co/Comfy-Org/Qwen3-VL" },
  { match: /^qwen[_-]?image/i, license: "Apache-2.0", source: "https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI" },
  { match: /^qwen_2\.5_vl/i, license: "Apache-2.0", source: "https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI" },
  { match: /^qwen_3_/i, license: "Apache-2.0", source: "https://huggingface.co/Comfy-Org" },
  { match: /^flux-?2-klein|^flux2-klein|^flux-2-klein/i, license: "Apache-2.0 (Klein 4B)", source: "https://huggingface.co/black-forest-labs" },
  { match: /^ltx-?2/i, license: "LTX-2 Community License", source: "https://huggingface.co/Lightricks" },
  { match: /minimax|fasth3|(?:^|[_-])h3[_-]/i, license: "MiniMax H3 Community License (attribution)", source: "PR #219" },
  { match: /seedvr2/i, license: "Apache-2.0", source: "https://huggingface.co/ByteDance-Seed/SeedVR2-3B" },
  { match: /trellis/i, license: "MIT", source: "https://huggingface.co/microsoft/TRELLIS.2-4B" },
  { match: /^umt5|^t5xxl|^clip_l|^gemma/i, license: "Apache-2.0 / Gemma terms", source: "text encoders" },
  { match: /^wan2|^wan_2/i, license: "Apache-2.0", source: "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged" },
];

/** Model files whose licence restricts use: refused in the contest mode (LICENCE_RESTREINTE, JD 01 Nov). */
export const RESTRICTED_MODEL = /hunyuan_?3d/i;

const MODEL_FILE = /\.(?:safetensors|gguf|ckpt|pt|pth|bin|sft|onnx)$/i;

export interface GraphInspection {
  nodeTypes: string[];
  partnerNodes: string[];
  closedNodes: string[];
  models: string[];
  closedModels: string[];
  restrictedModels: string[];
  /** Model files with no checked licence: reported, not refused (the table grows with qualification). */
  unknownLicences: string[];
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => !!value && typeof value === "object" && !Array.isArray(value);

/**
 * Every node of a Comfy graph, whatever its shape: API prompt (`{id: {class_type, inputs}}`),
 * UI workflow (`nodes[]` with `type`/`widgets_values`), `definitions.subgraphs[]`, group nodes
 * (`extra.groupNodes`) and API prompts wrapped as `{prompt}`. Unknown shapes contribute nothing
 * (an empty graph runs nothing and costs nothing; the provider refuses it).
 */
function collectNodes(graph: unknown, out: { type: string; values: unknown[] }[], seen = new Set<unknown>()): void {
  if (!isObject(graph) || seen.has(graph)) return;
  seen.add(graph);
  if (isObject(graph.prompt)) collectNodes(graph.prompt, out, seen);
  if (Array.isArray(graph.nodes)) {
    for (const node of graph.nodes) {
      if (!isObject(node)) continue;
      const type = typeof node.type === "string" ? node.type : typeof node.class_type === "string" ? node.class_type : "";
      const values: unknown[] = [];
      if (Array.isArray(node.widgets_values)) values.push(...node.widgets_values);
      else if (isObject(node.widgets_values)) values.push(...Object.values(node.widgets_values));
      if (isObject(node.inputs)) values.push(...Object.values(node.inputs));
      if (isObject(node.properties) && Array.isArray(node.properties.models)) values.push(...node.properties.models.map(m => isObject(m) ? m.name : m));
      if (type) out.push({ type, values });
      if (isObject(node.subgraph)) collectNodes(node.subgraph, out, seen);
    }
  }
  for (const holder of [graph.definitions, isObject(graph.extra) ? graph.extra : undefined]) {
    if (!isObject(holder)) continue;
    if (Array.isArray(holder.subgraphs)) for (const sub of holder.subgraphs) collectNodes(sub, out, seen);
    if (isObject(holder.groupNodes)) for (const group of Object.values(holder.groupNodes)) collectNodes(group, out, seen);
  }
  if (!Array.isArray(graph.nodes)) {
    for (const node of Object.values(graph)) {
      if (isObject(node) && typeof node.class_type === "string") {
        out.push({ type: node.class_type, values: isObject(node.inputs) ? Object.values(node.inputs) : [] });
      }
    }
  }
}

function flatStrings(values: unknown[], out: string[] = []): string[] {
  for (const value of values) {
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) flatStrings(value, out);
    else if (isObject(value)) flatStrings(Object.values(value), out);
  }
  return out;
}

export function isPartnerNode(type: string): boolean {
  return PARTNER_NODE.test(type) && !/^(?:Save|Load|Preview)/.test(type);
}

export function modelLicence(file: string): { license: string; source: string } | null {
  const base = file.split(/[\\/]/).pop() ?? file;
  const hit = OPEN_MODEL_LICENCES.find(entry => entry.match.test(base));
  return hit ? { license: hit.license, source: hit.source } : null;
}

export function inspectGraph(graph: unknown): GraphInspection {
  const nodes: { type: string; values: unknown[] }[] = [];
  collectNodes(graph, nodes);
  const uniq = (list: string[]) => [...new Set(list)].sort();
  const nodeTypes = uniq(nodes.map(node => node.type));
  const models = uniq(nodes.flatMap(node => flatStrings(node.values).filter(value => MODEL_FILE.test(value.trim()))));
  const named = uniq(nodes.flatMap(node => flatStrings(node.values).filter(value => value.length < 120 && CLOSED_MODEL.test(value.trim()) && (MODEL_FILE.test(value) || /\//.test(value) || /^[\w.\-]+$/.test(value)))));
  return {
    nodeTypes,
    partnerNodes: nodeTypes.filter(isPartnerNode),
    closedNodes: nodeTypes.filter(type => type in CLOSED_NATIVE_NODES),
    models,
    closedModels: named,
    restrictedModels: models.filter(model => RESTRICTED_MODEL.test(model)),
    unknownLicences: models.filter(model => !modelLicence(model) && !RESTRICTED_MODEL.test(model)),
  };
}

export interface PolicyVerdict { allowed: boolean; reasons: string[]; inspection: GraphInspection }

export function graphVerdict(graph: unknown, openWeightsMode: boolean = OPEN_WEIGHTS_MODE): PolicyVerdict {
  const inspection = inspectGraph(graph);
  if (!openWeightsMode) return { allowed: true, reasons: [], inspection };
  const reasons = [
    ...inspection.partnerNodes.map(type => `partner node ${type}`),
    ...inspection.closedNodes.map(type => `closed weights ${type}`),
    ...inspection.closedModels.map(model => `closed model ${model}`),
    ...inspection.restrictedModels.map(model => `restricted licence ${model}`),
  ];
  return { allowed: reasons.length === 0, reasons, inspection };
}

/** The common guard of every Comfy submit. Throws `MODEL_INELIGIBLE` before any network call. */
export function assertSubmittable(graph: unknown, options: { openWeightsMode?: boolean } = {}): GraphInspection {
  const verdict = graphVerdict(graph, options.openWeightsMode ?? OPEN_WEIGHTS_MODE);
  if (!verdict.allowed) throw new CinemaError("MODEL_INELIGIBLE", "This workflow is not eligible in open-weights mode.", verdict.reasons);
  return verdict.inspection;
}

/** Hosted-model routes (not a graph): the agent's Comfy Router call. */
export type PaidRoute = { route: "studio-agent.router"; model: string };

export function routeAllowed(route: PaidRoute, openWeightsMode: boolean = OPEN_WEIGHTS_MODE): boolean {
  if (!openWeightsMode) return true;
  // A Router call is a hosted provider model by construction: none is open-weights in the studio.
  return false;
}

export function assertRouteAllowed(route: PaidRoute, openWeightsMode: boolean = OPEN_WEIGHTS_MODE): void {
  if (!routeAllowed(route, openWeightsMode)) {
    throw new CinemaError("MODEL_INELIGIBLE", "Hosted model refused in open-weights mode.", [`${route.route}: ${route.model}`]);
  }
}

/**
 * Which agent engine a saved preference resolves to. In the contest mode the answer is always the
 * native Qwen3-VL workflow, whatever an older `localStorage` says (« GPT-5 Nano » preference).
 */
export type AgentEngine = "native-qwen3vl" | "router-gpt5-nano";
export function agentEngine(saved: unknown, openWeightsMode: boolean = OPEN_WEIGHTS_MODE): AgentEngine {
  if (openWeightsMode) return "native-qwen3vl";
  return saved === "router-gpt5-nano" ? "router-gpt5-nano" : "native-qwen3vl";
}

/** Template ids hidden for their licence; re-exported so one module answers « may this run? ». */
export const RESTRICTED_TEMPLATES: readonly string[] = Object.keys(LICENCE_RESTREINTE);
