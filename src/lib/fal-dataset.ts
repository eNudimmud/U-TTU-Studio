import { DATASET_SIZE } from "./comfy-stack.ts";
import { checkTrigger, wordCount } from "./gate/captions.ts";
import { GATE } from "./gate/rules.ts";
import type { ZipEntry } from "./zip.ts";

const TRAINING_FILE = /^(\d{2})\.(jpg|txt)$/;
const slotName = (slot: number, extension: "jpg" | "txt") => `${String(slot).padStart(2, "0")}.${extension}`;
const isJpeg = (data: Uint8Array) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;

// fal gets the images and their captions only: the report, gate.json and the source file names stay on the device.
export const pickTrainingEntries = (entries: ZipEntry[]) =>
  entries.filter(entry => TRAINING_FILE.test(entry.name)).sort((a, b) => a.name.localeCompare(b.name));

export interface FalDatasetCheck { ok: boolean; problems: string[]; captions: string[] }

// The proxy and the smoke script cannot rerun the gate (human review, pixels); they refuse anything that does not have its shape.
export function checkFalDataset(entries: ZipEntry[], trigger: string): FalDatasetCheck {
  const problems: string[] = [];
  const triggerError = checkTrigger(trigger);
  if (triggerError) problems.push(`Trigger « ${trigger} » : ${triggerError}`);

  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1);
  const expected = new Set(Array.from({ length: DATASET_SIZE }, (_, i) => [slotName(i + 1, "jpg"), slotName(i + 1, "txt")]).flat());
  const extra = [...counts.keys()].filter(name => !expected.has(name));
  if (extra.length) problems.push(`Fichiers en trop : ${extra.slice(0, 5).join(", ")}${extra.length > 5 ? "…" : ""}. Attendu : ${slotName(1, "jpg")} à ${slotName(DATASET_SIZE, "jpg")} et leurs .txt, rien d’autre.`);
  const doubled = [...counts].filter(([, count]) => count > 1).map(([name]) => name);
  if (doubled.length) problems.push(`Noms en double : ${doubled.join(", ")}.`);

  const byName = new Map(entries.map(entry => [entry.name, entry.data]));
  const missing = Array.from({ length: DATASET_SIZE }, (_, i) => slotName(i + 1, "jpg")).filter(name => !byName.has(name));
  if (missing.length) {
    const images = DATASET_SIZE - missing.length;
    problems.push(`${images} image${images > 1 ? "s" : ""} sur ${DATASET_SIZE} (manque ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}) : le gate en exige ${DATASET_SIZE}, pas le minimum de fal.`);
  }

  const decoder = new TextDecoder();
  const captions: string[] = [];
  for (let slot = 1; slot <= DATASET_SIZE; slot++) {
    const image = byName.get(slotName(slot, "jpg"));
    const text = byName.get(slotName(slot, "txt"));
    if (image && !isJpeg(image)) problems.push(`${slotName(slot, "jpg")} n’est pas un JPEG.`);
    if (image && !text) problems.push(`${slotName(slot, "txt")} manque : chaque image garde sa légende.`);
    if (!text) continue;
    const caption = decoder.decode(text).trim();
    captions.push(caption);
    const name = slotName(slot, "txt");
    if (/[\r\n]/.test(caption)) problems.push(`${name} : une seule ligne attendue.`);
    if (caption !== trigger && !caption.startsWith(`${trigger},`)) problems.push(`${name} ne commence pas par le trigger « ${trigger} ».`);
    if (wordCount(caption) > GATE.maxCaptionWords) problems.push(`${name} : plus de ${GATE.maxCaptionWords} mots.`);
  }
  const keys = captions.map(caption => caption.toLowerCase());
  const repeated = keys.filter((key, i) => keys.indexOf(key) !== i).length;
  if (repeated) problems.push(`${repeated} légende${repeated > 1 ? "s" : ""} en double : chaque image décrit ce qui la distingue.`);

  return { ok: problems.length === 0, problems, captions };
}

// Fallback when the ZIP has no gate.json: every caption starts with the trigger.
export function inferTrigger(entries: ZipEntry[]): string | null {
  const first = entries.find(entry => entry.name === slotName(1, "txt"));
  if (!first) return null;
  return new TextDecoder().decode(first.data).trim().split(",")[0]?.trim() || null;
}
