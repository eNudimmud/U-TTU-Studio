// Catalogue of creation processes. Live entries are the two Comfy App Mode
// apps already shared. Scene entries stay soon: neither app holds a passage
// between two images, and this delivery does not publish a third app.

import { COMFY_APPS } from "./comfy-stack.ts";
import { SPHERE_PRESETS, STUDIO_MODES, type StudioMode } from "./studio-modes.ts";

export const VAULT_PROCESS_NOTE = {
  folder: "processes/",
  journal: "jobs.md",
} as const;

export type ProcessState = "live" | "soon";
export type ComfyAppKey = keyof typeof COMFY_APPS;

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

const scene = (id: "avant" | "apres" | "entre"): CreationProcess => {
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
  scene("entre"),
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

export function processAction(process: { state: ProcessState }, hold = false): { label: "Lancer" | "Bientôt" | "Après le lot"; enabled: boolean } {
  if (process.state === "soon") return { label: "Bientôt", enabled: false };
  if (hold) return { label: "Après le lot", enabled: false };
  return { label: "Lancer", enabled: true };
}
