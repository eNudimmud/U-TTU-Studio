import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FalProxyError, falJobStatus, startFalGeneration, startFalTraining, type FalProxy } from "../src/lib/fal-proxy.ts";
import { FAL_API, FAL_ENDPOINTS, FAL_GEN, FAL_PRIVACY } from "../src/lib/fal-stack.ts";
import { createZip } from "../src/lib/zip.ts";
import { MIN_TOKEN_LENGTH, handle, type Env } from "../workers/fal-proxy/src/proxy.ts";
import { FAKE, fakeFal, gateEntries } from "./fal-fixtures.ts";

const ORIGIN = "https://enudimmud.github.io";
const TOKEN = "studio-access-code-0123456789abcdef";
const BASE = "https://uttu-fal-proxy.example.workers.dev";
const env: Env = { FAL_KEY: FAKE.key, ACCESS_TOKEN: TOKEN, ALLOWED_ORIGINS: ORIGIN };
const gate = gateEntries();
const arrayBuffer = (bytes: Uint8Array) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
const falZip = () => createZip(gate.training);

type Fal = ReturnType<typeof fakeFal>;
interface Options { method?: string; body?: BodyInit; headers?: Record<string, string>; origin?: string | null; token?: string | null }

function send(fal: Fal, path: string, options: Options = {}, environment: Env = env) {
  const headers = new Headers(options.headers);
  if (options.origin !== null) headers.set("Origin", options.origin ?? ORIGIN);
  if (options.token !== null) headers.set("Authorization", `Bearer ${options.token ?? TOKEN}`);
  return handle(new Request(`${BASE}${path}`, { method: options.method ?? "GET", body: options.body, headers }), environment, fal.fetch);
}

const statusPath = `/status?job=train&id=${FAKE.trainId}`;

describe("fal proxy worker", () => {
  it("answers the CORS preflight for the Pages origin and refuses other origins", async () => {
    const fal = fakeFal();
    const preflight = (origin: string) => handle(new Request(`${BASE}/train`, {
      method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization, content-type" },
    }), env, fal.fetch);
    const ok = await preflight(ORIGIN);
    assert.equal(ok.status, 204);
    assert.equal(ok.headers.get("Access-Control-Allow-Origin"), ORIGIN);
    assert.match(ok.headers.get("Access-Control-Allow-Headers") ?? "", /Authorization/);
    assert.match(ok.headers.get("Access-Control-Allow-Methods") ?? "", /POST/);
    const other = await preflight("https://evil.example");
    assert.equal(other.status, 403);
    assert.equal(other.headers.get("Access-Control-Allow-Origin"), null);
    assert.equal(fal.calls.length, 0);
  });

  it("refuses before any fal call: missing secrets, short or wrong access code, other origin, unknown route", async () => {
    const fal = fakeFal();
    assert.equal((await send(fal, statusPath, {}, { ...env, FAL_KEY: undefined })).status, 503);
    assert.equal((await send(fal, statusPath, {}, { ...env, ACCESS_TOKEN: "x".repeat(MIN_TOKEN_LENGTH - 1) })).status, 503);
    assert.equal((await send(fal, statusPath, { token: null })).status, 401);
    assert.equal((await send(fal, statusPath, { token: `${TOKEN}x` })).status, 401);
    assert.equal((await send(fal, statusPath, { origin: "https://evil.example" })).status, 403);
    assert.equal((await send(fal, "/train", { method: "GET" })).status, 404);
    assert.equal((await send(fal, "/admin")).status, 404);
    assert.equal(fal.calls.length, 0);
  });

  it("trains: rechecks the gate shape, uploads without the key, queues subject mode with the privacy headers", async () => {
    const fal = fakeFal();
    const zip = falZip();
    const response = await send(fal, `/train?trigger=${gate.trigger}&steps=1000`, { method: "POST", body: arrayBuffer(zip), headers: { "Content-Type": "application/zip" } });
    assert.equal(response.status, 202);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
    assert.deepEqual(await response.json(), { id: FAKE.trainId });

    const [initiate, put, submit, ...rest] = fal.calls;
    assert.equal(rest.length, 0);
    assert.equal(initiate.url, FAL_API.storageInitiate);
    assert.equal(initiate.headers.authorization, `Key ${FAKE.key}`);
    assert.deepEqual(initiate.body, { content_type: "application/zip", file_name: `c-micro-${gate.trigger}-fal.zip` });
    assert.deepEqual(JSON.parse(initiate.headers["x-fal-object-lifecycle"]), { expiration_duration_seconds: FAL_PRIVACY.zipExpiresSeconds });
    assert.equal(put.method, "PUT");
    assert.equal(put.url, FAKE.uploadUrl);
    assert.equal(put.headers.authorization, undefined, "the signed upload URL must never see the key");
    assert.deepEqual([...(put.body as Uint8Array)], [...zip]);
    assert.equal(submit.url, `${FAL_API.queue}/${FAL_ENDPOINTS.train}`);
    assert.equal(submit.headers.authorization, `Key ${FAKE.key}`);
    assert.deepEqual(submit.body, { images_data_url: FAKE.zipUrl, trigger_word: gate.trigger, steps: 1000, create_masks: true, is_style: false });
    assert.equal(submit.headers["x-fal-store-io"], "0");
    assert.deepEqual(JSON.parse(submit.headers["x-fal-object-lifecycle-preference"]), { expiration_duration_seconds: FAL_PRIVACY.outputsExpiresSeconds });
  });

  it("refuses what the gate would refuse, with no fal call", async () => {
    const fal = fakeFal();
    const post = (query: string, bytes: Uint8Array) => send(fal, `/train?${query}`, { method: "POST", body: arrayBuffer(bytes) });
    const four = await post(`trigger=${gate.trigger}`, createZip(gate.training.filter(entry => Number(entry.name.slice(0, 2)) <= 4)));
    assert.equal(four.status, 422);
    assert.match(((await four.json()) as { problems: string[] }).problems.join("\n"), /4 images sur 15/);
    assert.equal((await post(`trigger=${gate.trigger}`, createZip(gate.all))).status, 422, "the report and gate.json stay on the device");
    assert.equal((await post("trigger=woman", falZip())).status, 422);
    assert.equal((await post(`trigger=${gate.trigger}&steps=5000`, falZip())).status, 400);
    assert.equal((await post(`trigger=${gate.trigger}`, new TextEncoder().encode("not a zip"))).status, 400);
    assert.equal(fal.calls.length, 0);
  });

  it("follows the queue and returns the LoRA file, or the failure", async () => {
    const fal = fakeFal();
    const poll = async (path = statusPath) => (await send(fal, path)).json();
    assert.deepEqual(await poll(), { status: "IN_QUEUE", position: 2 });
    assert.deepEqual(await poll(), { status: "IN_PROGRESS", log: "Training step 500/1000" });
    assert.deepEqual(await poll(), { status: "COMPLETED", result: { lora: FAKE.lora, config: FAKE.config } });
    assert.equal((await send(fal, `/status?job=other&id=${FAKE.trainId}`)).status, 400);
    assert.equal((await send(fal, "/status?job=train&id=../../v1/keys")).status, 400);

    const failing = fakeFal({ trainStatuses: [{ status: "COMPLETED", error: "Could not read the archive" }] });
    assert.deepEqual(await (await send(failing, statusPath)).json(), { status: "FAILED", error: "Could not read the archive" });
    const empty = fakeFal({ trainStatuses: [{ status: "COMPLETED" }], trainResult: {} });
    assert.equal(((await (await send(empty, statusPath)).json()) as { status: string }).status, "FAILED");
  });

  it("renders one image per call, from a fal-hosted LoRA, whatever else the client sends", async () => {
    const fal = fakeFal();
    const gen = (body: unknown) => send(fal, "/gen", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "Content-Type": "application/json" } });
    const accepted = await gen({ lora: FAKE.lora, prompt: `${gate.trigger}, plain grey background`, scale: 0.6, seed: 424242, num_images: 8, image_size: "landscape_16_9", loras: [{ path: "x", scale: 9 }] });
    assert.equal(accepted.status, 202);
    const submit = fal.calls.find(call => call.method === "POST");
    const input = submit?.body as Record<string, unknown>;
    assert.equal(submit?.url, `${FAL_API.queue}/${FAL_ENDPOINTS.gen}`);
    assert.equal(input.num_images, 1);
    assert.deepEqual(input.image_size, { width: 1024, height: 1024 });
    assert.deepEqual(input.loras, [{ path: FAKE.lora, scale: 0.6 }]);
    assert.equal(input.enable_safety_checker, true);

    const calls = fal.calls.length;
    assert.equal((await gen({ lora: "https://evil.example/x.safetensors", prompt: "p", scale: 0.6, seed: 1 })).status, 400);
    assert.equal((await gen({ lora: FAKE.lora, prompt: "p", scale: 3, seed: 1 })).status, 400);
    assert.equal((await gen("{")).status, 400);
    assert.equal(fal.calls.length, calls);
  });

  it("turns a fal error into a 502 that never echoes the key", async () => {
    const leaky: typeof fetch = async () => new Response(JSON.stringify({ detail: `No user found for Key ${FAKE.key}` }), { status: 401 });
    const response = await handle(new Request(`${BASE}${statusPath}`, { headers: { Origin: ORIGIN, Authorization: `Bearer ${TOKEN}` } }), env, leaky);
    assert.equal(response.status, 502);
    const text = await response.text();
    assert.ok(!text.includes(FAKE.key));
    assert.match(text, /\[FAL_KEY\]/);
  });

  it("serves the UI client end to end: train, follow the queue, then the three-strength grid", async () => {
    const fal = fakeFal();
    const proxy: FalProxy = {
      url: BASE, token: TOKEN,
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("Origin", ORIGIN);
        return handle(new Request(String(input), { ...init, headers }), env, fal.fetch);
      },
    };
    const { id } = await startFalTraining(proxy, new Blob([arrayBuffer(falZip())], { type: "application/zip" }), gate.trigger, 1000);
    const seen: string[] = [];
    let lora = "";
    for (let polls = 0; polls < 5 && !lora; polls++) {
      const status = await falJobStatus(proxy, "train", id);
      seen.push(status.status);
      if (status.status === "COMPLETED") lora = status.result.lora;
    }
    assert.deepEqual(seen, ["IN_QUEUE", "IN_PROGRESS", "COMPLETED"]);
    assert.equal(lora, FAKE.lora);

    const images = await Promise.all(FAL_GEN.strengths.map(async scale => {
      const { id: genId } = await startFalGeneration(proxy, { lora, prompt: `${gate.trigger}, plain grey background`, scale, seed: 424242 });
      const status = await falJobStatus(proxy, "gen", genId);
      return status.status === "COMPLETED" ? status.result : null;
    }));
    assert.deepEqual(images.map(image => image?.image.replace(/^.*-/, "")), FAL_GEN.strengths.map(scale => `${scale}.jpg`));
    assert.ok(images.every(image => image?.width === 1024 && image.nsfw === false));

    await assert.rejects(
      startFalTraining(proxy, new Blob([arrayBuffer(createZip(gate.training.slice(0, 8)))]), gate.trigger, 1000),
      (error: unknown) => error instanceof FalProxyError && error.status === 422 && error.problems.some(problem => /4 images sur 15/.test(problem)),
    );
    await assert.rejects(falJobStatus({ ...proxy, token: "wrong" }, "train", id), (error: unknown) => error instanceof FalProxyError && error.status === 401);
    assert.ok(!fal.calls.some(call => call.headers.authorization?.includes(TOKEN)), "the access code stays between the browser and the proxy");
  });
});
