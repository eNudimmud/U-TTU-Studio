// Runs one exported studio graph on YOUR local ComfyUI (open weights, no credits).
//   node scripts/run-local.mjs workflows/prise/prise-plan.api.json \
//     --text "Uttu marche sous la pluie" --image uttu-personnage.jpg=./uttu.png --image uttu-lieu.jpg=./quai.png
// COMFY_URL defaults to http://127.0.0.1:8188. Partner-node graphs (FLUX 3 Image API, Nano Banana,
// ElevenLabs…) need a Comfy account key in ComfyUI and are refused here unless --allow-partner is set.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { randomUUID } from "node:crypto";

const endpoint = new URL(process.env.COMFY_URL ?? "http://127.0.0.1:8188");
if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('COMFY_URL must be an HTTP(S) base URL without credentials or query parameters.');
const COMFY = endpoint.href.replace(/\/$/, '');
const request = (path, init = {}) => fetch(`${COMFY}${path}`, { ...init, signal: AbortSignal.timeout(60_000) });
const PLACEHOLDER = "<texte du visiteur>";
const args = process.argv.slice(2);
const file = args.shift();
if (!file) throw new Error("Usage: node scripts/run-local.mjs <graph.api.json> --text \"…\" --image name=path");
let text = "";
const images = new Map();
let allowPartner = false;
while (args.length) {
  const flag = args.shift();
  if (flag === "--text") text = args.shift() ?? "";
  else if (flag === "--image") {
    const pair = args.shift() ?? ''; const at = pair.indexOf('=');
    if (at < 1 || at === pair.length - 1) throw new Error('Use --image input-name=local-path');
    images.set(pair.slice(0, at), pair.slice(at + 1));
  }
  else if (flag === "--allow-partner") allowPartner = true;
  else throw new Error(`Unknown option: ${flag}`);
}

const graph = JSON.parse(readFileSync(file, "utf8"));
const inputs = new Set(Object.values(graph).flatMap(node => Object.values(node.inputs ?? {})).filter(value => typeof value === 'string'));
for (const name of images.keys()) if (!inputs.has(name)) throw new Error(`No input named ${name} in this graph; nothing was uploaded.`);
const infoResponse = await request('/object_info');
if (!infoResponse.ok) throw new Error(`Cannot inspect ComfyUI: ${infoResponse.status}`);
const info = await infoResponse.json();
const partner = Object.values(graph).filter(node => info[node.class_type]?.api_node).map(node => node.class_type);
if (partner.length && !allowPartner) throw new Error(`Partner nodes in this graph: ${partner.join(", ")}. Use --allow-partner.`);
const missing = Object.values(graph).filter(node => !info[node.class_type]).map(node => node.class_type);
if (missing.length) throw new Error(`Your ComfyUI lacks: ${[...new Set(missing)].join(", ")}. Update ComfyUI.`);

const uploaded = new Map();
for (const [name, path] of images) {
  const form = new FormData();
  form.append("image", new Blob([readFileSync(path)]), `uttu-${randomUUID()}-${basename(name)}`);
  form.append("overwrite", "false");
  const response = await request('/upload/image', { method: "POST", body: form });
  if (!response.ok) throw new Error(`upload ${basename(path)}: ${response.status}`);
  const saved = await response.json();
  if (typeof saved.name !== 'string' || !saved.name) throw new Error('Upload returned no filename; nothing was submitted.');
  uploaded.set(name, saved.subfolder ? `${saved.subfolder}/${saved.name}` : saved.name);
}
for (const node of Object.values(graph)) {
  for (const [key, value] of Object.entries(node.inputs)) {
    if (typeof value === "string" && value.includes(PLACEHOLDER)) node.inputs[key] = value.replace(PLACEHOLDER, text);
    if (typeof value === 'string' && uploaded.has(value)) node.inputs[key] = uploaded.get(value);
  }
  if (node.class_type === "RandomNoise") node.inputs.noise_seed = Math.floor(Math.random() * 2 ** 31);
}
const response = await request('/prompt', { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: graph }) });
if (!response.ok) throw new Error(`ComfyUI refused the graph (${response.status}). No automatic retry.`);
const queued = await response.json();
if (!queued.prompt_id) throw new Error(JSON.stringify(queued.node_errors ?? queued, null, 2));
console.log(`queued ${queued.prompt_id}`);
const deadline = Date.now() + 35 * 60_000;
for (;;) {
  if (Date.now() > deadline) throw new Error(`Stopped waiting for ${queued.prompt_id}; it may still be running. Check ComfyUI, do not resubmit blindly.`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  const response = await request(`/history/${encodeURIComponent(queued.prompt_id)}`);
  if (!response.ok) throw new Error(`Cannot read job ${queued.prompt_id}: ${response.status}. No automatic resubmission.`);
  const history = await response.json();
  const entry = history[queued.prompt_id];
  if (!entry) continue;
  if (entry.status?.status_str === "error") throw new Error("ComfyUI reported an error, see its console.");
  for (const output of Object.values(entry.outputs ?? {})) {
    for (const item of [...(output.images ?? []), ...(output.videos ?? []), ...(output.gifs ?? []), ...(output.audio ?? [])]) {
      console.log(`${COMFY}/view?filename=${encodeURIComponent(item.filename)}&subfolder=${encodeURIComponent(item.subfolder ?? "")}&type=${item.type ?? "output"}`);
    }
  }
  break;
}
