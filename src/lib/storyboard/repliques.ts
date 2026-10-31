// « Suggest lines » (SB4b): one call to Comfy's text model writes up to three short lines per shot.
// Here only the text in and the text out, no network. The answer is read tolerantly; a line longer than
// 160 characters is cut, a name that is not in the project is replaced by nothing, and the visitor's own
// text is never overwritten: the proposals are only offered, quoted and editable.

import { PROPOSITIONS_MAX, REPLIQUE_MAX, tousLesPlans, type Storyboard } from "./storyboard.ts";

export interface DemandeRepliques { system: string; prompt: string; plans: string[] }

/** The text sent: the story, then one numbered shot per line. English instructions, the visitor's language for the lines. */
export function promptRepliques(sb: Storyboard, langue: string): DemandeRepliques {
  const plans = tousLesPlans(sb).filter(plan => plan.dialogue.type !== "aucune" || plan.refs.some(ref => ref.role === "qui"));
  const noms = [...new Set(plans.flatMap(plan => plan.refs.filter(ref => ref.role === "qui").map(ref => ref.nom)))];
  const system = [
    "You write short spoken lines for the shots of a short film.",
    `Write in the language with code "${langue}".`,
    `Give up to ${PROPOSITIONS_MAX} lines per shot, each under ${REPLIQUE_MAX} characters, said in a few seconds.`,
    noms.length ? `Only these characters exist: ${noms.join(", ")}. Never invent another name.` : "Never invent a name.",
    'Answer with JSON only: {"shots":[{"id":"<shot id>","lines":["…"]}]}',
  ].join(" ");
  const prompt = [
    `Story: ${sb.logline || sb.idee}`,
    ...plans.map(plan => `${plan.id}: ${plan.action}${plan.dialogue.qui ? ` (speaks: ${plan.dialogue.qui})` : ""}`),
  ].join("\n");
  return { system, prompt, plans: plans.map(plan => plan.id) };
}

function premierJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

/** A capitalised word that is not a known name and not the first word of the line is removed. */
function sansNomsInconnus(line: string, connus: readonly string[], inconnus: readonly string[]): string {
  let out = line;
  for (const nom of inconnus) {
    if (connus.some(item => item.toLowerCase() === nom.toLowerCase())) continue;
    out = out.replace(new RegExp(`\\b${nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b,?\\s*`, "gu"), "");
  }
  return out.replace(/\s*,\s*([.!?…])/gu, "$1").replace(/\s+([.!?…,])/gu, "$1").replace(/\s{2,}/g, " ").trim();
}

/**
 * The model's answer → proposals by shot id. Unknown shots are dropped. `noms` are the project's
 * character names; `interdits` names the reader must remove (other cards, earlier examples).
 */
export function lireRepliques(text: string, plans: readonly string[], noms: readonly string[], interdits: readonly string[] = []): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const data = premierJson(text) as { shots?: unknown } | null;
  const rows = Array.isArray(data?.shots) ? data.shots : [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const { id, lines } = row as { id?: unknown; lines?: unknown };
    if (typeof id !== "string" || !plans.includes(id) || !Array.isArray(lines)) continue;
    const clean = lines
      .filter((line): line is string => typeof line === "string")
      .map(line => sansNomsInconnus(line.replace(/[\r\n]+/g, " ").replace(/^[\s"«“]+|[\s"»”]+$/g, ""), noms, interdits).slice(0, REPLIQUE_MAX).trim())
      .filter(Boolean);
    const unique = [...new Set(clean)].slice(0, PROPOSITIONS_MAX);
    if (unique.length) out.set(id, unique);
  }
  return out;
}

/** Proposals go next to each line. The text already there (the visitor's or the idea's) stays as it is. */
export function appliquerRepliques(sb: Storyboard, proposals: ReadonlyMap<string, string[]>, now?: string): Storyboard {
  if (!proposals.size) return sb;
  return {
    ...sb,
    majLe: now ?? sb.majLe,
    sequences: sb.sequences.map(seq => ({ ...seq, plans: seq.plans.map(plan => {
      const lines = proposals.get(plan.id);
      if (!lines) return plan;
      const qui = plan.dialogue.qui ?? plan.refs.find(ref => ref.role === "qui")?.nom ?? null;
      const type = plan.dialogue.type === "aucune" ? "replique" : plan.dialogue.type;
      const vide = plan.dialogue.texte.trim() === "";
      return { ...plan, dialogue: { ...plan.dialogue, type, qui, propositions: lines, ...(vide ? { source: "uttu" as const } : {}) } };
    }) })),
  };
}
