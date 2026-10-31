// One sentence in PRISE → what the shot needs. Rule-based, deterministic, FR/EN/DE/ES.
// Nothing is guessed: what is not understood is listed in `unknown` and the sentence still leaves verbatim.

import type { Cadrage, CameraMove } from "../prise/copy.ts";
import { cameraFromWords } from "../prise/camera-words.ts";
import { STOP, containsPhrase, fold, padded } from "./words.ts";

export type IntentionLang = "fr" | "en" | "de" | "es";

export interface KnownName {
  id: string;
  name: string;
  aliases?: readonly string[];
}

export interface IntentionContext {
  cast: readonly KnownName[];
  decor: readonly KnownName[];
}

export interface Found {
  id: string;
  name: string;
  /** The words of the sentence (or alias) that matched. */
  words: string;
}

export interface Ambiance {
  /** Short label shown on the chip, e.g. "VHS 1994". */
  label: string;
  /** What leaves to the engine, in English. Free ambiance words leave as written. */
  en: string;
  words: string;
}

export interface Resolved {
  text: string;
  lang: IntentionLang;
  who: Found[];
  where: Found | null;
  /** The action clauses, verbatim (camera, ambiance, duration and format clauses removed). */
  action: string;
  speed: "lent" | "rapide" | null;
  speedWords: string;
  camera: { move: CameraMove | null; words: string; degrees: number | null; degreesWords: string };
  /** Plongée / contre-plongée / framing words → a cadrage. */
  cadrage: { value: Cadrage; words: string } | null;
  ambiance: Ambiance[];
  duration: { seconds: 5 | 8; asked: number; words: string } | null;
  format: { value: "16:9" | "9:16"; words: string } | null;
  /** Name-like words that match no CAST or DÉCOR card. Shown, never replaced. */
  unknown: string[];
}

const LANG_WORDS: Record<IntentionLang, readonly string[]> = {
  fr: ["le", "la", "les", "un", "une", "et", "dans", "vers", "avec", "camera", "lentement", "traverse", "autour", "plongee", "secondes", "marche", "ambiance", "d", "l", "du", "des", "sur", "se"],
  en: ["the", "a", "and", "in", "into", "towards", "with", "camera", "slowly", "crosses", "walks", "around", "seconds", "mood", "through", "across", "shot", "of"],
  de: ["der", "die", "das", "ein", "eine", "und", "im", "durch", "mit", "kamera", "langsam", "geht", "um", "sekunden", "stimmung", "den", "dem", "uber"],
  es: ["el", "la", "los", "las", "un", "una", "y", "en", "con", "hacia", "camara", "lentamente", "cruza", "alrededor", "segundos", "ambiente", "por", "del", "al"],
};

export function detectLang(text: string): IntentionLang {
  const words = fold(text).split(" ");
  let best: IntentionLang = "en";
  let score = 0;
  for (const lang of ["fr", "en", "de", "es"] as const) {
    const set = new Set(LANG_WORDS[lang]);
    const hits = words.filter(word => set.has(word)).length;
    if (hits > score) { best = lang; score = hits; }
  }
  return best;
}

const SPEED: readonly { value: "lent" | "rapide"; pattern: RegExp }[] = [
  { value: "lent", pattern: /\b(lentement|doucement|au ralenti|slowly|in slow motion|slow motion|langsam|in zeitlupe|lentamente|despacio|a c[áa]mara lenta)\b/i },
  { value: "rapide", pattern: /\b(rapidement|vite|en courant|quickly|fast|rapidly|schnell|r[áa]pidamente|deprisa|corriendo)\b/i },
];

const EXTRA_CAMERA: readonly { move: CameraMove; pattern: RegExp }[] = [
  { move: "epaule", pattern: /\b[àa] l['’][ée]paule\b/i },
  { move: "epaule", pattern: /\bschulterkamera\b|\bhandgehalten\b/i },
  { move: "orbite", pattern: /\bfait le tour (de|d['’])|\brotation\b.*\bautour\b|\bcircles? around\b|\bmoves? around\b|\bkreist um\b|\bf[äa]hrt um\b|\bdreht sich um\b|\brodea\b|\bda la vuelta alrededor\b/i },
  { move: "travelling-avant", pattern: /\btravelling\b(?! arri)|\bpush in\b|\bfährt heran\b|\bfahrt heran\b/i },
];

const DEGREES = /(\d{2,3})\s*(°|degr[ée]s?\b|degrees?\b|grad\b|grados?\b)/i;
const TURN_WORDS: readonly { degrees: number; pattern: RegExp }[] = [
  { degrees: 90, pattern: /\bquart de tour\b|\bquarter turn\b|\bvierteldrehung\b|\bcuarto de vuelta\b/i },
  { degrees: 180, pattern: /\bdemi[- ]tour\b|\bhalf[- ]turn\b|\bhalbe drehung\b|\bmedia vuelta\b/i },
  { degrees: 360, pattern: /\btour complet\b|\bfull (turn|circle)\b|\bganze drehung\b|\bvuelta completa\b/i },
];

const CADRAGE_WORDS: readonly { value: Cadrage; pattern: RegExp }[] = [
  { value: "contre", pattern: /\bcontre[- ]plong[ée]e\b|\blow[- ]angle\b|\bfroschperspektive\b|\buntersicht\b|\bcontrapicado\b/i },
  { value: "plongee", pattern: /\bplong[ée]e\b|\bhigh[- ]angle\b|\bvogelperspektive\b|\baufsicht\b|\bpicado\b/i },
  { value: "tgp", pattern: /\btr[èe]s gros plan\b|\bextreme close[- ]up\b|\bdetailaufnahme\b|\bprimer[ií]simo primer plano\b/i },
  { value: "gros", pattern: /\bgros plan\b|\bclose[- ]up\b|\bnahaufnahme\b|\bprimer plano\b/i },
  { value: "large", pattern: /\bplan large\b|\bplan d['’]ensemble\b|\bwide shot\b|\btotale\b|\bplano general\b/i },
  { value: "moyen", pattern: /\bplan moyen\b|\bmedium shot\b|\bhalbtotale\b|\bplano medio\b/i },
];

const STYLE: readonly { label: (year: string) => string; en: (year: string) => string; pattern: RegExp }[] = [
  { pattern: /\bvhs\b/i, label: year => year ? `VHS ${year}` : "VHS", en: year => `VHS camcorder look${year ? ` from ${year}` : ""}, tape noise, soft chroma bleed` },
  { pattern: /\bsuper ?8\b/i, label: () => "Super 8", en: () => "Super 8 film look, heavy grain, light leaks" },
  { pattern: /\b16 ?mm\b/i, label: () => "16 mm", en: () => "16mm film grain" },
  { pattern: /\b35 ?mm\b/i, label: () => "35 mm", en: () => "35mm film look" },
  { pattern: /\bnoir et blanc\b|\bblack and white\b|\bb&w\b|\bschwarz[- ]?wei(ß|ss)\b|\bblanco y negro\b/i, label: () => "Noir et blanc", en: () => "black and white" },
  { pattern: /\bfilm noir\b/i, label: () => "Film noir", en: () => "film noir lighting, hard shadows" },
  { pattern: /\bcrt\b|\bsoft error\b/i, label: () => "CRT", en: () => "CRT screen texture, scanlines" },
  { pattern: /\bbrume\b|\bbrouillard\b|\bfog(gy)?\b|\bmist(y)?\b|\bnebel\b|\bniebla\b|\bbruma\b/i, label: () => "Brume", en: () => "light fog" },
  { pattern: /\bsous la pluie\b|\bpluie\b|\bin the rain\b|\brain\b|\bim regen\b|\bregen\b|\bbajo la lluvia\b|\blluvia\b/i, label: () => "Pluie", en: () => "rain" },
  { pattern: /\baube\b|\bdawn\b|\bmorgengrauen\b|\bmorgend[äa]mmerung\b|\bamanecer\b/i, label: () => "Aube", en: () => "dawn light" },
  { pattern: /\bcr[ée]puscule\b|\bdusk\b|\babendd[äa]mmerung\b|\batardecer\b/i, label: () => "Crépuscule", en: () => "dusk light" },
  { pattern: /\blumi[èe]re dor[ée]e\b|\bgolden hour\b|\bgoldene stunde\b|\bhora dorada\b/i, label: () => "Lumière dorée", en: () => "golden hour light" },
  { pattern: /\bdocumentaire\b|\bdocumentary\b|\bdokumentar\w*\b|\bdocumental\b/i, label: () => "Documentaire", en: () => "documentary look" },
];

/** "ambiance X", "style X", "look X", "Stimmung X", "ambiente X": the words after the cue, kept as written when no known style matched. */
const AMBIANCE_CUE = /\b(ambiance|atmosph[èe]re|style|look|mood|vibe|stimmung|atmosph[äa]re|stil|ambiente|estilo|atm[óo]sfera)\s+(?:de\s+|d['’]|of\s+|im\s+)?([^,;.]+)/i;

const DURATION = /\b(\d{1,2})\s*(s|sec|secs|secondes?|seconds?|sek|sekunden|segundos?)\b/i;
const FORMAT: readonly { value: "16:9" | "9:16"; pattern: RegExp }[] = [
  { value: "9:16", pattern: /\b9 ?[:/x] ?16\b|\bverticale?s?\b|\bhochkant\b|\bhochformat\b|\bformat portrait\b|\ben portrait\b|\bportrait mode\b/i },
  { value: "16:9", pattern: /\b16 ?[:/x] ?9\b|\bhorizontale?s?\b|\bpaysage\b|\blandscape\b|\bquerformat\b|\bapaisado\b/i },
];

const YEAR = /\b(19[2-9]\d|20[0-4]\d)\b/;

/** The sentence's own words for a phrase found by folding ("d'É*LISE" → "É*LISE"). */
export function originalSpan(source: string, phrase: string): string {
  const tokens = [...source.matchAll(/[\p{L}\p{N}*⥀]+/gu)];
  const folded = tokens.map(token => fold(token[0]));
  const target = fold(phrase).split(" ").filter(Boolean);
  if (target.length === 0) return phrase;
  for (let index = 0; index + target.length <= tokens.length; index++) {
    if (target.every((word, offset) => folded[index + offset] === word)) {
      const last = tokens[index + target.length - 1];
      return source.slice(tokens[index].index, last.index + last[0].length);
    }
  }
  return phrase;
}

function findName(text: string, items: readonly KnownName[]): Found[] {
  const hay = padded(text);
  const found: Found[] = [];
  for (const item of items) {
    const names = [item.name, ...(item.aliases ?? [])].filter(Boolean);
    // Multi-word card names ("Un quai la nuit") match on their content words.
    const hit = names.find(name => containsPhrase(hay, name))
      ?? names.find(name => {
        const content = fold(name).split(" ").filter(word => word.length > 1 && !STOP.has(word));
        return content.length > 0 && content.every(word => hay.includes(` ${word} `));
      });
    if (!hit) continue;
    const span = originalSpan(text, hit);
    const words = span !== hit || containsPhrase(hay, hit) ? span : fold(hit).split(" ").filter(word => word.length > 1 && !STOP.has(word)).map(word => originalSpan(text, word)).join(" … ");
    found.push({ id: item.id, name: item.name, words });
  }
  // Order of appearance in the sentence.
  return found.sort((a, b) => hay.indexOf(` ${fold(a.words).split(" ").find(w => !STOP.has(w)) ?? fold(a.words)} `) - hay.indexOf(` ${fold(b.words).split(" ").find(w => !STOP.has(w)) ?? fold(b.words)} `));
}

function clauses(text: string): string[] {
  return text.split(/[,;]|\s[–—-]\s|\.\s/).map(part => part.trim()).filter(Boolean);
}

function isDirection(clause: string): boolean {
  return Boolean(
    cameraFromWords(clause) || EXTRA_CAMERA.some(entry => entry.pattern.test(clause)) || DEGREES.test(clause)
    || TURN_WORDS.some(entry => entry.pattern.test(clause)) || CADRAGE_WORDS.some(entry => entry.pattern.test(clause))
    || AMBIANCE_CUE.test(clause) || DURATION.test(clause) || FORMAT.some(entry => entry.pattern.test(clause))
    || STYLE.some(entry => entry.pattern.test(clause)),
  );
}

function nameLike(token: string, first: boolean, lang: IntentionLang): boolean {
  if (/[*⥀]/.test(token)) return true;
  const letters = token.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2) return false;
  if (letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return true;
  // German capitalises every noun: there, only stars and capitals mark a name.
  return lang !== "de" && !first && /^\p{Lu}/u.test(letters);
}

export function resolveIntention(text: string, context: IntentionContext): Resolved {
  const source = (text || "").replace(/\s+/g, " ").trim();
  const lang = detectLang(source);
  const who = findName(source, context.cast);
  const places = findName(source, context.decor);
  const where = places[0] ?? null;

  const speedHit = SPEED.map(entry => ({ entry, match: entry.pattern.exec(source) })).find(item => item.match);
  const speed = speedHit ? speedHit.entry.value : null;

  const said = cameraFromWords(source);
  const extra = EXTRA_CAMERA.map(entry => ({ entry, match: entry.pattern.exec(source) })).filter(item => item.match).sort((a, b) => a.match!.index - b.match!.index)[0];
  const degreeMatch = DEGREES.exec(source);
  const turn = TURN_WORDS.find(entry => entry.pattern.test(source));
  const degrees = degreeMatch ? Math.min(360, Number(degreeMatch[1])) : turn?.degrees ?? null;
  let move: CameraMove | null = said?.move ?? extra?.entry.move ?? null;
  let moveWords = said?.words ?? extra?.match?.[0] ?? "";
  if (!move && degrees !== null && /autour|around|um\b|herum|alrededor|rotation|tourne|dreht|gira/i.test(source)) {
    move = "orbite";
    moveWords = degreeMatch?.[0] ?? (turn ? turn.pattern.exec(source)?.[0] ?? "" : "");
  }

  const cadrageHit = CADRAGE_WORDS.map(entry => ({ entry, match: entry.pattern.exec(source) })).find(item => item.match);
  const year = YEAR.exec(source)?.[1] ?? "";
  const ambiance: Ambiance[] = [];
  for (const style of STYLE) {
    const match = style.pattern.exec(source);
    if (!match) continue;
    // A style word inside a décor card name ("Sous la pluie") is the place, not an ambiance.
    if (places.some(place => containsPhrase(padded(place.words), match[0]))) continue;
    ambiance.push({ label: style.label(year), en: style.en(year), words: match[0] });
  }
  const cue = AMBIANCE_CUE.exec(source);
  if (cue && ambiance.length === 0) {
    const words = cue[2].trim();
    ambiance.push({ label: words, en: words, words });
  }

  const durationMatch = DURATION.exec(source);
  const duration = durationMatch ? { asked: Number(durationMatch[1]), seconds: (Number(durationMatch[1]) <= 6 ? 5 : 8) as 5 | 8, words: durationMatch[0] } : null;
  const formatHit = FORMAT.map(entry => ({ entry, match: entry.pattern.exec(source) })).find(item => item.match);

  const parts = clauses(source);
  // The first clause is the action; later clauses are direction unless they name someone.
  const actionParts = parts.filter((part, index) => index === 0 || !isDirection(part) || findName(part, context.cast).length > 0);
  const action = actionParts.join(", ");

  // Name-like words that no card explains.
  const knownWords = new Set<string>();
  for (const item of [...who, ...places]) for (const word of fold(item.words).split(" ")) knownWords.add(word);
  for (const item of [...context.cast, ...context.decor]) for (const name of [item.name, ...(item.aliases ?? [])]) for (const word of fold(name).split(" ")) if (word) knownWords.add(word);
  for (const words of [...ambiance.map(item => item.words), moveWords, cadrageHit?.match?.[0] ?? "", speedHit?.match?.[0] ?? "", formatHit?.match?.[0] ?? "", durationMatch?.[0] ?? ""]) for (const word of fold(words).split(" ")) if (word) knownWords.add(word);
  const lexicon = new Set(["vhs", "crt", "ltx", "h3", "ok", "tv", "uv", "dj", "mm"]);
  const unknown: string[] = [];
  const tokens = [...source.matchAll(/[\p{L}\p{N}*⥀'’]+/gu)];
  tokens.forEach((match, index) => {
    const raw = match[0].replace(/^(l|d|qu|j|s|n|m|t|c)['’]/i, "").replace(/['’]$/, "");
    const before = source.slice(0, match.index).trimEnd();
    const first = index === 0 || /[.!?]$/.test(before);
    if (!nameLike(raw, first, lang)) return;
    const key = fold(raw);
    if (!key || knownWords.has(key) || STOP.has(key) || lexicon.has(key) || /^\d+$/.test(key)) return;
    if (!unknown.includes(raw)) unknown.push(raw);
  });
  // A capitalised first word is only a suspect when no subject was found at all.
  const firstToken = tokens[0]?.[0] ?? "";
  if (who.length === 0 && firstToken && /^\p{Lu}\p{Ll}+$/u.test(firstToken) && !STOP.has(fold(firstToken)) && !knownWords.has(fold(firstToken)) && !unknown.includes(firstToken)) {
    const cameraish = /^(cam[ée]ra|camera|kamera|c[áa]mara|plan|travelling|ambiance|lentement|slowly|langsam|lentamente)$/i.test(firstToken);
    if (!cameraish) unknown.unshift(firstToken);
  }

  return {
    text: source,
    lang,
    who,
    where,
    action,
    speed,
    speedWords: speedHit?.match?.[0] ?? "",
    camera: { move, words: moveWords, degrees, degreesWords: degreeMatch?.[0] ?? (turn ? turn.pattern.exec(source)?.[0] ?? "" : "") },
    cadrage: cadrageHit ? { value: cadrageHit.entry.value, words: cadrageHit.match![0] } : null,
    ambiance,
    duration,
    format: formatHit ? { value: formatHit.entry.value, words: formatHit.match![0] } : null,
    unknown,
  };
}
