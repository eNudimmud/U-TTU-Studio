import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { COMFY_CLOUD, DATASET_SIZE, FLUX_STACK, estimatePromptTest, estimateTrainRun, maxSafeSteps } from "../src/lib/comfy-stack.ts";
import {
  IDS, buildPromptTestWorkflow, buildTrainWorkflow, imageNodeId, promptAppInputs, promptAppOutputs, trainAppInputs, trainAppOutputs,
  type ApiWorkflow, type Link,
} from "../src/lib/comfy-workflows.ts";

interface GraphNode { id: number; type: string; title?: string; inputs: { name: string; link: number | null }[]; widgets_values?: unknown[] }
interface Graph { nodes: GraphNode[]; links: [number, number, number, number, number, string][]; extra: { linearMode: boolean; linearData: { inputs: [number, string][]; outputs: number[] } } }

const readJson = <T>(path: string): T => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8")) as T;
const isLink = (value: unknown): value is Link => Array.isArray(value) && value.length === 2 && typeof value[0] === "string";

function assertGraphMatches(graph: Graph, api: ApiWorkflow) {
  assert.equal(graph.nodes.length, Object.keys(api).length);
  for (const [id, node] of Object.entries(api)) {
    const saved = graph.nodes.find(item => item.id === Number(id));
    assert.ok(saved, `node ${id} missing`);
    assert.equal(saved.type, node.class_type, `node ${id} type`);
    if (node._meta?.title) assert.equal(saved.title, node._meta.title, `node ${id} title`);
    const widgets = [...(saved.widgets_values ?? [])];
    for (const [name, value] of Object.entries(node.inputs)) {
      if (isLink(value)) {
        const slot: number = saved.inputs.findIndex(input => input.name === name);
        assert.ok(slot >= 0, `node ${id} input ${name}`);
        const link: Graph["links"][number] | undefined = graph.links.find(item => item[3] === Number(id) && item[4] === slot);
        assert.ok(link, `node ${id} input ${name} not wired`);
        assert.deepEqual([link[1], link[2]], [Number(value[0]), value[1]], `node ${id} input ${name} source`);
      } else {
        const index = widgets.findIndex(item => item === value);
        assert.ok(index >= 0, `node ${id} widget ${name}=${JSON.stringify(value)} missing from ${JSON.stringify(saved.widgets_values)}`);
        widgets.splice(index, 1);
      }
    }
  }
}

describe("Comfy workflows", () => {
  const train = buildTrainWorkflow();

  it("feeds exactly 15 uploaded images, in slot order, into one training list", () => {
    const loaders = Object.entries(train).filter(([, node]) => node.class_type === "LoadImage");
    assert.equal(loaders.length, DATASET_SIZE);
    assert.deepEqual(loaders.map(([, node]) => node._meta?.title), Array.from({ length: DATASET_SIZE }, (_, i) => `Image ${String(i + 1).padStart(2, "0")}`));
    const order = [IDS.listA, IDS.listB].flatMap(id => Object.values(train[id].inputs).map(value => (value as Link)[0]));
    assert.deepEqual(order, Array.from({ length: DATASET_SIZE }, (_, i) => imageNodeId(i + 1)));
    assert.deepEqual(train[IDS.list].inputs, { "inputs.input0": [IDS.listA, 0], "inputs.input1": [IDS.listB, 0] });
    assert.deepEqual(train[IDS.dataset].inputs.texts, [IDS.split, 0]);
  });

  it("trains on Flux.1 dev and renders with and without the fresh LoRA from the same seed", () => {
    assert.equal(train[IDS.unet].inputs.unet_name, FLUX_STACK.models.unet);
    assert.equal(train[IDS.train].class_type, "TrainLoraNode");
    assert.equal(train[IDS.train].inputs.steps, FLUX_STACK.training.testSteps);
    assert.deepEqual(train[IDS.lora].inputs.lora, [IDS.train, 0]);
    assert.deepEqual(train[IDS.sampler].inputs.model, [IDS.lora, 0]);
    assert.deepEqual(train[IDS.controlSampler].inputs.model, [IDS.unet, 0]);
    assert.deepEqual(train[IDS.sampler].inputs.seed, [IDS.seed, 0]);
    assert.deepEqual(train[IDS.controlSampler].inputs.seed, [IDS.seed, 0]);
    assert.ok(String(train[IDS.captions].inputs.value).split("\n").length > 1, "a one-line placeholder would be repeated for every image");
  });

  it("matches the committed API files", () => {
    assert.deepEqual(readJson("comfy/c-micro-train-image.api.json"), train);
    assert.deepEqual(readJson("comfy/c-micro-prompt-test.api.json"), buildPromptTestWorkflow());
  });

  it("matches the graphs saved in Comfy Cloud, App Mode config included", () => {
    const savedTrain = readJson<Graph>("public/comfy/c-micro-train-image.json");
    assertGraphMatches(savedTrain, train);
    assert.equal(savedTrain.extra.linearMode, true);
    assert.deepEqual(savedTrain.extra.linearData.inputs, trainAppInputs().map(item => [item.nodeId, item.widgetName]));
    assert.deepEqual(savedTrain.extra.linearData.outputs, trainAppOutputs());
    const savedPrompt = readJson<Graph>("public/comfy/c-micro-prompt-test.json");
    assertGraphMatches(savedPrompt, buildPromptTestWorkflow());
    assert.deepEqual(savedPrompt.extra.linearData.inputs, promptAppInputs().map(item => [item.nodeId, item.widgetName]));
    assert.deepEqual(savedPrompt.extra.linearData.outputs, promptAppOutputs());
    for (const graph of [savedTrain, savedPrompt]) {
      const seed = graph.nodes.find(node => node.id === Number(IDS.seed));
      assert.equal(seed?.widgets_values?.[1], "fixed", "a randomized seed would break the with/without comparison");
    }
  });
});

describe("cost estimates", () => {
  it("prices GPU seconds at the published Comfy rate", () => {
    const estimate = estimateTrainRun(800, 1);
    assert.equal(estimate.credits.low, estimate.seconds.low * COMFY_CLOUD.gpuCreditsPerSecond);
    assert.equal(estimate.usd.high, estimate.credits.high / COMFY_CLOUD.creditsPerUsd);
    assert.ok(estimate.seconds.low < estimate.seconds.high);
  });

  it("keeps the default run inside the 30 minute cap, even pessimistically", () => {
    const steps = FLUX_STACK.training.steps;
    assert.ok(maxSafeSteps("standard", FLUX_STACK.image.maxCount) >= steps);
    assert.ok(estimateTrainRun(steps, FLUX_STACK.image.maxCount).seconds.high < COMFY_CLOUD.runtimeLimitMinutes.standard * 60);
    assert.ok(maxSafeSteps("pro", 1) > maxSafeSteps("standard", 1));
  });

  it("makes the dry run and the prompt test much cheaper than the real run", () => {
    const real = estimateTrainRun(FLUX_STACK.training.steps, 1).credits.high;
    assert.ok(estimateTrainRun(FLUX_STACK.training.testSteps, 1).credits.high < real / 3);
    assert.ok(estimatePromptTest().credits.high < real / 10);
  });
});
