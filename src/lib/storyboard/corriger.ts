// « Ask Uttu to change, add, shorten… » (SB8, free mode): a few plain intentions read in FR/EN/DE/ES,
// no model, no credit. Anything else is changed by hand in the shot sheet.

import type { Camera, Registre } from "../film/registre.ts";
import { cameraFromWords } from "../prise/camera-words.ts";
import type { CameraMove } from "../prise/copy.ts";
import {
  ACTION_MAX, ajouterPlan, changerFormat, deplacerPlan, dureeTotale, ecrireReplique, etatDuPlan, planVide, retirerPlan,
  tousLesPlans, trouverPlan, type Cadrage, type Format, type PlanSB, type Storyboard,
} from "./storyboard.ts";

export type Correction =
  | { type: "ajouter"; fin: boolean }
  | { type: "retirer"; n: number }
  | { type: "deplacer"; n: number; pas: 1 | -1 }
  | { type: "format"; format: Format }
  | { type: "raccourcir"; secondes: number }
  | { type: "replique"; n: number; texte: string }
  /** CE5: camera, framing, angle or mood words for one shot. Written into the shot, nothing is rendered. */
  | { type: "reglage"; n: number; camera: Camera | null; cadrage: Cadrage | null; note: string };

const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const SHOT = "(?:plan|shot|einstellung|plano)";
const NUM = "(\\d{1,2})";

/** The storyboard keeps four camera kinds: each engine move is read as the nearest one. */
const CAMERA_SB: Record<CameraMove, Camera> = {
  fixe: "fixe", "travelling-avant": "approche", "travelling-arriere": "fixe", panoramique: "suit", dolly: "approche",
  suivi: "suit", orbite: "autour", epaule: "suit",
};
const CADRAGE_SB: readonly { value: Cadrage; pattern: RegExp }[] = [
  { value: "detail", pattern: /\b(tres gros plan|extreme close[- ]?up|detail(?:aufnahme)?|insert|macro|primerisimo primer plano)\b/ },
  { value: "serre", pattern: /\b(gros plan|close[- ]?up|closer|plus serre|nahaufnahme|primer plano)\b/ },
  { value: "moyen", pattern: /\b(plan moyen|medium shot|mid[- ]shot|halbtotale|plano medio)\b/ },
  { value: "large", pattern: /\b(plan large|plan d'ensemble|wide(?: shot)?|wider|plus large|totale|plano general|establishing)\b/ },
];
/** Angle, light and mood words: kept verbatim in the action, never guessed. */
const AMBIANCE = /\b(low[- ]?(?:camera|angle)|high[- ]?(?:camera|angle)|camera basse|contre[- ]plongee|plongee|froschperspektive|vogelperspektive|contrapicado|picado|dramati\w*|tense|tendu\w*|sombre|dark\w*|moody|mood|ambiance|stimmung|ambiente|night|nuit|nacht|noche|rain\w*|pluie|regen|lluvia|fog|brume|nebel|niebla|light\w*|lumiere|licht|luz|slow[- ]?motion|ralenti|zeitlupe|camara lenta|silhouette|backlit|contre[- ]jour|neon|candle\w*|bougie|stained glass|vitrail|vitraux)\b/;

// ---------------------------------------------------------------- whole-command grammar (CE5-L, R10)
//
// A structural change (add, remove, move a shot, switch the format, tighten the film) is read from the
// WHOLE request: every word has to belong to that one command (its verb, its object, its scope, a few
// polite or filler words). One word left over (« the rain », « a close-up », « camera », « not », a second
// clause, a second shot) and nothing structural is done: the request goes to the setting reader, to the
// native agent, or back to the visitor. Never a structural action from an isolated word.

/** Polite and filler words that never change the command (FR/EN/DE/ES, folded). */
const FILLER = new Set(["please", "pls", "now", "just", "stp", "svp", "bitte", "mal", "porfa", "ahora", "maintenant", "jetzt", "ok", "okay", "uttu"]);
const FILLER_PHRASES = [/\bs il te plait\b/g, /\bpor favor\b/g, /\bcan you\b/g, /\bcould you\b/g, /\bpeux tu\b/g, /\bkannst du\b/g, /\bpuedes\b/g];
/** Determiners and pronouns that may stand for the shot in scope. */
const DET = new Set(["the", "this", "that", "it", "one", "le", "la", "ce", "cet", "cette", "ca", "lo", "el", "este", "ese", "esta", "die", "diese", "dieser", "den", "diesen", "sie", "es", "ihn"]);
const SHOT_NOUN = new Set(["shot", "plan", "plano", "einstellung"]);

/** Folded words of the request; each « shot N » becomes one `@shot` token and its number is kept. */
function words(raw: string): { words: string[]; shots: number[] } {
  let f = fold(raw).replace(/[«»"“”„.,!?;…()]/g, " ").replace(/['’`´-]/g, " ").replace(/(\d)\s*:\s*(\d)/g, "$1x$2").replace(/:/g, " ");
  for (const phrase of FILLER_PHRASES) f = f.replace(phrase, " ");
  const shots: number[] = [];
  f = f.replace(new RegExp(`${SHOT}\\s*(?:n[o°]?\\s*)?${NUM}`, "giu"), (_m, n: string) => { shots.push(Number(n)); return " @shot "; });
  for (const phrase of [...LATER, ...EARLIER].filter(item => item.includes(" ")).sort((a, b) => b.length - a.length)) {
    f = f.replace(new RegExp(`\\b${phrase}\\b`, "g"), phrase.replace(/ /g, "_"));
  }
  return { words: f.split(/\s+/).filter(word => word && !FILLER.has(word)), shots };
}

/** True when every word is the shot, a determiner, a shot noun, or one of `allowed`. */
const only = (list: readonly string[], allowed: ReadonlySet<string> = new Set()) =>
  list.every(word => word === "@shot" || DET.has(word) || SHOT_NOUN.has(word) || allowed.has(word));

const REMOVE = /^(remove|delete|drop|retire|retirer|supprime|supprimer|enleve|enlever|efface|effacer|entfern\w*|losch\w*|streich\w*|quita|quitalo|quitala|quitar|borra|borralo|borrala|borrar|elimina|eliminalo|eliminala|eliminar)$/;
const MOVE_VERB = /^(move|shift|bring|put|push|deplace|deplacer|decale|decaler|mets|mettre|verschieb\w*|schieb\w*|setz\w*|stell\w*|mueve|muevelo|mover|pon|ponlo)$/;
const EARLIER_VERB = /^(avance|avancer|adelanta|adelantalo|adelantar)$/;
const LATER_VERB = /^(recule|reculer|retrasa|retrasalo|retrasar)$/;
const LATER = ["later", "after", "down", "back", "backward", "backwards", "plus tard", "apres", "en arriere", "nach hinten", "spater", "despues", "mas tarde", "atras"];
const EARLIER = ["earlier", "before", "up", "forward", "forwards", "plus tot", "avant", "en avant", "nach vorn", "nach vorne", "fruher", "antes", "mas temprano", "adelante"];
const isLater = (word: string) => LATER.includes(word.replace(/_/g, " "));
const isEarlier = (word: string) => EARLIER.includes(word.replace(/_/g, " "));
const STEP = new Set(["by", "a", "d", "un", "cran", "um", "eins", "ein", "bit", "peu", "spot", "place", "position", "uno", "lugar", "puesto"]);

const ADD = /^(add|ajoute|ajouter|rajoute|rajouter|hinzu|hinzufug\w*|fuge|anade|anadir|agrega|agregar|insert|insere|inserer)$/;
const ANOTHER = /^(another|autre|noch|otro)$/;
const ADD_OK = new Set(["a", "an", "new", "un", "une", "nouveau", "nouvel", "ein", "eine", "einen", "neue", "neuen", "uno", "una", "nuevo", "at", "to", "au", "am", "al", "de", "of", "der", "des", "del", "film", "storyboard", "board", "ende"]);
const END = /^(closing|end|ending|final|fin|schluss|schlusseinstellung|endeinstellung|cierre)$/;
const ADD_NOUN = /^(schlusseinstellung|endeinstellung)$/;

const FORMAT_OK = new Set(["switch", "go", "change", "make", "turn", "to", "into", "in", "passe", "passer", "mets", "mettre", "en", "format", "formato", "wechsle", "wechseln", "ins", "zu", "auf", "pasar", "pasa", "cambia", "cambiar", "a", "al", "mode", "vers", "pour", "for", "les", "fur", "para", "las", "redes"]);
const PORTRAIT = /^(portrait|vertical|hochformat|9x16|reseaux|sociaux|social|sociales)$/;
const LANDSCAPE = /^(paysage|landscape|horizontal|querformat|16x9)$/;

const TIGHTEN = /^(raccourci\w*|resserre\w*|reduis|reduire|shorten|tighten|trim|cut|kurz\w*|acorta\w*|reduce|reducir|ajusta\w*)$/;
const SECONDS = /^(s|sec|secs|seconds?|secondes?|sekunden|segundos)$/;
const TIGHTEN_OK = new Set(["to", "down", "a", "auf", "film", "video", "storyboard", "board", "das", "total", "en", "in", "under", "sous", "unter", "about", "environ", "etwa", "unos"]);

/** Structural commands read from the whole request; null when one word does not belong (R10). */
function lireStructure(raw: string, chosen: number | null): Correction | null {
  const { words: list, shots } = words(raw);
  if (!list.length || new Set(shots).size > 1) return null; // two shots named: clarify, never guess
  const n = shots[0] ?? chosen;
  const without = (pred: (word: string) => boolean) => list.filter(word => !pred(word));
  const count = (pred: (word: string) => boolean) => list.filter(pred).length;

  // Remove one shot: « retire le plan 3 », « Einstellung 3 entfernen », « retire-le », « remove it ».
  if (n && count(word => REMOVE.test(word)) === 1 && only(without(word => REMOVE.test(word)))) return { type: "retirer", n };

  // Move one shot one step: an explicit move verb with one direction, or a named shot with one direction.
  const moveWord = (word: string) => MOVE_VERB.test(word) || EARLIER_VERB.test(word) || LATER_VERB.test(word) || isLater(word) || isEarlier(word);
  const verbs = count(word => MOVE_VERB.test(word));
  const directions = count(word => EARLIER_VERB.test(word) || LATER_VERB.test(word) || isLater(word) || isEarlier(word));
  const pointed = verbs === 1 || count(word => EARLIER_VERB.test(word) || LATER_VERB.test(word)) === 1 || shots.length === 1;
  if (n && directions === 1 && verbs <= 1 && pointed && only(without(moveWord), STEP)) {
    return { type: "deplacer", n, pas: list.some(word => isLater(word) || LATER_VERB.test(word)) ? 1 : -1 };
  }

  // Switch the board's format: « passe en portrait », « Ins Hochformat », « vertical ».
  const formatWord = (word: string) => PORTRAIT.test(word) || LANDSCAPE.test(word);
  const portrait = count(word => PORTRAIT.test(word)) > 0;
  const landscape = count(word => LANDSCAPE.test(word)) > 0;
  if (portrait !== landscape && !shots.length && only(without(formatWord), FORMAT_OK)) return { type: "format", format: portrait ? "portrait" : "paysage" };

  // Tighten the film: « raccourcis à 15 s », « Auf 30 s kürzen », « acorta a 15 s ».
  const joined = list.map(word => word.replace(/^(\d{1,3})(s|sec|secs|seconds?|secondes?|sekunden|segundos)$/, "$1 $2")).join(" ").split(" ");
  const numbers = joined.filter(word => /^\d{1,3}$/.test(word));
  if (numbers.length === 1 && !shots.length && joined.filter(word => TIGHTEN.test(word)).length === 1
    && joined.every(word => /^\d{1,3}$/.test(word) || SECONDS.test(word) || TIGHTEN.test(word) || DET.has(word) || TIGHTEN_OK.has(word))) {
    return { type: "raccourcir", secondes: Number(numbers[0]) };
  }

  // Add one shot: « ajoute un plan », « Add a closing shot », « Schlusseinstellung hinzufügen », « otro plano ».
  const addWord = (word: string) => ADD.test(word) || ANOTHER.test(word) || END.test(word) || ADD_NOUN.test(word);
  const adds = count(word => ADD.test(word));
  const hasNoun = list.some(word => SHOT_NOUN.has(word) || ADD_NOUN.test(word));
  if (!shots.length && adds <= 1 && (adds === 1 || count(word => ANOTHER.test(word)) === 1) && (hasNoun || count(word => ANOTHER.test(word)) === 1) && only(without(addWord), ADD_OK)) {
    return { type: "ajouter", fin: list.some(word => END.test(word)) };
  }
  return null;
}

/** Removal, negation: « Remove the rain », « no rain », « sans pluie » are never a local setting (R10). */
const NOT_A_SETTING = /\b(remove|delete|drop|cut|coupe\w*|schneid\w*|corta\w*|without|no more|not|don ?t|never|retire\w*|supprime\w*|enleve\w*|efface\w*|sans|plus de|pas|jamais|entfern\w*|losch\w*|ohne|kein\w*|nicht|nie|quita\w*|borra\w*|elimina\w*|sin|nunca|no)\b/;
/** A second structural clause (« … and add a shot », « … puis retire le plan 3 »). */
const STRUCTURAL_CLAUSE = /\b(add|ajoute|rajoute|hinzu\w*|anade|agrega|move|deplace|decale|verschieb\w*|mueve|avance|recule|adelanta|retrasa)\b/;

/** « Make it more dramatic: low camera, slow push-in, rain on the stained glass » for the selected shot. */
export function lireReglage(raw: string, selected?: number): Correction | null {
  const text = raw.replace(/[`´]+/g, " ").replace(/\s+/g, " ").trim();
  const f = fold(text);
  const named = new RegExp(`${SHOT}\\s*(?:n[o°]?\\s*)?${NUM}`, "iu").exec(f);
  const n = named ? Number(named[1]) : selected && selected > 0 ? selected : null;
  if (!n) return null;
  // R10: removal, negation, a second shot or a second structural clause is not one setting for one shot.
  // Nothing is written locally; the request goes to the native agent or back to the visitor.
  const plain = f.replace(/['’-]/g, " ");
  const shotsNamed = new Set([...f.matchAll(new RegExp(`${SHOT}\\s*(?:n[o°]?\\s*)?${NUM}`, "giu"))].map(m => m[1]));
  if (NOT_A_SETTING.test(plain) || STRUCTURAL_CLAUSE.test(plain) || shotsNamed.size > 1) return null;
  const move = cameraFromWords(text)?.move ?? null;
  const cadrage = CADRAGE_SB.find(entry => entry.pattern.test(f))?.value ?? null;
  const mood = AMBIANCE.test(f);
  if (!move && !cadrage && !mood) return null;
  // The visitor's own words go into the action, without « make it » nor the shot number.
  const note = text
    .replace(new RegExp(`^(?:(?:in|dans|im|en)\\s+)?${SHOT}\\s*(?:n[o°]?\\s*)?\\d{1,2}\\s*[:,-]?\\s*`, "iu"), "")
    .replace(/^(?:make it|rends[- ]le|mach es|hazlo)\s+/iu, "")
    .replace(/[\s.]+$/u, "");
  return { type: "reglage", n, camera: move ? CAMERA_SB[move] : null, cadrage, note: note.charAt(0).toUpperCase() + note.slice(1) };
}

/**
 * `selected` (1-based, CE5): the shot selected next to the field. A request that names no shot is read
 * for it, without rewriting the request text; a request that names one is read as written.
 */
export function lireCorrection(raw: string, selected?: number): Correction | null {
  const text = raw.trim();
  const f = fold(text);
  const chosen = selected && selected > 0 ? selected : null;
  // « shot 2 says: … » / « le plan 2 dit : … » / « Einstellung 2 sagt: … » / « el plano 2 dice: … »
  const says = new RegExp(`${SHOT}\\s*${NUM}\\s*(?:says|dit|sagt|dice)\\s*:?\\s*(.+)$`, "iu").exec(f);
  if (says) {
    const start = f.indexOf(says[2]!);
    const texte = text.slice(start).replace(/^[\s«"“„]+|[\s»"”“]+$/g, "").slice(0, 160);
    if (texte) return { type: "replique", n: Number(says[1]), texte };
  }
  // « says: … » with no shot named: the selected shot's line.
  const saysHere = chosen ? /^(?:says|dit|sagt|dice)\s*:?\s*(.+)$/iu.exec(f) : null;
  if (saysHere && !says) {
    const start = f.indexOf(saysHere[1]!);
    const texte = text.slice(start).replace(/^[\s«"“„]+|[\s»"”“]+$/g, "").slice(0, 160);
    if (texte) return { type: "replique", n: chosen!, texte };
  }
  return lireStructure(text, chosen);
  return null;
}

/**
 * Down to about `secondes`: unfilmed shots go back to 5 s first (a shot with a line keeps 8 s), then
 * unfilmed shots in the middle are removed, last scene first. The first and last shots and filmed shots stay.
 */
export function resserrer(sb: Storyboard, secondes: number, registre: Pick<Registre, "plans"> | null, now?: string): Storyboard {
  let out: Storyboard = {
    ...sb,
    majLe: now ?? sb.majLe,
    sequences: sb.sequences.map(seq => ({ ...seq, plans: seq.plans.map(plan => etatDuPlan(plan, registre) === "tourne" ? plan : { ...plan, duree: plan.dialogue.texte.trim() ? Math.min(plan.duree, 8) as PlanSB["duree"] : 5 }) })),
  };
  for (let guard = 0; guard < 40 && dureeTotale(out) > secondes; guard += 1) {
    const plans = tousLesPlans(out);
    if (plans.length <= 2) break;
    const removable = plans.slice(1, -1).filter(plan => etatDuPlan(plan, registre) !== "tourne");
    const victim = removable.at(-1);
    if (!victim) break;
    out = retirerPlan(out, victim.id, now);
  }
  return out;
}

export interface Applique { sb: Storyboard; n: number | null }

/** Applies a correction; null when it points at a shot that does not exist. */
export function appliquerCorrection(sb: Storyboard, c: Correction, registre: Pick<Registre, "plans"> | null, nouvelIdPlan: string, now?: string): Applique | null {
  const plans = tousLesPlans(sb);
  const at = (n: number) => plans[n - 1] ?? null;
  switch (c.type) {
    case "ajouter": {
      const last = sb.sequences.at(-1);
      if (!last) return null;
      const next = ajouterPlan(sb, last.id, { ...planVide(nouvelIdPlan, sb.format), cadrage: c.fin ? "large" : null, camera: c.fin ? "fixe" : null }, undefined, now);
      return { sb: next, n: trouverPlan(next, nouvelIdPlan)?.numero ?? null };
    }
    case "retirer": {
      const plan = at(c.n);
      return plan ? { sb: retirerPlan(sb, plan.id, now), n: c.n } : null;
    }
    case "deplacer": {
      const plan = at(c.n);
      return plan ? { sb: deplacerPlan(sb, plan.id, c.pas, now), n: c.n } : null;
    }
    case "format": return { sb: changerFormat(sb, c.format, registre, now), n: null };
    case "raccourcir": return { sb: resserrer(sb, Math.max(5, c.secondes), registre, now), n: null };
    case "replique": {
      const plan = at(c.n);
      if (!plan) return null;
      const withType = plan.dialogue.type === "aucune" ? { ...sb, sequences: sb.sequences.map(seq => ({ ...seq, plans: seq.plans.map(item => item.id === plan.id ? { ...item, dialogue: { ...item.dialogue, type: "replique" as const, qui: item.refs.find(ref => ref.role === "qui")?.nom ?? null } } : item) })) } : sb;
      return { sb: ecrireReplique(withType, plan.id, c.texte, now), n: c.n };
    }
    case "reglage": {
      const plan = at(c.n);
      if (!plan || etatDuPlan(plan, registre) === "tourne") return null;
      const action = plan.action.includes(c.note) ? plan.action : `${plan.action.replace(/[\s.]+$/u, "")}${plan.action.trim() ? ". " : ""}${c.note}.`;
      const next: Storyboard = { ...sb, majLe: now ?? sb.majLe, sequences: sb.sequences.map(seq => ({ ...seq, plans: seq.plans.map(item => item.id !== plan.id ? item : {
        ...item, action: action.slice(0, ACTION_MAX), camera: c.camera ?? item.camera, cadrage: c.cadrage ?? item.cadrage,
      }) })) };
      return { sb: next, n: c.n };
    }
  }
}
