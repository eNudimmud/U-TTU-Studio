import { idbVault, type VaultStore } from "../coffre/store.ts";
import { createRenderClient, renderCredentialScope, jobStage, pickOutput, type RenderClient } from "../render/client.ts";
import { readRenderLink } from "../render/settings.ts";
import { sessionTokens } from "../render/session.ts";
import { readPending, recoverableClient, clearPending, type PendingRender } from "../render/recovery.ts";
import { imageVide } from "../render/blank.ts";
import { qwenImageGraph, QWEN_EDIT, QWEN_TEXT } from "../render/qwen-image.ts";
import { BILLED_CREDITS_PER_GPU_SECOND } from "../credits.ts";
import { animeImageGraph, ANIME_TEMPLATE } from "./anime-graph.ts";
import { fileResult, readProduction, writeProduction, nextTakeNumber, type ProductionAsset, type Production, type AssetKind } from "./model.ts";
import type { Section } from "./registry.ts";

export interface CreationRequest {
  id: string; project: string; section: Section; kind: AssetKind; name: string; prompt: string;
  refs: string[]; structure?: string; seed: number; quote: number; shotId?: string;
}
export const vault = () => idbVault();
export function browserClient(): RenderClient | null {
  const link = readRenderLink(localStorage);
  if (link.mode === "key") return createRenderClient({ auth: { kind: "key", key: link.key }, openWeightsMode: true });
  if (link.mode === "session") { const tokens = sessionTokens(); return createRenderClient({ auth: { kind: "session", token: () => tokens.token() }, openWeightsMode: true }); }
  return null;
}
export async function locked<T>(name: string, run: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new Error("Ce navigateur ne permet pas de sécuriser les opérations. Ouvre le studio dans Chrome ou Safari à jour.");
  return navigator.locks.request(name, { ifAvailable: true }, lock => { if (!lock) throw new Error("Une opération est déjà en cours dans un autre onglet."); return run(); });
}
export async function openProject() {
  const model = await import("../coffre/model.ts");
  const store = vault();
  await model.ensureActiveProject(store);
  const old = await model.loadStudio(store);
  const project = old.project!;
  let production = await readProduction(store, project);
  // Import the old index once; retain original files and notes, without copying media.
  if (!(await store.get(`Projets/${project}/.uttu/production-imported.json`))) {
    const additions: ProductionAsset[] = [];
    for (const c of old.cast) {
      const path = c.sheet || c.photos[0]; if (!path || !(await store.get(path))?.blob) continue;
      additions.push({ id: `legacy-cast-${c.id}`, kind: "cast", section: "cinema", name: c.name, path, media: "image", prompt: c.prompt, at: c.at, refs: c.photos, source: "legacy", template: c.template, credits: c.cost });
    }
    for (const s of old.scenes) {
      const path = s.render || s.stills[0]; if (!path || !(await store.get(path))?.blob) continue;
      additions.push({ id: `legacy-set-${s.id}`, kind: "set", section: "cinema", name: s.name, path, media: "image", prompt: s.prompt || s.note, at: "", refs: s.stills, source: "legacy", template: s.template, credits: s.cout });
    }
    for (const t of old.takes) {
      if (!(await store.get(t.video))?.blob) continue;
      const section = /anime|anisora/i.test(t.workflow || "") ? "anime" : "cinema";
      additions.push({ id: `legacy-take-${t.id}`, kind: "take", section, name: t.line || t.sceneName, path: t.video, media: "video", prompt: t.prompt, at: t.at, refs: t.refs || [], source: "legacy", jobId: t.jobId, template: t.workflow, credits: t.costCredits, seconds: t.settings.seconds, shotId: t.planId || t.id, number: 1, kept: t.etat === "gardee" || t.etat === "finalisee", finalPath: t.finalVideo || undefined });
    }
    production = { ...production, assets: [...production.assets, ...additions.filter(a => !production.assets.some(b => b.id === a.id))] };
    await writeProduction(store, project, production);
    await store.put({ path: `Projets/${project}/.uttu/production-imported.json`, text: "true", updatedAt: Date.now() });
  }
  return { project, name: old.projectName, projects: old.projects, production };
}
export const requestPath = (project: string) => `Projets/${project}/.uttu/production-request.json`;
async function uploaded(store: VaultStore, client: RenderClient, path: string) {
  const blob = (await store.get(path))?.blob;
  if (!blob) throw new Error("Une référence n’est plus disponible dans ce projet.");
  return client.upload(blob, path.split("/").pop()!);
}
export async function collectResult(store: VaultStore, client: RenderClient, receipt: PendingRender, request: CreationRequest, status: (text: string) => void, signal?: AbortSignal): Promise<Production> {
  if (!receipt.jobId || !receipt.outputNode) throw new Error("L’envoi est incertain. Retrouve son identifiant dans Comfy avant toute nouvelle génération.");
  const job = receipt.jobId;
  const until = Date.now() + 40 * 60_000;
  while (true) {
    if (signal?.aborted || Date.now() > until) throw new Error("Suivi interrompu. Le reçu est conservé ; récupère le résultat sans relancer la génération.");
    const stage = jobStage(await client.status(job));
    if (stage === "failed" || stage === "cancelled") { clearPending(localStorage, job); throw new Error("Le rendu a échoué chez Comfy. Aucun résultat ni coût n’a été ajouté au projet."); }
    if (stage === "done") break;
    status(stage === "queue" ? "Dans la file de rendu…" : stage === "prepare" ? "Préparation du rendu…" : "Création en cours…");
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  status("Vérification et sauvegarde du résultat…");
  const detail = await client.job(job);
  const output = pickOutput(detail.outputs, "image", receipt.outputNode);
  if (!output || output.type !== "output") throw new Error("Aucune sortie finale valide. Le reçu est conservé.");
  const blob = await client.file(output);
  const current = await readProduction(store, request.project);
  const ext = /\.(png|jpe?g|webp)$/i.exec(output.filename)?.[1] || "png";
  const asset: ProductionAsset = { id: request.id, section: request.section, kind: request.kind, name: request.name, path: `Projets/${request.project}/Assets/${request.id}.${ext}`, media: "image", prompt: request.prompt, refs: request.refs, at: receipt.at, source: "comfy", jobId: job, output, template: receipt.template, seed: request.seed, quote: request.quote, credits: null,
    ...(request.shotId ? { shotId: request.shotId, number: nextTakeNumber(current, request.section, request.shotId), kept: false } : {}) };
  await fileResult(store, request.project, asset, blob, imageVide);
  // Only the job's billed events count. Never infer a debit from other work on the account.
  const charge = await client.jobCharge(job, BILLED_CREDITS_PER_GPU_SECOND).catch(() => null);
  const saved = await readProduction(store, request.project);
  const next = { ...saved, assets: saved.assets.map(a => a.id === request.id ? { ...a, credits: charge?.credits ?? a.credits ?? null } : a) };
  await writeProduction(store, request.project, next);
  clearPending(localStorage, job);
  return next;
}
export async function createImage(request: CreationRequest, status: (text: string) => void, signal?: AbortSignal) {
  return locked("uttu-paid-render", async () => {
    const client = browserClient(); if (!client) throw new Error("Connecte ton compte Comfy Cloud.");
    if (readPending(localStorage)) throw new Error("Un résultat attend sa récupération. Aucun nouvel envoi.");
    const store = vault(); const account = await renderCredentialScope(client);
    if (!account) throw new Error("La connexion Comfy est expirée.");
    const balance = await client.balance(); if (balance === null || balance < request.quote) throw new Error("Le solde Comfy ne permet pas de confirmer ce devis.");
    status("Envoi des références…");
    const images: string[] = [];
    for (const path of request.refs) images.push(await uploaded(store, client, path));
    const structure = request.structure ? await uploaded(store, client, request.structure) : undefined;
    const graph = request.section === "anime" ? animeImageGraph({ prompt: request.prompt, images, structure, seed: request.seed, portrait: request.kind === "cast" }) : qwenImageGraph({ prompt: request.prompt, images, seed: request.seed, edit: images.length > 0 });
    const template = request.section === "anime" ? ANIME_TEMPLATE : images.length ? QWEN_EDIT : QWEN_TEXT;
    const receipt: PendingRender = { version: 1, kind: "image", project: request.project, id: request.id, name: request.name, prompt: request.prompt, at: new Date().toISOString(), account, refs: request.refs, template, quote: request.quote, balanceBefore: balance, jobId: null, outputNode: request.section === "anime" ? "21" : "461" };
    await store.put({ path: requestPath(request.project), text: JSON.stringify(request), updatedAt: Date.now() });
    const safe = recoverableClient(client, localStorage, receipt);
    status("Envoi du rendu…");
    const jobId = await safe.submit(graph, crypto.randomUUID());
    return collectResult(store, client, { ...receipt, jobId }, request, status, signal);
  });
}
export async function recoverCreation(status: (text: string) => void) {
  return locked("uttu-paid-render", async () => {
    const client = browserClient(); const receipt = readPending(localStorage);
    if (!client || !receipt) throw new Error("Aucun rendu à récupérer sur ce compte.");
    if (receipt.account !== await renderCredentialScope(client)) throw new Error("Reconnecte le compte Comfy utilisé pour ce rendu.");
    const store = vault(); const raw = (await store.get(requestPath(receipt.project)))?.text;
    if (!raw) throw new Error("Ce rendu vient de l’ancien studio. Utilise sa commande Récupérer le rendu.");
    const request = JSON.parse(raw) as CreationRequest;
    if (request.id !== receipt.id || request.project !== receipt.project) throw new Error("Le reçu ne correspond pas à cette création.");
    await collectResult(store, client, receipt, request, status);
    return receipt.project;
  });
}
