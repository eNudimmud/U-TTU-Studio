// The adherent's own fal account, called straight from the browser. fal sends
// CORS headers for this origin on its queue, platform, storage and CDN hosts,
// so the key goes from this device to fal and to no other server.

export const FAL_QUEUE = "https://queue.fal.run";
export const FAL_API = "https://api.fal.ai/v1";
export const FAL_REST = "https://rest.fal.ai";

export type FalErrorCode = "auth" | "scope" | "credits" | "invalid" | "network" | "failed" | "cancelled" | "timeout" | "busy";

export class FalError extends Error {
  readonly code: FalErrorCode;
  readonly detail: string[];
  constructor(code: FalErrorCode, message: string, detail: string[] = []) {
    super(message);
    this.name = "FalError";
    this.code = code;
    this.detail = detail;
  }
}

export interface FalPrice {
  endpointId: string;
  unitPrice: number;
  unit: string;
  currency: string;
}

export interface FalAccount {
  username: string;
  usd: number;
}

export interface FalHandle {
  requestId: string;
  statusUrl: string;
  responseUrl: string;
  cancelUrl: string;
}

export type FalStatus =
  | { state: "queue"; position: number | null }
  | { state: "running"; log: string | null }
  | { state: "done"; error: string | null; errorType: string | null; seconds: number | null };

export interface FalUploadOptions {
  /** Seconds before fal deletes the uploaded copy. The vault keeps the original. */
  expiresIn?: number;
  onProgress?(loaded: number, total: number): void;
  signal?: AbortSignal;
}

export interface FalClientOptions {
  key: string;
  fetch?: typeof fetch;
  multipartThreshold?: number;
  partSize?: number;
}

const MULTIPART_THRESHOLD = 90 * 1024 * 1024;
const PART_SIZE = 10 * 1024 * 1024;

function falHost(url: string, hosts: readonly string[]): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname;
    return hosts.some(allowed => host === allowed || host.endsWith(`.${allowed}`)) ? parsed : null;
  } catch {
    return null;
  }
}

const QUEUE_HOSTS = ["queue.fal.run"] as const;
const FILE_HOSTS = ["fal.media", "fal.run", "fal.ai"] as const;

function fileUrl(url: string): URL | null {
  const parsed = falHost(url, FILE_HOSTS);
  if (parsed) return parsed;
  try {
    const legacy = new URL(url);
    return legacy.protocol === "https:" && legacy.hostname === "storage.googleapis.com" && legacy.pathname.startsWith("/falserverless/") ? legacy : null;
  } catch {
    return null;
  }
}

function lifecycle(seconds: number | undefined): string | null {
  return typeof seconds === "number" && seconds > 0 ? JSON.stringify({ expiration_duration_seconds: Math.round(seconds) }) : null;
}

async function bodyOf(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function detailLines(body: unknown): string[] {
  if (typeof body === "string") return [body.slice(0, 240)];
  if (!body || typeof body !== "object") return [];
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return [detail.slice(0, 240)];
  if (Array.isArray(detail)) {
    return detail.slice(0, 6).map(item => {
      if (!item || typeof item !== "object") return String(item);
      const row = item as { loc?: unknown; msg?: unknown };
      const where = Array.isArray(row.loc) ? row.loc.filter(part => part !== "body").join(".") : "";
      return `${where ? `${where} : ` : ""}${typeof row.msg === "string" ? row.msg : "refusé"}`;
    });
  }
  const message = (body as { message?: unknown; error?: unknown }).message ?? (body as { error?: unknown }).error;
  return typeof message === "string" ? [message.slice(0, 240)] : [];
}

function exhausted(lines: string[]): boolean {
  return lines.some(line => /balance|exhausted|locked|insufficient|credits?/i.test(line));
}

export function createFalClient(options: FalClientOptions) {
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
  const multipartThreshold = options.multipartThreshold ?? MULTIPART_THRESHOLD;
  const partSize = options.partSize ?? PART_SIZE;
  const auth = `Key ${options.key}`;

  async function send(url: string, init: RequestInit, { admin = false }: { admin?: boolean } = {}): Promise<Response> {
    let response: Response;
    try {
      response = await doFetch(url, { ...init, cache: "no-store", credentials: "omit" });
    } catch (error) {
      if (init.signal?.aborted) throw new FalError("cancelled", "Envoi annulé.");
      throw new FalError("network", error instanceof Error && /abort/i.test(error.name) ? "Envoi annulé." : "fal ne répond pas.");
    }
    if (response.ok) return response;
    const lines = detailLines(await bodyOf(response));
    if (response.status === 401) throw new FalError("auth", "fal refuse cette clé.", lines);
    if (response.status === 402 || (response.status === 403 && exhausted(lines))) throw new FalError("credits", "Solde fal insuffisant.", lines);
    if (response.status === 403) {
      throw admin
        ? new FalError("scope", "Cette clé n’a pas la portée Admin : fal ne montre le solde qu’à une clé Admin.", lines)
        : new FalError("auth", "fal refuse cette clé pour ce modèle.", lines);
    }
    if (response.status === 422 || response.status === 400) throw new FalError("invalid", "fal refuse la demande.", lines);
    if (response.status === 429) throw new FalError("busy", "fal est saturé. Réessaie dans un moment.", lines);
    throw new FalError("network", `fal répond ${response.status}.`, lines);
  }

  async function json<T>(response: Response): Promise<T> {
    const body = await bodyOf(response);
    if (body === null || typeof body !== "object") throw new FalError("network", "Réponse illisible de fal.");
    return body as T;
  }

  function handleFrom(body: Record<string, unknown>): FalHandle {
    const requestId = typeof body.request_id === "string" ? body.request_id : "";
    const urls = [body.status_url, body.response_url, body.cancel_url].map(value => (typeof value === "string" && falHost(value, QUEUE_HOSTS) ? value : null));
    if (!/^[A-Za-z0-9-]{8,80}$/.test(requestId) || urls.some(url => !url)) throw new FalError("network", "fal a accepté la demande sans adresse de suivi.");
    return { requestId, statusUrl: urls[0]!, responseUrl: urls[1]!, cancelUrl: urls[2]! };
  }

  async function uploadSingle(file: Blob, name: string, opts: FalUploadOptions): Promise<string> {
    const type = file.type || "application/octet-stream";
    const headers: Record<string, string> = { authorization: auth, "content-type": "application/json" };
    const keep = lifecycle(opts.expiresIn);
    if (keep) headers["x-fal-object-lifecycle"] = keep;
    const started = await json<{ upload_url?: unknown; file_url?: unknown }>(await send(`${FAL_REST}/storage/upload/initiate?storage_type=fal-cdn-v3`, {
      method: "POST", headers, body: JSON.stringify({ content_type: type, file_name: name }), signal: opts.signal,
    }));
    const target = typeof started.upload_url === "string" ? fileUrl(started.upload_url) : null;
    const url = typeof started.file_url === "string" ? fileUrl(started.file_url) : null;
    if (!target || !url) throw new FalError("network", "fal n’a pas donné d’adresse d’envoi.");
    await send(target.toString(), { method: "PUT", headers: { "content-type": type }, body: file, signal: opts.signal });
    opts.onProgress?.(file.size, file.size);
    return url.toString();
  }

  async function uploadParts(file: Blob, name: string, opts: FalUploadOptions): Promise<string> {
    const type = file.type || "application/octet-stream";
    const headers: Record<string, string> = { authorization: auth, "content-type": "application/json" };
    const keep = lifecycle(opts.expiresIn);
    if (keep) headers["x-fal-object-lifecycle"] = keep;
    const started = await json<{ upload_url?: unknown; file_url?: unknown }>(await send(`${FAL_REST}/storage/upload/initiate-multipart?storage_type=fal-cdn-v3`, {
      method: "POST", headers, body: JSON.stringify({ content_type: type, file_name: name }), signal: opts.signal,
    }));
    const target = typeof started.upload_url === "string" ? fileUrl(started.upload_url) : null;
    const url = typeof started.file_url === "string" ? fileUrl(started.file_url) : null;
    if (!target || !url) throw new FalError("network", "fal n’a pas donné d’adresse d’envoi.");
    const parts: { partNumber: number; etag: string }[] = [];
    const count = Math.ceil(file.size / partSize);
    for (let index = 0; index < count; index++) {
      const start = index * partSize;
      const end = Math.min(start + partSize, file.size);
      const partNumber = index + 1;
      let etag: string | null = null;
      for (let attempt = 0; attempt < 3 && !etag; attempt++) {
        try {
          const response = await send(`${target.origin}${target.pathname}/${partNumber}${target.search}`, { method: "PUT", body: file.slice(start, end), signal: opts.signal });
          const body = await bodyOf(response);
          etag = (body && typeof body === "object" && typeof (body as { etag?: unknown }).etag === "string" ? (body as { etag: string }).etag : null) ?? response.headers.get("etag");
          if (!etag) throw new FalError("network", "fal n’a pas confirmé une partie de l’envoi.");
        } catch (error) {
          if (opts.signal?.aborted || attempt === 2 || (error instanceof FalError && error.code !== "network" && error.code !== "busy")) throw error;
        }
      }
      parts.push({ partNumber, etag: etag! });
      opts.onProgress?.(end, file.size);
    }
    await send(`${target.origin}${target.pathname}/complete${target.search}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ parts }), signal: opts.signal,
    });
    return url.toString();
  }

  return {
    /** Who the key belongs to and the credit left. fal shows the balance to Admin-scope keys only. */
    async account(): Promise<FalAccount | null> {
      const body = await json<{ username?: unknown; credits?: { current_balance?: unknown; currency?: unknown } }>(
        await send(`${FAL_API}/account/billing?expand=credits`, { headers: { authorization: auth } }, { admin: true }),
      );
      const usd = Number(body.credits?.current_balance);
      if (!body.credits || body.credits.currency !== "USD" || !Number.isFinite(usd)) return null;
      return { username: typeof body.username === "string" ? body.username : "", usd };
    },

    /** The account's own unit price for an endpoint, as fal will bill it. */
    async price(endpointId: string): Promise<FalPrice | null> {
      const body = await json<{ prices?: unknown }>(await send(`${FAL_API}/models/pricing?endpoint_id=${encodeURIComponent(endpointId)}`, { headers: { authorization: auth } }));
      const rows = Array.isArray(body.prices) ? body.prices as Record<string, unknown>[] : [];
      const row = rows.find(item => item.endpoint_id === endpointId);
      const unitPrice = Number(row?.unit_price);
      if (!row || !Number.isFinite(unitPrice) || typeof row.unit !== "string" || typeof row.currency !== "string") return null;
      return { endpointId, unitPrice, unit: row.unit, currency: row.currency };
    },

    /** What fal actually charged for one request, from its billing events. Null until fal has booked it. */
    async charged(requestId: string): Promise<number | null> {
      const body = await json<{ billing_events?: unknown }>(
        await send(`${FAL_API}/models/billing-events?request_id=${encodeURIComponent(requestId)}`, { headers: { authorization: auth } }, { admin: true }),
      );
      const events = (Array.isArray(body.billing_events) ? body.billing_events as Record<string, unknown>[] : []).filter(event => event.request_id === requestId);
      if (events.length === 0) return null;
      const total = events.reduce((sum, event) => sum + (Number(event.cost_total) || 0), 0);
      return Math.round(total * 1e6) / 1e6;
    },

    async upload(file: Blob, name: string, opts: FalUploadOptions = {}): Promise<string> {
      return file.size > multipartThreshold ? uploadParts(file, name, opts) : uploadSingle(file, name, opts);
    },

    async submit(endpointId: string, input: Record<string, unknown>, { expiresIn, signal }: { expiresIn?: number; signal?: AbortSignal } = {}): Promise<FalHandle> {
      const headers: Record<string, string> = { authorization: auth, "content-type": "application/json" };
      const keep = lifecycle(expiresIn);
      if (keep) headers["x-fal-object-lifecycle-preference"] = keep;
      return handleFrom(await json<Record<string, unknown>>(await send(`${FAL_QUEUE}/${endpointId}`, { method: "POST", headers, body: JSON.stringify(input), signal })));
    },

    async status(handle: FalHandle): Promise<FalStatus> {
      const body = await json<Record<string, unknown>>(await send(`${handle.statusUrl}?logs=1`, { headers: { authorization: auth } }));
      const status = String(body.status ?? "").toUpperCase();
      if (status === "COMPLETED") {
        const metrics = body.metrics as { inference_time?: unknown } | undefined;
        const seconds = Number(metrics?.inference_time);
        return {
          state: "done",
          error: typeof body.error === "string" ? body.error : null,
          errorType: typeof body.error_type === "string" ? body.error_type : null,
          seconds: Number.isFinite(seconds) ? Math.round(seconds) : null,
        };
      }
      if (status === "IN_PROGRESS") {
        const logs = Array.isArray(body.logs) ? body.logs as { message?: unknown }[] : [];
        const last = [...logs].reverse().find(log => typeof log?.message === "string" && log.message.trim());
        return { state: "running", log: last ? String(last.message).trim().slice(0, 160) : null };
      }
      const position = Number(body.queue_position);
      return { state: "queue", position: Number.isFinite(position) ? position : null };
    },

    async result<T>(handle: FalHandle): Promise<T> {
      return json<T>(await send(handle.responseUrl, { headers: { authorization: auth } }));
    },

    async cancel(handle: FalHandle): Promise<void> {
      await send(handle.cancelUrl, { method: "PUT", headers: { authorization: auth } }).catch(() => {});
    },

    /** Files on fal's CDN are public by URL: no key goes with them. */
    async download(url: string, signal?: AbortSignal): Promise<Blob> {
      const target = fileUrl(url);
      if (!target) throw new FalError("network", "Adresse de fichier inattendue.");
      const response = await send(target.toString(), { signal });
      const type = (response.headers.get("content-type") ?? "").split(";")[0];
      if (type.includes("json") || type.startsWith("text/html")) throw new FalError("network", "Fichier illisible chez fal.");
      return response.blob();
    },

    /** True while an earlier upload is still on fal's CDN. */
    async alive(url: string): Promise<boolean> {
      const target = fileUrl(url);
      if (!target) return false;
      try {
        const response = await doFetch(target.toString(), { method: "HEAD", cache: "no-store", credentials: "omit" });
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}

export type FalClient = ReturnType<typeof createFalClient>;
