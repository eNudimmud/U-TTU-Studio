// The adherent's own cloud renderer, called from the browser through the
// studio's same-origin relay (cloud.comfy.org sends no CORS headers for this
// host). Endpoints are Comfy Cloud's documented v1 API. No credential is kept
// on a server: the key or session token only transits the relay.

import { centsToCredits } from "../credits.ts";
import type { ApiGraph } from "./take-graph.ts";
import { UPLOAD_HEAVY, uploadTooHeavy } from "./upload-limit.ts";
import { prepareUpload, type UploadNeed } from "./prepare-upload.ts";
import { directContentType, readDirectState, sendDirect, type BlobUpload, type DirectState } from "../envoi-direct/client.ts";

export type RenderAuth =
  | { kind: "key"; key: string }
  | { kind: "session"; token: () => Promise<string | null> };

export type RenderErrorCode = "auth" | "credits" | "subscription" | "invalid" | "network" | "failed" | "cancelled" | "timeout";

export class RenderError extends Error {
  readonly code: RenderErrorCode;
  readonly detail: string[];
  constructor(code: RenderErrorCode, message: string, detail: string[] = []) {
    super(message);
    this.name = "RenderError";
    this.code = code;
    this.detail = detail;
  }
}

export interface OutputRef {
  filename: string;
  subfolder: string;
  type: string;
}

export interface JobDetail {
  status: string;
  outputs?: Record<string, unknown>;
  execution_status?: { messages?: unknown[] };
  execution_start_time?: number | null;
  execution_end_time?: number | null;
  execution_error?: { exception_message?: string; node_type?: string } | null;
}

export interface RenderClientOptions {
  auth: RenderAuth;
  fetch?: typeof fetch;
  relay?: string;
  balanceUrl?: string;
  /** Direct send to private Vercel Blob for heavy files (tests inject a fake). */
  blobUpload?: BlobUpload;
}

export const BALANCE_URL = "https://api.comfy.org/customers/balance";

const IN_QUEUE = new Set(["submitted", "waiting_to_dispatch", "queued_waiting", "pending", "queued"]);
const PREPARING = new Set(["preparing", "assigned"]);
const SUCCESS = new Set(["success", "completed"]);
const FAILED = new Set(["error", "non_retryable_error", "failed", "lost"]);
const CANCELLED = new Set(["cancelled"]);

export type JobStage = "queue" | "prepare" | "render" | "done" | "failed" | "cancelled";

export function jobStage(status: string): JobStage {
  const value = status.trim().toLowerCase();
  if (SUCCESS.has(value)) return "done";
  if (FAILED.has(value)) return "failed";
  if (CANCELLED.has(value)) return "cancelled";
  if (IN_QUEUE.has(value)) return "queue";
  if (PREPARING.has(value)) return "prepare";
  return "render";
}

const VIDEO_FILE = /\.(mp4|webm|mov|mkv)$/i;
const IMAGE_FILE = /\.(png|jpe?g|webp)$/i;
const AUDIO_FILE = /\.(mp3|wav|ogg|m4a|flac|opus)$/i;

export type OutputKind = "video" | "image" | "audio" | "mesh";
const MESH_FILE = /\.(glb|gltf)$/i;
const KIND_FILE: Record<OutputKind, RegExp> = { video: VIDEO_FILE, image: IMAGE_FILE, audio: AUDIO_FILE, mesh: MESH_FILE };

function filesOf(node: unknown): OutputRef[] {
  const files: OutputRef[] = [];
  if (!node || typeof node !== "object") return files;
  for (const list of Object.values(node as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (typeof row.filename !== "string" || !row.filename) continue;
      files.push({
        filename: row.filename,
        subfolder: typeof row.subfolder === "string" ? row.subfolder : "",
        type: typeof row.type === "string" ? row.type : "output",
      });
    }
  }
  return files;
}

/**
 * The file a job saved, of one kind. With `node`, only that node's outputs count:
 * Comfy also reports the loaded inputs (LoadVideo previews the source clip), and
 * history keys come back in numeric order, so « the first video » can be the source.
 * Without `node`, files marked `input` never count and saved files come first.
 */
export function pickOutput(outputs: Record<string, unknown> | undefined, kind: OutputKind, node?: string): OutputRef | null {
  if (!outputs || typeof outputs !== "object") return null;
  const pattern = KIND_FILE[kind];
  if (node !== undefined) return filesOf((outputs as Record<string, unknown>)[node]).find(file => file.type !== "input" && pattern.test(file.filename)) ?? null;
  const files = Object.values(outputs).flatMap(filesOf).filter(file => file.type !== "input" && pattern.test(file.filename));
  return files.find(file => file.type === "output") ?? files[0] ?? null;
}

/** Every file of one kind a node saved, in save order (an 8-angle lot leaves through one node). */
export function pickOutputs(outputs: Record<string, unknown> | undefined, kind: OutputKind, node: string): OutputRef[] {
  if (!outputs || typeof outputs !== "object") return [];
  const pattern = KIND_FILE[kind];
  return filesOf((outputs as Record<string, unknown>)[node]).filter(file => file.type !== "input" && pattern.test(file.filename));
}

/** The video a job saved. SaveVideo reports it under `images`, `video` or `gifs`. */
export function videoOutput(outputs: Record<string, unknown> | undefined, node?: string): OutputRef | null {
  return pickOutput(outputs, "video", node);
}

/** The audio file a job saved. */
export function audioOutput(outputs: Record<string, unknown> | undefined, node?: string): OutputRef | null {
  return pickOutput(outputs, "audio", node);
}

/** The 3D model a job saved. SaveGLB and Save3DAdvanced report it under `3d` or `result`. */
export function meshOutput(outputs: Record<string, unknown> | undefined, node?: string): OutputRef | null {
  return pickOutput(outputs, "mesh", node);
}

/** The still a job saved. SaveImage reports it under `images`. */
export function imageOutput(outputs: Record<string, unknown> | undefined, node?: string): OutputRef | null {
  return pickOutput(outputs, "image", node);
}

/** Execution time the cloud recorded, from its own timeline. */
export function executionSeconds(detail: JobDetail): number | null {
  const start = Number(detail.execution_start_time);
  const end = Number(detail.execution_end_time);
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) return Math.round((end - start) / (end > 1e11 ? 1000 : 1));
  const messages = Array.isArray(detail.execution_status?.messages) ? detail.execution_status.messages : [];
  let first: number | null = null;
  let last: number | null = null;
  for (const message of messages) {
    if (!Array.isArray(message) || typeof message[0] !== "string") continue;
    const stamp = Number((message[1] as { timestamp?: unknown } | undefined)?.timestamp);
    if (!Number.isFinite(stamp)) continue;
    if (message[0] === "execution_start") first = stamp;
    if (message[0] === "execution_success" || message[0] === "execution_error") last = stamp;
  }
  if (first === null || last === null || last <= first) return null;
  return Math.round((last - first) / 1000);
}

function readCents(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const raw = row.amount_micros ?? row.amountMicros;
  const cents = typeof raw === "number" ? raw : Number(raw);
  return raw !== undefined && raw !== null && Number.isFinite(cents) ? cents : null;
}

function errorLines(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const row = body as Record<string, unknown>;
  const lines: string[] = [];
  const nodes = row.node_errors;
  if (nodes && typeof nodes === "object") {
    for (const [id, node] of Object.entries(nodes as Record<string, { class_type?: string; errors?: { message?: string; details?: string }[] }>)) {
      for (const error of node?.errors ?? []) lines.push(`${node.class_type ?? id} : ${error.message ?? error.details ?? "erreur"}`);
    }
  }
  const error = row.error;
  if (typeof error === "string") lines.push(error);
  else if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") lines.push(message);
  }
  return lines.slice(0, 6);
}

/**
 * The headers Comfy expects for this link: `X-API-Key` for a pasted key, `Authorization: Bearer`
 * for a Comfy session (refreshed by the token source). Null when nothing usable is linked.
 * Shared by the renderer and any studio feature that calls Comfy for the visitor. Never stored.
 */
export async function getComfyAuthHeaders(auth: RenderAuth | null): Promise<Record<string, string> | null> {
  if (!auth) return null;
  if (auth.kind === "key") return auth.key ? { "x-api-key": auth.key } : null;
  const token = await auth.token();
  return token ? { authorization: `Bearer ${token}` } : null;
}

const credentialScopes = new WeakMap<object, () => Promise<string | undefined>>();
/** Opaque account partition only. Call after authenticating with user(); never exposes credentials. */
export async function renderCredentialScope(client: object): Promise<string | undefined> { return credentialScopes.get(client)?.(); }

export function createRenderClient(options: RenderClientOptions) {
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
  const relay = (options.relay ?? "").replace(/\/+$/, "");
  const balanceUrl = options.balanceUrl ?? BALANCE_URL;
  let directState: Promise<DirectState> | null = null;

  async function authHeaders(): Promise<Record<string, string>> {
    const headers = await getComfyAuthHeaders(options.auth);
    if (!headers) throw new RenderError("auth", "Compte de rendu non connecté.");
    return headers;
  }

  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    for (const [key, value] of Object.entries(await authHeaders())) headers.set(key, value);
    let response: Response;
    try {
      response = await doFetch(`${relay}${path}`, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(path.startsWith("/api/view") ? 120_000 : 60_000), credentials: "same-origin", cache: "no-store" });
    } catch {
      throw new RenderError("network", "Le compte de rendu ne répond pas.");
    }
    if (response.status === 401 || response.status === 403) throw new RenderError("auth", "Le compte de rendu refuse la connexion. Reconnecte-toi.");
    if (response.status === 402) throw new RenderError("credits", "Crédits insuffisants sur ton compte de rendu.");
    if (response.status === 429) throw new RenderError("subscription", "Ton abonnement de rendu est inactif, ou la file est pleine.");
    return response;
  }

  async function json<T>(response: Response): Promise<T> {
    try {
      return await response.json() as T;
    } catch {
      throw new RenderError("network", "Réponse illisible du compte de rendu.");
    }
  }

  const client = {
    async user(): Promise<Record<string, unknown>> {
      const response = await call("/api/user");
      if (!response.ok) throw new RenderError("auth", "Compte de rendu introuvable.");
      return json(response);
    },

    /** Credits available right now on the account that will be charged. */
    async balance(): Promise<number | null> {
      if (options.auth.kind === "session") {
        try {
          const response = await doFetch(balanceUrl, { headers: await authHeaders(), signal: AbortSignal.timeout(15_000), cache: "no-store" });
          if (response.ok) {
            const cents = readCents(await response.json());
            if (cents !== null) return centsToCredits(cents);
          }
        } catch {}
      }
      const response = await call("/api/billing/usage/timeseries?granularity=month&months=1");
      if (!response.ok) return null;
      const body = await json<{ summary?: { balance?: unknown } }>(response);
      const cents = readCents(body.summary?.balance);
      return cents === null ? null : centsToCredits(cents);
    },

    /** Returns the input name a LoadImage node takes. */
    async upload(source: Blob, filename: string, need?: UploadNeed): Promise<string> {
      // Every user file passes here. With the private Blob store connected
      // (src/lib/envoi-direct), it goes as the original, bytes untouched (Wan Animate's
      // pose video is only re-timed). Without it, or if that send fails, the browser
      // reduction + relay path of src/lib/render/prepare-upload.ts, as before.
      directState ??= authHeaders().then(headers => readDirectState(relay, headers, doFetch), () => ({ direct: false }));
      const state = await directState;
      if (state.direct && state.scope && directContentType(source, filename)) {
        try {
          const file = await prepareUpload(source, filename, need, "direct");
          return await sendDirect(file, state.scope, relay, await authHeaders(), doFetch, options.blobUpload);
        } catch {
          // Silent fallback to the relay path below.
        }
      }
      const file = await prepareUpload(source, filename, need);
      if (uploadTooHeavy(file.size)) throw new Error(UPLOAD_HEAVY);
      const form = new FormData();
      form.append("image", file, file.name);
      form.append("type", "input");
      const response = await call("/api/upload/image", { method: "POST", body: form });
      if (response.status === 413) throw new Error(UPLOAD_HEAVY);
      if (!response.ok) throw new RenderError("invalid", `Photo refusée (${response.status}).`);
      const body = await json<{ name?: unknown; subfolder?: unknown }>(response);
      if (typeof body.name !== "string" || !body.name || /[\\\u0000]/.test(body.name)) throw new RenderError("invalid", "Photo envoyée sans nom.");
      return typeof body.subfolder === "string" && body.subfolder ? `${body.subfolder}/${body.name}` : body.name;
    },

    async submit(graph: ApiGraph, clientId: string): Promise<string> {
      // Partner/API nodes read credentials from extra_data, not only HTTP headers
      // (Comfy Cloud: api_key_comfy_org for a key, auth_token_comfy_org for a session).
      const extra_data: Record<string, string> = {};
      if (options.auth.kind === "key") {
        if (options.auth.key) extra_data.api_key_comfy_org = options.auth.key;
      } else {
        const token = await options.auth.token();
        if (token) extra_data.auth_token_comfy_org = token;
      }
      const response = await call("/api/prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: graph, client_id: clientId, extra_data }),
      });
      const body = await json<Record<string, unknown>>(response);
      const lines = errorLines(body);
      if (!response.ok || lines.length > 0 || typeof body.prompt_id !== "string") {
        throw new RenderError("invalid", "Le compte de rendu a refusé la prise.", lines);
      }
      return body.prompt_id;
    },

    async status(jobId: string): Promise<string> {
      const response = await call(`/api/job/${encodeURIComponent(jobId)}/status`);
      if (response.status === 404) return "submitted";
      if (!response.ok) throw new RenderError("network", `Statut illisible (${response.status}).`);
      const body = await json<{ status?: unknown }>(response);
      return typeof body.status === "string" ? body.status : "submitted";
    },

    async job(jobId: string): Promise<JobDetail> {
      const response = await call(`/api/jobs/${encodeURIComponent(jobId)}`);
      if (!response.ok) throw new RenderError("network", `Prise illisible (${response.status}).`);
      return json<JobDetail>(response);
    },

    async file(ref: OutputRef): Promise<Blob> {
      const query = new URLSearchParams({ filename: ref.filename, subfolder: ref.subfolder, type: ref.type });
      const response = await call(`/api/view?${query}`);
      const type = (response.headers.get("content-type") ?? "").split(";")[0];
      if (!response.ok || type.includes("json") || type.startsWith("text/")) throw new RenderError("network", `Vidéo illisible (${response.status}).`);
      return response.blob();
    },
    // No cancel(): the studio never cancels a Comfy job. Interrupting only stops waiting locally.
  };
  credentialScopes.set(client, async () => {
    let identity: string;
    if (options.auth.kind === "key") identity = options.auth.key;
    else {
      const token = await options.auth.token();
      try {
        const payload = token?.split(".")[1];
        if (!payload) return undefined;
        const data = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
        if (typeof data.sub !== "string" || !data.sub || data.sub.length > 200) return undefined;
        identity = `session:${data.iss ?? "comfy"}:${data.sub}`;
      } catch { return undefined; }
    }
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
  });
  return client;
}

export type RenderClient = ReturnType<typeof createRenderClient>;
