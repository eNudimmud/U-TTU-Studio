// Catalogue of creation processes. Former and Tester are the two published
// Comfy App Mode shares. Entre becomes the same kind of card only when a
// third share is configured, and never by reusing those two. Without one,
// the card stays on « Partage manquant » and nothing is embedded.

import { COMFY_APPS, entreShareUrl } from "./comfy-stack.ts";
import { SPHERE_PRESETS, STUDIO_MODES, type StudioMode } from "./studio-modes.ts";

export const VAULT_PROCESS_NOTE = {
  folder: "processes/",
  journal: "jobs.md",
} as const;

export type ProcessState = "live" | "soon" | "gap";
export type ComfyAppKey = keyof typeof COMFY_APPS;

export const ENTRE_GAP_NOTE = "Le passage est au catalogue. Le partage Comfy n’existe pas encore. Aucune adresse n’est posée à sa place.";

export interface CreationProcess {
  id: string;
  title: string;
  pitch: string;
  modes: readonly StudioMode[];
  state: ProcessState;
  app: ComfyAppKey | null;
  appUrl: string | null;
  workflowId: string | null;
  vault: typeof VAULT_PROCESS_NOTE;
  consent: string | null;
}

const CONSENT = "Compte Comfy, crédits à toi. Le cadre ne charge rien avant un second clic : Comfy peut alors appeler ses traceurs.";

const scene = (id: "avant" | "apres"): CreationProcess => {
  const preset = SPHERE_PRESETS.find(item => item.id === id);
  if (!preset) throw new Error(`scène absente : ${id}`);
  return {
    id,
    title: preset.title,
    pitch: preset.line,
    modes: ["sphere"],
    state: "soon",
    app: null,
    appUrl: null,
    workflowId: null,
    vault: VAULT_PROCESS_NOTE,
    consent: null,
  };
};

export function entreEntry(raw: string | null): CreationProcess {
  const preset = SPHERE_PRESETS.find(item => item.id === "entre");
  if (!preset) throw new Error("scène absente : entre");
  const appUrl = entreShareUrl(raw, [COMFY_APPS.train.url, COMFY_APPS.prompt.url]);
  const live = appUrl !== null;
  return {
    id: "entre",
    title: preset.title,
    pitch: preset.line,
    modes: ["sphere"],
    state: live ? "live" : "gap",
    app: live ? "entre" : null,
    appUrl,
    workflowId: null,
    vault: VAULT_PROCESS_NOTE,
    consent: live ? CONSENT : null,
  };
}

export const CREATION_PROCESSES = [
  {
    id: "former",
    title: "Former mon look",
    pitch: "Le lot tenu, le look se forme, puis une image.",
    modes: ["creer", "identite"],
    state: "live",
    app: "train",
    appUrl: COMFY_APPS.train.url,
    workflowId: "e8d7c649-0cb5-466b-be1a-4d7caa9204c2",
    vault: VAULT_PROCESS_NOTE,
    consent: CONSENT,
  },
  {
    id: "tester",
    title: "Tester un prompt",
    pitch: "La scène seule, avant de former. Sans look.",
    modes: ["creer", "sphere"],
    state: "live",
    app: "prompt",
    appUrl: COMFY_APPS.prompt.url,
    workflowId: "d5746aa7-b780-4e09-b877-0cf39309e875",
    vault: VAULT_PROCESS_NOTE,
    consent: CONSENT,
  },
  entreEntry(COMFY_APPS.entre.url),
  scene("avant"),
  scene("apres"),
] as const satisfies readonly CreationProcess[];

export type ProcessId = (typeof CREATION_PROCESSES)[number]["id"];

export function processById(id: string) {
  return CREATION_PROCESSES.find(process => process.id === id);
}

export function processesForMode(mode: StudioMode) {
  return CREATION_PROCESSES.filter(process => (process.modes as readonly string[]).includes(mode));
}

export function processModeLabels(process: { modes: readonly StudioMode[] }): string {
  return process.modes.map(id => STUDIO_MODES.find(mode => mode.id === id)?.label ?? id).join(" · ");
}

export function processShareId(process: { appUrl: string | null }): string | null {
  if (!process.appUrl) return null;
  return new URL(process.appUrl).searchParams.get("share");
}

export function processGap(process: { id: string; state: ProcessState }): string | null {
  if (process.state !== "gap" || process.id !== "entre") return null;
  return ENTRE_GAP_NOTE;
}

export function processStateLabel(state: ProcessState): "Prêt" | "Bientôt" | "Partage manquant" {
  if (state === "live") return "Prêt";
  if (state === "gap") return "Partage manquant";
  return "Bientôt";
}

export function sphereLead(entre: { state: ProcessState } | undefined): string {
  if (entre?.state === "live") return "Former, Tester et Entre deux images s’ouvrent ici. Avant et Après attendent. Rien ne part avant le clic.";
  return "Former et Tester s’ouvrent ici. Entre deux images est au catalogue : le partage Comfy manque. Avant et Après attendent. Rien ne part avant le clic.";
}

export function processAction(process: { state: ProcessState }, hold = false): { label: "Lancer" | "Bientôt" | "Après le lot" | "Partage manquant"; enabled: boolean } {
  if (process.state === "gap") return { label: "Partage manquant", enabled: false };
  if (process.state === "soon") return { label: "Bientôt", enabled: false };
  if (hold) return { label: "Après le lot", enabled: false };
  return { label: "Lancer", enabled: true };
}
