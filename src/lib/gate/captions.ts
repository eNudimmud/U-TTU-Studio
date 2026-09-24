import { ANGLES, COMMON_WORDS, FRAMINGS, STOPWORDS, type Angle, type Framing } from "./vocabulary.ts";

export const SEGMENT_REPEAT_RATIO = 0.6;
export const WORD_REPEAT_RATIO = 0.8;

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function cleanVariables(raw: string): string {
  return raw
    .split(/[,;\r\n]+/)
    .map(part => part.trim().replace(/\s+/g, " ").replace(/\.+$/g, ""))
    .filter(Boolean)
    .join(", ");
}

export function buildCaption(trigger: string, angle: Angle | null, framing: Framing | null, variables: string): string {
  const parts = [trigger.trim()];
  const angleCaption = ANGLES.find(item => item.id === angle)?.caption;
  const framingCaption = FRAMINGS.find(item => item.id === framing)?.caption;
  if (angleCaption) parts.push(angleCaption);
  if (framingCaption) parts.push(framingCaption);
  const free = cleanVariables(variables);
  if (free) parts.push(free);
  return parts.filter(Boolean).join(", ");
}

export function parseInvariants(raw: string): string[] {
  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const piece of raw.split(/[,;\n]+/)) {
    const phrase = piece.trim().replace(/\s+/g, " ");
    const key = normalize(phrase);
    if (key.length < 3 || seen.has(key)) continue;
    seen.add(key);
    phrases.push(phrase);
  }
  return phrases;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function findInvariantHits(text: string, invariants: string[]): string[] {
  const haystack = normalize(text);
  return invariants.filter(invariant => {
    const needle = normalize(invariant);
    return needle.length >= 3 && new RegExp(`(^| )${escapeRegExp(needle)}(e?s)?( |$)`).test(haystack);
  });
}

export interface Repetition { term: string; count: number }

export function repeatedTerms(variablesList: string[]): Repetition[] {
  const total = variablesList.length;
  if (total < 5) return [];
  const segments = new Map<string, number>();
  const words = new Map<string, number>();
  for (const variables of variablesList) {
    const cleaned = cleanVariables(variables);
    for (const segment of new Set(cleaned.split(", ").map(normalize).filter(item => item.length >= 3))) {
      segments.set(segment, (segments.get(segment) ?? 0) + 1);
    }
    for (const word of new Set(normalize(cleaned).split(" ").filter(item => item.length >= 3 && !STOPWORDS.has(item)))) {
      words.set(word, (words.get(word) ?? 0) + 1);
    }
  }
  const repeated: Repetition[] = [];
  for (const [term, count] of segments) {
    if (count >= 3 && count / total >= SEGMENT_REPEAT_RATIO) repeated.push({ term, count });
  }
  for (const [term, count] of words) {
    const alreadyCovered = repeated.some(item => ` ${item.term} `.includes(` ${term} `));
    if (!alreadyCovered && count >= 3 && count / total >= WORD_REPEAT_RATIO) repeated.push({ term, count });
  }
  return repeated.sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
}

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export function checkTrigger(trigger: string): string | null {
  const value = trigger.trim();
  if (!value) return "Choisis un trigger.";
  if (!/^[a-z][a-z0-9_]{3,23}$/.test(value)) return "4 à 24 caractères : minuscules, chiffres ou _, en commençant par une lettre.";
  if (!/[0-9_]/.test(value)) return "Ajoute un chiffre ou un _ (ex. uttu_v1) : un mot nu entre en collision avec ce que Flux connaît déjà.";
  const core = value.replace(/[0-9_]+/g, "");
  if (COMMON_WORDS.has(core)) return `« ${core} » est un mot courant : Flux lui donne déjà un sens.`;
  return null;
}
