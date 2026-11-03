// A free sentence such as « make the project anime » becomes a proposal.
// The proposal carries a quote and waits. It never starts a job.

import type { Locale } from "../i18n/config.ts";
import { estGuide, lookAnime, type AnimePreset, type ProjectLook } from "./model.ts";
import { routePlan, type ShotCue } from "./resolve.ts";
import { devisFilm, devisPreparation, libelleEstime, type CoutEstime } from "./quote.ts";

export interface InventaireLook {
  characters: readonly { name: string }[];
  places: readonly { name: string }[];
  shots: readonly ShotCue[];
}

export interface LigneDevis {
  stage: "style" | "sheet" | "decor" | "shot";
  count: number;
  credits: number;
  high: number;
  nature: CoutEstime["nature"];
}

export interface PropositionLook {
  kind: "propose-look";
  launches: false;
  needsConfirmation: true;
  posted: false;
  preset: AnimePreset;
  look: ProjectLook;
  remake: LigneDevis[];
  quote: CoutEstime;
  label: string;
  summary: string;
  /** Old pictures stay. A later render is a new revision. */
  keepsMedia: true;
}

const PRESET_WORD: { preset: AnimePreset; pattern: RegExp }[] = [
  { preset: "retro", pattern: /\b(90s|90's|nineties|ann[ée]es?\s*90|retro|r[ée]tro|90er)\b/i },
  { preset: "neon", pattern: /\b(neon|n[ée]on|neonlicht)\b/i },
  { preset: "darkfantasy", pattern: /\b(dark\s*fantasy|fantasy\s*sombre|dunkle\s*fantasy|fantas[ií]a\s*oscura)\b/i },
  { preset: "daylight", pattern: /\b(summer|daylight|[ée]t[ée]|plein jour|tageslicht|verano|luz del d[ií]a)\b/i },
  { preset: "theatrical", pattern: /\b(theatrical|th[ée][aâ]tral|theatralisch|teatral)\b/i },
];

/** True when the sentence asks for the anime look. « Animate » is not that sentence. */
export function demandeAnime(text: string): boolean {
  return /\banime\b|2\.5\s*d|dessin anim[ée]/i.test(text);
}

export function presetDemande(text: string): AnimePreset {
  return PRESET_WORD.find(entry => entry.pattern.test(text))?.preset ?? "theatrical";
}

function localeDe(text: string): Locale {
  if (/\b(passe|projet|mets|dessin anim|cr[ée]dits)\b/i.test(text)) return "fr";
  if (/\b(projekt|mach|zum|gesch[äa]tzt)\b/i.test(text)) return "de";
  if (/\b(proyecto|ponlo|estimado)\b/i.test(text)) return "es";
  return "en";
}

const SUMMARY: Record<Locale, string> = {
  en: "I can set this project to Anime 2.5D. Pictures already made stay as they are. New ones are a new revision. Nothing starts until you confirm.",
  fr: "Je peux passer ce projet en Anime 2.5D. Les images déjà faites restent. Les nouvelles seront une nouvelle révision. Rien ne part avant ta confirmation.",
  de: "Ich kann dieses Projekt auf Anime 2.5D stellen. Vorhandene Bilder bleiben. Neue werden eine neue Fassung. Es startet nichts, bevor du bestätigst.",
  es: "Puedo poner este proyecto en Anime 2.5D. Las imágenes ya hechas se quedan. Las nuevas serán una revisión nueva. No empieza nada hasta que confirmes.",
};

/**
 * A proposal, or null when the sentence is not about the look.
 * `launches` and `posted` are constants: there is no path from here to a POST.
 */
export function proposerLook(text: string, current: ProjectLook | null, inventory: InventaireLook = { characters: [], places: [], shots: [] }): PropositionLook | null {
  if (!demandeAnime(text)) return null;
  const preset = presetDemande(text);
  const look = lookAnime(preset, current?.kind === "anime25d" ? { locks: current.locks, onTwos: current.onTwos, styleFrameRef: current.styleFrameRef, ownRefs: current.ownRefs } : {});
  const people = inventory.characters.filter(person => !estGuide(person.name));
  const routes = inventory.shots.map(shot => routePlan(shot));
  const prep = devisPreparation(people.length, inventory.places.length);
  const quote = routes.length ? devisFilm(routes, people.length, inventory.places.length) : prep;
  const remake: LigneDevis[] = [
    { stage: "style", count: 1, credits: prep.credits === 0 ? 0 : 3, high: 5, nature: "hypothese" },
  ];
  if (people.length) remake.push({ stage: "sheet", count: people.length, credits: 4 * people.length, high: 6 * people.length, nature: "hypothese" });
  if (inventory.places.length) remake.push({ stage: "decor", count: inventory.places.length, credits: 3 * inventory.places.length, high: 5 * inventory.places.length, nature: "hypothese" });
  if (routes.length) {
    const shots = routes.reduce((sum, route) => sum + (route === "camera" ? 18 : 19), 0);
    const high = routes.reduce((sum, route) => sum + (route === "camera" ? 28 : 30), 0);
    remake.push({ stage: "shot", count: routes.length, credits: shots, high, nature: "hypothese" });
  }
  const locale = localeDe(text);
  return {
    kind: "propose-look",
    launches: false,
    needsConfirmation: true,
    posted: false,
    preset,
    look,
    remake,
    quote,
    label: libelleEstime(locale, quote.credits),
    summary: SUMMARY[locale],
    keepsMedia: true,
  };
}
