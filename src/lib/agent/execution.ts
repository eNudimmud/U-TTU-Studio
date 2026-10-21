import type { StudioSession } from "../../components/app/studio-session.tsx";
import { emptyPlan } from "../prise/decision.ts";
import { planMarkdown } from "../prise/vault.ts";
import { projectResources } from "./context.ts";
import { studioActionRegistry } from "./registry.ts";
import { stepBlock, type ProductionContext, type ProductionPlan, type ProductionStep } from "./kernel/production.ts";

export const AGENT_DRAFT_FILE = ".uttu/agent-draft.json";
export const AGENT_EVENT = "u-ttu-agent-draft";
export interface AgentDraft { version: 1; projectId: string; stepId: string; operationId: string; prompt: string; resourceIds: string[]; }

export function parseAgentDraft(raw: string | undefined, context: ProductionContext): AgentDraft | null {
  if (!raw || raw.length > 10_000) return null;
  try {
    const draft = JSON.parse(raw) as AgentDraft;
    if (draft.version !== 1 || draft.projectId !== context.projectId || typeof draft.stepId !== "string" || !/^[a-z0-9-]{1,80}$/.test(draft.stepId) || typeof draft.prompt !== "string" || draft.prompt.length > 2000 || !Array.isArray(draft.resourceIds) || draft.resourceIds.length > 20) return null;
    if (!context.operations.some(op => op.id === draft.operationId && op.status === "ready") || draft.resourceIds.some(id => !context.resources.some(r => r.id === id && r.available))) return null;
    return { version: 1, projectId: draft.projectId, stepId: draft.stepId, operationId: draft.operationId, prompt: draft.prompt, resourceIds: draft.resourceIds };
  } catch { return null; }
}

export interface Preparation { state: "done" | "prepared"; results: string[]; href?: string; }
/** No paid methods are invoked here. Studio-owned forms retain quoting, consent and execution. */
export async function prepareStep(session: StudioSession, context: ProductionContext, plan: ProductionPlan, step: ProductionStep): Promise<Preparation> {
  const registry = studioActionRegistry(session.prefs);
  const live = { ...context, operations: registry };
  const reason = stepBlock(step, plan, live);
  if (reason || session.studio.project !== context.projectId || !plan.steps.some(s => s.id === step.id && s.operationId === step.operationId)) throw new Error(reason ?? "project");
  if (!['ready', 'prepared', 'failed', 'interrupted'].includes(step.state)) throw new Error("state");
  const op = registry.find(op => op.id === step.operationId)!;
  const resources = projectResources(session);
  const selected = resources.filter(r => step.resourceIds.includes(r.id) && r.available);
  if (step.resourceIds.some(id => !selected.some(r => r.id === id))) throw new Error("resource");

  if (op.adapter === "shots") {
    const cast = selected.filter(r => r.role === "cast");
    const decor = selected.find(r => r.role === "decor");
    const ids: string[] = [];
    const quantity = [1, 2, 3].includes(step.quantity) ? step.quantity : 1;
    for (let i = 0; i < quantity; i++) {
      const id = `${step.id}-${i + 1}`;
      ids.push(id);
      if (await session.readProjectFile(`Shots/${id}.md`)) continue; // Idempotent retry, preserve edits.
      const input = { ...emptyPlan(), action: step.prompt.slice(0, 240), castIds: cast.map(r => r.id.slice(5)), castNames: cast.map(r => r.name), castPlanche: cast.map(() => true), decorId: decor?.id.slice(6) ?? null, decorName: decor?.name ?? "", cadrage: (["large", "moyen", "gros"] as const)[i] };
      await session.writeProjectFile(`Shots/${id}.md`, planMarkdown({ id, name: `Plan ${session.studio.shots.length + i + 1}`, ordre: session.studio.shots.length + i, etat: "vide", input, graph: "", pourquoi: "Brouillon préparé par l’assistant ; vérifier références, action et cadrage avant génération.", takeIds: [], imageCle: "", imageFin: "", finalVideo: "" }));
    }
    await session.refreshStudio();
    return { state: "done", results: ids, href: `/studio?plan=${ids[0]}#prise` };
  }
  if (op.adapter === "montage") {
    const takes = selected.filter(r => r.role === "take").flatMap(r => session.studio.takes.find(t => `take:${t.id}` === r.id) ?? []);
    if (takes.length) {
      await session.sendSequence(takes.map(take => ({ takeId: take.id, planId: session.studio.shots.find(s => s.takeIds.includes(take.id))?.id ?? `agent-${take.id}`, label: take.line, seconds: take.settings.seconds, aspect: take.settings.aspect === "vertical" ? "vertical" : "horizontal", still: take.poster ? session.media[take.poster] : "", prompt: take.prompt, sceneName: take.sceneName, composeur: "" })));
      // Downloaded library media are inserted by the mounted timeline, after it
      // has loaded this saved cut. Keep the step prepared until that save exists.
      if (!selected.some(r => r.role === "asset" && ["image", "video", "audio"].includes(r.kind))) {
        return { state: "done", results: takes.map(t => `take:${t.id}`), href: op.href };
      }
    }
  }
  if (op.adapter === "backup") {
    await session.exportCoffre();
    return { state: "done", results: [`zip:${Date.now()}`] };
  }
  if (op.adapter === "jobs") {
    session.setSheet("credits");
    return { state: "prepared", results: [] };
  }
  const draft: AgentDraft = { version: 1, projectId: context.projectId, stepId: step.id, operationId: op.id, prompt: step.prompt, resourceIds: selected.map(r => r.id) };
  await session.writeProjectFile(AGENT_DRAFT_FILE, JSON.stringify(draft));
  return { state: "prepared", results: [], href: op.href };
}
