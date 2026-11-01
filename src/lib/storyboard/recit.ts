// U1.1 · a story in the visitor's own words becomes one plan. Deterministic, no model, no credit.
// A single sentence still goes through the template writer. A longer text is cut on scenes, sentences
// and « then » / « ; ». Shot titles come from titreDeLIdee (the action's first words). Dialogue lines
// stay dialogue. A known place is never turned into a character.

import { mentionedReferences } from "../creation/mentions.ts";
import { comprendrePlan } from "../film/comprendre.ts";
import type { KnownName } from "../intention/resolve.ts";
import {
  ecrireStoryboard, lieuDeLIdee, lieuEcrit, lieuMentionne, sansReplique, titreDeLIdee, varier,
  type ContexteEcriture, type Ecrit, type OptionsEcriture,
} from "./ecrire.ts";
import { foldName } from "./identites.ts";
import {
  nouvelId, planVide, refsPropres, storyboardVide, type Cadrage, type Camera, type DureeCible, type DureePlan,
  type PlanSB, type RefPlan, type Rendu, type Storyboard,
} from "./storyboard.ts";

export interface OptionsRecit extends Omit<OptionsEcriture, "dureeCible"> {
  /** null: the story decides the length (« fits my story »). 15 / 30 / 60 still merge toward that target. */
  dureeCible: DureeCible | null;
  rendu?: Rendu;
}

export interface EtapesRecit {
  personnages: string[];
  personnagesConnus: boolean;
  lieu: string | null;
  lieuConnu: boolean;
  plans: number;
  repliques: number;
}

export interface EcritRecit extends Ecrit {
  mode: "recit" | "gabarit";
  etapes: EtapesRecit;
}

const sansArobase = (text: string) => text.replace(/(^|[^\p{L}\p{N}_])@(?=[\p{L}\p{N}])/gu, "$1");
const MOUVEMENT = /\b(march\w*|cour\w*|runn?\w*|walk\w*|cross\w*|flee\w*|chase\w*|geh\w*|lauf\w*|renn\w*|camin\w*|corr\w*|sprint\w*)\b/iu;
/** Weather and time of day are not people. A possessive (« Fizz's ») is the person, not a new name. */
const PAS_UN_PERSONNAGE = /^(?:night|day|dawn|dusk|morning|evening|noon|midnight|rain|rains|thunder|lightning|snow|wind|storm|fog|mist|silence|darkness|nuit|aube|aurore|matin|soir|pluie|orage|tonnerre|eclair|neige|vent|regen|donner|nacht|morgen|abend|lluvia|noche|amanecer|trueno|relampago|golden|thread)$/iu;
const racine = (nom: string) => nom.replace(/(?:['’]s|['’])$/iu, "").trim();
const LIGNE = /([\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,3})\s*:\s*[«"“„]([^»"”“]{1,160})[»"”“]/gu;
const PHRASE = /(?<=[.!?…])\s+(?=\p{Lu}|[«"“„]|\d)/u;
const MAX_PLANS = 12;

interface Ligne { qui: string; texte: string }

export function estRecit(idee: string): boolean {
  const text = idee.trim();
  if (!text) return false;
  if (/:\s*[«"“„]/u.test(text)) return true;
  if (/\n/.test(text)) return true;
  if (/^\s*\d{1,2}[.)]\s+/m.test(text)) return true;
  if (/;\s|\s(?:then|puis|ensuite|dann|luego|entonces)\s/iu.test(text)) return true;
  return text.split(PHRASE).filter(part => part.trim()).length > 1;
}

function repliques(beat: string): Ligne[] {
  return [...beat.matchAll(LIGNE)].map(match => ({ qui: match[1]!.replace(/\s+/g, " ").trim(), texte: match[2]!.trim() }));
}

function phrases(part: string): string[] {
  const bits = part.split(PHRASE).map(item => item.trim()).filter(Boolean);
  return bits.length ? bits : [part.trim()].filter(Boolean);
}

/** Scenes, newlines, semicolons, « then », then sentences. A beat of three words or fewer joins the previous one. */
export function decouper(corps: string): string[] {
  const chunks: string[] = [];
  for (const line of corps.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const numbered = /^\d{1,2}[.)]\s+(.+)$/u.exec(trimmed);
    const content = (numbered ? numbered[1]! : trimmed).trim();
    const parts = content.split(/\s*;\s*|\s+(?:then|puis|ensuite|dann|luego|entonces)\s+/iu).map(item => item.trim()).filter(Boolean);
    for (const part of parts) {
      const lines = repliques(part);
      const onlyTalk = lines.length > 0 && sansReplique(part).replace(/[\p{L}'’.-]+\s*:/gu, "").trim().length < 8;
      if (onlyTalk) chunks.push(part);
      else for (const sentence of phrases(part)) chunks.push(sentence);
    }
  }
  const merged: string[] = [];
  for (const chunk of chunks) {
    const words = chunk.replace(/[«»"“”„]/g, "").split(/\s+/).filter(Boolean);
    if (merged.length && words.length <= 3) merged[merged.length - 1] += ` ${chunk}`;
    else merged.push(chunk);
  }
  return merged.filter(Boolean).slice(0, MAX_PLANS);
}

function nomme(sentence: string, names: readonly string[]): boolean {
  return names.some(name => {
    if (name.length < 3) return false;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(sentence);
  });
}

function separerTitre(raw: string, cast: readonly KnownName[]): { titre: string | null; corps: string } {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const sentences = text.split(/(?<=[.!?…])\s+/u);
  if (sentences.length < 2) return { titre: null, corps: text };
  const head = sentences[0]!.trim();
  const words = head.replace(/[.!?…]+$/u, "").split(/\s+/).filter(Boolean);
  const names = cast.map(item => item.name.trim());
  if (words.length >= 1 && words.length <= 6 && /[.!?…]$/u.test(head) && !nomme(head, names) && !/^\d/.test(head)) {
    const titre = head.replace(/[.!?…]+$/u, "").trim();
    const corps = text.slice(text.indexOf(head) + head.length).trim();
    if (titre && corps) return { titre, corps };
  }
  return { titre: null, corps: text };
}

function reduire(beats: string[], cible: DureeCible | null): string[] {
  const max = cible === 15 ? 3 : cible === 30 ? 6 : MAX_PLANS;
  const out = [...beats];
  while (out.length > max) {
    let at = 0;
    let best = Infinity;
    for (let i = 0; i < out.length - 1; i += 1) {
      const len = out[i]!.length + out[i + 1]!.length;
      if (len < best) { best = len; at = i; }
    }
    out.splice(at, 2, `${out[at]} ${out[at + 1]}`.replace(/\s+/g, " ").trim());
  }
  return out;
}

function lieuDuTexte(text: string, ctx: ContexteEcriture): RefPlan | null {
  const plain = sansArobase(text).replace(LIGNE, " ");
  const lieux: KnownName[] = [
    ...ctx.decor,
    ...(ctx.lieuxNommes ?? []).filter(nom => !ctx.decor.some(item => foldName(item.name) === foldName(nom))).map(name => ({ id: "", name })),
  ];
  const mention = lieuMentionne(text, lieux) ?? lieuEcrit(plain, lieux) ?? mentionedReferences(plain, lieux)[0] ?? null;
  if (mention) return { role: "ou", nom: mention.name, id: mention.id || null };
  const lu = lieuDeLIdee(plain);
  if (!lu) return null;
  if ((ctx.ambigus ?? []).some(item => foldName(item) === foldName(lu))) return null;
  const known = ctx.decor.find(item => foldName(item.name) === foldName(lu));
  return { role: "ou", nom: known?.name ?? lu, id: known?.id ?? null };
}

function quiDuBeat(beat: string, ctx: ContexteEcriture, ou: RefPlan | null, lines: readonly Ligne[]): RefPlan[] {
  const ambigus = new Set((ctx.ambigus ?? []).map(foldName));
  const lieuMots = new Set((ou?.nom ?? "").toLowerCase().split(/\s+/).filter(word => word.length > 2));
  const decor = new Set(ctx.decor.map(item => foldName(item.name)));
  const refuse = (nom: string) => {
    const propre = racine(nom);
    const key = foldName(propre);
    return !key || PAS_UN_PERSONNAGE.test(propre) || ambigus.has(key) || decor.has(key) || lieuMots.has(propre.toLowerCase());
  };
  const compris = comprendrePlan(sansArobase(beat).replace(LIGNE, " "), ctx);
  const refs: RefPlan[] = [];
  const push = (nom: string, id: string | null) => {
    const propre = racine(nom);
    if (refuse(propre)) return;
    const known = ctx.cast.find(item => foldName(item.name) === foldName(propre));
    refs.push({ role: "qui", nom: known?.name ?? propre, id: known?.id ?? (id || null) });
  };
  for (const item of compris.qui) push(item.nom, item.nouveau ? null : item.id);
  for (const line of lines) push(line.qui, null);
  return refsPropres(refs);
}

function actionDe(beat: string, lines: readonly Ligne[]): string {
  const prose = sansReplique(beat)
    .replace(/(?:^|\s)[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,3}\s*:/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (prose.replace(/[^\p{L}\p{N}]/gu, "").length > 2) return prose;
  if (lines.length) return lines.map(line => `${line.qui}: “${line.texte}”`).join(" ");
  return sansReplique(beat) || beat;
}

function dureeDe(action: string, parle: boolean, options: OptionsRecit): DureePlan {
  const huit = options.dureeChiffree?.(8) ?? false;
  const dix = options.dureeChiffree?.(10) ?? false;
  if (parle && huit) return 8;
  if (action.split(/\s+/).filter(Boolean).length > 18 && dix) return 10;
  return 5;
}

function forme(action: string, qui: readonly RefPlan[], parle: boolean): { cadrage: Cadrage; camera: Camera } {
  const move = comprendrePlan(action, { cast: [], decor: [] }).read.camera.move;
  if (!qui.length && !parle) return { cadrage: "large", camera: move ? "suit" : "fixe" };
  if (parle) return { cadrage: "moyen", camera: "fixe" };
  if (move || MOUVEMENT.test(action)) return { cadrage: "moyen", camera: "suit" };
  return { cadrage: "moyen", camera: "fixe" };
}

function avecRendu(sb: Storyboard, rendu: Rendu): Storyboard {
  if (rendu === "fidele") return sb;
  return { ...sb, sequences: sb.sequences.map(seq => ({ ...seq, plans: seq.plans.map(plan => ({ ...plan, rendu })) })) };
}

function etapesDe(sb: Storyboard, ou: RefPlan | null): EtapesRecit {
  const plans = sb.sequences.flatMap(seq => seq.plans);
  const qui = plans.flatMap(plan => plan.refs.filter(ref => ref.role === "qui"));
  const noms = [...new Map(qui.map(ref => [foldName(ref.nom), ref])).values()];
  return {
    personnages: noms.map(ref => ref.nom),
    personnagesConnus: noms.length > 0 && noms.every(ref => Boolean(ref.id)),
    lieu: ou?.nom ?? plans.flatMap(plan => plan.refs.filter(ref => ref.role === "ou"))[0]?.nom ?? null,
    lieuConnu: Boolean(ou?.id),
    plans: plans.length,
    repliques: plans.filter(plan => plan.dialogue.texte.trim()).length,
  };
}

function gabarit(idee: string, ctx: ContexteEcriture, options: OptionsRecit): EcritRecit {
  const res = ecrireStoryboard(idee, ctx, { ...options, dureeCible: options.dureeCible ?? 30 });
  const sb = avecRendu(res.storyboard, options.rendu ?? "fidele");
  const ou = sb.sequences.flatMap(seq => seq.plans).flatMap(plan => plan.refs).find(ref => ref.role === "ou") ?? null;
  return { ...res, storyboard: sb, mode: "gabarit", etapes: etapesDe(sb, ou) };
}

/** Writes one plan from a story. One sentence keeps the template découpage. */
export function ecrireDepuisRecit(ideeBrute: string, ctx: ContexteEcriture, options: OptionsRecit): EcritRecit {
  const brut = ideeBrute.replace(/\r\n/g, "\n").trim().slice(0, 4000);
  if (!brut) return gabarit(brut, ctx, options);
  if (!estRecit(brut)) return gabarit(brut, ctx, options);

  const { titre: titrePose, corps } = separerTitre(brut, [...ctx.cast, ...ctx.decor]);
  const beats = reduire(decouper(corps), options.dureeCible);
  if (!beats.length) return gabarit(brut, ctx, options);
  const ou = lieuDuTexte(brut, ctx);
  const rendu = options.rendu ?? "fidele";
  const plans: PlanSB[] = beats.map((beat, index) => {
    const lines = repliques(beat);
    const action = actionDe(beat, lines).slice(0, 240);
    const qui = quiDuBeat(beat, ctx, ou, lines);
    const parle = lines.length > 0;
    const look = forme(action, qui, parle);
    const titre = parle
      ? titreDeLIdee(`${lines[0]!.qui} says “${lines[0]!.texte}”`)
      : titreDeLIdee(action || beat);
    const base = planVide(`p${index + 1}`, options.format);
    const plan: PlanSB = {
      ...base,
      titre,
      action,
      refs: refsPropres([...(ou ? [ou] : []), ...qui]),
      cadrage: look.cadrage,
      camera: look.camera,
      duree: dureeDe(action, parle, options),
      rendu,
      dialogue: parle
        ? {
          type: "replique",
          qui: qui.find(ref => foldName(ref.nom) === foldName(lines[0]!.qui))?.nom ?? lines[0]!.qui,
          texte: (lines.length === 1 ? lines[0]!.texte : lines.map(line => `${line.qui}: “${line.texte}”`).join(" ")).slice(0, 160),
          source: "idee",
          propositions: [],
        }
        : base.dialogue,
      raccord: index > 0,
    };
    return plan;
  });
  const varies = varier(plans);
  const titre = (titrePose || titreDeLIdee(sansArobase(corps))).slice(0, 80) || "Storyboard";
  const sb: Storyboard = {
    ...storyboardVide({
      id: nouvelId(titre, options.suffixe),
      titre,
      idee: brut.slice(0, 600),
      format: options.format,
      dureeCible: options.dureeCible ?? (plans.reduce((sum, plan) => sum + plan.duree, 0) <= 22 ? 15 : plans.reduce((sum, plan) => sum + plan.duree, 0) <= 45 ? 30 : 60),
      now: options.now,
    }),
    logline: (plans.find(plan => plan.action)?.action ?? brut).slice(0, 240),
    sequences: [{ id: "s1", titre, resume: plans[0]?.action.slice(0, 240) ?? "", plans: varies }],
  };
  const tous = varies.flatMap(plan => plan.refs);
  const uniques = [...new Map(tous.map(ref => [`${ref.role}:${foldName(ref.nom)}`, ref])).values()];
  return {
    storyboard: sb,
    question: null,
    repris: uniques.filter(ref => ref.id).map(ref => ref.nom),
    nouveaux: uniques.filter(ref => !ref.id).map(ref => ref.nom),
    mode: "recit",
    etapes: etapesDe(sb, ou),
  };
}
