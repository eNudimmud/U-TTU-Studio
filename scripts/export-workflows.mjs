// Exports one Comfy workflow per studio gesture into workflows/<tab>/.
//   <id>.json      the official Comfy template the gesture comes from (UI format, open it in ComfyUI)
//   <id>.api.json  the exact API graph the studio sends (placeholders for files and text), wired gestures only
//   index.json     gesture → template, partner node or open weights, files
// Templates are read from github.com/Comfy-Org/workflow_templates. Partner nodes are
// detected with a local ComfyUI's /object_info (COMFY_URL, default http://127.0.0.1:8188)
// when it answers, else from the template name. Nothing is queued, nothing is spent.
//   node --experimental-strip-types scripts/export-workflows.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { REGISTRE } from "../src/lib/workflows/registre.ts";
import { wiredGraphs } from "../src/lib/workflows/export.ts";
import { FINAL_GRAPH } from "../src/lib/prise/finaliser.ts";
import { finalGraph } from "../src/lib/montage/finaliser.ts";

const RAW = "https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates";
const COMFY = process.env.COMFY_URL ?? "http://127.0.0.1:8188";

let apiNodes = null;
try {
  const info = await (await fetch(`${COMFY}/object_info`)).json();
  apiNodes = new Set(Object.entries(info).filter(([, def]) => def.api_node === true).map(([name]) => name));
  console.log(`object_info: ${apiNodes.size} partner nodes`);
} catch {
  console.log("object_info unreachable: partner flag from the template name");
}

function nodeTypes(workflow) {
  const types = new Set();
  for (const node of workflow.nodes ?? []) types.add(node.type);
  for (const sub of workflow.definitions?.subgraphs ?? []) for (const node of sub.nodes ?? []) types.add(node.type);
  return [...types].filter(type => !/^[0-9a-f-]{36}$/.test(type) && !["MarkdownNote", "Note", "Reroute"].includes(type));
}

const cache = new Map();
async function template(name) {
  if (!cache.has(name)) {
    const response = await fetch(`${RAW}/${name}.json`);
    if (!response.ok) throw new Error(`${name}: ${response.status}`);
    cache.set(name, await response.json());
  }
  return cache.get(name);
}

const json = value => `${JSON.stringify(value, null, 2)}\n`;
const wired = new Map(wiredGraphs().map(item => [item.id, item]));
const index = [];

async function exportOne(id, onglet, name, wiredGraph) {
  const workflow = await template(name);
  const types = nodeTypes(workflow);
  const partnerNodes = apiNodes ? types.filter(type => apiNodes.has(type)) : null;
  const sentPartner = wiredGraph && apiNodes ? Object.values(wiredGraph).some(node => apiNodes.has(node.class_type)) : null;
  mkdirSync(`workflows/${onglet}`, { recursive: true });
  writeFileSync(`workflows/${onglet}/${id}.json`, json(workflow));
  if (wiredGraph) writeFileSync(`workflows/${onglet}/${id}.api.json`, json(wiredGraph));
  index.push({
    id, onglet, template: name,
    ...(id === "prise-plan-cadre" ? { sources: ["workflows/cast/cast-photos.json", "workflows/prise/sources/image_qwen_image_instantx_controlnet.json"] } : {}),
    partner: partnerNodes ? partnerNodes.length > 0 : name.startsWith("api_"),
    partnerNodes: partnerNodes ?? [],
    sentPartner,
    template_file: `workflows/${onglet}/${id}.json`,
    api_file: wiredGraph ? `workflows/${onglet}/${id}.api.json` : null,
  });
}

mkdirSync("workflows/prise/sources", { recursive: true });
writeFileSync("workflows/prise/sources/image_qwen_image_instantx_controlnet.json", json(await template("image_qwen_image_instantx_controlnet")));
for (const row of REGISTRE) await exportOne(row.id, row.onglet, row.template, wired.get(row.id)?.graph ?? null);
for (const name of Object.values(FINAL_GRAPH)) await exportOne(name, "finaliser", name, null);
// The Finaliser the studio really sends: the RTX Video Super Resolution stage of the
// official template `utility_nvidia_rtx_video_enhance`, without its HDR and frame steps.
await exportOne("montage-finaliser", "finaliser", "utility_nvidia_rtx_video_enhance", finalGraph({ file: "uttu-montage.mp4", ratio: "16/9", resolution: "1080p", nettoyer: "aucun" }));

writeFileSync("workflows/index.json", json({ source: RAW, exported: new Date().toISOString().slice(0, 10), workflows: index }));
console.log(`${index.length} workflows, ${index.filter(item => item.api_file).length} API graphs`);
