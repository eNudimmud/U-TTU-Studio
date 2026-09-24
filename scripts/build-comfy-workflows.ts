import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPromptTestWorkflow, buildTrainWorkflow } from "../src/lib/comfy-workflows.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputs = {
  "comfy/c-micro-train-image.api.json": buildTrainWorkflow(),
  "comfy/c-micro-prompt-test.api.json": buildPromptTestWorkflow(),
};

for (const [file, workflow] of Object.entries(outputs)) {
  const target = join(root, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(workflow, null, 2)}\n`);
  console.log(`${file}: ${Object.keys(workflow).length} nodes`);
}
