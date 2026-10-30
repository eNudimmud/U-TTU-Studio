// Registre de production (refonte FILM, PR 3). One register per film: characters, places, plans,
// takes and the cut, all referenced by id. Nothing is copied: a plan points at its characters and
// place, a cut clip points at its take, so a clip finds its references through its plan.
// Pure functions only; the studio session persists the plans next to the vault.

export const REFS_MAX = 3;
export const REGISTRE_VERSION = 1;
export const REGISTRE_FILE = ".uttu/registre-plans.json";

/** One reference picture. `comfyName` is the input name Comfy Cloud gave it: never sent twice. */
export interface RefImage {
  sha256: string;
  path: string;
  comfyName?: string;
}

export interface Personnage {
  id: string;
  nom: string;
  refs: RefImage[];
  /** The CAST card this character comes from. */
  castId: string | null;
  /** Always false until a LoRA can be saved on Comfy Cloud (SaveLoRA). */
  entraine: boolean;
}

export interface Lieu {
  id: string;
  nom: string;
  refs: RefImage[];
  vue3D: boolean;
  decorId: string | null;
}

export type Duree = 3 | 5 | 8;
export type Format = "paysage" | "portrait";
export type Camera = "fixe" | "suit" | "approche" | "autour";
export type Paroles = "aucune" | "replique" | "voixoff";
export type Rendu = "rapide" | "fidele";

export interface ReglagesPlan {
  duree: Duree;
  format: Format;
  camera: Camera | null;
  paroles: Paroles;
  raccord: boolean;
  rendu: Rendu;
}

export const REGLAGES_DEFAUT: ReglagesPlan = { duree: 5, format: "paysage", camera: null, paroles: "aucune", raccord: false, rendu: "fidele" };

export interface Prise {
  id: string;
  /** Vault path of the video. */
  fichier: string;
  garde: boolean;
}

export interface PlanFilm {
  id: string;
  phrase: string;
  quiIds: string[];
  ouId: string | null;
  reglages: ReglagesPlan;
  prises: Prise[];
}

export interface ClipFilm {
  planId: string;
  priseId: string;
  in: number;
  out: number;
}

export interface Registre {
  version: number;
  personnages: Personnage[];
  lieux: Lieu[];
  plans: PlanFilm[];
  montage: { clips: ClipFilm[] };
}

export function registreVide(): Registre {
  return { version: REGISTRE_VERSION, personnages: [], lieux: [], plans: [], montage: { clips: [] } };
}

export interface AjoutRef {
  refs: RefImage[];
  /** Same bytes already there: « Déjà dans ta galerie, l'utiliser ». */
  doublon: RefImage | null;
  /** Three pictures already: the new one is refused. */
  plein: boolean;
}

/** Adds a picture to a character or a place: never twice the same bytes, never more than three. */
export function ajouterRef(refs: readonly RefImage[], ref: RefImage): AjoutRef {
  const doublon = refs.find(item => item.sha256 === ref.sha256) ?? null;
  if (doublon) return { refs: [...refs], doublon, plein: false };
  if (refs.length >= REFS_MAX) return { refs: [...refs], doublon: null, plein: true };
  return { refs: [...refs, ref], doublon: null, plein: false };
}

/** Keeps the first of each SHA-256 and at most three. */
export function refsPropres(refs: readonly RefImage[]): RefImage[] {
  const seen = new Set<string>();
  const out: RefImage[] = [];
  for (const ref of refs) {
    if (!ref.sha256 || seen.has(ref.sha256)) continue;
    seen.add(ref.sha256);
    out.push(ref);
    if (out.length === REFS_MAX) break;
  }
  return out;
}

/** A new plan picks up the characters and the place of the previous plan. */
export function nouveauPlan(registre: Registre, id: string, phrase = ""): PlanFilm {
  const precedent = registre.plans.at(-1);
  return {
    id,
    phrase,
    quiIds: precedent ? [...precedent.quiIds] : [],
    ouId: precedent?.ouId ?? null,
    reglages: { ...(precedent?.reglages ?? REGLAGES_DEFAUT), raccord: false },
    prises: [],
  };
}

export function ajouterPlan(registre: Registre, plan: PlanFilm): Registre {
  return { ...registre, plans: [...registre.plans.filter(item => item.id !== plan.id), plan] };
}

export function majPlan(registre: Registre, id: string, patch: Partial<Omit<PlanFilm, "id">>): Registre {
  return { ...registre, plans: registre.plans.map(plan => plan.id === id ? { ...plan, ...patch } : plan) };
}

/** A take lands in its plan. The first take is kept (★) until another one is. */
export function ajouterPrise(registre: Registre, planId: string, prise: Omit<Prise, "garde">): Registre {
  return majPlanWith(registre, planId, plan => {
    if (plan.prises.some(item => item.id === prise.id)) return plan;
    return { ...plan, prises: [...plan.prises, { ...prise, garde: plan.prises.length === 0 }] };
  });
}

/** ★ Garder: one kept take per plan. The cut follows the kept take. */
export function garderPrise(registre: Registre, planId: string, priseId: string): Registre {
  const next = majPlanWith(registre, planId, plan => ({ ...plan, prises: plan.prises.map(item => ({ ...item, garde: item.id === priseId })) }));
  return { ...next, montage: { clips: next.montage.clips.map(clip => clip.planId === planId ? { ...clip, priseId } : clip) } };
}

function majPlanWith(registre: Registre, planId: string, change: (plan: PlanFilm) => PlanFilm): Registre {
  return { ...registre, plans: registre.plans.map(plan => plan.id === planId ? change(plan) : plan) };
}

export function priseGardee(plan: PlanFilm): Prise | null {
  return plan.prises.find(item => item.garde) ?? plan.prises.at(-1) ?? null;
}

export interface RefsClip {
  plan: PlanFilm;
  prise: Prise | null;
  personnages: Personnage[];
  lieu: Lieu | null;
  refs: RefImage[];
}

/** A cut clip knows its take, so its plan, so its references. */
export function refsDuClip(registre: Registre, clip: Pick<ClipFilm, "planId" | "priseId">): RefsClip | null {
  const plan = registre.plans.find(item => item.id === clip.planId);
  if (!plan) return null;
  const prise = plan.prises.find(item => item.id === clip.priseId) ?? null;
  const personnages = plan.quiIds.flatMap(id => registre.personnages.filter(item => item.id === id));
  const lieu = plan.ouId ? registre.lieux.find(item => item.id === plan.ouId) ?? null : null;
  return { plan, prise, personnages, lieu, refs: [...personnages.flatMap(item => item.refs), ...(lieu?.refs ?? [])] };
}

/** Puts a plan's kept take at the end of the cut, once. Returns the same register when it is there. */
export function auMontage(registre: Registre, planId: string, secondes: number): Registre {
  const plan = registre.plans.find(item => item.id === planId);
  const prise = plan ? priseGardee(plan) : null;
  if (!plan || !prise || registre.montage.clips.some(clip => clip.planId === planId)) return registre;
  return { ...registre, montage: { clips: [...registre.montage.clips, { planId, priseId: prise.id, in: 0, out: secondes }] } };
}

/** Reads the stored register. Malformed rows are dropped, never thrown. */
export function lireRegistre(raw: string | null | undefined): Registre {
  if (!raw) return registreVide();
  let data: Partial<Registre>;
  try { data = JSON.parse(raw) as Partial<Registre>; } catch { return registreVide(); }
  if (!data || typeof data !== "object") return registreVide();
  const id = (value: unknown): value is string => typeof value === "string" && /^[\w.-]{1,80}$/.test(value);
  const refs = (value: unknown): RefImage[] => refsPropres((Array.isArray(value) ? value : []).filter((item): item is RefImage => Boolean(item) && typeof item.sha256 === "string" && typeof item.path === "string"));
  const reglages = (value: unknown): ReglagesPlan => {
    const row = (value ?? {}) as Partial<ReglagesPlan>;
    return {
      duree: row.duree === 3 || row.duree === 8 ? row.duree : 5,
      format: row.format === "portrait" ? "portrait" : "paysage",
      camera: row.camera === "fixe" || row.camera === "suit" || row.camera === "approche" || row.camera === "autour" ? row.camera : null,
      paroles: row.paroles === "replique" || row.paroles === "voixoff" ? row.paroles : "aucune",
      raccord: row.raccord === true,
      rendu: row.rendu === "rapide" ? "rapide" : "fidele",
    };
  };
  return {
    version: REGISTRE_VERSION,
    personnages: (Array.isArray(data.personnages) ? data.personnages : []).filter(item => id(item?.id)).map(item => ({ id: item.id, nom: String(item.nom ?? "").slice(0, 80), refs: refs(item.refs), castId: typeof item.castId === "string" ? item.castId : null, entraine: false })),
    lieux: (Array.isArray(data.lieux) ? data.lieux : []).filter(item => id(item?.id)).map(item => ({ id: item.id, nom: String(item.nom ?? "").slice(0, 80), refs: refs(item.refs), vue3D: item.vue3D === true, decorId: typeof item.decorId === "string" ? item.decorId : null })),
    plans: (Array.isArray(data.plans) ? data.plans : []).filter(item => id(item?.id)).map(item => ({
      id: item.id,
      phrase: String(item.phrase ?? "").slice(0, 240),
      quiIds: (Array.isArray(item.quiIds) ? item.quiIds : []).filter(id).slice(0, 3),
      ouId: id(item.ouId) ? item.ouId : null,
      reglages: reglages(item.reglages),
      prises: (Array.isArray(item.prises) ? item.prises : []).filter(prise => id(prise?.id) && typeof prise.fichier === "string").map(prise => ({ id: prise.id, fichier: prise.fichier, garde: prise.garde === true })),
    })),
    montage: { clips: (Array.isArray(data.montage?.clips) ? data.montage!.clips : []).filter(clip => id(clip?.planId) && id(clip?.priseId)).map(clip => ({ planId: clip.planId, priseId: clip.priseId, in: Math.max(0, Number(clip.in) || 0), out: Math.max(0, Number(clip.out) || 0) })) },
  };
}

export function registreJson(registre: Registre): string {
  return `${JSON.stringify(registre, null, 2)}\n`;
}

/** What the vault already holds, as a register: CAST cards are characters, DÉCOR scenes are places. */
export interface VaultView {
  cast: readonly { id: string; name: string; sheet: string | null; photos: readonly string[] }[];
  scenes: readonly { id: string; name: string; stills: readonly string[]; render?: string | null; geste?: string }[];
}

/** Binds the stored plans to the vault's characters and places. Hashes come from `hashOf` (path → sha). */
export function relier(registre: Registre, vault: VaultView, hashOf: (path: string) => string | undefined): Registre {
  const ref = (path: string): RefImage | null => {
    const sha256 = hashOf(path);
    return sha256 ? { sha256, path, ...known(path) } : { sha256: `path:${path}`, path, ...known(path) };
  };
  const knownNames = new Map<string, string>();
  for (const item of [...registre.personnages, ...registre.lieux]) for (const r of item.refs) if (r.comfyName) knownNames.set(r.path, r.comfyName);
  function known(path: string): { comfyName?: string } { const name = knownNames.get(path); return name ? { comfyName: name } : {}; }
  const personnages: Personnage[] = vault.cast.filter(card => card.name.trim()).map(card => ({
    id: card.id,
    nom: card.name.trim(),
    refs: refsPropres([...(card.sheet ? [card.sheet] : []), ...card.photos].flatMap(path => ref(path) ?? [])),
    castId: card.id,
    entraine: false,
  }));
  const lieux: Lieu[] = vault.scenes.filter(scene => scene.name.trim()).map(scene => ({
    id: scene.id,
    nom: scene.name.trim(),
    refs: refsPropres([...(scene.render ? [scene.render] : []), ...scene.stills].flatMap(path => ref(path) ?? [])),
    vue3D: scene.geste === "decor-cadre",
    decorId: scene.id,
  }));
  const ids = new Set([...personnages.map(item => item.id)]);
  const places = new Set(lieux.map(item => item.id));
  return {
    ...registre,
    personnages,
    lieux,
    plans: registre.plans.map(plan => ({ ...plan, quiIds: plan.quiIds.filter(id => ids.has(id)), ouId: plan.ouId && places.has(plan.ouId) ? plan.ouId : null })),
  };
}
