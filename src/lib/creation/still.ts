// A still on the visitor's own Comfy account, through the same client as a take.
// The graph is the template's nodes. Nothing here opens a network by itself.

import { measuredCost } from "../credits.ts";
import { imageOutput, jobStage, RenderError, type JobDetail, type OutputRef, type RenderClient } from "../render/client.ts";
import type { ApiGraph } from "../render/take-graph.ts";
import type { CreationQuote } from "./quotes.ts";
import { CAST_PHOTO_QUOTE, CAST_TEXT_QUOTE, DECOR_PHOTO_QUOTE, DECOR_TEXT_QUOTE } from "./quotes.ts";

export type StillKind = "texte-cast" | "texte-decor" | "photo-decor" | "photo-cast" | "planche";

export interface StillRunInput {
  kind: StillKind;
  prompt: string;
  pictures: readonly { blob: Blob; name: string }[];
  seed: number;
  clientId: string;
  balanceBefore: number;
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
  if (kind === "planche") return CAST_PHOTO_QUOTE;
  if (kind === "photo-decor") return DECOR_PHOTO_QUOTE;
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

/** The API graph for one template. `images` are already uploaded input names. */
export function stillGraph(input: { kind: StillKind; prompt: string; images: readonly string[]; seed: number }): ApiGraph {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Le texte est vide.");
  const seed = seedOf(input.seed);
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
          resolution: "1K",
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
          resolution: "1K",
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
  const graph = stillGraph({ kind: input.kind, prompt: input.prompt, images: names, seed: input.seed });
  const jobId = await client.submit(graph, input.clientId);
  const started = now();
  for (;;) {
    if (options.signal?.aborted) {
      await client.cancel(jobId).catch(() => {});
      throw new RenderError("cancelled", "Rendu annulé.");
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
