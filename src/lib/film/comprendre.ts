// The plan card reads one sentence: who, where, what happens. A name that matches no character and a
// place that matches no décor become steps of the same quote (« créé avec ce plan »), never a detour.

import { resolveIntention, type KnownName, type Resolved } from "../intention/resolve.ts";
import { fold } from "../intention/words.ts";

export interface QuiCompris { id: string | null; nom: string; nouveau: boolean }
export interface OuCompris { id: string | null; nom: string; nouveau: boolean }

export interface PlanCompris {
  phrase: string;
  qui: QuiCompris[];
  ou: OuCompris | null;
  /** Nothing named at all: the place is drawn from the sentence itself. */
  decorDeLaPhrase: boolean;
  read: Resolved;
}

const PREP = /(?:^|[\s,])(sur|dans|devant|derri[eè]re|sous|pr[eè]s d[eu']|au|aux|on|in|at|inside|near|under|across|auf|im|am|unter|vor|en|sobre|junto a|bajo|frente a)\s+/giu;
const ARTICLE = /^(?:l['’]|le |la |les |un |une |des |du |the |a |an |dem |der |die |den |das |einem |einer |el |la |los |las |un |una )/iu;
const STOP = new Set(["camera", "lentement", "doucement", "vite", "pendant", "et", "qui", "avec", "puis", "alors", "slowly", "while", "and", "with", "then", "langsam", "und", "mit", "lentamente", "y", "con", "mientras", "la", "le", "les", "the", "die", "der", "el", "nuit", "night", "nacht", "noche", "jour", "day"]);

/** « sur le quai la nuit » → « le quai ». Two meaningful words at most after the article. */
export function lieuDeLaPhrase(phrase: string): string | null {
  for (const match of phrase.matchAll(PREP)) {
    const rest = phrase.slice((match.index ?? 0) + match[0].length).split(/[,.;:!?\n]/)[0];
    const article = ARTICLE.exec(rest)?.[0] ?? "";
    const words = rest.slice(article.length).split(/\s+/).filter(Boolean);
    const kept: string[] = [];
    for (const word of words) {
      const folded = fold(word);
      const afterDe = /^(de|du|des|d['’])$/i.test(kept.at(-1) ?? "");
      if (afterDe && /^(la|le|l['’]|les)$/i.test(word)) { kept.push(word); continue; }
      if (STOP.has(folded) || /^\d/.test(word)) break;
      // « de la gare », « du port »: the complement belongs to the place.
      kept.push(word);
      if (kept.length >= 4 || (kept.length === 1 && !/^(de|du|des|d['’])$/i.test(words[1] ?? ""))) break;
    }
    if (!kept.length || kept.every(word => /^(de|du|des|d['’])$/i.test(word))) continue;
    if (/^(de|du|des)$/i.test(kept.at(-1)!)) kept.pop();
    const name = `${article}${kept.join(" ")}`.trim();
    if (name.length >= 3) return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return null;
}

/** A capitalised word not at a sentence start, or the first word when it is a name: a new character. */
function nouveauNom(read: Resolved, phrase: string): string | null {
  const known = new Set(read.who.map(item => fold(item.words)));
  for (const word of read.unknown) {
    if (known.has(fold(word))) continue;
    if (/^\p{Lu}[\p{L}'-]{1,30}$/u.test(word) && phrase.includes(word)) return word;
  }
  return null;
}

export function comprendrePlan(phrase: string, context: { cast: readonly KnownName[]; decor: readonly KnownName[] }): PlanCompris {
  const text = phrase.trim().slice(0, 240);
  const read = resolveIntention(text, context);
  const qui: QuiCompris[] = read.who.slice(0, 3).map(item => ({ id: item.id, nom: item.name, nouveau: false }));
  const nom = qui.length < 3 ? nouveauNom(read, text) : null;
  if (nom) qui.push({ id: null, nom, nouveau: true });
  let ou: OuCompris | null = read.where ? { id: read.where.id, nom: read.where.name, nouveau: false } : null;
  if (!ou) {
    const lieu = lieuDeLaPhrase(text);
    if (lieu) ou = { id: null, nom: lieu, nouveau: true };
  }
  const decorDeLaPhrase = text.length > 0 && !ou && qui.length === 0;
  if (decorDeLaPhrase) ou = { id: null, nom: text.split(/\s+/).slice(0, 4).join(" "), nouveau: true };
  return { phrase: text, qui, ou, decorDeLaPhrase, read };
}

export type EtapeType = "personnage" | "lieu" | "prise";
export interface Etape { type: EtapeType; nom: string; credits: number }

/** The steps of one quote, in order: missing characters, missing place, then the take. */
export function etapesPlan(plan: PlanCompris, cost: { personnage: number; lieu: number; prise: number }): { etapes: Etape[]; total: number } {
  const etapes: Etape[] = [
    ...plan.qui.filter(item => item.nouveau).map(item => ({ type: "personnage" as const, nom: item.nom, credits: cost.personnage })),
    ...(plan.ou?.nouveau ? [{ type: "lieu" as const, nom: plan.ou.nom, credits: cost.lieu }] : []),
    { type: "prise", nom: plan.phrase, credits: cost.prise },
  ];
  return { etapes, total: Math.round(etapes.reduce((sum, item) => sum + item.credits, 0) * 10) / 10 };
}
