// Storyboard (SB1). One storyboard per file, kept in its project:
//   Projets/<projet>/.uttu/sb-<id>.json   the structured truth (this module)
//   Projets/<projet>/Storyboard/<id>.md   the readable view for Obsidian (markdown.ts)
// Pure functions only, like film/registre.ts. No take, no media and no price is stored here: takes live
// in the production register (a shot points at its PlanFilm by id), prices are derived (devis.ts).

import { priseGardee, type Camera, type Format, type Paroles, type Registre, type Rendu } from "../film/registre.ts";
import { CREATION_REFERENCES_MAX } from "../creation/named-references.ts";

export const STORYBOARD_VERSION = 1;
export const DUREES_PLAN = [5, 8, 10] as const;
export const DUREES_CIBLE = [15, 30, 60] as const;
export const CADRAGES = ["large", "moyen", "serre", "detail"] as const;
export const RENDUS_SB: readonly Rendu[] = ["fidele", "rapide"];
export const ACTION_MAX = 240;
export const REPLIQUE_MAX = 160;
export const PROPOSITIONS_MAX = 3;
export const QUI_MAX = 3;

export type DureePlan = (typeof DUREES_PLAN)[number];
export type DureeCible = (typeof DUREES_CIBLE)[number];
export type Cadrage = (typeof CADRAGES)[number];
export type EtatPlan = "a-tourner" | "en-cours" | "tourne" | "echec";
export type { Camera, Format, Paroles, Rendu };

/** A reference is a name known in the visitor's project (CAST, DÉCOR, object, style), or a name to create. */
export interface RefPlan {
  role: "qui" | "ou" | "objet" | "style";
  nom: string;
  /** The CAST / DÉCOR card or named reference; null = « new · will be created ». */
  id: string | null;
  description?: string;
}

export interface Dialogue {
  type: Paroles;
  /** Who speaks a line; null for a voice-over. */
  qui: string | null;
  texte: string;
  /** Where the shown text comes from: typed by the visitor, quoted in the idea, or proposed by Uttu. */
  source: "visiteur" | "idee" | "uttu";
  /** Uttu's other proposals, kept so that picking another one costs no new call. */
  propositions: string[];
}

export interface Son { musique: string; ambiance: string }

export interface PlanSB {
  id: string;
  titre: string;
  action: string;
  refs: RefPlan[];
  cadrage: Cadrage | null;
  camera: Camera | null;
  duree: DureePlan;
  format: Format;
  rendu: Rendu;
  dialogue: Dialogue;
  son: Son;
  promptManuel: string | null;
  raccord: boolean;
  /** The register's PlanFilm once the shot was sent. */
  planFilmId: string | null;
  etat: EtatPlan;
}

export interface Sequence { id: string; titre: string; resume: string; plans: PlanSB[] }

export interface Storyboard {
  version: number;
  id: string;
  titre: string;
  idee: string;
  logline: string;
  scenario: string;
  format: Format;
  dureeCible: DureeCible;
  musique: string;
  sequences: Sequence[];
  archive: boolean;
  creeLe: string;
  majLe: string;
}

const ID = /^[a-z0-9][a-z0-9-]{0,60}$/;

/** « Last set » → « last-set-k3f9 ». The suffix keeps two storyboards with one title apart. */
export function nouvelId(titre: string, suffixe: string): string {
  const base = titre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "storyboard";
  const tail = suffixe.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "0";
  return `${base}-${tail}`;
}

/** The two files of one storyboard, relative to its project (4 segments at most from the vault root). */
export function cheminJson(id: string): string { return `.uttu/sb-${id}.json`; }
export function cheminMarkdown(id: string): string { return `Storyboard/${id}.md`; }
/** `.uttu/sb-<id>.json` (project-relative or full vault path) → id. */
export function idDuChemin(path: string): string | null {
  const match = /(?:^|\/)\.uttu\/sb-([a-z0-9][a-z0-9-]{0,60})\.json$/.exec(path);
  return match ? match[1]! : null;
}

export function dialogueVide(): Dialogue {
  return { type: "aucune", qui: null, texte: "", source: "visiteur", propositions: [] };
}

export function planVide(id: string, format: Format = "paysage"): PlanSB {
  return {
    id, titre: "", action: "", refs: [], cadrage: null, camera: null, duree: 5, format, rendu: "fidele",
    dialogue: dialogueVide(), son: { musique: "", ambiance: "" }, promptManuel: null, raccord: false, planFilmId: null, etat: "a-tourner",
  };
}

export function storyboardVide(input: { id: string; titre: string; idee: string; format?: Format; dureeCible?: DureeCible; now: string }): Storyboard {
  return {
    version: STORYBOARD_VERSION, id: input.id, titre: input.titre.slice(0, 80), idee: input.idee.slice(0, 600), logline: input.idee.slice(0, 240),
    scenario: "", format: input.format ?? "paysage", dureeCible: input.dureeCible ?? 30, musique: "", sequences: [], archive: false, creeLe: input.now, majLe: input.now,
  };
}

// ---------------------------------------------------------------- reading (tolerant, never throws)

const str = (value: unknown, max: number) => typeof value === "string" ? value.slice(0, max) : "";
const pick = <T extends string | number>(value: unknown, allowed: readonly T[], fallback: T): T => allowed.includes(value as T) ? value as T : fallback;

/** A length outside 5/8/10 becomes 5 (the old 3 s too). */
export function dureePlan(value: unknown): DureePlan {
  return pick(value, DUREES_PLAN, 5);
}

/** Who ≤ 3, where ≤ 1, 7 references in all; a reference without a name is dropped. */
export function refsPropres(refs: readonly RefPlan[]): RefPlan[] {
  const out: RefPlan[] = [];
  let qui = 0;
  let ou = 0;
  const seen = new Set<string>();
  for (const ref of refs) {
    const nom = ref.nom.trim().slice(0, 80);
    const key = `${ref.role}:${nom.toLowerCase()}`;
    if (!nom || seen.has(key)) continue;
    if (ref.role === "qui" && qui >= QUI_MAX) continue;
    if (ref.role === "ou" && ou >= 1) continue;
    if (out.length >= CREATION_REFERENCES_MAX) break;
    seen.add(key);
    if (ref.role === "qui") qui += 1;
    if (ref.role === "ou") ou += 1;
    out.push({ role: ref.role, nom, id: ref.id, ...(ref.description ? { description: ref.description.slice(0, 240) } : {}) });
  }
  return out;
}

function lireRef(value: unknown): RefPlan | null {
  const row = (value ?? {}) as Partial<RefPlan>;
  const nom = str(row.nom, 80).trim();
  if (!nom) return null;
  return { role: pick(row.role, ["qui", "ou", "objet", "style"] as const, "qui"), nom, id: typeof row.id === "string" && row.id ? row.id.slice(0, 120) : null, ...(typeof row.description === "string" && row.description ? { description: row.description.slice(0, 240) } : {}) };
}

function lireDialogue(value: unknown): Dialogue {
  const row = (value ?? {}) as Partial<Dialogue>;
  return {
    type: pick(row.type, ["aucune", "replique", "voixoff"] as const, "aucune"),
    qui: typeof row.qui === "string" && row.qui.trim() ? row.qui.trim().slice(0, 80) : null,
    texte: str(row.texte, REPLIQUE_MAX),
    source: pick(row.source, ["visiteur", "idee", "uttu"] as const, "visiteur"),
    propositions: (Array.isArray(row.propositions) ? row.propositions : []).filter((item): item is string => typeof item === "string" && item.trim() !== "").map(item => item.slice(0, REPLIQUE_MAX)).slice(0, PROPOSITIONS_MAX),
  };
}

function lirePlan(value: unknown, format: Format): PlanSB | null {
  const row = (value ?? {}) as Partial<PlanSB>;
  if (typeof row.id !== "string" || !ID.test(row.id)) return null;
  return {
    id: row.id,
    titre: str(row.titre, 80),
    action: str(row.action, ACTION_MAX),
    refs: refsPropres((Array.isArray(row.refs) ? row.refs : []).flatMap(item => lireRef(item) ?? [])),
    cadrage: CADRAGES.includes(row.cadrage as Cadrage) ? row.cadrage as Cadrage : null,
    camera: row.camera === "fixe" || row.camera === "suit" || row.camera === "approche" || row.camera === "autour" ? row.camera : null,
    duree: dureePlan(row.duree),
    format: row.format === "portrait" ? "portrait" : row.format === "paysage" ? "paysage" : format,
    rendu: row.rendu === "rapide" ? "rapide" : "fidele",
    dialogue: lireDialogue(row.dialogue),
    son: { musique: str(row.son?.musique, 160), ambiance: str(row.son?.ambiance, 160) },
    promptManuel: typeof row.promptManuel === "string" && row.promptManuel.trim() ? row.promptManuel.slice(0, 600) : null,
    raccord: row.raccord === true,
    planFilmId: typeof row.planFilmId === "string" && /^[\w.-]{1,80}$/.test(row.planFilmId) ? row.planFilmId : null,
    etat: pick(row.etat, ["a-tourner", "en-cours", "tourne", "echec"] as const, "a-tourner"),
  };
}

/** Reads a stored storyboard. A broken file gives null (the caller says so and never overwrites it). */
export function lireStoryboard(raw: string | null | undefined): Storyboard | null {
  if (!raw) return null;
  let data: Partial<Storyboard>;
  try { data = JSON.parse(raw) as Partial<Storyboard>; } catch { return null; }
  if (!data || typeof data !== "object" || typeof data.id !== "string" || !ID.test(data.id)) return null;
  const format: Format = data.format === "portrait" ? "portrait" : "paysage";
  const ids = new Set<string>();
  const sequences: Sequence[] = (Array.isArray(data.sequences) ? data.sequences : []).flatMap(seq => {
    if (!seq || typeof seq.id !== "string" || !ID.test(seq.id)) return [];
    const plans = (Array.isArray(seq.plans) ? seq.plans : []).flatMap(item => {
      const plan = lirePlan(item, format);
      if (!plan || ids.has(plan.id)) return [];
      ids.add(plan.id);
      return [plan];
    });
    return [{ id: seq.id, titre: str(seq.titre, 80), resume: str(seq.resume, 240), plans }];
  });
  const now = new Date(0).toISOString();
  return {
    version: STORYBOARD_VERSION,
    id: data.id,
    titre: str(data.titre, 80),
    idee: str(data.idee, 600),
    logline: str(data.logline, 240),
    scenario: str(data.scenario, 8000),
    format,
    dureeCible: pick(data.dureeCible, DUREES_CIBLE, 30),
    musique: str(data.musique, 160),
    sequences,
    archive: data.archive === true,
    creeLe: typeof data.creeLe === "string" ? data.creeLe : now,
    majLe: typeof data.majLe === "string" ? data.majLe : now,
  };
}

export function storyboardJson(sb: Storyboard): string {
  return `${JSON.stringify(sb, null, 2)}\n`;
}

// ---------------------------------------------------------------- edits (pure, return a new storyboard)

export function tousLesPlans(sb: Storyboard): PlanSB[] {
  return sb.sequences.flatMap(seq => seq.plans);
}

export function trouverPlan(sb: Storyboard, planId: string): { plan: PlanSB; sequence: Sequence; index: number; numero: number } | null {
  let numero = 0;
  for (const sequence of sb.sequences) {
    for (let index = 0; index < sequence.plans.length; index += 1) {
      numero += 1;
      if (sequence.plans[index]!.id === planId) return { plan: sequence.plans[index]!, sequence, index, numero };
    }
  }
  return null;
}

function touche(sb: Storyboard, sequences: Sequence[], now?: string): Storyboard {
  return { ...sb, sequences, majLe: now ?? sb.majLe };
}

export function majPlan(sb: Storyboard, planId: string, patch: Partial<Omit<PlanSB, "id">>, now?: string): Storyboard {
  return touche(sb, sb.sequences.map(seq => ({ ...seq, plans: seq.plans.map(plan => {
    if (plan.id !== planId) return plan;
    const next = { ...plan, ...patch };
    return { ...next, action: next.action.slice(0, ACTION_MAX), duree: dureePlan(next.duree), refs: refsPropres(next.refs), dialogue: { ...next.dialogue, texte: next.dialogue.texte.slice(0, REPLIQUE_MAX) } };
  }) })), now);
}

/** The visitor types a line: it is theirs now, Uttu's proposals stay to pick from. */
export function ecrireReplique(sb: Storyboard, planId: string, texte: string, now?: string): Storyboard {
  const found = trouverPlan(sb, planId);
  if (!found) return sb;
  const type = found.plan.dialogue.type === "aucune" ? "replique" : found.plan.dialogue.type;
  return majPlan(sb, planId, { dialogue: { ...found.plan.dialogue, type, texte: texte.slice(0, REPLIQUE_MAX), source: "visiteur" } }, now);
}

/** Picks one of Uttu's kept proposals: no new call. */
export function choisirProposition(sb: Storyboard, planId: string, index: number, now?: string): Storyboard {
  const found = trouverPlan(sb, planId);
  const texte = found?.plan.dialogue.propositions[index];
  if (!found || texte === undefined) return sb;
  const type = found.plan.dialogue.type === "aucune" ? "replique" : found.plan.dialogue.type;
  return majPlan(sb, planId, { dialogue: { ...found.plan.dialogue, type, texte, source: "uttu" } }, now);
}

/** Adds a shot after `apres` (or at the end of the scene). It inherits who, where and format from its neighbour. */
export function ajouterPlan(sb: Storyboard, sequenceId: string, plan: PlanSB, apres?: string, now?: string): Storyboard {
  if (tousLesPlans(sb).some(item => item.id === plan.id)) return sb;
  return touche(sb, sb.sequences.map(seq => {
    if (seq.id !== sequenceId) return seq;
    const at = apres ? seq.plans.findIndex(item => item.id === apres) : -1;
    const voisin = at >= 0 ? seq.plans[at] : seq.plans.at(-1);
    const next: PlanSB = { ...plan, refs: plan.refs.length ? plan.refs : (voisin?.refs.filter(ref => ref.role === "qui" || ref.role === "ou") ?? []), format: voisin?.format ?? plan.format };
    const plans = [...seq.plans];
    plans.splice(at >= 0 ? at + 1 : plans.length, 0, next);
    return { ...seq, plans };
  }), now);
}

export function retirerPlan(sb: Storyboard, planId: string, now?: string): Storyboard {
  return touche(sb, sb.sequences.map(seq => ({ ...seq, plans: seq.plans.filter(plan => plan.id !== planId) })), now);
}

/** Moves a shot by `pas` places in the whole board (it may change scene). */
/**
 * One step earlier (pas < 0) or later (pas > 0). Inside a scene the shot swaps with its neighbour; at the
 * scene's edge it crosses into the next (or previous) scene first, without jumping over a shot.
 */
export function deplacerPlan(sb: Storyboard, planId: string, pas: number, now?: string): Storyboard {
  const s = sb.sequences.findIndex(seq => seq.plans.some(plan => plan.id === planId));
  if (s < 0 || pas === 0) return sb;
  const seqs = sb.sequences.map(seq => ({ ...seq, plans: [...seq.plans] }));
  const plans = seqs[s]!.plans;
  const i = plans.findIndex(plan => plan.id === planId);
  const dir = pas > 0 ? 1 : -1;
  const j = i + dir;
  if (j >= 0 && j < plans.length) {
    [plans[i], plans[j]] = [plans[j]!, plans[i]!];
  } else {
    const t = s + dir;
    if (t < 0 || t >= seqs.length) return sb;
    const [moved] = plans.splice(i, 1);
    if (dir > 0) seqs[t]!.plans.unshift(moved!);
    else seqs[t]!.plans.push(moved!);
  }
  return touche(sb, seqs, now);
}

export function majSequence(sb: Storyboard, sequenceId: string, patch: Partial<Omit<Sequence, "id" | "plans">>, now?: string): Storyboard {
  return touche(sb, sb.sequences.map(seq => seq.id === sequenceId ? { ...seq, ...patch } : seq), now);
}

/** Every shot not yet filmed in portrait (or landscape), and the storyboard with them. A filmed shot keeps its take's format. */
export function changerFormat(sb: Storyboard, format: Format, registre: Pick<Registre, "plans"> | null = null, now?: string): Storyboard {
  return { ...touche(sb, sb.sequences.map(seq => ({ ...seq, plans: seq.plans.map(plan => etatDuPlan(plan, registre) === "tourne" ? plan : { ...plan, format }) })), now), format };
}

export function archiver(sb: Storyboard, archive: boolean, now?: string): Storyboard {
  return { ...sb, archive, majLe: now ?? sb.majLe };
}

// ---------------------------------------------------------------- derived

/** Filmed when the register holds a kept take for its PlanFilm; otherwise the stored state. */
export function etatDuPlan(plan: PlanSB, registre: Pick<Registre, "plans"> | null, enCours?: string | null): EtatPlan {
  if (plan.planFilmId && enCours === plan.planFilmId) return "en-cours";
  const film = plan.planFilmId && registre ? registre.plans.find(item => item.id === plan.planFilmId) : null;
  if (film && priseGardee(film)) return "tourne";
  return plan.etat === "tourne" || plan.etat === "en-cours" ? "a-tourner" : plan.etat;
}

export function dureeTotale(sb: Storyboard): number {
  return tousLesPlans(sb).reduce((sum, plan) => sum + plan.duree, 0);
}

export function progression(sb: Storyboard, registre: Pick<Registre, "plans"> | null): { tournes: number; total: number } {
  const plans = tousLesPlans(sb);
  return { tournes: plans.filter(plan => etatDuPlan(plan, registre) === "tourne").length, total: plans.length };
}

export type Filtre = "tous" | "en-cours" | "tournes" | "archives";

/** List filters: archived ones only under « Archived »; « Filmed » = every shot filmed. */
export function filtrer(list: readonly Storyboard[], filtre: Filtre, registre: Pick<Registre, "plans"> | null): Storyboard[] {
  return list.filter(sb => {
    if (filtre === "archives") return sb.archive;
    if (sb.archive) return false;
    if (filtre === "tous") return true;
    const { tournes, total } = progression(sb, registre);
    const fini = total > 0 && tournes === total;
    return filtre === "tournes" ? fini : !fini;
  }).sort((a, b) => b.majLe.localeCompare(a.majLe));
}
