// A storyboard shot becomes a film2 shot (SB7): same take, same single confirmation, same register.
// A name that already has a card is linked. A name that does not is listed in `manquants`: the film
// path may still create it, the storyboard path refuses (D6) and never posts a new card.

import { fromRefPlan, type ShotRefInput } from "../cinema/references.ts";
import type { KnownName } from "../intention/resolve.ts";
import type { TakeSettings } from "../render/take-graph.ts";
import { reglagesDuPlan } from "./devis.ts";
import { promptDuPlan } from "./prompt.ts";
import type { PlanSB, Storyboard } from "./storyboard.ts";

export interface EnvoiPlan {
  planId: string;
  phrase: string;
  ligne: string;
  castIds: string[];
  decorId: string | null;
  nouveaux: { nom: string }[];
  nouveauLieu: { nom: string } | null;
  /** Characters and the place that are still not a card. The storyboard shoot stops on these. */
  manquants: { role: "qui" | "ou"; nom: string }[];
  settings: TakeSettings;
  /**
   * CE1: every ref of the shot with its role, objects and style included, in the shot's order. The
   * cinema resolver (cinema/references.ts) binds them by project/category/id up to the graph; the
   * fields above stay for the historical take path.
   */
  references: ShotRefInput[];
}

/** The register id of a storyboard shot: stable, so a retry finds the steps already done. */
export function planFilmId(sb: Pick<Storyboard, "id">, plan: Pick<PlanSB, "id">): string {
  return `sb-${sb.id}-${plan.id}`.slice(0, 80);
}

/** A reference without id may meanwhile exist as a card (made by an earlier shot): it is linked, not made again. */
function carte(nom: string, cards: readonly KnownName[]): KnownName | undefined {
  const key = nom.trim().toLowerCase();
  return cards.find(card => card.name.trim().toLowerCase() === key);
}

export function versPlanFilm(sb: Storyboard, plan: PlanSB, cards: { cast: readonly KnownName[]; decor: readonly KnownName[] }): EnvoiPlan {
  const castIds: string[] = [];
  const nouveaux: { nom: string }[] = [];
  for (const ref of plan.refs.filter(item => item.role === "qui")) {
    const id = ref.id ?? carte(ref.nom, cards.cast)?.id ?? null;
    if (id) castIds.push(id);
    else nouveaux.push({ nom: ref.nom });
  }
  const ou = plan.refs.find(item => item.role === "ou");
  const decorId = ou ? ou.id ?? carte(ou.nom, cards.decor)?.id ?? null : null;
  return {
    planId: plan.planFilmId ?? planFilmId(sb, plan),
    phrase: plan.action.trim() || plan.titre,
    ligne: promptDuPlan(plan),
    castIds: [...new Set(castIds)],
    decorId,
    nouveaux,
    nouveauLieu: ou && !decorId ? { nom: ou.nom } : null,
    manquants: [
      ...nouveaux.map(item => ({ role: "qui" as const, nom: item.nom })),
      ...(ou && !decorId ? [{ role: "ou" as const, nom: ou.nom }] : []),
    ],
    settings: reglagesDuPlan(plan),
    references: plan.refs.map(fromRefPlan),
  };
}

/**
 * Storyboard shots never create a CAST or DÉCOR card. An unknown name or place is `REF_MISSING`
 * and the caller sends nothing. The film path (no `origine`, or `"film"`) still creates them.
 */
export function refusTournageStoryboard(input: { origine?: string | null; nouveaux: readonly { nom: string }[]; nouveauLieu: { nom: string } | null }): "REF_MISSING" | null {
  if (input.origine !== "storyboard") return null;
  if (input.nouveaux.length > 0 || input.nouveauLieu) return "REF_MISSING";
  return null;
}

/**
 * « Film N shots »: the shots still to film, in board order, one after the other. A running take is
 * never cancelled: the queue only starts the next shot once the previous one ended (landed or failed).
 */
export interface FileTournage { restants: string[]; enCours: string | null; faits: string[]; echecs: string[] }

export function fileVide(ids: readonly string[]): FileTournage {
  return { restants: [...ids], enCours: null, faits: [], echecs: [] };
}

export function suivantDeLaFile(file: FileTournage): FileTournage {
  if (file.enCours || !file.restants.length) return file;
  const [next, ...rest] = file.restants;
  return { ...file, enCours: next!, restants: rest };
}

export function finDuPlan(file: FileTournage, ok: boolean): FileTournage {
  if (!file.enCours) return file;
  return { ...file, enCours: null, faits: ok ? [...file.faits, file.enCours] : file.faits, echecs: ok ? file.echecs : [...file.echecs, file.enCours] };
}
