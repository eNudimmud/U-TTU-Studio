// The studio's memory, read from and written to the vault. Every file is
// plain Markdown with frontmatter, or the picture/video it points to.
//   CANON.md              the look: name, traits, photos
//   refs/look-N.jpg       the look's photos
//   scenes/<id>.md        a place: name, note, stills
//   scenes/<id>-N.jpg     its stills
//   prises/<id>.md        a take: plan, settings, job, measured cost
//   prises/<id>.mp4       the take itself
//   prises/<id>.jpg       one decoded frame, so a shelf tile always has pixels
//   clips/clip-*.mp4      the short videos a LoRA learns from
//   loras/<id>.md         a trained LoRA: trigger, steps, request, measured cost
//   loras/<id>.safetensors  the LoRA file itself
//   jobs.md               one line per take and per training, cost included
//   .uttu/etat.json       which place is current
//   .uttu/clips.json      each clip's length and size

import type { LoraResolution } from "../fal/prices.ts";
import { DEFAULT_TAKE, TAKE_ASPECTS, TAKE_SECONDS, TAKE_STEPS, takeProfile, type TakeSettings } from "../render/take-graph.ts";
import type { Clip, ClipFormat, TrainingAspect } from "../lora/dataset.ts";
import { list, num, readFrontmatter, text, withFrontmatter } from "./markdown.ts";
import type { VaultStore } from "./store.ts";

export const COFFRE_ROOT = "U-TTU-Studio";
export const LOOK_PHOTOS_MAX = 3;
export const SCENE_STILLS_MAX = 2;
export const TRAITS_MIN = 2;
export const NAME_MAX = 40;
export const NOTE_MAX = 280;
export const LINE_MAX = 240;

export interface Look {
  name: string;
  traits: string[];
  photos: string[];
  note: string;
}

export interface Scene {
  id: string;
  name: string;
  note: string;
  stills: string[];
}

/** "comfy": references only, on Comfy Cloud. "lora": the adherent's LoRA loaded by H3 on fal. */
export type TakeEngine = "comfy" | "lora";
export type CostSource = "billing" | "balance" | null;

export interface Take {
  id: string;
  at: string;
  sceneId: string | null;
  sceneName: string;
  line: string;
  settings: TakeSettings;
  profile: string;
  jobId: string;
  video: string;
  poster: string | null;
  prompt: string;
  gpuSeconds: number | null;
  costCredits: number | null;
  /** Balances are in the engine's own unit: Comfy credits, or US dollars on fal. */
  balanceBefore: number | null;
  balanceAfter: number | null;
  engine: TakeEngine;
  loraId: string | null;
  resolution: LoraResolution | null;
  costUsd: number | null;
  costSource: CostSource;
}

export interface Lora {
  id: string;
  at: string;
  name: string;
  trigger: string;
  file: string;
  bytes: number;
  sha256: string;
  steps: number;
  rank: number;
  aspect: TrainingAspect;
  clips: number;
  endpoint: string;
  requestId: string;
  seconds: number | null;
  costUsd: number | null;
  costSource: CostSource;
  balanceBefore: number | null;
  balanceAfter: number | null;
}

export interface Studio {
  look: Look;
  scenes: Scene[];
  currentScene: string | null;
  takes: Take[];
  loras: Lora[];
  clips: Clip[];
}

export const emptyLook = (): Look => ({ name: "", traits: [], photos: [], note: "" });
export const emptyStudio = (): Studio => ({ look: emptyLook(), scenes: [], currentScene: null, takes: [], loras: [], clips: [] });

const oneLine = (value: string, max: number) => value.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const block = (value: string, max: number) => value.replace(/\r\n/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f]+/g, " ").trim().slice(0, max);

export function cleanTraits(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const trait = oneLine(item, 60);
    const key = trait.toLowerCase();
    if (!trait || seen.has(key)) continue;
    seen.add(key);
    out.push(trait);
    if (out.length >= 8) break;
  }
  return out;
}

export function parseTraits(raw: string): string[] {
  return cleanTraits(raw.split(/[,;\n]+/));
}

export interface LookCheck {
  ready: boolean;
  photos: boolean;
  name: boolean;
  traits: boolean;
}

/** The look holds with two photos, a name, and two things that do not change. */
export function lookCheck(look: Look): LookCheck {
  const photos = look.photos.length >= 2;
  const name = look.name.trim().length > 0;
  const traits = look.traits.length >= TRAITS_MIN;
  return { ready: photos && name && traits, photos, name, traits };
}

export function slugify(name: string): string {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return base || "lieu";
}

export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; n < 1000; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${Date.now().toString(36)}`;
}

export function takeId(date: Date, scene: string): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${stamp}-${slugify(scene || "prise").slice(0, 24)}`;
}

export const extensionFor = (type: string) => (type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "video/webm" ? "webm" : type.startsWith("video/") ? "mp4" : "jpg");

export function canonMarkdown(look: Look): string {
  const traits = look.traits.length ? look.traits.map(trait => `- ${trait}`).join("\n") : "-";
  const photos = look.photos.map(path => `![[${path}]]`).join("\n");
  const body = `# ${look.name || "Mon look"}\n\n## Ce qui ne change pas\n\n${traits}\n\n## Photos\n\n${photos || "Aucune."}\n${look.note ? `\n## Note\n\n${look.note}\n` : ""}`;
  return withFrontmatter({ type: "look", nom: look.name, traits: look.traits, photos: look.photos }, body);
}

export function parseCanon(source: string): Look {
  const { fields, body } = readFrontmatter(source);
  const note = /## Note\n\n([\s\S]*)$/.exec(body)?.[1]?.trim() ?? "";
  return {
    name: oneLine(text(fields.nom), NAME_MAX),
    traits: cleanTraits(list(fields.traits)),
    photos: list(fields.photos).slice(0, LOOK_PHOTOS_MAX),
    note: block(note, NOTE_MAX),
  };
}

export function sceneMarkdown(scene: Scene): string {
  const stills = scene.stills.map(path => `![[${path}]]`).join("\n");
  const body = `# ${scene.name}\n\n${scene.note || ""}\n\n${stills}\n`;
  return withFrontmatter({ type: "scene", nom: scene.name, note: scene.note, images: scene.stills }, body);
}

export function parseScene(id: string, source: string): Scene {
  const { fields } = readFrontmatter(source);
  return {
    id,
    name: oneLine(text(fields.nom, id), NAME_MAX) || id,
    note: block(text(fields.note), NOTE_MAX),
    stills: list(fields.images).slice(0, SCENE_STILLS_MAX),
  };
}

const usd = (value: number) => `${value.toFixed(2)} $`;

/** What a take cost, in its payer's own unit. */
export function costLabel(take: Pick<Take, "engine" | "costCredits" | "costUsd">): string | null {
  if (take.engine === "lora") return take.costUsd === null ? null : usd(take.costUsd);
  return take.costCredits === null ? null : `${take.costCredits} cr.`;
}

export function takeMarkdown(take: Take): string {
  const cost = take.engine === "lora"
    ? take.costUsd === null ? "Débit pas encore lu." : `${usd(take.costUsd)} débités sur le compte fal.`
    : take.costCredits === null ? "Débit pas encore lu." : `${take.costCredits} crédits débités.`;
  const engine = take.engine === "lora" ? `Rendu avec le LoRA [[loras/${take.loraId}]], chez fal. ` : "";
  const body = `# ${take.line || "Prise"}\n\n![[${take.video}]]\n\n${take.sceneName ? `Lieu : ${take.sceneName}. ` : ""}${engine}${cost}\n`;
  return withFrontmatter({
    type: "prise",
    date: take.at,
    lieu: take.sceneId,
    lieu_nom: take.sceneName,
    plan: take.line,
    moteur: take.engine,
    lora: take.loraId,
    duree_s: take.settings.seconds,
    qualite: take.settings.quality,
    resolution: take.resolution,
    format: take.settings.aspect,
    profil: take.profile,
    job: take.jobId,
    video: take.video,
    vignette: take.poster,
    calcul_s: take.gpuSeconds,
    cout_credits: take.costCredits,
    cout_usd: take.costUsd,
    cout_source: take.costSource,
    solde_avant: take.balanceBefore,
    solde_apres: take.balanceAfter,
    texte: take.prompt,
  }, body);
}

const ENGINES: readonly TakeEngine[] = ["comfy", "lora"];
const RESOLUTIONS: readonly LoraResolution[] = ["480P", "768P"];
const SOURCES: readonly NonNullable<CostSource>[] = ["billing", "balance"];
const ASPECTS: readonly TrainingAspect[] = ["9:16", "16:9", "1:1"];
const pick = <T extends string>(value: string, options: readonly T[]): T | null => (options as readonly string[]).includes(value) ? value as T : null;

export function parseTake(id: string, source: string): Take | null {
  const { fields } = readFrontmatter(source);
  const video = text(fields.video);
  const jobId = text(fields.job);
  if (!video || !jobId) return null;
  const seconds = num(fields.duree_s);
  const quality = text(fields.qualite);
  const aspect = text(fields.format);
  const settings: TakeSettings = {
    seconds: (TAKE_SECONDS as readonly number[]).includes(seconds ?? -1) ? seconds as TakeSettings["seconds"] : DEFAULT_TAKE.seconds,
    quality: quality in TAKE_STEPS ? quality as TakeSettings["quality"] : DEFAULT_TAKE.quality,
    aspect: aspect in TAKE_ASPECTS ? aspect as TakeSettings["aspect"] : DEFAULT_TAKE.aspect,
  };
  return {
    id,
    at: text(fields.date),
    sceneId: text(fields.lieu) || null,
    sceneName: text(fields.lieu_nom),
    line: text(fields.plan),
    settings,
    profile: text(fields.profil) || takeProfile(settings),
    jobId,
    video,
    poster: text(fields.vignette) || null,
    prompt: text(fields.texte),
    gpuSeconds: num(fields.calcul_s),
    costCredits: num(fields.cout_credits),
    balanceBefore: num(fields.solde_avant),
    balanceAfter: num(fields.solde_apres),
    engine: pick(text(fields.moteur), ENGINES) ?? "comfy",
    loraId: text(fields.lora) || null,
    resolution: pick(text(fields.resolution), RESOLUTIONS),
    costUsd: num(fields.cout_usd),
    costSource: pick(text(fields.cout_source), SOURCES),
  };
}

export function loraId(date: Date, name: string): string {
  return takeId(date, name || "lora");
}

export function loraMarkdown(lora: Lora): string {
  const cost = lora.costUsd === null ? "Débit pas encore lu." : `${usd(lora.costUsd)} débités sur le compte fal.`;
  const body = `# LoRA — ${lora.name || "mon look"}\n\nDéclencheur : \`${lora.trigger}\`.\n\nFormé chez fal sur ${lora.clips} clips, ${lora.steps} pas, rang ${lora.rank}. ${cost}\n\nLa prise le charge en rendu « Ton LoRA » : MiniMax H3 référence-vers-vidéo, chez fal.\n\nFichier : \`${lora.file}\`\n`;
  return withFrontmatter({
    type: "lora",
    date: lora.at,
    nom: lora.name,
    declencheur: lora.trigger,
    fichier: lora.file,
    octets: lora.bytes,
    sha256: lora.sha256,
    pas: lora.steps,
    rang: lora.rank,
    format: lora.aspect,
    clips: lora.clips,
    entraineur: lora.endpoint,
    requete: lora.requestId,
    calcul_s: lora.seconds,
    cout_usd: lora.costUsd,
    cout_source: lora.costSource,
    solde_avant: lora.balanceBefore,
    solde_apres: lora.balanceAfter,
  }, body);
}

export function parseLora(id: string, source: string): Lora | null {
  const { fields } = readFrontmatter(source);
  const file = text(fields.fichier);
  const trigger = text(fields.declencheur);
  const requestId = text(fields.requete);
  if (!file || !trigger || !requestId) return null;
  return {
    id,
    at: text(fields.date),
    name: oneLine(text(fields.nom), NAME_MAX),
    trigger: oneLine(trigger, 60),
    file,
    bytes: num(fields.octets) ?? 0,
    sha256: text(fields.sha256),
    steps: num(fields.pas) ?? 0,
    rank: num(fields.rang) ?? 0,
    aspect: pick(text(fields.format), ASPECTS) ?? "9:16",
    clips: num(fields.clips) ?? 0,
    endpoint: text(fields.entraineur),
    requestId,
    seconds: num(fields.calcul_s),
    costUsd: num(fields.cout_usd),
    costSource: pick(text(fields.cout_source), SOURCES),
    balanceBefore: num(fields.solde_avant),
    balanceAfter: num(fields.solde_apres),
  };
}

export function jobsMarkdown(takes: readonly Take[], loras: readonly Lora[] = []): string {
  const rows = [
    ...takes.map(take => ({
      at: take.at,
      row: `| ${take.at.slice(0, 16).replace("T", " ")} | [[prises/${take.id}]] | ${take.engine === "lora" ? "fal" : "Comfy"} | ${take.profile} | ${take.gpuSeconds ?? "—"} | ${costLabel(take) ?? "en attente"} |`,
    })),
    ...loras.map(lora => ({
      at: lora.at,
      row: `| ${lora.at.slice(0, 16).replace("T", " ")} | [[loras/${lora.id}]] | fal | lora-${lora.steps}pas-rang${lora.rank} | ${lora.seconds ?? "—"} | ${lora.costUsd === null ? "en attente" : usd(lora.costUsd)} |`,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at)).map(item => item.row);
  return `# Journal\n\nUne ligne par prise et par formation. Le coût vient du compte qui a payé : le solde Comfy, ou la facture fal de la demande.\n\n| Date | Quoi | Moteur | Réglage | Calcul (s) | Coût |\n| --- | --- | --- | --- | --- | --- |\n${rows.join("\n")}\n`;
}

export const README = `# U*TTU Studio — coffre

Ce dossier est ton studio. L’app l’écrit, Obsidian le lit tel quel.

- \`CANON.md\` — ton look : nom, traits, photos.
- \`refs/\` — les photos du look.
- \`scenes/\` — tes lieux, une note et des images chacun.
- \`prises/\` — chaque prise : la vidéo et sa fiche (plan, réglage, coût mesuré).
- \`clips/\` — les courtes vidéos de toi dont ton LoRA apprend.
- \`loras/\` — chaque LoRA formé : le fichier \`.safetensors\` et sa fiche (déclencheur, pas, coût).
- \`jobs.md\` — le journal des prises, des formations et de ce qu’elles ont coûté.

Rien ici n’est envoyé au studio. Les prises et les formations tournent sur tes propres comptes.
`;

export async function loadStudio(store: VaultStore): Promise<Studio> {
  const entries = await store.list();
  const studio = emptyStudio();
  const byPath = new Map(entries.map(entry => [entry.path, entry]));
  const canon = byPath.get("CANON.md")?.text;
  if (canon) {
    const look = parseCanon(canon);
    studio.look = { ...look, photos: look.photos.filter(path => byPath.has(path)) };
  }
  for (const entry of entries) {
    const scene = /^scenes\/([a-z0-9-]+)\.md$/.exec(entry.path);
    if (scene && entry.text) {
      const parsed = parseScene(scene[1], entry.text);
      studio.scenes.push({ ...parsed, stills: parsed.stills.filter(path => byPath.has(path)) });
      continue;
    }
    const take = /^prises\/([A-Za-z0-9-]+)\.md$/.exec(entry.path);
    if (take && entry.text) {
      const parsed = parseTake(take[1], entry.text);
      if (parsed && byPath.has(parsed.video)) studio.takes.push({ ...parsed, poster: parsed.poster && byPath.has(parsed.poster) ? parsed.poster : null });
      continue;
    }
    const lora = /^loras\/([A-Za-z0-9-]+)\.md$/.exec(entry.path);
    if (lora && entry.text) {
      const parsed = parseLora(lora[1], entry.text);
      if (parsed && byPath.has(parsed.file)) studio.loras.push(parsed);
    }
  }
  studio.takes.sort((a, b) => b.at.localeCompare(a.at));
  studio.loras.sort((a, b) => b.at.localeCompare(a.at));
  try {
    const state = JSON.parse(byPath.get(".uttu/etat.json")?.text ?? "{}") as { lieu?: unknown };
    if (typeof state.lieu === "string" && studio.scenes.some(scene => scene.id === state.lieu)) studio.currentScene = state.lieu;
  } catch {}
  studio.currentScene ??= studio.scenes[0]?.id ?? null;
  studio.clips = readClips(byPath.get(".uttu/clips.json")?.text).filter(clip => byPath.has(clip.path));
  return studio;
}

const FORMATS: readonly ClipFormat[] = ["mp4", "mov", "mkv", "avi"];

function readClips(source: string | undefined): Clip[] {
  try {
    const rows = JSON.parse(source ?? "[]") as Record<string, unknown>[];
    if (!Array.isArray(rows)) return [];
    return rows.flatMap(row => {
      const format = typeof row.format === "string" ? pick(row.format, FORMATS) : null;
      const values = [row.bytes, row.seconds, row.width, row.height].map(Number);
      if (typeof row.path !== "string" || !row.path.startsWith("clips/") || !format || values.some(value => !Number.isFinite(value))) return [];
      return [{ path: row.path, format, bytes: values[0], seconds: values[1], width: values[2], height: values[3] }];
    });
  } catch {
    return [];
  }
}

const now = () => Date.now();

export async function writeText(store: VaultStore, path: string, value: string): Promise<void> {
  await store.put({ path, text: value, updatedAt: now() });
}

export async function writeBlob(store: VaultStore, path: string, blob: Blob): Promise<void> {
  await store.put({ path, blob, updatedAt: now() });
}

export async function writeLook(store: VaultStore, look: Look): Promise<void> {
  await writeText(store, "CANON.md", canonMarkdown(look));
}

export async function writeScene(store: VaultStore, scene: Scene): Promise<void> {
  await writeText(store, `scenes/${scene.id}.md`, sceneMarkdown(scene));
}

export async function removeScene(store: VaultStore, scene: Scene): Promise<void> {
  for (const path of scene.stills) await store.remove(path);
  await store.remove(`scenes/${scene.id}.md`);
}

export async function writeState(store: VaultStore, currentScene: string | null): Promise<void> {
  await writeText(store, ".uttu/etat.json", JSON.stringify({ lieu: currentScene }));
}

export async function writeTake(store: VaultStore, take: Take, takes: readonly Take[], loras: readonly Lora[] = []): Promise<void> {
  await writeText(store, `prises/${take.id}.md`, takeMarkdown(take));
  await writeText(store, "jobs.md", jobsMarkdown(takes, loras));
  if (!(await store.get("README.md"))) await writeText(store, "README.md", README);
}

export async function removeTake(store: VaultStore, take: Take, takes: readonly Take[], loras: readonly Lora[] = []): Promise<void> {
  await store.remove(take.video);
  if (take.poster) await store.remove(take.poster);
  await store.remove(`prises/${take.id}.md`);
  await writeText(store, "jobs.md", jobsMarkdown(takes, loras));
}

export async function writeClips(store: VaultStore, clips: readonly Clip[]): Promise<void> {
  await writeText(store, ".uttu/clips.json", JSON.stringify(clips));
}

export async function writeLora(store: VaultStore, lora: Lora, file: Blob, takes: readonly Take[], loras: readonly Lora[]): Promise<void> {
  await writeBlob(store, lora.file, file);
  await writeText(store, `loras/${lora.id}.md`, loraMarkdown(lora));
  await writeText(store, "jobs.md", jobsMarkdown(takes, loras));
  if (!(await store.get("README.md"))) await writeText(store, "README.md", README);
}

export async function removeLora(store: VaultStore, lora: Lora, takes: readonly Take[], loras: readonly Lora[]): Promise<void> {
  await store.remove(lora.file);
  await store.remove(`loras/${lora.id}.md`);
  await writeText(store, "jobs.md", jobsMarkdown(takes, loras));
}

/** The file's own fingerprint, written in its sheet so a take can prove which file it loaded. */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
