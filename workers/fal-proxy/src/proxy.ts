import { FalError, jobStatus, submitJob, uploadToStorage, type FalClient } from "../../../src/lib/fal-api.ts";
import {
  bootstrapCaption, bootstrapPlan, falVaryInput, imageExtension, sniffImage, type ImageKind,
} from "../../../src/lib/fal-bootstrap.ts";
import { checkFalDataset } from "../../../src/lib/fal-dataset.ts";
import {
  FAL_ACCESS_MIN, FAL_PROXY_ROUTES, FAL_TRAINING, FAL_VARY, checkFalGen, checkFalSteps, falGenInput, falTrainInput, falZipName, isFalFileUrl, isFalRequestId,
  type FalGenRequest, type FalJob,
} from "../../../src/lib/fal-stack.ts";
import { checkTrigger } from "../../../src/lib/gate/captions.ts";
import { readZip } from "../../../src/lib/zip.ts";

export interface Env {
  FAL_KEY?: string;
  ACCESS_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
}

const DEFAULT_ORIGINS = "https://enudimmud.github.io";
export const MIN_TOKEN_LENGTH = FAL_ACCESS_MIN;

type Cors = Record<string, string>;

function corsHeaders(origin: string | null, env: Env): Cors {
  const allowed = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(",").map(item => item.trim().replace(/\/+$/, "")).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

const json = (body: unknown, status: number, cors: Cors) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

function sameSecret(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

async function train(request: Request, url: URL, client: FalClient, cors: Cors): Promise<Response> {
  const trigger = url.searchParams.get("trigger")?.trim() ?? "";
  const steps = Number(url.searchParams.get("steps") ?? FAL_TRAINING.steps);
  const stepsError = checkFalSteps(steps);
  if (stepsError) return json({ error: stepsError }, 400, cors);
  const tooBig = { error: `ZIP trop lourd : ${FAL_TRAINING.maxZipBytes / 1048576} Mo au plus.` };
  if (Number(request.headers.get("Content-Length") ?? 0) > FAL_TRAINING.maxZipBytes) return json(tooBig, 413, cors);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > FAL_TRAINING.maxZipBytes) return json(tooBig, 413, cors);

  let check;
  try {
    check = checkFalDataset(readZip(bytes, { verifyCrc: false }), trigger);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "ZIP illisible." }, 400, cors);
  }
  if (!check.ok) return json({ error: "ZIP refusé : il n’a pas la forme du gate.", problems: check.problems }, 422, cors);

  const zipUrl = await uploadToStorage(client, bytes, falZipName(trigger), "application/zip");
  return json({ id: await submitJob(client, "train", falTrainInput(zipUrl, trigger, steps)) }, 202, cors);
}

const isJob = (value: string | null): value is FalJob => value === "train" || value === "gen" || value === "vary";

async function status(url: URL, client: FalClient, cors: Cors): Promise<Response> {
  const job = url.searchParams.get("job");
  const id = url.searchParams.get("id") ?? "";
  if (!isJob(job)) return json({ error: "job : train, gen ou vary." }, 400, cors);
  if (!isFalRequestId(id)) return json({ error: "Identifiant de requête invalide." }, 400, cors);
  return json(await jobStatus(client, job, id), 200, cors);
}

async function readRef(entry: FormDataEntryValue): Promise<{ bytes: Uint8Array; kind: ImageKind } | { error: string; status: number }> {
  if (!(entry instanceof File)) return { error: "Chaque référence doit être un fichier image.", status: 400 };
  if (entry.size <= 0) return { error: "Une référence est vide.", status: 400 };
  if (entry.size > FAL_VARY.maxRefBytes) return { error: `Référence trop lourde : ${FAL_VARY.maxRefBytes / 1048576} Mo au plus.`, status: 413 };
  const bytes = new Uint8Array(await entry.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return { error: "Références : JPEG, PNG ou WebP seulement.", status: 400 };
  return { bytes, kind };
}

// Server-owned prompts: the client sends photos and a trigger, never the edit instruction or the image count.
async function bootstrap(request: Request, url: URL, client: FalClient, cors: Cors): Promise<Response> {
  const trigger = url.searchParams.get("trigger")?.trim() ?? "";
  const triggerError = checkTrigger(trigger);
  if (triggerError) return json({ error: `Trigger « ${trigger} » : ${triggerError}` }, 400, cors);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Formulaire attendu : 2 ou 3 images dans le champ refs." }, 400, cors);
  }
  const entries = form.getAll("refs");
  if (entries.length < FAL_VARY.minRefs || entries.length > FAL_VARY.maxRefs) {
    return json({ error: `${FAL_VARY.minRefs} ou ${FAL_VARY.maxRefs} photos de référence, pas ${entries.length}.` }, 400, cors);
  }
  const refs: { bytes: Uint8Array; kind: ImageKind }[] = [];
  for (const entry of entries) {
    const read = await readRef(entry);
    if ("error" in read) return json({ error: read.error }, read.status, cors);
    refs.push(read);
  }

  const stored = await Promise.all(refs.map((ref, i) =>
    uploadToStorage(client, ref.bytes, `c-micro-${trigger}-ref-${i + 1}.${imageExtension(ref.kind)}`, ref.kind)));
  const plan = bootstrapPlan();
  const ids = await Promise.all(plan.map(slot => submitJob(client, "vary", falVaryInput(stored, slot))));
  return json({
    refs: stored,
    slots: plan.map((slot, i) => ({
      index: slot.index,
      id: ids[i],
      angle: slot.angle,
      framing: slot.framing,
      variables: slot.variables,
      caption: bootstrapCaption(trigger, slot),
      seed: slot.seed,
    })),
  }, 202, cors);
}

async function file(url: URL, client: FalClient, cors: Cors): Promise<Response> {
  const target = url.searchParams.get("url") ?? "";
  if (!isFalFileUrl(target)) return json({ error: "Fichier : une URL hébergée par fal est attendue." }, 400, cors);
  const upstream = client.fetch ?? fetch;
  const response = await upstream(target, { redirect: "manual" });
  if (response.status !== 200) return json({ error: `Fichier indisponible (${response.status}).` }, 502, cors);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > FAL_VARY.maxRefBytes) return json({ error: "Fichier vide ou trop lourd." }, 502, cors);
  const kind = sniffImage(bytes);
  if (!kind) return json({ error: "Le fichier n’est pas une image JPEG, PNG ou WebP." }, 502, cors);
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Response(body, { status: 200, headers: { ...cors, "Content-Type": kind, "Cache-Control": "private, no-store" } });
}

async function gen(request: Request, client: FalClient, cors: Cors): Promise<Response> {
  let body: Partial<FalGenRequest>;
  try {
    body = (await request.json()) as Partial<FalGenRequest>;
  } catch {
    return json({ error: "Corps JSON attendu." }, 400, cors);
  }
  const error = checkFalGen(body ?? {});
  if (error) return json({ error }, 400, cors);
  return json({ id: await submitJob(client, "gen", falGenInput(body as FalGenRequest)) }, 202, cors);
}

// Fixed routes and server-side inputs only: the key pays for whatever this worker forwards.
export async function handle(request: Request, env: Env, upstream: typeof fetch = fetch): Promise<Response> {
  const origin = request.headers.get("Origin");
  const cors = corsHeaders(origin, env);
  if (origin && !cors["Access-Control-Allow-Origin"]) return json({ error: "Origine refusée." }, 403, cors);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!env.FAL_KEY || !env.ACCESS_TOKEN || env.ACCESS_TOKEN.length < MIN_TOKEN_LENGTH) {
    return json({ error: `Proxy non configuré : secrets FAL_KEY et ACCESS_TOKEN (${MIN_TOKEN_LENGTH} caractères au moins).` }, 503, cors);
  }
  const token = /^Bearer (.+)$/.exec(request.headers.get("Authorization") ?? "")?.[1] ?? "";
  if (!sameSecret(token, env.ACCESS_TOKEN)) return json({ error: "Code d’accès refusé." }, 401, cors);

  const url = new URL(request.url);
  const client: FalClient = { key: env.FAL_KEY, fetch: upstream };
  try {
    if (request.method === "POST" && url.pathname === FAL_PROXY_ROUTES.train) return await train(request, url, client, cors);
    if (request.method === "GET" && url.pathname === FAL_PROXY_ROUTES.status) return await status(url, client, cors);
    if (request.method === "POST" && url.pathname === FAL_PROXY_ROUTES.gen) return await gen(request, client, cors);
    if (request.method === "POST" && url.pathname === FAL_PROXY_ROUTES.bootstrap) return await bootstrap(request, url, client, cors);
    if (request.method === "GET" && url.pathname === FAL_PROXY_ROUTES.file) return await file(url, client, cors);
    return json({ error: "Route inconnue." }, 404, cors);
  } catch (error) {
    if (error instanceof FalError) return json({ error: error.message }, 502, cors);
    return json({ error: "Erreur interne du proxy." }, 500, cors);
  }
}
