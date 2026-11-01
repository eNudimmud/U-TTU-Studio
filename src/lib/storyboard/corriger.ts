// « Ask Uttu to change, add, shorten… » (SB8, free mode): a few plain intentions read in FR/EN/DE/ES,
// no model, no credit. Anything else is changed by hand in the shot sheet.

import type { Registre } from "../film/registre.ts";
import {
  ajouterPlan, changerFormat, deplacerPlan, dureeTotale, ecrireReplique, etatDuPlan, planVide, retirerPlan,
  tousLesPlans, trouverPlan, type Format, type PlanSB, type Storyboard,
} from "./storyboard.ts";

export type Correction =
  | { type: "ajouter"; fin: boolean }
  | { type: "retirer"; n: number }
  | { type: "deplacer"; n: number; pas: 1 | -1 }
  | { type: "format"; format: Format }
  | { type: "raccourcir"; secondes: number }
  | { type: "replique"; n: number; texte: string };

const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const SHOT = "(?:plan|shot|einstellung|plano)";
const NUM = "(\\d{1,2})";

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
  const named = new RegExp(`${SHOT}\\s*(?:n[o°]?\\s*)?${NUM}`, "iu").exec(f);
  const n = named ? [named[0], named[1]] as const : chosen ? ["", String(chosen)] as const : null;
  if (n && /\b(retire|supprime|enleve|remove|delete|drop|entfern|losch|quita|borra|elimina)/.test(f)) return { type: "retirer", n: Number(n[1]) };
  if (n && /\b(recule|apres|plus tard|later|after|down|nach hinten|spater|retrasa|despues|mas tarde)/.test(f)) return { type: "deplacer", n: Number(n[1]), pas: 1 };
  if (n && /\b(avance|avant|plus tot|earlier|before|up|nach vorn|fruher|adelanta|antes)/.test(f)) return { type: "deplacer", n: Number(n[1]), pas: -1 };
  if (/\b(portrait|vertical|hochformat|9:16|reseaux|social)/.test(f)) return { type: "format", format: "portrait" };
  if (/\b(paysage|landscape|horizontal|querformat|16:9)/.test(f)) return { type: "format", format: "paysage" };
  const sec = /(\d{1,3})\s*(?:s\b|sec|secondes|seconds|sekunden|segundos)/.exec(f);
  if (sec && /\b(raccourci|resserre|reduis|shorten|tighten|cut|trim|kurz|kurzer|acorta|reduce|ajusta)/.test(f)) return { type: "raccourcir", secondes: Number(sec[1]) };
  if (/\b(ajoute|rajoute|add|another|hinzu|noch eine|anad|agreg|otro)/.test(f)) return { type: "ajouter", fin: /\b(fin|end|closing|schluss|final)/.test(f) };
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
  }
}
