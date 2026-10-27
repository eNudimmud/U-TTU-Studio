// A still on the visitor's own Comfy account, through the same client as a take.
// The graph is the template's nodes. Nothing here opens a network by itself.

import { measuredCost } from "../credits.ts";
import { imageOutput, jobStage, RenderError, type JobDetail, type OutputRef, type RenderClient } from "../render/client.ts";
import { instantxCadreGraph, INSTANTX_CADRE_TEMPLATE } from "../render/instantx-cadre.ts";
import { KLEIN_REFS_MAX, kleinNodes, type KleinAspect } from "../render/klein-graph.ts";
import type { ApiGraph } from "../render/take-graph.ts";
import type { CreationQuote } from "./quotes.ts";
import { CAST_PHOTO_QUOTE, CAST_SHEET_QUOTE, CAST_TEXT_QUOTE, DECOR_PHOTO_QUOTE, DECOR_TEXT_QUOTE } from "./quotes.ts";

/** `cadre-decor`: the kept 3D colour frame alone, via InstantX + Lotus (decor-cadre.ts). */
export type StillKind = "texte-cast" | "texte-decor" | "photo-decor" | "photo-cast" | "planche" | "cadre-decor";

/** Which graph family builds the still. Read from the gesture's template. */
export type StillEngine = "klein" | "flux3" | "nano" | "instantx";

export function stillEngine(template: string | undefined): StillEngine {
  if (!template || template.startsWith("image_flux3_klein")) return "klein";
  if (template === INSTANTX_CADRE_TEMPLATE || template.includes("instantx_controlnet")) return "instantx";
  if (template.startsWith("api_bfl_flux3")) return "flux3";
  if (template.startsWith("api_nano_banana") || template === "templates-character_sheet") return "nano";
  return "klein";
}

export type CadreStillLayout = "depth-control" | "frame-first" | "photo-lines";

export interface StillRunInput {
  kind: StillKind;
  /** The gesture template. FLUX 3 Klein when absent. */
  template?: string;
  prompt: string;
  pictures: readonly { blob: Blob; name: string }[];
  seed: number;
  clientId: string;
  balanceBefore: number;
  /** Cadre-decor only: depth-control (InstantX) is the live path; legacy aliases accepted. */
  cadreLayout?: CadreStillLayout;
}

export interface StillRunResult {
  jobId: string;
  image: Blob;
  filename: string;
  balanceBefore: number;
  balanceAfter: number | null;
  costCredits: number | null;
}

export interface StillRunOptions {
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  pollMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const SYSTEM = "You are an expert image-generation engine. You must ALWAYS produce an image. Interpret the text as visual directions. No letters in the image.";

const sleepDefault = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export function quoteForKind(kind: StillKind): CreationQuote {
  if (kind === "planche") return CAST_SHEET_QUOTE;
  if (kind === "photo-decor" || kind === "cadre-decor") return DECOR_PHOTO_QUOTE;
  if (kind === "texte-decor") return DECOR_TEXT_QUOTE;
  return CAST_TEXT_QUOTE;
}

function seedOf(seed: number): number {
  return Number.isSafeInteger(seed) && seed >= 0 ? seed : 0;
}

function save(id: string, from: string, prefix: string): ApiGraph[string] {
  return {
    class_type: "SaveImageAdvanced",
    inputs: {
      images: [from, 0],
      filename_prefix: prefix,
      format: "png",
      "format.bit_depth": "8-bit",
      "format.input_color_space": "sRGB",
    },
    _meta: { title: id === "save" ? "Enregistrer" : "Enregistrer la planche" },
  };
}

const SUFFIX: Record<StillKind, string> = {
  "texte-cast": "One fictional person, character sheet: front face, three-quarter, profile, full body. Neutral background. No text.",
  "texte-decor": "Cinema still, 16:9, empty of people. No text.",
  "photo-cast": "The same fictional person as the reference images. Keep the face. No text.",
  "photo-decor": "Cinema still, 16:9, the same place as the reference image, empty of people. No text.",
  planche: "",
  // The whole instruction is in the visitor prompt (cadrePrompt): nothing to add.
  "cadre-decor": "",
};

function aspectOf(kind: StillKind): KleinAspect {
  return kind === "texte-decor" || kind === "photo-decor" || kind === "cadre-decor" ? "16:9" : "3:4";
}

function needsPhoto(kind: StillKind, images: readonly string[]): void {
  if (kind === "cadre-decor") {
    // The frame alone is enough: the place goes in the prompt, photos are optional.
    if (!images[0]) throw new Error("Le décor part d’un cadre 3D gardé.");
    return;
  }
  if (kind === "texte-cast" || kind === "texte-decor" || images[0]) return;
  throw new Error(kind === "photo-decor" ? "Le décor part d’une photo." : kind === "planche" ? "La planche part d’une photo." : "Le personnage part d’une photo.");
}

function loads(graph: ApiGraph, images: readonly string[], max: number): [string, number][] {
  return images.slice(0, max).map((image, index) => {
    const id = index === 0 ? "load" : `load${index + 1}`;
    graph[id] = { class_type: "LoadImage", inputs: { image }, _meta: { title: `Photo ${index + 1}` } };
    return [id, 0];
  });
}

/** FLUX 3 Image Klein (open weights). Edits take up to four references. */
function kleinStill(input: { kind: StillKind; prompt: string; images: readonly string[]; seed: number; cadreLayout?: CadreStillLayout }): ApiGraph {
  const kind = input.kind === "planche" ? "photo-cast" : input.kind;
  needsPhoto(input.kind, input.images);
  const graph: ApiGraph = {};
  const refs = kind === "texte-cast" || kind === "texte-decor" ? [] : loads(graph, input.images, KLEIN_REFS_MAX);
  if (kind === "cadre-decor") {
    if (input.cadreLayout === "photo-lines") {
      graph.load._meta = { title: "Photo du lieu (style)" };
      if (refs[1]) graph[refs[1][0]]._meta = { title: "Cadre 3D (lignes / structure)" };
      refs.slice(2).forEach(([id], index) => { graph[id]._meta = { title: `Photo du lieu ${index + 2}` }; });
    } else {
      graph.load._meta = { title: "Cadre 3D (base fixe)" };
      refs.slice(1).forEach(([id], index) => { graph[id]._meta = { title: `Photo du lieu ${index + 1}` }; });
    }
  }
  const sheet = input.kind === "planche" ? "Turnaround of this fictional person: front, three-quarter, profile, back, full body, side by side. Plain background. No text." : SUFFIX[kind];
  Object.assign(graph, kleinNodes({ prefix: "klein_", prompt: sheet ? `${input.prompt}\n\n${sheet}` : input.prompt, seed: input.seed, aspect: aspectOf(kind), images: refs }));
  graph.save = save(input.kind === "planche" ? "planche" : "save", "klein_decode", input.kind === "planche" ? "uttu-planche" : "uttu-still");
  return graph;
}

/** FLUX 3 Image (partner node). Up to ten references; the studio sends five. */
function flux3Still(input: { kind: StillKind; prompt: string; images: readonly string[]; seed: number }): ApiGraph {
  needsPhoto(input.kind, input.images);
  const graph: ApiGraph = {};
  const refs = loads(graph, input.images, 5);
  const images: Record<string, [string, number]> = {};
  refs.forEach((link, index) => { images[`images.image_${index + 1}`] = link; });
  const node = (prompt: string, seed: number, aspect: string) => ({
    class_type: "Flux3ImageNode",
    inputs: { prompt, aspect_ratio: aspect, resolution: "1K", grounding: false, safety_tolerance: 2, seed, ...images },
  });
  if (input.kind === "planche") {
    graph.close = { ...node(`${input.prompt}\n\nClose-up turnaround of this fictional person from image 1: front, three-quarter, profile. Plain background. No text.`, input.seed, "9:16"), _meta: { title: "Visage" } };
    graph.body = { ...node(`${input.prompt}\n\nFull-body turnaround of this fictional person from image 1: front, three-quarter, profile, back. Plain background. No text.`, input.seed + 1, "16:9"), _meta: { title: "Corps" } };
    graph.stitch = {
      class_type: "ImageStitch",
      inputs: { image1: ["close", 0], image2: ["body", 0], direction: "right", match_image_size: true, spacing_width: 0, spacing_color: "white" },
      _meta: { title: "Planche" },
    };
    graph.save = save("planche", "stitch", "uttu-planche");
    return graph;
  }
  graph.still = { ...node(`${input.prompt}\n\n${SUFFIX[input.kind]}`, input.seed, aspectOf(input.kind)), _meta: { title: "FLUX 3 Image" } };
  graph.save = save("save", "still", "uttu-still");
  return graph;
}

/** The API graph for one template. `images` are already uploaded input names. */
export function stillGraph(input: { kind: StillKind; prompt: string; images: readonly string[]; seed: number; template?: string; cadreLayout?: CadreStillLayout }): ApiGraph {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Le texte est vide.");
  const seed = seedOf(input.seed);
  const engine = stillEngine(input.template);
  if (input.kind === "cadre-decor") {
    // InstantX + Lotus is the only cadre path. Klein photo-lines drifted the 3D viewpoint.
    if (engine !== "instantx" && input.template && engine !== "klein") {
      throw new Error("Le décor depuis un cadre passe par InstantX ControlNet.");
    }
    needsPhoto("cadre-decor", input.images);
    return instantxCadreGraph({ image: input.images[0]!, prompt, seed });
  }
  if (engine === "klein") return kleinStill({ ...input, prompt, seed });
  if (engine === "flux3") return flux3Still({ ...input, prompt, seed });
  if (input.kind === "planche") {
    const image = input.images[0];
    if (!image) throw new Error("La planche part d’une photo.");
    return {
      load: { class_type: "LoadImage", inputs: { image }, _meta: { title: "Photo" } },
      close: {
        class_type: "GeminiImage2Node",
        inputs: {
          prompt: `${prompt}\n\nClose-up turnaround of this fictional person: front, three-quarter, profile. Plain background. No text.`,
          model: "gemini-3-pro-image-preview",
          seed,
          aspect_ratio: "9:16",
          resolution: "2K",
          response_modalities: "IMAGE",
          images: ["load", 0],
          system_prompt: SYSTEM,
        },
        _meta: { title: "Visage" },
      },
      body: {
        class_type: "GeminiImage2Node",
        inputs: {
          prompt: `${prompt}\n\nFull-body turnaround of this fictional person: front, three-quarter, profile, back. Plain background. No text.`,
          model: "gemini-3-pro-image-preview",
          seed: seed + 1,
          aspect_ratio: "16:9",
          resolution: "2K",
          response_modalities: "IMAGE",
          images: ["load", 0],
          system_prompt: SYSTEM,
        },
        _meta: { title: "Corps" },
      },
      stitch: {
        class_type: "ImageStitch",
        inputs: { image1: ["close", 0], image2: ["body", 0], direction: "right", match_image_size: true, spacing_width: 0, spacing_color: "white" },
        _meta: { title: "Planche" },
      },
      save: save("planche", "stitch", "uttu-planche"),
    };
  }
  if (input.kind === "photo-cast" || input.kind === "photo-decor") {
    const image = input.images[0];
    if (!image) throw new Error(input.kind === "photo-cast" ? "Le personnage part d’une photo." : "Le décor part d’une photo.");
    const place = input.kind === "photo-decor";
    const graph: ApiGraph = {
      load: { class_type: "LoadImage", inputs: { image }, _meta: { title: place ? "Photo du lieu" : "Photo" } },
    };
    const images: Record<string, [string, number]> = { "model.images.image_1": ["load", 0] };
    input.images.slice(1, 3).forEach((name, index) => {
      const id = `load${index + 2}`;
      graph[id] = { class_type: "LoadImage", inputs: { image: name }, _meta: { title: `Photo ${index + 2}` } };
      images[`model.images.image_${index + 2}`] = [id, 0];
    });
    graph.still = {
      class_type: "GeminiNanoBanana2V2",
      inputs: {
        prompt: place
          ? `${prompt}\n\nCinema still, 16:9, the same place, empty of people. No text.`
          : `${prompt}\n\nThe same fictional person as the photos. Keep the face. No text.`,
        model: "Gemini Nano Banana 2.1",
        "model.aspect_ratio": place ? "16:9" : "3:4",
        "model.resolution": "1K",
        "model.thinking_level": "MEDIUM",
        ...images,
        seed,
        response_modalities: "IMAGE",
        system_prompt: SYSTEM,
        temperature: 1,
        top_p: 0.95,
      },
      _meta: { title: place ? "Décor" : "Personnage" },
    };
    graph.save = save("save", "still", "uttu-still");
    return graph;
  }
  const place = input.kind === "texte-decor";
  return {
    still: {
      class_type: "GeminiNanoBanana2V2",
      inputs: {
        prompt: place
          ? `${prompt}\n\nCinema still, 16:9, empty of people. No text.`
          : `${prompt}\n\nOne fictional person, character sheet: front face, three-quarter, profile, full body. Neutral background. No text.`,
        model: "Gemini Nano Banana 2.1",
        "model.aspect_ratio": place ? "16:9" : "3:4",
        "model.resolution": "1K",
        "model.thinking_level": "MEDIUM",
        seed,
        response_modalities: "IMAGE",
        system_prompt: SYSTEM,
        temperature: 1,
        top_p: 0.95,
      },
      _meta: { title: place ? "Décor" : "Personnage" },
    },
    save: save("save", "still", "uttu-still"),
  };
}

function listedImages(outputs: JobDetail["outputs"]): OutputRef[] {
  if (!outputs) return [];
  const files: OutputRef[] = [];
  for (const node of Object.values(outputs)) {
    if (!node || typeof node !== "object") continue;
    for (const list of Object.values(node as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        if (typeof row.filename !== "string" || !row.filename) continue;
        files.push({
          filename: row.filename,
          subfolder: typeof row.subfolder === "string" ? row.subfolder : "",
          type: typeof row.type === "string" ? row.type : "output",
        });
      }
    }
  }
  return files;
}

/** The stitched board when the job saved one, otherwise the first still. */
export function stillOutput(outputs: JobDetail["outputs"]): OutputRef | null {
  const files = listedImages(outputs);
  return files.find(file => /uttu-planche/i.test(file.filename)) ?? imageOutput(outputs);
}

/** Uploads, queues, waits, and reads the cost from two balances. */
export async function runStill(client: RenderClient, input: StillRunInput, options: StillRunOptions = {}): Promise<StillRunResult> {
  const sleep = options.sleep ?? sleepDefault;
  const now = options.now ?? Date.now;
  const pollMs = options.pollMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 4 * 60 * 1000;
  const names: string[] = [];
  for (const picture of input.pictures) {
    if (options.signal?.aborted) throw new RenderError("cancelled", "Rendu annulé avant l’envoi.");
    names.push(await client.upload(picture.blob, picture.name));
  }
  if (options.signal?.aborted) throw new RenderError("cancelled", "Rendu annulé avant l’envoi.");
  const graph = stillGraph({ kind: input.kind, prompt: input.prompt, images: names, seed: input.seed, template: input.template, cadreLayout: input.cadreLayout });
  const jobId = await client.submit(graph, input.clientId);
  const started = now();
  for (;;) {
    if (options.signal?.aborted) {
      // Never cancel a Comfy job: stop waiting here only. The job keeps running in the cloud.
      throw new RenderError("cancelled", "Suivi arrêté sur cet appareil. Le rendu continue chez Comfy ; son résultat se récupère plus tard depuis la médiathèque.");
    }
    if (now() - started > timeoutMs) throw new RenderError("timeout", "Le rendu dépasse la durée permise.");
    const status = await client.status(jobId);
    const stage = jobStage(status);
    if (stage === "done") break;
    if (stage === "failed") throw new RenderError("failed", "Le rendu a échoué dans le cloud.");
    if (stage === "cancelled") throw new RenderError("cancelled", "Le rendu a été annulé dans le cloud.");
    await sleep(pollMs);
  }
  const detail = await client.job(jobId);
  const ref = stillOutput(detail.outputs);
  if (!ref) throw new RenderError("failed", "Le rendu est fini, mais aucune image n’est sortie.");
  const image = await client.file(ref);
  const balanceAfter = await client.balance().catch(() => null);
  const charged = balanceAfter !== null && balanceAfter !== input.balanceBefore ? balanceAfter : null;
  return {
    jobId,
    image,
    filename: ref.filename,
    balanceBefore: input.balanceBefore,
    balanceAfter: charged,
    costCredits: measuredCost(input.balanceBefore, charged),
  };
}
