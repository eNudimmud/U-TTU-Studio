import {
  FAL_API, FAL_ENDPOINTS, FAL_GEN, FAL_PRIVACY, isFalFileUrl, isFalRequestId,
  type FalGenResult, type FalJob, type FalJobResult, type FalJobStatus, type FalTrainResult,
} from "./fal-stack.ts";

// Server side only (proxy, smoke script): every call below carries the fal key. The browser talks to the proxy.
export interface FalClient { key: string; fetch?: typeof fetch }

export class FalError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "FalError";
    this.status = status;
  }
}

// Workers throw "Illegal invocation" when fetch is called as a method of another object.
const sender = (client: FalClient): typeof fetch => client.fetch ?? fetch;
const scrub = (client: FalClient, text: string) => (client.key ? text.split(client.key).join("[FAL_KEY]") : text);

function reason(body: string): string {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown; error?: unknown; message?: unknown };
    const detail = parsed.detail ?? parsed.error ?? parsed.message;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map(item => {
        const { loc, msg } = (item ?? {}) as { loc?: unknown; msg?: unknown };
        const field = Array.isArray(loc) ? loc.filter(part => part !== "body").join(".") : "";
        return `${field ? `${field} : ` : ""}${typeof msg === "string" ? msg : JSON.stringify(item)}`;
      }).join(" · ");
    }
  } catch {
    // Not JSON: fall through to the raw text.
  }
  return body.slice(0, 200) || "réponse vide";
}

async function call<T>(client: FalClient, url: string, init: RequestInit = {}): Promise<T> {
  const response = await sender(client)(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Key ${client.key}` } });
  const body = await response.text();
  const where = new URL(url).pathname;
  if (!response.ok) throw new FalError(scrub(client, `fal ${response.status} (${where}) : ${reason(body)}`), response.status);
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new FalError(`fal : réponse illisible (${where}).`, 502);
  }
}

export async function uploadToStorage(client: FalClient, data: Uint8Array, fileName: string, contentType: string): Promise<string> {
  const target = await call<{ upload_url?: unknown; file_url?: unknown }>(client, FAL_API.storageInitiate, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Fal-Object-Lifecycle": JSON.stringify({ expiration_duration_seconds: FAL_PRIVACY.zipExpiresSeconds }) },
    body: JSON.stringify({ content_type: contentType, file_name: fileName }),
  });
  const { upload_url: uploadUrl, file_url: fileUrl } = target;
  if (typeof uploadUrl !== "string" || !uploadUrl.startsWith("https://") || typeof fileUrl !== "string" || !isFalFileUrl(fileUrl)) {
    throw new FalError("fal : adresse de dépôt inattendue.", 502);
  }
  // Signed upload URL: the key must not travel with the file.
  const put = await sender(client)(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: data as Uint8Array<ArrayBuffer> });
  if (!put.ok) throw new FalError(`fal : dépôt refusé (${put.status}).`, put.status);
  return fileUrl;
}

export const falQueueHeaders = (): Record<string, string> => ({
  "X-Fal-Object-Lifecycle-Preference": JSON.stringify({ expiration_duration_seconds: FAL_PRIVACY.outputsExpiresSeconds }),
  ...(FAL_PRIVACY.storeRequestPayloads ? {} : { "X-Fal-Store-IO": "0" }),
});

const queueUrl = (job: FalJob, suffix = "") => `${FAL_API.queue}/${FAL_ENDPOINTS[job]}${suffix}`;

export async function submitJob(client: FalClient, job: FalJob, input: object): Promise<string> {
  const { request_id: id } = await call<{ request_id?: unknown }>(client, queueUrl(job), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...falQueueHeaders() },
    body: JSON.stringify(input),
  });
  if (typeof id !== "string" || !isFalRequestId(id)) throw new FalError("fal : la file n’a pas rendu d’identifiant.", 502);
  return id;
}

const fileUrl = (value: unknown) => {
  const url = (value as { url?: unknown } | null | undefined)?.url;
  return typeof url === "string" && url.startsWith("https://") ? url : null;
};

export function pickTrainResult(output: unknown): FalTrainResult {
  const data = (output ?? {}) as { diffusers_lora_file?: unknown; config_file?: unknown };
  const lora = fileUrl(data.diffusers_lora_file);
  if (!lora) throw new FalError("fal : pas de fichier LoRA dans la réponse.", 502);
  return { lora, config: fileUrl(data.config_file) };
}

export function pickGenResult(output: unknown): FalGenResult {
  const data = (output ?? {}) as { images?: unknown; seed?: unknown; has_nsfw_concepts?: unknown };
  const image = (Array.isArray(data.images) ? data.images[0] : undefined) as { url?: unknown; width?: unknown; height?: unknown } | undefined;
  const url = fileUrl(image);
  if (!url) throw new FalError("fal : pas d’image dans la réponse.", 502);
  return {
    image: url,
    width: typeof image?.width === "number" ? image.width : FAL_GEN.width,
    height: typeof image?.height === "number" ? image.height : FAL_GEN.height,
    seed: typeof data.seed === "number" ? data.seed : null,
    nsfw: Array.isArray(data.has_nsfw_concepts) && data.has_nsfw_concepts[0] === true,
  };
}

interface QueueStatus { status?: unknown; queue_position?: unknown; logs?: { message?: unknown }[] | null; error?: unknown }

export async function jobStatus<J extends FalJob>(client: FalClient, job: J, id: string): Promise<FalJobStatus<FalJobResult[J]>> {
  if (!isFalRequestId(id)) throw new FalError("Identifiant de requête invalide.", 400);
  const raw = await call<QueueStatus>(client, queueUrl(job, `/requests/${id}/status?logs=1`));
  if (raw.status === "IN_QUEUE") return { status: "IN_QUEUE", position: typeof raw.queue_position === "number" ? raw.queue_position : null };
  if (raw.status === "IN_PROGRESS") {
    const messages = (raw.logs ?? []).map(entry => entry?.message).filter((message): message is string => typeof message === "string" && !!message.trim());
    return { status: "IN_PROGRESS", log: messages.length ? messages[messages.length - 1].slice(0, 200) : null };
  }
  if (raw.status !== "COMPLETED") throw new FalError(`fal : statut inconnu (${String(raw.status)}).`, 502);
  if (raw.error) return { status: "FAILED", error: scrub(client, String(raw.error)).slice(0, 300) };
  try {
    const output = await call<unknown>(client, queueUrl(job, `/requests/${id}`));
    return { status: "COMPLETED", result: (job === "train" ? pickTrainResult(output) : pickGenResult(output)) as FalJobResult[J] };
  } catch (error) {
    if (error instanceof FalError) return { status: "FAILED", error: error.message };
    throw error;
  }
}

export interface WaitOptions<T> {
  intervalMs: number;
  timeoutMs: number;
  onStatus?: (status: FalJobStatus<T>) => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export async function waitForJob<J extends FalJob>(client: FalClient, job: J, id: string, options: WaitOptions<FalJobResult[J]>): Promise<FalJobResult[J]> {
  const { sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now } = options;
  const deadline = now() + options.timeoutMs;
  for (;;) {
    const status = await jobStatus(client, job, id);
    options.onStatus?.(status);
    if (status.status === "COMPLETED") return status.result;
    if (status.status === "FAILED") throw new FalError(`fal : ${FAL_ENDPOINTS[job]} en échec : ${status.error}`, 502);
    if (now() > deadline) throw new FalError(`fal : pas fini après ${Math.round(options.timeoutMs / 60000)} min (requête ${id}).`, 504);
    await sleep(options.intervalMs);
  }
}

// Public CDN files: downloaded without the key.
export async function downloadFile(client: FalClient, url: string): Promise<Uint8Array> {
  if (!url.startsWith("https://")) throw new FalError("Téléchargement : URL https attendue.", 400);
  const response = await sender(client)(url);
  if (!response.ok) throw new FalError(`Téléchargement refusé (${response.status}) : ${new URL(url).hostname}.`, response.status);
  return new Uint8Array(await response.arrayBuffer());
}
