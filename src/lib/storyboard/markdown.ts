// The storyboard as a note in the visitor's Obsidian vault (SB2): Projets/<projet>/Storyboard/<id>.md.
// A view, rewritten after each change: editing it in Obsidian does not change the storyboard (v1).
// No media is copied: pictures and takes are linked where they already are (Cast/, Lieux/, Prises/).

import { withFrontmatter } from "../coffre/markdown.ts";
import type { Registre } from "../film/registre.ts";
import { promptDuPlan } from "./prompt.ts";
import { dureeTotale, etatDuPlan, progression, type PlanSB, type RefPlan, type Storyboard } from "./storyboard.ts";

/** Words of the note, in the visitor's language (messages/storyboard/<locale>.json → storyboard.md). */
export interface LibellesMd {
  scene: string; shot: string; action: string; who: string; where: string; object: string; line: string; voiceOver: string;
  sound: string; prompt: string; render: string; kept: string; toCreate: string; fidele: string; rapide: string;
  cadrage: Record<string, string>; camera: Record<string, string>; credits: string; noQuote: string; landscape: string; portrait: string;
}

export interface ContexteMd {
  projet: string;
  registre: Pick<Registre, "plans"> | null;
  /** Vault path of a known reference's note or picture (without extension for notes), or null. */
  lienRef(ref: RefPlan): string | null;
  /** Vault path (without extension) of the kept take's note, and of its still picture. */
  prise(plan: PlanSB): { note: string; image: string | null; id: string } | null;
  /** « ≈ X » for one unfilmed shot, or null when there is no quote. */
  devis(plan: PlanSB): number | null;
  devisRestant: number | null;
  date: string;
  credits(n: number): string;
}

/** Brackets and pipes would break a wiki link; line breaks would break a list item. */
function propre(text: string): string {
  return text.replace(/[\r\n]+/g, " ").replace(/[[\]|]/g, " ").replace(/\s{2,}/g, " ").trim();
}

function lien(path: string | null, label: string): string {
  return path ? `[[${path}|${propre(label)}]]` : propre(label);
}

export function storyboardMarkdown(sb: Storyboard, ctx: ContexteMd, l: LibellesMd): string {
  const { tournes, total } = progression(sb, ctx.registre);
  const fields = {
    type: "storyboard",
    projet: ctx.projet,
    storyboard: sb.id,
    statut: sb.archive ? "archive" : total > 0 && tournes === total ? "tourne" : "en-cours",
    format: sb.format,
    duree: dureeTotale(sb),
    plans: total,
    tournes,
    devis_restant: ctx.devisRestant,
    updated: ctx.date,
  };
  const out: string[] = [`# ${propre(sb.titre) || sb.id}`];
  if (sb.logline.trim()) out.push(`> ${propre(sb.logline)}`);
  let n = 0;
  sb.sequences.forEach((seq, s) => {
    out.push("", `## ${l.scene} ${s + 1} · ${propre(seq.titre)}`);
    if (seq.resume.trim()) out.push(propre(seq.resume));
    for (const plan of seq.plans) {
      n += 1;
      const head = [`${plan.duree} s`, plan.cadrage ? l.cadrage[plan.cadrage] : "", plan.camera ? l.camera[plan.camera] : ""].filter(Boolean).join(" · ");
      out.push("", `### ${l.shot} ${n} · ${propre(plan.titre) || "—"} — ${head}`);
      const prise = etatDuPlan(plan, ctx.registre) === "tourne" ? ctx.prise(plan) : null;
      if (prise?.image) out.push(`![[${prise.image}]]`);
      out.push(`- **${l.action}** : ${propre(plan.action) || "—"}`);
      const refs = (role: RefPlan["role"]) => plan.refs.filter(ref => ref.role === role).map(ref => ref.id ? lien(ctx.lienRef(ref), ref.nom) : `${propre(ref.nom)} *(${l.toCreate})*`).join(" · ");
      if (refs("qui")) out.push(`- **${l.who}** : ${refs("qui")}`);
      if (refs("ou")) out.push(`- **${l.where}** : ${refs("ou")}`);
      const autres = [refs("objet"), refs("style")].filter(Boolean).join(" · ");
      if (autres) out.push(`- **${l.object}** : ${autres}`);
      if (plan.dialogue.type !== "aucune" && plan.dialogue.texte.trim()) {
        const who = plan.dialogue.type === "voixoff" ? l.voiceOver : propre(plan.dialogue.qui ?? "");
        out.push(`- **${l.line}**${who ? ` — ${who}` : ""} : « ${propre(plan.dialogue.texte)} »`);
      }
      const son = [plan.son.musique, plan.son.ambiance].map(propre).filter(Boolean).join(" · ");
      if (son) out.push(`- **${l.sound}** : ${son}`);
      out.push(`- **${l.prompt}** : \`${promptDuPlan(plan).replace(/`/g, "'")}\``);
      const devis = prise ? null : ctx.devis(plan);
      out.push(`- **${l.render}** : ${plan.rendu === "rapide" ? l.rapide : l.fidele} · ${plan.duree} s · ${plan.format === "portrait" ? l.portrait : l.landscape}${prise ? "" : ` · ${devis === null ? l.noQuote : ctx.credits(devis)}`}`);
      if (prise) out.push(`- **${l.kept}** : [[${prise.note}|${prise.id}]] ★`);
    }
  });
  return withFrontmatter(fields, `${out.join("\n")}\n`);
}
