// U1.1 · the reading is the native text agent (CE0, Qwen3-VL 8B, open weights). This module does not
// call the network: it prepares the request, turns a validated proposal into a board, and describes
// the diff. Names are never classified here. A name the model could not bind stays a question.

import { applyEnvelope } from "../cinema/commands.ts";
import { emptyMeta } from "../cinema/journal.ts";
import type { IntentEnvelope, Operation, ShotDraft, Unresolved } from "../cinema/types.ts";
import { titreDeLIdee } from "./ecrire.ts";
import { majPlan, nouvelId, storyboardVide, tousLesPlans, type DureePlan, type Format, type Rendu, type Storyboard } from "./storyboard.ts";

/**
 * CE0 documents an unmeasured hypothesis of about 1–3 credits for one Qwen3-VL 8B reading
 * (docs/implementation/CE0_NATIVE_AGENT.md). The button shows that ceiling. It is never 0.
 * A measured similar job, when the ledger has one, replaces it at prepare time.
 */
export const U11_AGENT_CEILING = 3;

export interface LibraryCard { id: string; category: "cast" | "decor"; name: string; description: string }

const REQUEST_MAX = 1200;

/** The story travels as the request; the library travels beside it. Neither is a list of special names. */
export function agentReading(story: string, library: readonly LibraryCard[]): { userText: string; scenario: string } {
  const body = story.replace(/\s+/g, " ").trim();
  const catalogue = library
    .filter(item => item.id && item.name.trim())
    .map(item => `${item.category} ${item.id} ${item.name.trim()}${item.description.trim() ? ` — ${item.description.trim()}` : ""}`)
    .join("\n")
    .slice(0, 700);
  const userText = [
    "Write one storyboard.create for the story below.",
    "creativeGoal is a short title you write. Shot titles are editorial, in the story's language, from the action.",
    "Bind a ref only with a referenceId copied from CONTEXT. A name that is not in the library has no referenceId: leave it unresolved.",
    "duree is 5, 8 or 10. Do not invent an id.",
    "",
    body,
  ].join("\n").slice(0, REQUEST_MAX);
  return { userText, scenario: catalogue };
}

/** A change request is sent as the visitor wrote it. The model returns operations; this function does not interpret them. */
export function agentChange(request: string): string {
  const body = request.replace(/\s+/g, " ").trim();
  return [
    "Apply the request below to the current storyboard.",
    "Return operations. A delete is shot.archive and a reorder is storyboard.reorder, and only when the request asks for that.",
    "Do not invent an id. A name with no referenceId stays unresolved.",
    "",
    body,
  ].join("\n").slice(0, REQUEST_MAX);
}

export interface NameProposal { name: string; role: "qui" | "ou"; shotIndex: number | null }

/** Names the model refused to bind. The role is the one the model wrote, still unconfirmed. */
export function proposalsOf(unresolved: readonly Unresolved[]): NameProposal[] {
  const out: NameProposal[] = [];
  for (const item of unresolved) {
    const match = /^reference without id \((qui|ou)\): (.+)$/u.exec(item.reason.trim());
    if (!match) continue;
    const name = match[2]!.trim();
    if (!name || out.some(proposal => proposal.name.toLowerCase() === name.toLowerCase() && proposal.role === match[1])) continue;
    const at = /shots\[(\d+)\]/u.exec(item.field);
    out.push({ name, role: match[1] as "qui" | "ou", shotIndex: at ? Number(at[1]) : null });
  }
  return out;
}

/** One plain line per operation, from the proposal itself. */
export function describeOperations(operations: readonly Operation[], titles: ReadonlyMap<string, string>): string[] {
  return operations.map(op => {
    switch (op.kind) {
      case "storyboard.create": return op.shots.map(shot => shot.titre || shot.action).filter(Boolean).join(" · ") || "storyboard.create";
      case "shot.patch": return `${titles.get(op.target.shotId) || op.target.shotId}: ${Object.keys(op.patch).join(", ")}`;
      case "shot.archive": return titles.get(op.target.shotId) || op.target.shotId;
      case "shot.duplicate": return titles.get(op.target.shotId) || op.target.shotId;
      case "storyboard.reorder": return op.shotIds.map(id => titles.get(id) || id).join(" → ");
      default: return op.kind;
    }
  });
}

export function shellForStory(story: string, reading: { scenario: string }, options: { format: Format; rendu: Rendu; suffix: string; now: string }): Storyboard {
  const title = titreDeLIdee(story).slice(0, 80) || "Storyboard";
  const base = storyboardVide({ id: nouvelId(title, options.suffix), titre: title, idee: story.slice(0, 600), format: options.format, now: options.now });
  return { ...base, scenario: reading.scenario.slice(0, 2000), sequences: [] };
}

/** Applies a validated proposal onto a shell or the current board. Unknown refs are already absent. */
export function boardFromProposal(current: Storyboard, envelope: IntentEnvelope, now: string): Storyboard {
  const applied = applyEnvelope(
    { storyboard: current, meta: emptyMeta(current.id) },
    envelope,
    { newShotId: () => `p${Math.random().toString(36).slice(2, 10)}`, now, locks: {} },
  );
  const title = envelope.creativeGoal.trim().slice(0, 80);
  return title ? { ...applied.state.storyboard, titre: title } : applied.state.storyboard;
}

/** Keeps only durations the studio can quote. Anything else becomes 5 s, which always has a price path. */
export function withQuotableDurations(sb: Storyboard, priced: (duree: DureePlan) => boolean): Storyboard {
  return {
    ...sb,
    sequences: sb.sequences.map(seq => ({
      ...seq,
      plans: seq.plans.map(plan => ({ ...plan, duree: plan.duree !== 5 && !priced(plan.duree) ? 5 : plan.duree })),
    })),
  };
}

export function withSettings(sb: Storyboard, format: Format, rendu: Rendu): Storyboard {
  return { ...sb, format, sequences: sb.sequences.map(seq => ({ ...seq, plans: seq.plans.map(plan => ({ ...plan, format, rendu })) })) };
}

/** The visitor confirmed a proposed name: it is added to the shot the model pointed at, still without an id. */
export function confirmProposal(sb: Storyboard, proposal: NameProposal, now?: string): Storyboard {
  const plans = tousLesPlans(sb);
  const plan = proposal.shotIndex !== null ? plans[proposal.shotIndex] : null;
  if (!plan) return sb;
  if (plan.refs.some(ref => ref.role === proposal.role && ref.nom.toLowerCase() === proposal.name.toLowerCase())) return sb;
  return majPlan(sb, plan.id, { refs: [...plan.refs, { role: proposal.role, nom: proposal.name, id: null }] }, now);
}

export type AgentAnswer = { status: "invalid" } | { status: "ready"; envelope: IntentEnvelope; proposals: NameProposal[] };

/** Invalid JSON is a retry, then a fallback. A clarification is ready: the plan is usable and the questions are shown. */
export function answerOf(status: "valid" | "needs_clarification" | "invalid", envelope: IntentEnvelope | null): AgentAnswer {
  if (status === "invalid" || !envelope || !envelope.operations.length) return { status: "invalid" };
  return { status: "ready", envelope, proposals: proposalsOf(envelope.unresolved) };
}

export function shotTitles(shots: readonly Pick<ShotDraft, "titre" | "action">[]): string[] {
  return shots.map(shot => shot.titre || shot.action);
}
