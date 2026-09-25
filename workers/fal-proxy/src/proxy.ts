import { FalError, jobStatus, submitJob, uploadToStorage, type FalClient } from "../../../src/lib/fal-api.ts";
import { checkFalDataset } from "../../../src/lib/fal-dataset.ts";
import {
  FAL_PROXY_ROUTES, FAL_TRAINING, checkFalGen, checkFalSteps, falGenInput, falTrainInput, falZipName, isFalRequestId,
  type FalGenRequest,
} from "../../../src/lib/fal-stack.ts";
import { readZip } from "../../../src/lib/zip.ts";

export interface Env {
  FAL_KEY?: string;
  ACCESS_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
}

const DEFAULT_ORIGINS = "https://enudimmud.github.io";
export const MIN_TOKEN_LENGTH = 24;

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

async function status(url: URL, client: FalClient, cors: Cors): Promise<Response> {
  const job = url.searchParams.get("job");
  const id = url.searchParams.get("id") ?? "";
  if (job !== "train" && job !== "gen") return json({ error: "job : train ou gen." }, 400, cors);
  if (!isFalRequestId(id)) return json({ error: "Identifiant de requête invalide." }, 400, cors);
  return json(await jobStatus(client, job, id), 200, cors);
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
    return json({ error: "Route inconnue." }, 404, cors);
  } catch (error) {
    if (error instanceof FalError) return json({ error: error.message }, 502, cors);
    return json({ error: "Erreur interne du proxy." }, 500, cors);
  }
}
