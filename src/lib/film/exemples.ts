// Refonte FILM · PR 4 — one model for every example (DESIGN §6). It replaces DEPARTS, ExempleDepart,
// loadExemple/applyHouse and partirExemple under film2: a type badge, the real before → after from
// public/exemples, the price to redo it from the studio quotes, one « Refaire cet exemple ».
// Nothing here spends or calls Comfy; redoing only fills the form, the visitor launches.

import type { Rendu } from "./registre.ts";

export type ExempleType = "image" | "video";

/** What the visitor brings: a house reference (imported into their project when redone) or a text. */
export type ExempleAvant =
  | { kind: "cast" | "decor"; nom: string; image: string; thumb: string }
  | { kind: "texte"; texte: string };

export type ExempleRefaire =
  /** Fills the plan card: Qui, Où and the sentence, then opens the confirmation. */
  | { vers: "plan"; rendu: Rendu }
  /** Fills the CAST or DÉCOR form with that gesture, then opens its confirmation. */
  | { vers: "cast" | "decor"; geste: string };

export interface Exemple {
  id: string;
  type: ExempleType;
  /** Seconds of the video result. */
  secondes?: 5;
  /** i18n key of the title, under film2.exemples.<id>. */
  titre: string;
  /** i18n key of the sentence the plan is filled with (plan examples only). */
  phrase?: string;
  avant: readonly ExempleAvant[];
  /** The real house result. A video is a video, never the place's still. */
  apres: { image: string } | { video: string; poster: string };
  refaire: ExempleRefaire;
}

export const EXEMPLES_FILM: readonly Exemple[] = [
  {
    id: "uttuQuai", type: "video", secondes: 5,
    titre: "film2.exemples.uttuQuai.titre", phrase: "film2.exemples.uttuQuai.phrase",
    avant: [
      { kind: "cast", nom: "Uttu", image: "/exemples/uttu-portrait-640.webp", thumb: "/exemples/uttu-portrait-640.webp" },
      { kind: "decor", nom: "Le quai, la nuit", image: "/exemples/decor-quai-nuit.webp", thumb: "/exemples/decor-quai-nuit-640.webp" },
    ],
    apres: { video: "/exemples/outils/prise-uttu-quai.mp4", poster: "/exemples/outils/prise-uttu-quai-poster.jpg" },
    // The house clip was shot with LTX: redoing it takes the same fast rendu.
    refaire: { vers: "plan", rendu: "rapide" },
  },
  {
    id: "lieuPhoto", type: "image",
    titre: "film2.exemples.lieuPhoto.titre",
    avant: [{ kind: "decor", nom: "Le quai, la nuit", image: "/exemples/decor-quai-nuit.webp", thumb: "/exemples/decor-quai-nuit-640.webp" }],
    apres: { image: "/exemples/apres-decor-photo-640.webp" },
    refaire: { vers: "decor", geste: "decor-photo" },
  },
  {
    id: "persoTexte", type: "image",
    titre: "film2.exemples.persoTexte.titre",
    avant: [{ kind: "texte", texte: "film2.exemples.persoTexte.texte" }],
    apres: { image: "/exemples/apres-cast-texte-640.webp" },
    refaire: { vers: "cast", geste: "cast-texte" },
  },
];

export interface PrixExemple {
  prise(rendu: Rendu): number | null;
  cast(source: "photos" | "texte"): number | null;
  decor(source: "photo" | "texte"): number | null;
}

/** What redoing it costs. The references are the visitor's once redone: only the render is paid. */
export function coutExemple(exemple: Exemple, prix: PrixExemple): number | null {
  const r = exemple.refaire;
  if (r.vers === "plan") return prix.prise(r.rendu);
  if (r.vers === "cast") return prix.cast(r.geste === "cast-texte" ? "texte" : "photos");
  return prix.decor(r.geste === "decor-texte" ? "texte" : "photo");
}

/** The media shown as the result: for a video, the clip itself. */
export function mediaApres(exemple: Exemple): string {
  return "video" in exemple.apres ? exemple.apres.video : exemple.apres.image;
}

/** Hand-off from the plan card to the CAST / DÉCOR form (same tab, read once). */
export const EXEMPLE_KEY = "u-ttu-film2-exemple";

export function lireExempleEnAttente(raw: string | null, vers: "cast" | "decor"): string | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { vers?: unknown; geste?: unknown };
    return data.vers === vers && typeof data.geste === "string" && /^(cast|decor)-[a-z]+$/.test(data.geste) ? data.geste : null;
  } catch { return null; }
}
