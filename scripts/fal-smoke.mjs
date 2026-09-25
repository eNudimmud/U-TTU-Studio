// Smoke fal : ZIP du gate → fal.storage → entraînement → LoRA → 1 image à 0,75.
// Dry par défaut : lit le ZIP, vérifie sa forme, affiche le plan et le budget. 0 appel réseau, 0 $.
// --live dépense (≈ 2 $ + 0,035 $ par défaut) avec la clé lue dans FAL_KEY. Jamais en CI.
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const self = fileURLToPath(import.meta.url);
const isMain = !!process.argv[1] && resolve(process.argv[1]) === self;

// The stack lives in src/lib/*.ts; before 22.18, Node strips TypeScript types only behind a flag.
if (isMain && !process.features.typescript && !process.execArgv.includes("--experimental-strip-types")) {
  const child = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", ...process.execArgv, self, ...process.argv.slice(2)], { stdio: "inherit" });
  process.exit(child.status ?? 1);
}

const stack = await import("../src/lib/fal-stack.ts");
const api = await import("../src/lib/fal-api.ts");
const { checkFalDataset, inferTrigger, pickTrainingEntries } = await import("../src/lib/fal-dataset.ts");
const { createZip, readZip } = await import("../src/lib/zip.ts");

export const DEFAULTS = { steps: stack.FAL_TRAINING.steps, maxUsd: 3, out: "fal-smoke-out" };
const GEN_IMAGES = 1;
const POLL = { train: { intervalMs: 10_000, timeoutMs: 90 * 60_000 }, gen: { intervalMs: 2_000, timeoutMs: 10 * 60_000 } };

export const USAGE = `Usage : node scripts/fal-smoke.mjs <ZIP du gate> [--live] [--steps ${DEFAULTS.steps}] [--max-usd ${DEFAULTS.maxUsd}] [--trigger t] [--out ${DEFAULTS.out}]
  Sans --live : lit le ZIP, vérifie sa forme, affiche le plan et le budget. 0 appel réseau, 0 $.
  --live      : clé lue dans FAL_KEY. Dépose le ZIP fal, entraîne, télécharge la LoRA, rend 1 image à ${stack.formatStrength(stack.FAL_GEN.smokeStrength)}.
                Budget par défaut ≈ ${stack.formatUsd(stack.estimateFalRun(DEFAULTS.steps, GEN_IMAGES).usd)} ; refusé au-delà de --max-usd.`;

const megabytes = bytes => `${(bytes / 1048576).toFixed(1).replace(".", ",")} Mo`;
const stamp = (date = new Date()) => date.toISOString().slice(0, 19).replace(/[:T]/g, "-");
export const smokePrompt = trigger => `${trigger}, ${stack.FAL_GEN.smokeScene}`;

export function parseArgs(argv) {
  const options = { zip: null, live: false, steps: DEFAULTS.steps, maxUsd: DEFAULTS.maxUsd, trigger: null, out: DEFAULTS.out, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`${arg} attend une valeur.`);
      return next;
    };
    if (arg === "--live") options.live = true;
    else if (arg === "--steps") options.steps = Number(value());
    else if (arg === "--max-usd") options.maxUsd = Number(value());
    else if (arg === "--trigger") options.trigger = value();
    else if (arg === "--out") options.out = value();
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg.startsWith("-")) throw new Error(`Option inconnue : ${arg}.`);
    else if (!options.zip) options.zip = arg;
    else throw new Error(`Argument en trop : ${arg}.`);
  }
  const stepsError = stack.checkFalSteps(options.steps);
  if (stepsError) throw new Error(stepsError);
  if (!(options.maxUsd > 0)) throw new Error("--max-usd : un montant positif.");
  return options;
}

export function liveBlocker(options, key) {
  if (!key) return "--live exige la clé fal dans la variable d’environnement FAL_KEY.";
  const total = stack.estimateFalRun(options.steps, GEN_IMAGES).usd;
  if (total > options.maxUsd) return `Budget estimé ${stack.formatUsd(total)} au-dessus de --max-usd ${stack.formatUsd(options.maxUsd)}.`;
  return null;
}

// Only the 15 images and their captions go to fal: the report, gate.json and the instructions stay local.
export function prepare(archive, options) {
  const entries = readZip(archive, { inflateRaw: data => inflateRawSync(data) });
  const gate = entries.find(entry => entry.name === "gate.json");
  let manifest = null;
  if (gate) {
    try {
      manifest = JSON.parse(new TextDecoder().decode(gate.data));
    } catch {
      throw new Error("gate.json illisible.");
    }
    if (manifest.verdict !== "PASS") throw new Error(`gate.json : verdict ${manifest.verdict}, PASS exigé.`);
  }
  const training = pickTrainingEntries(entries);
  const trigger = options.trigger ?? manifest?.trigger ?? inferTrigger(training) ?? "";
  return {
    trigger,
    verdict: manifest?.verdict ?? null,
    training,
    dropped: entries.filter(entry => !training.includes(entry)).map(entry => entry.name),
    check: checkFalDataset(training, trigger),
    zip: createZip(training),
  };
}

export function describePlan(prepared, options, outDir) {
  const { FAL_API, FAL_ENDPOINTS, FAL_GEN, FAL_PRICING, FAL_PRIVACY, USD_CHF } = stack;
  const train = stack.estimateFalTrain(options.steps);
  const gen = stack.estimateFalGen(GEN_IMAGES);
  const total = stack.estimateFalRun(options.steps, GEN_IMAGES);
  const trainInput = stack.falTrainInput("<URL fal.storage du ZIP>", prepared.trigger, options.steps);
  const genInput = stack.falGenInput({ lora: "<URL de la LoRA>", prompt: smokePrompt(prepared.trigger), scale: FAL_GEN.smokeStrength, seed: FAL_GEN.seed });
  const images = prepared.training.filter(entry => entry.name.endsWith(".jpg")).length;
  return [
    `ZIP        ${basename(options.zip)} · ${prepared.verdict ? `gate.json ${prepared.verdict}` : "sans gate.json"} · trigger « ${prepared.trigger || "?"} »`,
    `Forme      ${prepared.check.ok ? "OK" : "REFUSÉE"} : ${images} JPEG, ${prepared.check.captions.length} légendes. ZIP fal ${megabytes(prepared.zip.length)}, ${prepared.training.length} fichiers ; restent ici : ${prepared.dropped.join(", ") || "rien"}.`,
    `1. Dépôt   POST ${FAL_API.storageInitiate} · effacement demandé après ${FAL_PRIVACY.zipExpiresSeconds / 3600} h`,
    `2. Train   POST ${FAL_API.queue}/${FAL_ENDPOINTS.train}`,
    `           ${JSON.stringify(trainInput)}`,
    `3. Suivi   GET  …/requests/<id>/status toutes les ${POLL.train.intervalMs / 1000} s, puis diffusers_lora_file.url`,
    `4. Image   POST ${FAL_API.queue}/${FAL_ENDPOINTS.gen} · force ${stack.formatStrength(FAL_GEN.smokeStrength)} · ${FAL_GEN.width} × ${FAL_GEN.height}`,
    `           ${JSON.stringify(genInput)}`,
    `5. Sortie  ${outDir}/ : lora.safetensors, config.json, image-${FAL_GEN.smokeStrength}.jpg`,
    `En-têtes   X-Fal-Store-IO: 0 · LoRA et image effacées par fal après ${FAL_PRIVACY.outputsExpiresSeconds / 86400} jours (demandé)`,
    `Budget     ${stack.formatUsd(train.usd)} (${options.steps} étapes) + ${stack.formatUsd(gen.usd, 3)} (${GEN_IMAGES} image) = ${stack.formatFalCost(total)} · plafond --max-usd ${stack.formatUsd(options.maxUsd)}`,
    `           Tarifs fal relevés le ${FAL_PRICING.checkedOn}, pas encore comparés à une facture. Taux 1 $ = ${String(USD_CHF.rate).replace(".", ",")} CHF, ${USD_CHF.verified ? "vérifié" : "non vérifié"}.`,
  ];
}

function progress(log, label) {
  let last = "";
  return status => {
    const line = status.status === "IN_QUEUE" ? `    ${label} : en file${status.position !== null ? `, position ${status.position}` : ""}`
      : status.status === "IN_PROGRESS" ? `    ${label} : en cours${status.log ? ` · ${status.log}` : ""}`
        : "";
    if (line && line !== last) log(line);
    last = line;
  };
}

export async function runLive(prepared, options, { key, fetch: fetchImpl, log = console.log, save, sleep, now }) {
  const client = { key, fetch: fetchImpl };
  const { FAL_GEN, FAL_PRIVACY } = stack;
  log(`1/5 Dépôt du ZIP fal (${megabytes(prepared.zip.length)})…`);
  const zipUrl = await api.uploadToStorage(client, prepared.zip, stack.falZipName(prepared.trigger), "application/zip");
  log(`    Déposé sur ${new URL(zipUrl).hostname} : URL publique non listée, effacement demandé après ${FAL_PRIVACY.zipExpiresSeconds / 3600} h.`);

  const trainId = await api.submitJob(client, "train", stack.falTrainInput(zipUrl, prepared.trigger, options.steps));
  log(`2/5 Entraînement en file · requête ${trainId}`);
  const trained = await api.waitForJob(client, "train", trainId, { ...POLL.train, sleep, now, onStatus: progress(log, "entraînement") });
  log(`3/5 LoRA : ${trained.lora}`);
  await save("lora.safetensors", await api.downloadFile(client, trained.lora));
  if (trained.config) await save("config.json", await api.downloadFile(client, trained.config));

  const request = { lora: trained.lora, prompt: smokePrompt(prepared.trigger), scale: FAL_GEN.smokeStrength, seed: FAL_GEN.seed };
  const genId = await api.submitJob(client, "gen", stack.falGenInput(request));
  log(`4/5 Image à ${stack.formatStrength(request.scale)} en file · requête ${genId}`);
  const image = await api.waitForJob(client, "gen", genId, { ...POLL.gen, sleep, now, onStatus: progress(log, "image") });
  await save(`image-${request.scale}.jpg`, await api.downloadFile(client, image.image));
  log(`5/5 Fait.${image.nsfw ? " fal a signalé l’image (filtre de sécurité)." : ""}`);
  return { trainId, genId, lora: trained.lora, config: trained.config, image: image.image };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.zip) {
    console.log(USAGE);
    process.exitCode = options.help ? 0 : 2;
    return;
  }
  const prepared = prepare(new Uint8Array(await readFile(options.zip)), options);
  const outDir = join(options.out, `${prepared.trigger || "dataset"}-${stamp()}`);
  const total = stack.estimateFalRun(options.steps, GEN_IMAGES);
  console.log(`U*TTU · smoke fal · ${options.live ? "LIVE : dépense réelle" : "dry : 0 appel réseau, 0 $"}`);
  for (const line of describePlan(prepared, options, outDir)) console.log(line);
  console.log(`FAL_KEY    ${process.env.FAL_KEY?.trim() ? "présente (non affichée)" : "absente"}`);

  if (!prepared.check.ok) {
    console.error("\nZIP refusé, rien n’est parti :");
    for (const problem of prepared.check.problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }
  if (!options.live) {
    console.log(`\nDry : rien n’est parti. Pour lancer (≈ ${stack.formatUsd(total.usd)}) : FAL_KEY=… node scripts/fal-smoke.mjs ${options.zip} --live`);
    return;
  }
  const key = process.env.FAL_KEY?.trim();
  const blocker = liveBlocker(options, key);
  if (blocker) throw new Error(blocker);

  await mkdir(outDir, { recursive: true });
  console.log("");
  const result = await runLive(prepared, options, { key, save: (name, data) => writeFile(join(outDir, name), data) });
  console.log(`\nFichiers : ${outDir}/`);
  console.log(`Requêtes fal : entraînement ${result.trainId}, image ${result.genId}.`);
  console.log(`Dépense estimée : ${stack.formatFalCost(total)}. fal efface la LoRA sous ${stack.FAL_PRIVACY.outputsExpiresSeconds / 86400} jours (demandé) : garde le fichier local.`);
}

if (isMain) {
  main().catch(error => {
    const key = process.env.FAL_KEY?.trim();
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Échec : ${key ? message.split(key).join("[FAL_KEY]") : message}`);
    process.exitCode = 1;
  });
}
