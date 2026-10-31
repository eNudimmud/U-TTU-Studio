// Quotes of a storyboard (SB3). Never invented: a take price comes from the studio's quote for those
// settings (H3 or Rapide, 5/8/10 s), a new character or place from its creation quote. No price → null,
// and the caller disables the button (« Quote unavailable »). Nothing here is ever shown as zero.

import { reglagesVersTake } from "../film/reglages.ts";
import type { MeasuredQuote } from "../render/measured-quote.ts";
import type { TakeSettings } from "../render/take-graph.ts";
import { etatDuPlan, tousLesPlans, type PlanSB, type Storyboard } from "./storyboard.ts";
import type { Registre } from "../film/registre.ts";

export interface CoutsCreation { personnage: number; lieu: number }

export interface ContexteDevis {
  /** The take price for these settings, or null when the studio has none. */
  prixPrise(settings: TakeSettings): number | null;
  creation: CoutsCreation;
}

export interface EtapeDevis { type: "personnage" | "lieu" | "prise"; nom: string; credits: number }

export function reglagesDuPlan(plan: Pick<PlanSB, "duree" | "format" | "rendu">): TakeSettings {
  return reglagesVersTake({ duree: plan.duree, format: plan.format, rendu: plan.rendu });
}

const arrondi = (n: number) => Math.round(n * 10) / 10;

/**
 * The steps of one shot: each new character, the new place, then the take. `dejaCrees` holds the folded
 * names already counted by an earlier shot of the same batch: a new reference is created once.
 */
export function devisPlan(plan: PlanSB, ctx: ContexteDevis, dejaCrees: ReadonlySet<string> = new Set()): { etapes: EtapeDevis[]; total: number | null } {
  const prise = ctx.prixPrise(reglagesDuPlan(plan));
  const etapes: EtapeDevis[] = [];
  for (const ref of plan.refs) {
    if (ref.id || (ref.role !== "qui" && ref.role !== "ou")) continue;
    const key = `${ref.role}:${ref.nom.trim().toLowerCase()}`;
    if (dejaCrees.has(key)) continue;
    etapes.push(ref.role === "qui" ? { type: "personnage", nom: ref.nom, credits: ctx.creation.personnage } : { type: "lieu", nom: ref.nom, credits: ctx.creation.lieu });
  }
  if (prise === null) return { etapes, total: null };
  etapes.push({ type: "prise", nom: plan.titre || plan.action, credits: prise });
  return { etapes, total: arrondi(etapes.reduce((sum, step) => sum + step.credits, 0)) };
}

/** The shots still to film, in board order. */
export function plansATourner(sb: Storyboard, registre: Pick<Registre, "plans"> | null): PlanSB[] {
  return tousLesPlans(sb).filter(plan => etatDuPlan(plan, registre) !== "tourne");
}

/** Every shot still to film. A new reference shared by several shots is counted once. Null when one shot has no quote. */
export function devisStoryboard(sb: Storyboard, ctx: ContexteDevis, registre: Pick<Registre, "plans"> | null, plans: readonly PlanSB[] = plansATourner(sb, registre)): { total: number | null; plans: { id: string; total: number | null; etapes: EtapeDevis[] }[] } {
  const vus = new Set<string>();
  const out: { id: string; total: number | null; etapes: EtapeDevis[] }[] = [];
  let total = 0;
  let manque = false;
  for (const plan of plans) {
    const devis = devisPlan(plan, ctx, vus);
    for (const step of devis.etapes) if (step.type !== "prise") vus.add(`${step.type === "personnage" ? "qui" : "ou"}:${step.nom.trim().toLowerCase()}`);
    out.push({ id: plan.id, ...devis });
    if (devis.total === null) manque = true;
    else total += devis.total;
  }
  return { total: manque || out.length === 0 ? null : arrondi(total), plans: out };
}

/** Quote profile of one dialogue call on Comfy's text model (measured once, then read from the vault). */
export const PROFIL_REPLIQUES = "txt-repliques";

/**
 * « Suggest lines » for `nbPlans` shots. One call writes every shot's proposals, so the price is the
 * measured price of one call; null until a real run was measured (the button stays hidden).
 */
export function devisRepliques(quotes: readonly Pick<MeasuredQuote, "profile" | "credits" | "at">[], nbPlans: number): number | null {
  if (nbPlans <= 0) return null;
  const mesures = quotes.filter(quote => quote.profile === PROFIL_REPLIQUES && Number.isFinite(quote.credits) && quote.credits > 0).sort((a, b) => b.at.localeCompare(a.at));
  return mesures[0] ? arrondi(mesures[0].credits) : null;
}
