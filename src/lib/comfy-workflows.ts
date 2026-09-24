import { APP_LABELS, DATASET_SIZE, FLUX_STACK } from "./comfy-stack.ts";

export type Link = [string, number];
export interface ApiNode { class_type: string; inputs: Record<string, unknown>; _meta?: { title: string } }
export type ApiWorkflow = Record<string, ApiNode>;

const node = (class_type: string, inputs: Record<string, unknown>, title?: string): ApiNode =>
  title ? { class_type, inputs, _meta: { title } } : { class_type, inputs };

export const IDS = {
  unet: "1", clip: "2", vae: "3",
  listA: "20", listB: "21", list: "22", scale: "23",
  captions: "30", split: "31", dataset: "32", train: "33", loss: "34",
  seed: "40", prompt: "41", guidance: "42", negative: "43", lora: "44",
  latent: "45", sampler: "46", decode: "47", save: "48",
  controlLatent: "50", controlSampler: "51", controlDecode: "52", controlSave: "53",
} as const;

export const imageNodeId = (n: number) => String(100 + n);

// Two lines on purpose: one line would be silently repeated for every image by MakeTrainingDataset.
export const CAPTIONS_PLACEHOLDER = `COLLE ICI TES ${DATASET_SIZE} LÉGENDES, UNE PAR LIGNE.\nElles sortent de la checklist U*TTU (fichier captions_comfy.txt).`;
export const PROMPT_PLACEHOLDER = "montrigger_v1, three-quarter view, upper body shot, standing in a sunlit concrete workshop, soft window light";

function loaders(): ApiWorkflow {
  const { models } = FLUX_STACK;
  return {
    [IDS.unet]: node("UNETLoader", { unet_name: models.unet, weight_dtype: "default" }, "Flux.1 dev"),
    [IDS.clip]: node("DualCLIPLoader", { clip_name1: models.clipL, clip_name2: models.t5, type: "flux", device: "default" }, "Encodeurs texte Flux"),
    [IDS.vae]: node("VAELoader", { vae_name: models.vae }, "VAE Flux"),
  };
}

function imageBranch(model: Link, save: { latent: string; sampler: string; decode: string; save: string }, batch: number, prefix: string, title: string, exposeBatch: boolean): ApiWorkflow {
  const { sampling } = FLUX_STACK;
  return {
    [save.latent]: node("EmptySD3LatentImage", { width: sampling.width, height: sampling.height, batch_size: batch }, exposeBatch ? APP_LABELS.count : undefined),
    [save.sampler]: node("KSampler", {
      model, seed: [IDS.seed, 0], steps: sampling.steps, cfg: 1, sampler_name: sampling.sampler, scheduler: sampling.scheduler,
      positive: [IDS.guidance, 0], negative: [IDS.negative, 0], latent_image: [save.latent, 0], denoise: 1,
    }),
    [save.decode]: node("VAEDecode", { samples: [save.sampler, 0], vae: [IDS.vae, 0] }),
    [save.save]: node("SaveImage", { images: [save.decode, 0], filename_prefix: prefix }, title),
  };
}

function promptNodes(): ApiWorkflow {
  const { sampling, image } = FLUX_STACK;
  return {
    [IDS.seed]: node("PrimitiveInt", { value: image.seed }, APP_LABELS.seed),
    [IDS.prompt]: node("CLIPTextEncode", { text: PROMPT_PLACEHOLDER, clip: [IDS.clip, 0] }, APP_LABELS.prompt),
    [IDS.guidance]: node("FluxGuidance", { conditioning: [IDS.prompt, 0], guidance: sampling.guidance }),
    [IDS.negative]: node("ConditioningZeroOut", { conditioning: [IDS.prompt, 0] }),
  };
}

export function buildTrainWorkflow(): ApiWorkflow {
  const { training, image } = FLUX_STACK;
  const wf: ApiWorkflow = { ...loaders() };
  const listA: Record<string, unknown> = {};
  const listB: Record<string, unknown> = {};
  for (let n = 1; n <= DATASET_SIZE; n++) {
    wf[imageNodeId(n)] = node("LoadImage", { image: `DEPOSER-IMAGE-${String(n).padStart(2, "0")}.png` }, APP_LABELS.image(n));
    const target = n <= 10 ? listA : listB;
    target[`inputs.input${Object.keys(target).length}`] = [imageNodeId(n), 0];
  }
  Object.assign(wf, {
    [IDS.listA]: node("CreateList", listA, "Images 01–10"),
    [IDS.listB]: node("CreateList", listB, `Images 11–${DATASET_SIZE}`),
    [IDS.list]: node("CreateList", { "inputs.input0": [IDS.listA, 0], "inputs.input1": [IDS.listB, 0] }, `Dataset (${DATASET_SIZE} images)`),
    [IDS.scale]: node("ImageScaleToTotalPixels", { image: [IDS.list, 0], upscale_method: "lanczos", megapixels: training.megapixels, resolution_steps: training.resolutionSteps }, "Résolution d’entraînement"),
    [IDS.captions]: node("PrimitiveStringMultiline", { value: CAPTIONS_PLACEHOLDER }, APP_LABELS.captions),
    [IDS.split]: node("Basic data handling: StringSplitlinesDataList", { string: [IDS.captions, 0], keepends: false }, "1 ligne = 1 légende"),
    [IDS.dataset]: node("MakeTrainingDataset", { images: [IDS.scale, 0], vae: [IDS.vae, 0], clip: [IDS.clip, 0], texts: [IDS.split, 0] }),
    [IDS.train]: node("TrainLoraNode", {
      model: [IDS.unet, 0], latents: [IDS.dataset, 0], positive: [IDS.dataset, 1],
      batch_size: 1, grad_accumulation_steps: 1, steps: training.testSteps, learning_rate: training.learningRate, rank: training.rank,
      optimizer: "AdamW", loss_function: "MSE", seed: training.seed, training_dtype: "bf16", lora_dtype: "bf16",
      quantized_backward: false, algorithm: "LoRA", gradient_checkpointing: true, checkpoint_depth: 1, offloading: false,
      existing_lora: "[None]", bucket_mode: false, bypass_mode: false,
    }, APP_LABELS.steps),
    [IDS.loss]: node("LossGraphNode", { loss: [IDS.train, 1], filename_prefix: "c-micro/loss" }, APP_LABELS.loss),
    ...promptNodes(),
    [IDS.lora]: node("LoraModelLoader", { model: [IDS.unet, 0], lora: [IDS.train, 0], strength_model: image.strength, bypass: false }, APP_LABELS.strength),
    ...imageBranch([IDS.lora, 0], { latent: IDS.latent, sampler: IDS.sampler, decode: IDS.decode, save: IDS.save }, image.count, "c-micro/avec-lora", APP_LABELS.withLora, true),
    ...imageBranch([IDS.unet, 0], { latent: IDS.controlLatent, sampler: IDS.controlSampler, decode: IDS.controlDecode, save: IDS.controlSave }, 1, "c-micro/temoin-sans-lora", APP_LABELS.control, false),
  });
  return wf;
}

export function buildPromptTestWorkflow(): ApiWorkflow {
  return {
    ...loaders(),
    ...promptNodes(),
    ...imageBranch([IDS.unet, 0], { latent: IDS.latent, sampler: IDS.sampler, decode: IDS.decode, save: IDS.save }, 1, "c-micro/test-prompt", APP_LABELS.promptTest, false),
  };
}

export interface AppSelection { nodeId: number; widgetName: string }

export function trainAppInputs(): AppSelection[] {
  const images = Array.from({ length: DATASET_SIZE }, (_, i) => ({ nodeId: Number(imageNodeId(i + 1)), widgetName: "image" }));
  return [
    ...images,
    { nodeId: Number(IDS.captions), widgetName: "value" },
    { nodeId: Number(IDS.train), widgetName: "steps" },
    { nodeId: Number(IDS.prompt), widgetName: "text" },
    { nodeId: Number(IDS.lora), widgetName: "strength_model" },
    { nodeId: Number(IDS.seed), widgetName: "value" },
    { nodeId: Number(IDS.latent), widgetName: "batch_size" },
  ];
}

export const trainAppOutputs = () => [Number(IDS.save), Number(IDS.controlSave), Number(IDS.loss)];

export const promptAppInputs = (): AppSelection[] => [
  { nodeId: Number(IDS.prompt), widgetName: "text" },
  { nodeId: Number(IDS.seed), widgetName: "value" },
];

export const promptAppOutputs = () => [Number(IDS.save)];
