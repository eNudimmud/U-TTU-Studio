// A finished take lands on the storyboard shot it was sent for. Pure: the session calls it when the
// render is settled, including after a reload. The same take id is never added twice, and the shot
// is the plan id that was sent, never a plan that happens to share a phrase.

import { ajouterPlan, ajouterPrise, auMontage, nouveauPlan, type Registre } from "../film/registre.ts";

const ID = /^[\w.-]{1,80}$/;

export interface EnvoiReglement {
  /** The storyboard shot's planFilmId. */
  planId: string;
  phrase: string;
  castIds: readonly string[];
  decorId: string | null;
  /** Length of the clip on the cut, in seconds. */
  seconds: number;
}

export interface PriseReglement {
  id: string;
  fichier: string;
}

/** Puts `take` on `envoi.planId` and on the cut, once. An unknown id, or a take already on another plan, is left untouched. */
export function reglerPrise(registre: Registre, envoi: EnvoiReglement, take: PriseReglement): Registre {
  if (!ID.test(envoi.planId) || !ID.test(take.id) || typeof take.fichier !== "string" || take.fichier.length === 0) return registre;
  if (registre.plans.some(plan => plan.id !== envoi.planId && plan.prises.some(item => item.id === take.id))) return registre;
  const seconds = Number.isFinite(envoi.seconds) && envoi.seconds > 0 ? envoi.seconds : 0;
  const current = registre.plans.find(plan => plan.id === envoi.planId);
  // Already filed: keep its path and its kept flag. Put it on the cut if that step was missed.
  if (current?.prises.some(item => item.id === take.id)) {
    return seconds > 0 ? auMontage(registre, envoi.planId, seconds) : registre;
  }
  let next = registre;
  if (!current) {
    const created = nouveauPlan(next, envoi.planId, envoi.phrase);
    next = ajouterPlan(next, {
      ...created,
      phrase: envoi.phrase.slice(0, 240),
      quiIds: envoi.castIds.filter(id => ID.test(id)).slice(0, 3),
      ouId: envoi.decorId && ID.test(envoi.decorId) ? envoi.decorId : null,
      prises: [],
    });
  }
  next = ajouterPrise(next, envoi.planId, { id: take.id, fichier: take.fichier });
  return seconds > 0 ? auMontage(next, envoi.planId, seconds) : next;
}
