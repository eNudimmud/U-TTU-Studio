// Plain script for the Comfy frame boot. It names the run, estimates it from
// the same tables as the studio, and decides whether the launch button stays on.
// It never sends a run: the boot only forwards the visitor's own click.

import { COMFY_CLOUD, FLUX_STACK, TIMING } from "./comfy-stack.ts";
import { TAKE_TIMING } from "./credits.ts";

const TABLE = {
  creditsPerSecond: COMFY_CLOUD.gpuCreditsPerSecond,
  creditsPerUsd: COMFY_CLOUD.creditsPerUsd,
  take: { full: TAKE_TIMING.full, turbo: TAKE_TIMING.turbo },
  train: {
    steps: FLUX_STACK.training.steps,
    overhead: TIMING.overheadSeconds,
    perStep: TIMING.secondsPerStep,
    perImage: TIMING.secondsPerImage,
  },
  image: { low: 10 + TIMING.secondsPerImage.low, high: 60 + TIMING.secondsPerImage.high },
};

export const RUN_GATE_JS = `
const UTTU_GATE = ${JSON.stringify(TABLE)};
function gateNodes(body) {
  let data = body;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch (e) { return []; }
  }
  const prompt = data && typeof data === "object" && data.prompt && typeof data.prompt === "object" ? data.prompt : null;
  if (!prompt) return [];
  return Object.keys(prompt).map((key) => prompt[key]).filter((node) => node && typeof node === "object");
}
function gateClassify(body) {
  const nodes = gateNodes(body);
  const types = nodes.map((node) => String(node.class_type || ""));
  if (types.indexOf("MiniMaxH3ReferenceToVideo") >= 0) {
    let turbo = false;
    for (const node of nodes) {
      const title = String((node._meta && node._meta.title) || "");
      if (node.class_type === "PrimitiveBoolean" && /lightning|turbo/i.test(title) && node.inputs && node.inputs.value === true) turbo = true;
    }
    return { kind: "take", turbo: turbo };
  }
  for (const node of nodes) {
    if (node.class_type !== "TrainLoraNode") continue;
    const steps = Number(node.inputs && node.inputs.steps);
    return { kind: "train", steps: steps > 0 && steps <= 100000 ? Math.round(steps) : UTTU_GATE.train.steps };
  }
  if (types.some((type) => type === "SaveImage" || type === "PreviewImage")) return { kind: "image" };
  return { kind: nodes.length ? "other" : "unknown" };
}
function gateSeconds(run) {
  if (run.kind === "take") return (run.turbo ? UTTU_GATE.take.turbo : UTTU_GATE.take.full).seconds;
  if (run.kind === "train") {
    const t = UTTU_GATE.train;
    return { low: t.overhead.low + run.steps * t.perStep.low + 2 * t.perImage.low, high: t.overhead.high + run.steps * t.perStep.high + 2 * t.perImage.high };
  }
  if (run.kind === "image") return UTTU_GATE.image;
  return null;
}
function gateEstimate(run) {
  const seconds = gateSeconds(run);
  if (!seconds) return null;
  return { low: Math.round(seconds.low * UTTU_GATE.creditsPerSecond), high: Math.round(seconds.high * UTTU_GATE.creditsPerSecond) };
}
function gateLabel(run) {
  if (run.kind === "take") return run.turbo ? "La prise · turbo " + UTTU_GATE.take.turbo.steps + " pas" : "La prise · " + UTTU_GATE.take.full.steps + " pas";
  if (run.kind === "train") return "Former mon look · " + run.steps + " pas";
  if (run.kind === "image") return "Une image";
  return "Ce rendu";
}
function gateCredits(value) {
  return String(Math.round(value)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, "\\u202f");
}
function gateDecide(estimate, balance) {
  if (typeof balance !== "number") return { allow: true, tone: "warn", line: "Solde non lu dans ce cadre. Vérifie-le avant de lancer." };
  if (!estimate) return { allow: true, tone: "warn", line: "Coût de ce graphe non estimé. Solde : " + gateCredits(balance) + " crédits." };
  if (balance < estimate.low) return { allow: false, tone: "block", line: "Solde trop bas : " + gateCredits(balance) + " crédits, il en faut au moins " + gateCredits(estimate.low) + "." };
  if (balance < estimate.high) return { allow: true, tone: "warn", line: "Solde juste : le rendu peut dépasser " + gateCredits(balance) + " crédits." };
  return { allow: true, tone: "ok", line: "Solde suffisant pour l’estimation haute." };
}
function gateBalanceFrom(body) {
  if (!body || typeof body !== "object") return null;
  const raw = body.amount_micros !== undefined ? body.amount_micros : body.amountMicros;
  const cents = Number(raw);
  if (raw === undefined || raw === null || !isFinite(cents)) return null;
  return Math.round(cents * UTTU_GATE.creditsPerUsd / 100);
}
`;
