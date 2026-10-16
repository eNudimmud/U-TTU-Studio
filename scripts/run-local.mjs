// Runs one exported studio graph on YOUR local ComfyUI (open weights, no credits).
//   node scripts/run-local.mjs workflows/prise/prise-plan.api.json \
//     --text "Uttu marche sous la pluie" --image uttu-personnage.jpg=./uttu.png --image uttu-lieu.jpg=./quai.png
// COMFY_URL defaults to http://127.0.0.1:8188. Partner-node graphs (FLUX 3 Image API, Nano Banana,
// ElevenLabs…) need a Comfy account key in ComfyUI and are refused here unless --allow-partner is set.

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const COMFY = process.env.COMFY_URL ?? "http://127.0.0.1:8188";
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
  else if (flag === "--image") { const [name, path] = (args.shift() ?? "").split("="); images.set(name, path); }
  else if (flag === "--allow-partner") allowPartner = true;
}

const graph = JSON.parse(readFileSync(file, "utf8"));
const info = await (await fetch(`${COMFY}/object_info`)).json();
const partner = Object.values(graph).filter(node => info[node.class_type]?.api_node).map(node => node.class_type);
if (partner.length && !allowPartner) throw new Error(`Partner nodes in this graph: ${partner.join(", ")}. Use --allow-partner.`);
const missing = Object.values(graph).filter(node => !info[node.class_type]).map(node => node.class_type);
if (missing.length) throw new Error(`Your ComfyUI lacks: ${[...new Set(missing)].join(", ")}. Update ComfyUI.`);

for (const [name, path] of images) {
  const form = new FormData();
  form.append("image", new Blob([readFileSync(path)]), name);
  form.append("overwrite", "true");
  const response = await fetch(`${COMFY}/upload/image`, { method: "POST", body: form });
  if (!response.ok) throw new Error(`upload ${basename(path)}: ${response.status}`);
}
for (const node of Object.values(graph)) {
  for (const [key, value] of Object.entries(node.inputs)) {
    if (typeof value === "string" && value.includes(PLACEHOLDER)) node.inputs[key] = value.replace(PLACEHOLDER, text);
  }
  if (node.class_type === "RandomNoise") node.inputs.noise_seed = Math.floor(Math.random() * 2 ** 31);
}
const queued = await (await fetch(`${COMFY}/prompt`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: graph }) })).json();
if (!queued.prompt_id) throw new Error(JSON.stringify(queued.node_errors ?? queued, null, 2));
console.log(`queued ${queued.prompt_id}`);
for (;;) {
  await new Promise(resolve => setTimeout(resolve, 3000));
  const history = await (await fetch(`${COMFY}/history/${queued.prompt_id}`)).json();
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
