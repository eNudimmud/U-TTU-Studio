// The cut list of one sequence. The browser plays it. Nothing is rendered,
// and nothing here is a Comfy graph.

import { shotsOf, writeText, ensureActiveProject, type Sequence, type Shot, type Take } from "./model.ts";
import { withFrontmatter } from "./markdown.ts";
import { projectPath } from "./project.ts";
import type { VaultStore } from "./store.ts";

/** How long the “plan sans prise” card stays up. Long enough to read the line. Not a render duration. */
export const MONTAGE_SLATE_SECONDS = 2;

export interface MontageCue {
  /** 1-based row in the cut list. */
  ordre: number;
  shotId: string;
  shotName: string;
  takeId: string | null;
  takeLine: string;
  /** Seconds already written on the take, or the slate hold when the panel has no take. */
  seconds: number;
  /** Vault path of the video. Null when the row is a slate. */
  source: string | null;
}

type TakeCue = Pick<Take, "id" | "line" | "video" | "settings">;

export function montageFile(sequenceId: string): string {
  return `Sequences/${sequenceId}-montage.md`;
}

/** The sequence a montage note belongs to. Null when the stem is not a cut list. */
export function sequenceIdFromMontage(stem: string): string | null {
  if (!stem.endsWith("-montage")) return null;
  const id = stem.slice(0, -"-montage".length);
  return /^[a-z0-9-]+$/.test(id) && id.length > 0 ? id : null;
}

function alias(value: string, fallback: string): string {
  const clean = value.replace(/[\[\]|\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return clean || fallback;
}

function wiki(target: string, label: string): string {
  return `[[${target}|${alias(label, target.split("/").pop() ?? target)}]]`;
}

/** One row per take already on a panel, in storyboard order. A panel with no take is one slate. */
export function montageCues(shots: readonly Shot[], takes: readonly TakeCue[], sequenceId: string): MontageCue[] {
  const cues: MontageCue[] = [];
  for (const shot of shotsOf(shots, sequenceId)) {
    const present = shot.takeIds.flatMap(id => {
      const take = takes.find(item => item.id === id);
      return take?.video ? [take] : [];
    });
    if (present.length === 0) {
      cues.push({
        ordre: cues.length + 1,
        shotId: shot.id,
        shotName: shot.name,
        takeId: null,
        takeLine: "",
        seconds: MONTAGE_SLATE_SECONDS,
        source: null,
      });
      continue;
    }
    for (const take of present) {
      const seconds = take.settings.seconds;
      cues.push({
        ordre: cues.length + 1,
        shotId: shot.id,
        shotName: shot.name,
        takeId: take.id,
        takeLine: take.line.trim(),
        seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : MONTAGE_SLATE_SECONDS,
        source: take.video,
      });
    }
  }
  return cues;
}

export function montageMarkdown(
  sequence: Pick<Sequence, "id" | "name">,
  shots: readonly Shot[],
  takes: readonly TakeCue[],
  projet = "",
): string {
  const cues = montageCues(shots, takes, sequence.id);
  const sequenceTarget = projet ? `Projets/${projet}/Sequences/${sequence.id}` : `Sequences/${sequence.id}`;
  const rows = cues.map(cue => {
    const planTarget = projet ? `Projets/${projet}/Shots/${cue.shotId}` : `Shots/${cue.shotId}`;
    const plan = wiki(planTarget, cue.shotName || cue.shotId);
    const prise = cue.takeId
      ? wiki(projet ? `Projets/${projet}/Prises/${cue.takeId}` : `Prises/${cue.takeId}`, cue.takeLine || cue.takeId)
      : "—";
    const source = cue.source ? `![[${cue.source}]]` : "Plan sans prise";
    return `| ${cue.ordre} | ${plan} | ${prise} | ${cue.seconds} s | ${source} |`;
  });
  const table = rows.length > 0
    ? `| Ordre | Plan | Prise | Durée | Source |\n| --- | --- | --- | --- | --- |\n${rows.join("\n")}`
    : "Aucun plan pour l’instant.";
  const body = `# ${sequence.name}\n\nListe de montage. Le navigateur enchaîne ces lignes, dans l’ordre des plans. Un plan sans prise est un carton. Aucun film n’est assemblé.\n\nSéquence : ${wiki(sequenceTarget, sequence.name || sequence.id)}\n\n${table}\n`;
  return withFrontmatter({
    type: "montage",
    projet,
    statut: "tenu",
    gesture: "sequence",
    updated: new Date().toISOString(),
    sequence: sequence.id,
    nom: sequence.name,
  }, body);
}

export async function writeMontage(
  store: VaultStore,
  sequence: Pick<Sequence, "id" | "name">,
  shots: readonly Shot[],
  takes: readonly TakeCue[],
): Promise<void> {
  if (!/^[a-z0-9-]+$/.test(sequence.id) || sequence.id.endsWith("-montage")) return;
  const slug = await ensureActiveProject(store);
  await writeText(store, projectPath(slug, montageFile(sequence.id)), montageMarkdown(sequence, shots, takes, slug));
}

export async function removeMontage(store: VaultStore, sequenceId: string): Promise<void> {
  if (!/^[a-z0-9-]+$/.test(sequenceId)) return;
  const slug = await ensureActiveProject(store);
  await store.remove(projectPath(slug, montageFile(sequenceId)));
}
