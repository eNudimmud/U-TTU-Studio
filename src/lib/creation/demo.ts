// Example cards for the preview gallery. They are not written to the vault
// and they do not call a renderer.

import type { CastCard, DecorCard } from "./gallery.ts";
import { CAST_TEXT_QUOTE, DECOR_TEXT_QUOTE } from "./quotes.ts";

function demoCast(id: string, name: string, prompt: string, preview: string, at: string): CastCard {
  return {
    id, name, at, prompt, source: "texte", photos: [], sheet: null, preview, status: "pret",
    template: CAST_TEXT_QUOTE.template, quote: CAST_TEXT_QUOTE.credits, cost: null, engine: "comfy",
  };
}

export const DEMO_CAST: CastCard[] = [
  demoCast("demo-uttu", "Uttu", "Une femme au manteau sombre, regard calme.", "/exemples/cast-uttu.webp", "2026-10-08T12:00:00.000Z"),
  demoCast("demo-coursiere", "La coursière", "Une coursière, planche de vues, personnage fictif.", "/exemples/cast-coursiere.webp", "2026-10-08T12:05:00.000Z"),
  demoCast("demo-vieil-homme", "Le vieil homme", "Un vieil homme, planche de vues, personnage fictif.", "/exemples/cast-vieil-homme.webp", "2026-10-08T12:06:00.000Z"),
  demoCast("demo-dj", "DJ", "Un DJ, planche de vues, personnage fictif.", "/exemples/cast-dj.webp", "2026-10-08T12:07:00.000Z"),
];

// Four house renders, FLUX 3 Image Klein via Comfy Cloud (R10b). The flat room and
// the corridor were dropped: they did not make anyone want to use them.
export const DEMO_DECOR: DecorCard[] = [
  { id: "demo-quai", name: "Le quai, la nuit", prompt: "Un quai la nuit, eau noire, lumières lointaines, sans personne.", sheet: null, preview: "/exemples/decor-quai-nuit.webp", status: "pret" },
  { id: "demo-gare", name: "Un hall de gare", prompt: "Un hall de gare, vide, lumière froide, sans personne.", sheet: null, preview: "/exemples/decor-gare.webp", status: "pret" },
  { id: "demo-pluie", name: "Sous la pluie", prompt: "Une rue sous la pluie, lumières floues, sans personne.", sheet: null, preview: "/exemples/decor-rue-pluie.webp", status: "pret" },
  { id: "demo-toit", name: "Les toits à l’aube", prompt: "Des toits de zinc à l’aube, brume dorée, sans personne.", sheet: null, preview: "/exemples/decor-toit-aube.webp", status: "pret" },
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
