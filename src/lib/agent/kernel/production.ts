/** Studio is the authority. These contracts contain no URLs, credentials or executable code. */
export type Area = "cast" | "decor" | "prise" | "montage" | "outils" | "coffre" | "projets";
export type MediaKind = "image" | "video" | "audio" | "mesh";
export interface Operation {
  id: string;
  area: Area;
  label: string;
  description?: string;
  status: "ready" | "disabled";
  inputKinds: readonly string[];
  outputKind: string;
  requiresPrompt: boolean;
  reason?: string;
  quote?: { credits: number; ceiling: number; estimated: boolean };
}
export interface Resource {
  /** Opaque id; the Studio alone resolves it to a project file. */
  id: string;
  kind: MediaKind;
  name: string;
  role: "cast" | "decor" | "take" | "asset";
  available: boolean;
}
export interface ProductionContext {
  projectId: string;
  projectName: string;
  resources: readonly Resource[];
  selectedIds: readonly string[];
  /** Actual saved artefact ids/revisions, supplied by Studio. */
  evidence: Readonly<Record<string, readonly string[]>>;
  operations: readonly Operation[];
}
export type StepState = "ready" | "blocked" | "prepared" | "running" | "done" | "failed" | "interrupted" | "cancelled";
export interface ProductionStep {
  id: string;
  operationId: string;
  prompt: string;
  quantity: number;
  dependsOn: string[];
  state: StepState;
  resourceIds: string[];
  baseline: string[];
  results: string[];
  reason?: string;
}
export interface ProductionPlan {
  id: string;
  projectId: string;
  goal: string;
  steps: ProductionStep[];
}
export interface Conversation {
  version: 1;
  projectId: string;
  messages: { role: "user" | "assistant"; text: string; at: number }[];
  plan: ProductionPlan | null;
  selectedIds: string[];
  pending: { kind: "intent" | "prompt"; operationIds: string[] } | null;
}
export type Interpretation = { operationIds: string[]; confidence: number };

export const fold = (text: string): string => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
export const cleanMessage = (text: string): string => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, 2000);
export const emptyConversation = (projectId: string): Conversation => ({ version: 1, projectId, messages: [], plan: null, selectedIds: [], pending: null });

/** Conservative offline language adapter. Unknown requests stay questions, never guessed actions. */
export function interpretLocally(message: string, context: ProductionContext): string[] {
  const text = fold(message);
  const ids: string[] = [];
  const add = (id: string) => { if (context.operations.some(op => op.id === id) && !ids.includes(id)) ids.push(id); };
  // Negation is deliberately conservative: a model can propose, a human still reviews.
  if (/\b(ne |pas de |sans |don't |do not |without )/.test(text) && !/sans (son|musique)|without (sound|music)/.test(text)) return [];
  if (/\b(film complet|court.metrage|complete film|short film|production complete)\b/.test(text)) {
    ["local:cast", "local:decor", "local:shots", "local:take", "local:montage", "local:export", "local:backup", "local:projects"].forEach(add);
    return ids;
  }
  const cutout = /detour|remove (the )?background|supprim.*fond|enlev.*fond/.test(text);
  const toolRules: [RegExp, string][] = [
    [/detour|remove (the )?background|supprim.*fond|enlev.*fond/, context.resources.some(r => context.selectedIds.includes(r.id) && r.kind === "video") ? "vid-detourer" : "ret-detourer"],
    [/upscale|nettete|sharpen|amelior.*qualite/, context.resources.some(r => context.selectedIds.includes(r.id) && r.kind === "video") ? "vid-finaliser" : "ret-finaliser"],
    [/\b(animer|anime|animate)\b/, "vid-animer"],
    [/\b(parler|lipsync|lip.sync|talking)\b/, "vid-parler"],
    [/\b(prolonger|extend video)\b/, "vid-prolonger"],
    [/\b(3d|volume|mesh)\b/, "3d-ouvert"],
    [/\b(bruitage|bruitages|sound effect|sound effects|ambiance sonore)\b/, "son-bruitage-ouvert"],
    [/\b(musique|music)\b/, "son-musique-ouverte"],
    [/\b(voix|voice|narration)\b/, "son-voix"],
  ];
  if (/\b(lora|entrainement|training)\b/.test(text)) add("local:lora");
  else if (!cutout && /\b(personnage|personnages|character|cast|planches?)\b/.test(text) && /cre|prepar|import|ger|create|manage|sheet/.test(text)) add("local:cast");
  if (/street.view|tokyo|reperage|scout|carte|map|decor reel|real location/.test(text)) add("local:scout");
  else if (/\b(decor|decors|environnement|environment|background|location)\b/.test(text) && !cutout) add("local:decor");
  if (/\b(plans?|prises?|shots?|takes?|angles?)\b/.test(text) && /prepar|cre|trois|three|angle|plan/.test(text)) add("local:shots");
  if (/\b(gener|tourne|filmer|render|shoot)/.test(text) && /\b(prises?|plans?|shots?|takes?|video)\b/.test(text)) add("local:take");
  for (const [pattern, id] of toolRules) if (pattern.test(text) && !(/musique|music/.test(id) && /sans musique|without music/.test(text))) add(`tool:${id}`);
  if (/assembl|montage|timeline|transition|monter|\bedit\b/.test(text)) add("local:montage");
  if (/export|finalis.*film/.test(text)) add("local:export");
  if (/sauvegard|backup|back up|save project|coffre|vault/.test(text)) add("local:backup");
  if (/rouvr|reouvr|reopen|projets|projects/.test(text)) add("local:projects");
  if (/\b(jobs?|taches?|recuper|reprendre le rendu|recover|retry)\b/.test(text)) add("local:jobs");
  if (!ids.length) {
    // Search the live labels, including tools added after this package was built.
    const words = text.split(/\W+/).filter(w => w.length > 3);
    const scored = context.operations.filter(op => op.id.startsWith("tool:")).map(op => ({ id: op.id, score: words.filter(w => fold(`${op.label} ${op.description ?? ""} ${op.id}`).includes(w)).length })).sort((a, b) => b.score - a.score);
    if (scored[0]?.score >= 2 && scored[0].score > (scored[1]?.score ?? 0)) add(scored[0].id);
  }
  return ids;
}

export function stepBlock(step: ProductionStep, plan: ProductionPlan, context: ProductionContext): string | null {
  if (plan.projectId !== context.projectId) return "project";
  const op = context.operations.find(op => op.id === step.operationId);
  if (!op || op.status !== "ready") return "unavailable";
  if (step.dependsOn.some(id => plan.steps.find(s => s.id === id)?.state !== "done")) return "dependency";
  if (step.resourceIds.some(id => !context.resources.some(r => r.id === id && r.available))) return "resource";
  return null;
}

export function refreshPlan(plan: ProductionPlan, context: ProductionContext): ProductionPlan {
  return { ...plan, steps: plan.steps.map(step => {
    if (["done", "cancelled", "running", "failed", "interrupted", "prepared"].includes(step.state)) return step;
    const reason = stepBlock(step, plan, context);
    return { ...step, state: reason ? "blocked" : "ready", reason: reason ?? undefined };
  }) };
}

export function makePlan(goal: string, ids: readonly string[], context: ProductionContext, at = Date.now()): ProductionPlan {
  const quantity = /\b(trois|three|3)\b/i.test(goal) ? 3 : /\b(deux|two|2)\b/i.test(goal) ? 2 : 1;
  const unique = [...new Set(ids)].filter(id => context.operations.some(op => op.id === id)).slice(0, 16);
  const plan: ProductionPlan = { id: `p-${at.toString(36)}`, projectId: context.projectId, goal: cleanMessage(goal), steps: [] };
  for (const [index, operationId] of unique.entries()) {
    plan.steps.push({ id: `${plan.id}-${index + 1}`, operationId, prompt: cleanMessage(goal), quantity: operationId === "local:shots" ? quantity : 1,
      dependsOn: index ? [plan.steps[index - 1].id] : [], state: "ready", resourceIds: [...context.selectedIds].filter(id => context.resources.some(r => r.id === id && r.available)), baseline: [], results: [] });
  }
  return refreshPlan(plan, context);
}

export function productionTurn(previous: Conversation, message: string, context: ProductionContext, options: { at?: number; interpretation?: Interpretation; language?: "fr" | "en" } = {}): Conversation {
  const state = previous.projectId === context.projectId ? previous : emptyConversation(context.projectId);
  const at = options.at ?? Date.now();
  const input = cleanMessage(message);
  if (!input) return state;
  const en = options.language === "en";
  let plan = state.plan ? refreshPlan(state.plan, context) : null;
  let pending: Conversation["pending"] = null;
  let response: string;
  if (/^(continue|continuer|suite|et ensuite|next|reprendre)[.! ?]*$/i.test(input) && plan) {
    const next = plan.steps.find(s => s.state !== "done" && s.state !== "cancelled");
    response = next ? (en ? "Your plan is preserved. Review the next step below." : "Le plan est conservé. Vérifie la prochaine étape ci-dessous.") : (en ? "The plan is complete. What would you like to prepare next?" : "Le plan est terminé. Que veux-tu préparer ensuite ?");
  } else {
    const fromModel = options.interpretation;
    let ids = fromModel && fromModel.confidence >= 0.85 && fromModel.confidence <= 1 ? fromModel.operationIds : interpretLocally(input, context);
    ids = ids.filter(id => context.operations.some(op => op.id === id));
    if (!ids.length && state.pending?.kind === "prompt") ids = state.pending.operationIds;
    if (!ids.length) {
      pending = { kind: "intent", operationIds: [] };
      response = en ? "Which part should we prepare: character, location, shot, edit, audio or export? Your current plan is preserved." : "Quelle partie veux-tu préparer : personnage, décor, prise, montage, son ou export ? Ton plan actuel est conservé.";
    } else {
      const promptNeeded = ids.some(id => context.operations.find(op => op.id === id)?.requiresPrompt);
      plan = makePlan(state.pending?.kind === "prompt" ? `${state.plan?.goal ?? ""}\n${input}` : input, ids, context, at);
      if (promptNeeded && input.split(/\s+/).length < 4) pending = { kind: "prompt", operationIds: ids };
      response = pending ? (en ? "Describe the subject, action or atmosphere to keep in this plan." : "Décris le sujet, l’action ou l’ambiance à conserver dans ce plan.") : (en ? "Here is the proposed sequence. Preparing a step does not authorize a paid generation. Review each result before continuing." : "Voici les étapes proposées. Préparer une étape n’autorise aucune génération payante. Valide chaque résultat avant de continuer.");
    }
  }
  return { ...state, pending, plan, selectedIds: [...context.selectedIds], messages: [...state.messages, { role: "user" as const, text: input, at }, { role: "assistant" as const, text: response, at }].slice(-40) };
}

/** Preparation is never completion. Only a Studio receipt or new persisted evidence completes a step. */
export function updateStep(plan: ProductionPlan, id: string, patch: Partial<Pick<ProductionStep, "state" | "reason" | "baseline" | "results">>): ProductionPlan {
  return { ...plan, steps: plan.steps.map(s => s.id === id ? { ...s, ...patch } : s) };
}

/** Untrusted imported conversations are parsed, bounded and revalidated against the live registry. */
export function restoreConversation(raw: string | undefined, context: ProductionContext): Conversation {
  const empty = emptyConversation(context.projectId);
  if (!raw || raw.length > 150_000) return empty;
  try {
    const data = JSON.parse(raw) as Conversation;
    if (data.version !== 1 || data.projectId !== context.projectId || !Array.isArray(data.messages) || !Array.isArray(data.selectedIds)) return empty;
    const state: Conversation = { ...empty, selectedIds: data.selectedIds.filter(id => typeof id === "string" && context.resources.some(r => r.id === id)), messages: data.messages.filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && Number.isFinite(m.at)).slice(-40).map(m => ({ role: m.role, text: cleanMessage(m.text), at: m.at })) };
    if (data.pending && ["intent", "prompt"].includes(data.pending.kind) && Array.isArray(data.pending.operationIds)) state.pending = { kind: data.pending.kind, operationIds: data.pending.operationIds.filter(id => context.operations.some(op => op.id === id)).slice(0, 16) };
    const p = data.plan;
    if (!p || p.projectId !== context.projectId || typeof p.id !== "string" || typeof p.goal !== "string" || !Array.isArray(p.steps) || p.steps.length > 16) return state;
    const steps: ProductionStep[] = [];
    const states: StepState[] = ["ready", "blocked", "prepared", "done", "failed", "interrupted", "cancelled", "running"];
    for (const s of p.steps) {
      if (!s || typeof s.id !== "string" || !/^[a-z0-9-]{1,80}$/.test(s.id) || steps.some(v => v.id === s.id) || !context.operations.some(op => op.id === s.operationId) || typeof s.prompt !== "string" || !states.includes(s.state)) return state;
      if (![s.dependsOn, s.resourceIds, s.baseline, s.results].every(list => Array.isArray(list) && list.length <= 200 && list.every(v => typeof v === "string" && v.length <= 300))) return state;
      if (s.dependsOn.some(id => !steps.some(v => v.id === id))) return state;
      steps.push({ id: s.id, operationId: s.operationId, prompt: cleanMessage(s.prompt), quantity: [1, 2, 3].includes(s.quantity) ? s.quantity : 1, dependsOn: s.dependsOn, state: s.state === "running" ? "interrupted" : s.state, resourceIds: s.resourceIds, baseline: s.baseline, results: s.results });
    }
    state.plan = refreshPlan({ id: p.id.slice(0, 80), projectId: p.projectId, goal: cleanMessage(p.goal), steps }, context);
    return state;
  } catch { return empty; }
}
