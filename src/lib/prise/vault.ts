// What Mon studio keeps for a shot and for a take, original and final.
// The final file is an upscale of the original, never a new generation.

import { withFrontmatter } from "../coffre/markdown.ts";
import type { PlanInput } from "./decision.ts";
import { isCadrage, isCamera } from "./decision.ts";
import type { PlanEtat } from "./copy.ts";

export interface StoredPlan {
  id: string;
  name: string;
  ordre: number;
  etat: PlanEtat;
  input: PlanInput;
  graph: string;
  pourquoi: string;
  takeIds: string[];
  imageCle: string;
  imageFin: string;
  finalVideo: string;
}

export interface StoredPrise {
  id: string;
  planId: string;
  template: string;
  entrees: string[];
  camera: string;
  duree: number;
  devis: number | "inconnu";
  plafond: number | null;
  cout: number;
  promptId: string;
  etat: "essai" | "gardee" | "finalisee";
  date: string;
  video: string;
  finalVideo: string;
  prompt: string;
}

export function finalPath(path: string): string {
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const file = slash >= 0 ? path.slice(slash + 1) : path;
  const dir = slash >= 0 ? path.slice(0, slash + 1) : "";
  const dot = file.lastIndexOf(".");
  if (dot <= 0) return `${dir}${file}-final`;
  return `${dir}${file.slice(0, dot)}-final${file.slice(dot)}`;
}

export function planJson(input: PlanInput, extra: { etat?: PlanEtat; before?: string; after?: string } = {}): string {
  return JSON.stringify({
    etat: extra.etat ?? "vide",
    avant: extra.before ?? "",
    apres: extra.after ?? "",
    qui: input.castIds.slice(0, 3),
    ou: input.decorId,
    cadrage: input.cadrage,
    action: input.action,
    camera: input.camera,
    duree: input.duree,
    paroles: input.paroles,
    replique: input.replique,
    enchainer: input.enchainer,
    imageFin: input.imageFin,
    imageCle: input.imageCle,
    keyframes: input.keyframes,
    gesteFilme: input.gesteFilme,
    prolonger: input.prolonger,
    retoucher: input.retoucher,
    format: input.format,
  });
}

export function planStateFromJson(source: string | null | undefined): { etat: PlanEtat; before: string; after: string } {
  const empty = { etat: "vide" as PlanEtat, before: "", after: "" };
  if (!source) return empty;
  try {
    const data = JSON.parse(source) as Record<string, unknown>;
    const etat = data.etat === "image-cle" || data.etat === "validee" || data.etat === "prise" || data.etat === "gardee" || data.etat === "finalisee"
      ? data.etat
      : "vide";
    return {
      etat,
      before: typeof data.avant === "string" ? data.avant : "",
      after: typeof data.apres === "string" ? data.apres : "",
    };
  } catch {
    return empty;
  }
}

export function planFromJson(source: string | null | undefined, fallback: PlanInput): PlanInput {
  if (!source) return fallback;
  try {
    const data = JSON.parse(source) as Record<string, unknown>;
    const cadrage = typeof data.cadrage === "string" && isCadrage(data.cadrage) ? data.cadrage : fallback.cadrage;
    const camera = typeof data.camera === "string" && isCamera(data.camera) ? data.camera : fallback.camera;
    const duree = data.duree === 8 ? 8 : 5;
    const paroles = data.paroles === "replique" || data.paroles === "voix-off" ? data.paroles : "aucune";
    const imageCle = data.imageCle === "proposee" || data.imageCle === "validee" ? data.imageCle : "aucune";
    return {
      ...fallback,
      castIds: Array.isArray(data.qui) ? data.qui.filter((item): item is string => typeof item === "string").slice(0, 3) : [],
      decorId: typeof data.ou === "string" && data.ou ? data.ou : null,
      cadrage,
      action: typeof data.action === "string" ? data.action.slice(0, 240) : "",
      camera,
      duree,
      paroles,
      replique: typeof data.replique === "string" ? data.replique.slice(0, 240) : "",
      enchainer: data.enchainer === true,
      imageFin: data.imageFin === true,
      imageCle,
      keyframes: typeof data.keyframes === "number" ? data.keyframes : 0,
      gesteFilme: data.gesteFilme === true,
      prolonger: data.prolonger === true,
      retoucher: data.retoucher === true,
      format: data.format === "9:16" ? "9:16" : "16:9",
    };
  } catch {
    return fallback;
  }
}

function wiki(target: string, label: string): string {
  const alias = label.replace(/[\[\]|\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return alias ? `[[${target}|${alias}]]` : `[[${target}]]`;
}

export function planMarkdown(plan: StoredPlan): string {
  const links = plan.takeIds.map((id, index) => `${index + 1}. ${wiki(`Prises/${id}`, id)}`);
  const final = plan.finalVideo ? `Version finalisée : ${wiki(plan.finalVideo, "final")}` : "Pas encore de version finalisée.";
  const image = plan.imageCle ? `Image clé : ${wiki(plan.imageCle, "image clé")}` : "Pas encore d'image clé.";
  const body = [
    `# ${plan.name}`,
    "",
    "Le plan tel qu'il a été composé. L'original de la prise est gardé à côté de la version finalisée.",
    "",
    image,
    final,
    "",
    plan.pourquoi,
    "",
    links.length > 0 ? links.join("\n") : "Aucune prise pour l'instant.",
    "",
  ].join("\n");
  return withFrontmatter({
    type: "shot",
    statut: plan.etat,
    nom: plan.name,
    ordre: plan.ordre,
    prises: plan.takeIds,
    graphe: plan.graph,
    pourquoi: plan.pourquoi,
    composeur: planJson(plan.input, { etat: plan.etat, before: plan.imageCle, after: plan.finalVideo }),
    image_cle: plan.imageCle,
    image_fin: plan.imageFin,
    final: plan.finalVideo,
  }, body);
}

export function priseMarkdown(prise: StoredPrise): string {
  const devis = prise.devis === "inconnu" ? "inconnu" : prise.devis;
  const body = [
    `# Prise`,
    "",
    prise.video ? `![[${prise.video}]]` : "Pas encore de fichier.",
    "",
    prise.finalVideo ? `Finalisée : ![[${prise.finalVideo}]]` : "Pas encore de version finalisée.",
    "",
    "## Texte envoyé",
    "",
    prise.prompt.trim() || "Aucun texte n'est parti.",
    "",
  ].join("\n");
  return withFrontmatter({
    type: "prise",
    plan: `[[Shots/${prise.planId}]]`,
    template: prise.template,
    entrees: prise.entrees,
    camera: prise.camera,
    duree_s: prise.duree,
    devis: typeof devis === "number" ? devis : "inconnu",
    plafond: prise.plafond,
    cout_reel: prise.cout,
    prompt_id: prise.promptId,
    etat: prise.etat,
    date: prise.date,
    video: prise.video,
    video_finale: prise.finalVideo,
  }, body);
}

export function moveId(ids: readonly string[], from: string, to: string): string[] {
  const next = [...ids];
  const start = next.indexOf(from);
  const end = next.indexOf(to);
  if (start < 0 || end < 0 || start === end) return next;
  const [item] = next.splice(start, 1);
  next.splice(end, 0, item);
  return next;
}
