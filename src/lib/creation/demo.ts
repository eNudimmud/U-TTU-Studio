// Example cards for the preview gallery. They are not written to the vault
// and they do not call a renderer.

import type { CastCard, DecorCard } from "./gallery.ts";
import { CAST_PHOTO_QUOTE, CAST_TEXT_QUOTE, DECOR_TEXT_QUOTE } from "./quotes.ts";

export const DEMO_CAST: CastCard[] = [
  {
    id: "demo-mira",
    name: "Mira",
    at: "2026-10-08T12:00:00.000Z",
    prompt: "Une femme au manteau sombre, regard calme.",
    source: "texte",
    photos: [],
    sheet: null,
    preview: "/exemples/cast-mira.webp",
    status: "pret",
    template: CAST_TEXT_QUOTE.template,
    quote: CAST_TEXT_QUOTE.credits,
    cost: null,
    engine: "comfy",
  },
  {
    id: "demo-guide",
    name: "Le guide",
    at: "2026-10-08T12:05:00.000Z",
    prompt: "Visage dessiné, lumière dorée.",
    source: "photos",
    photos: [],
    sheet: null,
    preview: "/exemples/cast-guide.webp",
    status: "pret",
    template: CAST_PHOTO_QUOTE.template,
    quote: CAST_PHOTO_QUOTE.credits,
    cost: null,
    engine: "comfy",
  },
];

export const DEMO_DECOR: DecorCard[] = [
  { id: "demo-quai", name: "Le quai, la nuit", prompt: "Un quai la nuit, eau noire, sans personne.", sheet: null, preview: "/exemples/decor-quai-nuit.jpg", status: "pret" },
  { id: "demo-pluie", name: "Sous la pluie", prompt: "Une rue sous la pluie, sans personne.", sheet: null, preview: "/exemples/decor-rue-pluie.jpg", status: "pret" },
  { id: "demo-piece", name: "Une pièce", prompt: "Une pièce vide, sans personne.", sheet: null, preview: "/exemples/decor-piece.jpg", status: "pret" },
  { id: "demo-toit", name: "Un toit au lever du jour", prompt: "Un toit au lever du jour, sans personne.", sheet: null, preview: "/exemples/decor-toit-aube.jpg", status: "pret" },
  { id: "demo-gare", name: "Un hall de gare", prompt: "Un hall de gare, vide, sans personne.", sheet: null, preview: "/exemples/decor-gare.jpg", status: "pret" },
  { id: "demo-couloir", name: "Un couloir", prompt: "Un couloir clair, sans personne.", sheet: null, preview: "/exemples/decor-couloir.jpg", status: "pret" },
];

export const DEMO_DECOR_QUOTE = DECOR_TEXT_QUOTE.credits;

export const DEMO_TAKES = [
  { id: "demo-prise", name: "Le personnage est dans le lieu." },
];

export const DEMO_SEQUENCES = [
  { id: "demo-seq", name: "Séquence 1" },
];

export const DEMO_NOTES = [
  { id: "bible", label: "Bible", text: "Lumière basse, or discret." },
  { id: "lexique", label: "Lexique", text: "Quai : le bord de l’eau, la nuit." },
];
