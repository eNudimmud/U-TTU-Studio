// Finaliser : une seule passe Nvidia RTX Video Super Resolution sur tout le
// montage fini, sur le compte Comfy du visiteur. Rien n'est régénéré : la passe
// agrandit et nettoie les images déjà montées, le son et la cadence restent.
// Mesuré le 14 octobre 2026 en 1080p : 4,1 crédits pour 5 s, 4,5 pour 30 s.
// Presque tout vient du démarrage (≈ 4 crédits), chaque seconde coûte très peu.

import type { ApiGraph } from "../render/take-graph.ts";

export type FinalResolution = "1080p" | "4k";
export type FinalNettoyage = "aucun" | "bruit" | "flou";
export type FinalRatio = "16/9" | "9/16";

export interface FinalChoice {
  resolution: FinalResolution;
  nettoyer: FinalNettoyage;
}

export interface FinalQuote {
  /** Crédits attendus. */
  credits: number;
  /** Plafond : au-delà, on ne lance pas. */
  ceiling: number;
  /** « mesure » : chiffre mesuré sur une vraie passe ; « estimation » : pas encore mesuré. */
  kind: "mesure" | "estimation";
}

/** Le montage envoyé à la passe : 720p à 24 images par seconde, assez propre pour être agrandi. */
export const MASTER = { short: 720, long: 1280, fps: 24 } as const;
/** Une passe au-delà d'une minute n'est pas proposée : l'export dans l'onglet ne tient pas sur un téléphone. */
export const FINAL_MAX_SECONDS = 60;

const STARTUP = 4;
const PER_SECOND_1080 = 0.017;
const PER_SECOND_4K = 0.07;
const PER_SECOND_CLEAN = 0.01;

function up(value: number, step: number): number {
  return Math.ceil(value / step - 1e-9) * step;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function finalQuote(seconds: number, choice: FinalChoice): FinalQuote | null {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > FINAL_MAX_SECONDS) return null;
  const perSecond = (choice.resolution === "4k" ? PER_SECOND_4K : PER_SECOND_1080) + (choice.nettoyer === "aucun" ? 0 : PER_SECOND_CLEAN);
  const credits = round1(STARTUP + perSecond * seconds);
  const measured = choice.resolution === "1080p" && choice.nettoyer === "aucun";
  const ceiling = Math.max(round1(credits + 1), up(credits * 1.5, 0.5));
  return { credits, ceiling, kind: measured ? "mesure" : "estimation" };
}

export function finalSize(resolution: FinalResolution, ratio: FinalRatio): { width: number; height: number } {
  const long = resolution === "4k" ? 3840 : 1920;
  const short = resolution === "4k" ? 2160 : 1080;
  return ratio === "9/16" ? { width: short, height: long } : { width: long, height: short };
}

export function masterSize(ratio: FinalRatio): { width: number; height: number } {
  return ratio === "9/16" ? { width: MASTER.short, height: MASTER.long } : { width: MASTER.long, height: MASTER.short };
}

const CLEAN_MODEL: Record<Exclude<FinalNettoyage, "aucun">, string> = {
  bruit: "DENOISE_HIGH",
  flou: "DEBLUR_HIGH",
};

/** Le graphe de la passe. Aucun nœud n'est montré à l'écran. */
export function finalGraph(input: { file: string; ratio: FinalRatio } & FinalChoice): ApiGraph {
  if (!input.file || /[\\\u0000]/.test(input.file)) throw new Error("Montage sans nom.");
  const size = finalSize(input.resolution, input.ratio);
  const graph: ApiGraph = {
    load: { class_type: "LoadVideo", inputs: { file: input.file }, _meta: { title: "Montage" } },
    parts: { class_type: "GetVideoComponents", inputs: { video: ["load", 0] }, _meta: { title: "Images" } },
  };
  let images: [string, number] = ["parts", 0];
  if (input.nettoyer !== "aucun") {
    // Nettoyer garde la taille d'origine ; l'agrandissement vient après, dans le même rendu.
    graph.clean = {
      class_type: "RTXVideoSuperResolution",
      inputs: {
        images,
        resize_type: "scale by multiplier",
        "resize_type.scale": 1,
        quality: CLEAN_MODEL[input.nettoyer],
        strength: 1,
        image_encoding: "8-bit RGB",
      },
      _meta: { title: "Nettoyer" },
    };
    images = ["clean", 0];
  }
  graph.upscale = {
    class_type: "RTXVideoSuperResolution",
    inputs: {
      images,
      resize_type: "target dimensions",
      "resize_type.width": size.width,
      "resize_type.height": size.height,
      quality: "ULTRA",
      strength: 1,
      image_encoding: "8-bit RGB",
    },
    _meta: { title: "Finaliser" },
  };
  graph.video = {
    class_type: "CreateVideo",
    inputs: { images: ["upscale", 0], audio: ["parts", 1], fps: ["parts", 2] },
    _meta: { title: "Vidéo" },
  };
  graph.save = {
    class_type: "SaveVideo",
    inputs: {
      video: ["video", 0],
      filename_prefix: `uttu-final-${input.resolution}`,
      format: "mp4",
      "format.codec": "h264",
      "format.codec.encoding": "re-encode",
      "format.codec.encoding.crf": 16,
    },
    _meta: { title: "Enregistrer" },
  };
  return graph;
}

/** Nom du fichier gardé dans Mon studio (dossier Assets du projet). */
export function finalFileId(name: string, resolution: FinalResolution, at: Date): string {
  const stem = (name || "montage").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "montage";
  const stamp = at.toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return `${stem}-final-${resolution}-${stamp}`;
}
