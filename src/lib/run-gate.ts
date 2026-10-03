// Plain script for the Comfy frame boot. A run started inside a Comfy page
// waits for "Lancer". The dialog names the run and shows the balance read
// from the visitor's session. It quotes no cost: inside Comfy's own page the
// studio has not measured this graph. Takes run from the studio instead,
// where cost is measured.

import { COMFY_CLOUD } from "./comfy-stack.ts";

export const RUN_GATE_JS = `
const UTTU_GATE = ${JSON.stringify({ creditsPerUsd: COMFY_CLOUD.creditsPerUsd })};
function gateNodes(body) {
  let data = body;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch (e) { return []; }
  }
  const prompt = data && typeof data === "object" && data.prompt && typeof data.prompt === "object" ? data.prompt : null;
  if (!prompt) return [];
  return Object.keys(prompt).map((key) => prompt[key]).filter((node) => node && typeof node === "object");
}
function gateLabel(body) {
  const types = gateNodes(body).map((node) => String(node.class_type || ""));
  if (types.indexOf("MiniMaxH3ReferenceToVideo") >= 0) return "Une prise vidéo";
  if (types.indexOf("TrainLoraNode") >= 0) return "Un entraînement";
  if (types.some((type) => type === "SaveImage" || type === "PreviewImage")) return "Une image";
  return "Ce rendu";
}
function gateCredits(value) {
  return String(Math.round(value)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, "\\u202f");
}
function gateDecide(balance) {
  if (typeof balance !== "number") return { allow: true, tone: "warn", line: "Solde non lu dans ce cadre. Coût non calibré : le temps de calcul réel sera débité." };
  if (balance <= 0) return { allow: false, tone: "block", line: "Solde vide : " + gateCredits(balance) + " crédits." };
  return { allow: true, tone: "warn", line: "Ton solde : " + gateCredits(balance) + " crédits. Coût non calibré : le temps de calcul réel sera débité." };
}
function gateBalanceFrom(body) {
  if (!body || typeof body !== "object") return null;
  const raw = body.amount_micros !== undefined ? body.amount_micros : body.amountMicros;
  const cents = Number(raw);
  if (raw === undefined || raw === null || !isFinite(cents)) return null;
  return Math.round(cents * UTTU_GATE.creditsPerUsd / 100);
}
`;
