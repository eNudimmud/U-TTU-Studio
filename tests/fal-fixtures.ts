import { FAL_API, FAL_ENDPOINTS } from "../src/lib/fal-stack.ts";
import { buildManifest, buildReadme, buildReport, captionsBlock, slot } from "../src/lib/gate/report.ts";
import { evaluateGate } from "../src/lib/gate/rules.ts";
import type { ZipEntry } from "../src/lib/zip.ts";
import { cleanInput } from "./fixtures.ts";

const encoder = new TextEncoder();

export const fakeJpeg = (n: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 96 }, (_, i) => (i * 31 + n * 7) % 251), 0xff, 0xd9]);

// Same file set as buildDatasetZip on a PASS, with stand-in JPEG bytes (the real ones come from a canvas).
export function gateEntries() {
  const input = cleanInput();
  const result = evaluateGate(input);
  const date = new Date(2026, 8, 25, 10, 0);
  const training: ZipEntry[] = result.kept.flatMap((_, i) => [
    { name: `${slot(i)}.jpg`, data: fakeJpeg(i + 1) },
    { name: `${slot(i)}.txt`, data: encoder.encode(`${result.captions[i]}\n`) },
  ]);
  const all: ZipEntry[] = [
    ...training,
    { name: "captions_comfy.txt", data: encoder.encode(captionsBlock(result.captions)) },
    { name: "RAPPORT_GATE.txt", data: encoder.encode(buildReport(input, result, date)) },
    { name: "gate.json", data: encoder.encode(`${JSON.stringify(buildManifest(input, result, date), null, 2)}\n`) },
    { name: "LISEZMOI.txt", data: encoder.encode(buildReadme()) },
  ];
  return { trigger: input.trigger, verdict: result.verdict, captions: result.captions, training, all };
}

export const FAKE = {
  key: "fal-key-for-tests-only-0123456789",
  uploadUrl: "https://v3.fal.media/files/upload/signed?sig=abc",
  zipUrl: "https://v3.fal.media/files/test/c-micro-mira_v1-fal.zip",
  trainId: "train-0001-0000-0000-000000000001",
  lora: "https://v3.fal.media/files/test/pytorch_lora_weights.safetensors",
  config: "https://v3.fal.media/files/test/config.json",
} as const;

export interface FalCall { method: string; url: string; headers: Record<string, string>; body: unknown }

type Json = Record<string, unknown>;

// In-process stand-in for fal: any URL it does not know fails the test instead of reaching the network.
export function fakeFal({ trainStatuses = [
  { status: "IN_QUEUE", queue_position: 2 },
  { status: "IN_PROGRESS", logs: [{ message: "Preprocessing images" }, { message: "Training step 500/1000" }] },
  { status: "COMPLETED", logs: [{ message: "Done" }] },
] as Json[], trainResult = { diffusers_lora_file: { url: FAKE.lora, file_name: "pytorch_lora_weights.safetensors" }, config_file: { url: FAKE.config } } as Json } = {}) {
  const calls: FalCall[] = [];
  let trainPolls = 0;
  let gens = 0;
  const genScale = new Map<string, number>();
  const queue = (job: keyof typeof FAL_ENDPOINTS) => `${FAL_API.queue}/${FAL_ENDPOINTS[job]}`;
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

  const fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    const method = (init.method ?? "GET").toUpperCase();
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    calls.push({ method, url, headers, body });

    if (method === "POST" && url === FAL_API.storageInitiate) return json({ upload_url: FAKE.uploadUrl, file_url: FAKE.zipUrl });
    if (method === "PUT" && url === FAKE.uploadUrl) return new Response(null, { status: 200 });
    if (method === "POST" && url === queue("train")) return json({ request_id: FAKE.trainId, status_url: `${queue("train")}/requests/${FAKE.trainId}/status` });
    if (method === "GET" && url === `${queue("train")}/requests/${FAKE.trainId}/status?logs=1`) return json(trainStatuses[Math.min(trainPolls++, trainStatuses.length - 1)]);
    if (method === "GET" && url === `${queue("train")}/requests/${FAKE.trainId}`) return json(trainResult);
    if (method === "POST" && url === queue("gen")) {
      const id = `gen-${String(++gens).padStart(4, "0")}-0000-0000-000000000000`;
      genScale.set(id, (body as { loras: { scale: number }[] }).loras[0].scale);
      return json({ request_id: id });
    }
    const gen = new RegExp(`^${queue("gen")}/requests/(gen-[0-9-]+)(/status\\?logs=1)?$`).exec(url);
    if (method === "GET" && gen) {
      if (gen[2]) return json({ status: "COMPLETED", logs: [] });
      return json({ images: [{ url: `https://v3.fal.media/files/test/${gen[1]}-${genScale.get(gen[1])}.jpg`, width: 1024, height: 1024 }], seed: 424242, has_nsfw_concepts: [false] });
    }
    if (method === "GET" && url.startsWith("https://v3.fal.media/files/test/")) return new Response(encoder.encode(`bytes of ${url}`));
    throw new Error(`Appel réseau inattendu : ${method} ${url}`);
  };
  return { fetch: fetch as typeof globalThis.fetch, calls };
}
