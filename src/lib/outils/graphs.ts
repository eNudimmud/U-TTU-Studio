// One graph per hub tool, built by the family builder the studio already trusts (Klein, LTX
// and H3 takes, video gestures, 3D, sounds, « Et ensuite ? ») or by the whole-template
// builder (generique.ts). Pure functions: nothing here opens a network.

import { stemGraph } from "../creation/stem.ts";
import { kleinNodes } from "../render/klein-graph.ts";
import { meshGesteGraph } from "../render/mesh-gestes.ts";
import { takeGraphFor } from "../render/run.ts";
import type { ApiGraph } from "../render/take-graph.ts";
import { isVideoGeste, videoGesteGraph } from "../render/video-gestes.ts";
import { isSuiteGeste, suiteGraph, type Elargir } from "../suite/graphs.ts";
import { gesteParId } from "../workflows/registre.ts";
import { outilRow, type Outil } from "./catalogue.ts";
import { generiqueGraph, type OutilAspect, type OutilFiles } from "./generique.ts";

export const OUTIL_SECONDS = 5;

export interface OutilInput {
  files: OutilFiles;
  prompt: string;
  seed: number;
  aspect?: OutilAspect;
  elargir?: Elargir;
  fluidifier?: boolean;
  /** Length of the source video (estimate per block, Finaliser chunks). */
  seconds?: number;
  mesh?: "objet" | "perso";
}

export const MESH_GESTE = { objet: "prise-volume-objet", perso: "prise-volume-perso" } as const;

export function outilPrefix(outil: Outil): string {
  const folder = outil.sortie === "video" ? "video/" : outil.sortie === "audio" ? "audio/" : outil.sortie === "mesh" ? "3d/" : "";
  return `${folder}uttu-${outil.id}`;
}

function first(list: readonly string[] | undefined, what: string): string {
  const name = list?.[0];
  if (!name) throw new Error(`${what} manquant.`);
  return name;
}

export function outilGraph(outil: Outil, input: OutilInput): ApiGraph {
  const row = outilRow(outil);
  if (!row || !outil.moteur) throw new Error(`Outil pas encore branché : ${outil.id}`);
  const prompt = input.prompt.trim();
  if (outil.texte === "requis" && !prompt) throw new Error("Le texte est vide.");
  const images = input.files.images ?? [];
  const moteur = outil.moteur;
  switch (moteur.kind) {
    case "klein": {
      const graph = kleinNodes({ prefix: "klein_", prompt: `${prompt}\n\nNo text.`, seed: input.seed, aspect: input.aspect === "vertical" ? "9:16" : "16:9", images: [] });
      graph.save = { class_type: "SaveImage", inputs: { images: ["klein_decode", 0], filename_prefix: outilPrefix(outil) }, _meta: { title: "Enregistrer" } };
      return graph;
    }
    case "generique":
      return generiqueGraph({ template: outil.template, files: input.files, prompt, seed: input.seed, prefix: outilPrefix(outil), aspect: input.aspect });
    case "suite": {
      if (!isSuiteGeste(row.id)) throw new Error(row.id);
      const source = outil.entrees.includes("video") && row.id !== "suite-prolonger" ? input.files.video : images[0];
      return suiteGraph({ geste: row.id, files: { source: source ?? "", audio: input.files.audio }, prompt, seed: input.seed, aspect: input.aspect, elargir: input.elargir, fluidifier: input.fluidifier, seconds: input.seconds });
    }
    case "take":
      return takeGraphFor({ seconds: 5, quality: "rapide", aspect: input.aspect ?? "horizontal", engine: moteur.engine }, prompt, images.length ? images : [first(images, "Image")], input.seed);
    case "video": {
      if (!isVideoGeste(row.id)) throw new Error(row.id);
      const files: Record<string, string> = {};
      row.slots.forEach((slot, index) => {
        files[slot.slot] = slot.media === "video" ? (input.files.video ?? "") : (images[index] ?? images[0] ?? "");
      });
      return videoGesteGraph({ geste: row.id, files, prompt, seed: input.seed, aspect: input.aspect });
    }
    case "mesh":
      return meshGesteGraph({ geste: MESH_GESTE[input.mesh ?? "objet"], image: first(images, "Image"), seed: input.seed });
    case "stem":
      return stemGraph({ kind: moteur.stem, text: prompt, seed: input.seed });
  }
}

/** Placeholder inputs for workflows/ and dry runs. */
export function outilExample(outil: Outil): OutilInput {
  return {
    files: {
      // Prolonger starts from the take's last frame, read in the browser.
      images: outil.geste === "suite-prolonger" ? ["uttu-derniere-image.png"] : outil.entrees.filter(item => item === "image" || item === "image2").map((_, index) => `uttu-${index + 1}.png`),
      video: outil.entrees.includes("video") ? "uttu-plan.mp4" : undefined,
      audio: outil.entrees.includes("audio") ? "uttu-voix.mp3" : undefined,
    },
    prompt: outil.id === "son-dialogue" ? "<réplique 1>\n<réplique 2>" : outil.texte === "aucun" ? "" : "<texte du visiteur>",
    seed: 0,
  };
}

export interface OutilQuote {
  credits: number;
  high: number;
  kind: "estime";
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Estimated from the registry row. Per-length tools count each started block of five seconds. */
export function outilQuote(outil: Outil, options: { seconds?: number; fluidifier?: boolean; mesh?: "objet" | "perso" } = {}): OutilQuote | null {
  const row = outil.moteur?.kind === "mesh" ? gesteParId(MESH_GESTE[options.mesh ?? "objet"]) : outilRow(outil);
  if (!row || row.credits === null || row.high === null) return null;
  // Per-length tools (e.g. Musique pour une vidéo): wait for a real duration so the quote
  // does not jump 10→20 when the video metadata loads.
  if (outil.parTranche && !(Number.isFinite(options.seconds) && (options.seconds ?? 0) > 0)) return null;
  const seconds = Number.isFinite(options.seconds) && (options.seconds ?? 0) > 0 ? options.seconds! : OUTIL_SECONDS;
  // Encoded clips often land a few tens of ms past a block (e.g. 5.04 s). Without slack the
  // quote doubles the moment metadata loads (8→16). A 0.25 s grace keeps one block for a
  // "5 s" take while still billing a second block from ~5.25 s.
  const blocks = outil.parTranche ? Math.max(1, Math.ceil(Math.max(0, seconds - 0.25) / OUTIL_SECONDS - 1e-9)) : 1;
  let credits = row.credits * blocks;
  let high = row.high * blocks;
  if (outil.id === "vid-finaliser" && options.fluidifier) {
    const extra = gesteParId("suite-fluidifier");
    if (!extra || extra.credits === null || extra.high === null) return null;
    credits += extra.credits * blocks;
    high += extra.high * blocks;
  }
  return { credits: round1(credits), high: round1(high), kind: "estime" };
}
