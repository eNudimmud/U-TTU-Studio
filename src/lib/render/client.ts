// The adherent's own cloud renderer, called from the browser through the
// studio's same-origin relay (cloud.comfy.org sends no CORS headers for this
// host). Endpoints are Comfy Cloud's documented v1 API. No credential is kept
// on a server: the key or session token only transits the relay.

import { centsToCredits } from "../credits.ts";
import type { ApiGraph } from "./take-graph.ts";

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
}

export const BALANCE_URL = "https://api.comfy.org/customers/balance";

const IN_QUEUE = new Set(["submitted", "waiting_to_dispatch", "queued_waiting", "pending", "queued"]);
const PREPARING = new Set(["preparing", "assigned"]);
const SUCCESS = new Set(["success", "completed"]);
const FAILED = new Set(["error", "non_retryable_error", "failed", "lost"]);
const CANCELLED = new Set(["cancelled", "cancel_requested"]);

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

/** The first video a job saved. SaveVideo reports it under `images`, `video` or `gifs`. */
export function videoOutput(outputs: Record<string, unknown> | undefined): OutputRef | null {
  if (!outputs || typeof outputs !== "object") return null;
  const files: OutputRef[] = [];
  for (const node of Object.values(outputs)) {
    if (!node || typeof node !== "object") continue;
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
  }
  return files.find(file => VIDEO_FILE.test(file.filename)) ?? null;
}

/** The first still a job saved. SaveImage reports it under `images`. */
export function imageOutput(outputs: Record<string, unknown> | undefined): OutputRef | null {
  if (!outputs || typeof outputs !== "object") return null;
  const files: OutputRef[] = [];
  for (const node of Object.values(outputs)) {
    if (!node || typeof node !== "object") continue;
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
  }
  return files.find(file => IMAGE_FILE.test(file.filename)) ?? null;
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

export function createRenderClient(options: RenderClientOptions) {
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
  const relay = (options.relay ?? "").replace(/\/+$/, "");
  const balanceUrl = options.balanceUrl ?? BALANCE_URL;

  async function authHeaders(): Promise<Record<string, string>> {
    if (options.auth.kind === "key") return { "x-api-key": options.auth.key };
    const token = await options.auth.token();
    if (!token) throw new RenderError("auth", "Compte de rendu non connecté.");
    return { authorization: `Bearer ${token}` };
  }

  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    for (const [key, value] of Object.entries(await authHeaders())) headers.set(key, value);
    let response: Response;
    try {
      response = await doFetch(`${relay}${path}`, { ...init, headers, credentials: "same-origin", cache: "no-store" });
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

  return {
    async user(): Promise<Record<string, unknown>> {
      const response = await call("/api/user");
      if (!response.ok) throw new RenderError("auth", "Compte de rendu introuvable.");
      return json(response);
    },

    /** Credits available right now on the account that will be charged. */
    async balance(): Promise<number | null> {
      if (options.auth.kind === "session") {
        try {
          const response = await doFetch(balanceUrl, { headers: await authHeaders(), cache: "no-store" });
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
    async upload(file: Blob, filename: string, subfolder = ""): Promise<string> {
      const form = new FormData();
      form.append("image", file, filename);
      form.append("type", "input");
      if (subfolder) form.append("subfolder", subfolder);
      const response = await call("/api/upload/image", { method: "POST", body: form });
      if (!response.ok) throw new RenderError("invalid", `Photo refusée (${response.status}).`);
      const body = await json<{ name?: unknown; subfolder?: unknown }>(response);
      if (typeof body.name !== "string" || !body.name || /[\\\u0000]/.test(body.name)) throw new RenderError("invalid", "Photo envoyée sans nom.");
      return typeof body.subfolder === "string" && body.subfolder ? `${body.subfolder}/${body.name}` : body.name;
    },

    async submit(graph: ApiGraph, clientId: string): Promise<string> {
      const response = await call("/api/prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: graph, client_id: clientId }),
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

    async cancel(jobId: string): Promise<void> {
      await call("/api/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ delete: [jobId] }),
      });
    },
  };
}

export type RenderClient = ReturnType<typeof createRenderClient>;
