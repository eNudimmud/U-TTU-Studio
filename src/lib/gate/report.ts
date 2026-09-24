import { APP_LABELS, COMFY_APPS, COMFY_CLOUD, DATASET_SIZE, FLUX_STACK, estimateTrainRun, type RunEstimate } from "../comfy-stack.ts";
import { parseInvariants } from "./captions.ts";
import { ANGLES, FRAMINGS } from "./vocabulary.ts";
import type { CheckStatus, GateInput, GateResult } from "./rules.ts";

export const slot = (index: number) => String(index + 1).padStart(2, "0");
export const captionsBlock = (captions: string[]) => captions.join("\n");

const STATUS: Record<CheckStatus, string> = { pass: "PASS", fail: "FAIL", warn: "WARN", todo: "À FAIRE" };
const pad = (value: number) => String(value).padStart(2, "0");
const stamp = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} à ${pad(date.getHours())}:${pad(date.getMinutes())}`;
const angleLabel = (id: string | null) => ANGLES.find(item => item.id === id)?.label ?? "—";
const framingLabel = (id: string | null) => FRAMINGS.find(item => item.id === id)?.label ?? "—";
const round = (value: number) => Math.round(value);

export function formatEstimate(estimate: RunEstimate): string {
  const minutes = `${Math.max(1, Math.round(estimate.seconds.low / 60))}–${Math.max(1, Math.round(estimate.seconds.high / 60))} min`;
  return `${round(estimate.credits.low)}–${round(estimate.credits.high)} crédits (≈ ${estimate.usd.low.toFixed(2)}–${estimate.usd.high.toFixed(2)} $), ${minutes}`;
}

export function buildReport(input: GateInput, result: GateResult, generatedAt: Date): string {
  const invariants = parseInvariants(input.invariants);
  const rejected = input.images.filter(image => image.decision === "rejeter");
  const lines = [
    "U*TTU Studio — C micro · Rapport du gate dataset",
    `Verdict : ${result.verdict} · ${result.checks.length} contrôles · ${result.failCount} FAIL · ${result.todoCount} à faire · ${result.warnCount} avertissement(s)`,
    `Généré le ${stamp(generatedAt)} (heure de l’appareil), entièrement dans le navigateur.`,
    "",
    `Stack : ${FLUX_STACK.name} sur Comfy Cloud — ${DATASET_SIZE} images, entraînement à ${FLUX_STACK.training.megapixels} MP, ${FLUX_STACK.training.steps} étapes conseillées.`,
    `Trigger : ${input.trigger.trim()}`,
    `Invariants (portés par le trigger, interdits dans les légendes) : ${invariants.join(", ") || "—"}`,
    "",
    "CONTRÔLES",
    ...result.checks.map(item => `${STATUS[item.status].padEnd(7)} ${item.id}  ${item.label} — ${item.detail}`),
    "",
    `IMAGES RETENUES (ordre des emplacements « ${APP_LABELS.image(1)} » à « ${APP_LABELS.image(DATASET_SIZE)} »)`,
    ...result.kept.flatMap((image, i) => [
      `${slot(i)}  ${image.name} — ${image.width}×${image.height} · netteté ${round(image.sharpness)} · ${angleLabel(image.angle)} · ${framingLabel(image.framing)}${image.reviewed ? " · vérifiée à l’œil" : ""}`,
      `    ${result.captions[i]}`,
    ]),
    "",
    "IMAGES ÉCARTÉES",
    ...(rejected.length
      ? rejected.map(image => `- ${image.name}${result.flags[image.id]?.length ? ` (${result.flags[image.id].map(flag => flag.label.toLowerCase()).join(", ")})` : ""}`)
      : ["- aucune"]),
  ];
  return `${lines.join("\n")}\n`;
}

export function buildReadme(steps: number = FLUX_STACK.training.steps, images: number = FLUX_STACK.image.count): string {
  const test = estimateTrainRun(FLUX_STACK.training.testSteps, 1);
  const real = estimateTrainRun(steps, images);
  return [
    "C micro — étape suivante : un seul run Comfy Cloud",
    "",
    `1. Ouvre l’app : ${COMFY_APPS.train.url}`,
    "   Compte Comfy Cloud avec crédits. Tes images partent chez Comfy au moment où tu les déposes dans l’app.",
    `2. Dépose 01.jpg dans « ${APP_LABELS.image(1)} », 02.jpg dans « ${APP_LABELS.image(2)} »… jusqu’à ${slot(DATASET_SIZE - 1)}.jpg.`,
    `3. Colle tout captions_comfy.txt dans « ${APP_LABELS.captions} ».`,
    `4. Test à blanc : « Étapes d’entraînement » = ${FLUX_STACK.training.testSteps}, « Nombre d’images » = 1, puis Run.`,
    `   Attendu : 3 sorties (Avec LoRA, Témoin sans LoRA, Courbe de loss). Estimation : ${formatEstimate(test)}.`,
    `5. Run réel : « Étapes d’entraînement » = ${steps}, prompt, force et seed de l’étape 3, puis Run.`,
    `   Estimation : ${formatEstimate(real)}. Limite Comfy : ${COMFY_CLOUD.runtimeLimitMinutes.standard} min par run (Standard, Creator).`,
    "",
    "Estimations non mesurées : le premier run sert de calibration.",
    `La LoRA vit le temps du run : Comfy Cloud n’exporte pas ses poids (vérifié le ${COMFY_CLOUD.checkedOn}). Une autre image = un autre run.`,
    "",
    "Les fichiers 01.txt… contiennent les mêmes légendes au format standard (image + .txt) si tu entraînes ailleurs.",
    "",
  ].join("\n");
}

export function buildManifest(input: GateInput, result: GateResult, generatedAt: Date) {
  return {
    schema: "uttu-c-micro-gate/1",
    generatedAt: generatedAt.toISOString(),
    verdict: result.verdict,
    trigger: input.trigger.trim(),
    invariants: parseInvariants(input.invariants),
    stack: { model: FLUX_STACK.name, datasetSize: DATASET_SIZE, training: FLUX_STACK.training, app: COMFY_APPS.train.url },
    checks: result.checks.map(({ id, status, label, detail }) => ({ id, status, label, detail })),
    images: result.kept.map((image, i) => ({
      slot: slot(i), file: `${slot(i)}.jpg`, source: image.name, width: image.width, height: image.height,
      sharpness: round(image.sharpness), hash: image.hash, angle: image.angle, framing: image.framing, reviewed: image.reviewed, caption: result.captions[i],
    })),
    rejected: input.images.filter(image => image.decision === "rejeter").map(image => ({ source: image.name, flags: (result.flags[image.id] ?? []).map(flag => flag.kind) })),
  };
}
