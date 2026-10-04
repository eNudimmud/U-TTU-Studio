// Farpy runs Blender 4.1.1 Cycles on a .blend. Inspect locks a quote and
// does not spend. Start is the only call that spends, and only with the
// quote id just read plus the legal acceptance their API requires.

import { formatUsd } from "../fal/prices.ts";
import type { RunGate } from "../credits.ts";
import { pngFromZip } from "./zip-png.ts";

export const FARPY_ORIGIN = "https://farpy.com";
export const FARPY_LEGAL = "FARPY_LEGAL_V1";

export interface FilmQuote {
  uploadId: string;
  quoteId: string;
  priceCents: number;
  frameCount: number;
}

export class FarpyError extends Error {
  readonly detail: string[];

  constructor(message: string, detail: string[] = []) {
    super(message);
    this.name = "FarpyError";
    this.detail = detail;
  }
}

type Send = (url: string, init: RequestInit) => Promise<Response>;

const fetchSend: Send = (url, init) => fetch(url, init);

export function filmStartBody(quote: FilmQuote): { quote_id: string; legal_acceptance: string } {
  return { quote_id: quote.quoteId, legal_acceptance: FARPY_LEGAL };
}

/** The sheet may show this only after inspect returned it. No list price is filled in. */
export function filmGate(quote: FilmQuote | null): RunGate {
  if (!quote || !quote.quoteId || !quote.uploadId) return { allowed: false, tone: "block", line: "Le devis n’est pas encore lu. Rien ne part." };
  if (!Number.isFinite(quote.priceCents) || quote.priceCents < 0) return { allowed: false, tone: "block", line: "Le devis n’est pas lisible. Rien ne part." };
  const images = quote.frameCount === 1 ? "1 image" : `${quote.frameCount} images`;
  return { allowed: true, tone: "warn", line: `Devis lu : ${formatUsd(quote.priceCents / 100)} pour ${images}.` };
}

export function filmState(payload: Record<string, unknown>): "done" | "failed" | "cancelled" | "running" {
  const state = String(payload.state ?? payload.status ?? "").toLowerCase();
  if (state === "complete" || state === "completed" || state === "done" || state === "succeeded" || state === "success") return "done";
  if (state === "failed" || state === "error") return "failed";
  if (state === "cancelled" || state === "canceled") return "cancelled";
  return "running";
}

export function filmDownload(payload: Record<string, unknown>): string {
  const url = payload.download_url ?? payload.url ?? payload.artifact_url;
  return typeof url === "string" ? url : "";
}

function cents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

export function readFilmQuote(payload: unknown): FilmQuote {
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const nested = body.quote && typeof body.quote === "object" ? body.quote as Record<string, unknown> : {};
  const uploadId = String(body.upload_id ?? nested.upload_id ?? "").trim();
  const quoteId = String(nested.quote_id ?? body.quote_id ?? "").trim();
  const price = cents(nested.price_cents ?? body.price_cents);
  const frames = cents(nested.frame_count ?? body.frame_count) ?? 1;
  if (!uploadId || !quoteId || price === null || price < 0 || frames < 1) {
    throw new FarpyError("Le devis n’est pas lisible. Rien n’est lancé.");
  }
  return { uploadId, quoteId, priceCents: price, frameCount: frames };
}

function jobIdOf(payload: unknown): string {
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const nested = body.job && typeof body.job === "object" ? body.job as Record<string, unknown> : {};
  const id = body.job_id ?? nested.job_id ?? body.id ?? nested.id;
  return typeof id === "string" ? id.trim() : "";
}

function failure(status: number, payload: unknown): FarpyError {
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const error = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : {};
  const server = String(error.message ?? body.message ?? "").slice(0, 240);
  const detail = server ? [server] : [];
  if (status === 401 || status === 403) return new FarpyError("La clé est refusée. Il faut une clé de job Farpy, celle qui commence par farpy_agent_.", detail);
  if (status === 402) return new FarpyError("Le compte Blender n’a pas de crédit pour ce devis.", detail);
  return new FarpyError("Le service Blender n’a pas répondu.", detail);
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

export async function inspectBlend(key: string, file: Blob, filename: string, signal?: AbortSignal, send: Send = fetchSend): Promise<FilmQuote> {
  const body = new FormData();
  const name = filename.toLowerCase().endsWith(".blend") ? filename : `${filename}.blend`;
  body.append("file", file, name);
  const response = await send(`${FARPY_ORIGIN}/node/v1/uploads/inspect`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    body,
    signal,
  });
  const payload = await readJson(response);
  if (!response.ok) throw failure(response.status, payload);
  return readFilmQuote(payload);
}

export async function startRender(key: string, quote: FilmQuote, signal?: AbortSignal, send: Send = fetchSend): Promise<string> {
  const response = await send(`${FARPY_ORIGIN}/node/v1/uploads/${encodeURIComponent(quote.uploadId)}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(filmStartBody(quote)),
    signal,
  });
  const payload = await readJson(response);
  if (!response.ok) throw failure(response.status, payload);
  const jobId = jobIdOf(payload);
  if (!jobId) throw new FarpyError("Le rendu n’a pas de numéro. Rien n’est suivi.");
  return jobId;
}

export async function readJob(key: string, jobId: string, signal?: AbortSignal, send: Send = fetchSend): Promise<Record<string, unknown>> {
  const response = await send(`${FARPY_ORIGIN}/node/v1/jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    signal,
  });
  const payload = await readJson(response);
  if (!response.ok) throw failure(response.status, payload);
  return payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
}

export async function pngFromJob(key: string, job: Record<string, unknown>, signal?: AbortSignal, send: Send = fetchSend): Promise<Blob> {
  const url = filmDownload(job);
  if (!url.startsWith("https://")) throw new FarpyError("Le rendu est fini, mais aucune image n’est sortie.");
  const sameHost = url.startsWith(`${FARPY_ORIGIN}/`);
  const response = await send(url, {
    method: "GET",
    headers: sameHost ? { Authorization: `Bearer ${key}` } : {},
    signal,
  });
  if (!response.ok) throw new FarpyError("L’image du rendu n’est pas revenue.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const png = await pngFromZip(bytes);
  if (!png || png.length < 8 || png[0] !== 0x89) throw new FarpyError("Le rendu est fini, mais aucune image n’est sortie.");
  return new Blob([new Uint8Array(png)], { type: "image/png" });
}
