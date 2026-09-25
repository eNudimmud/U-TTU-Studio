import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FAL_API, FAL_ENDPOINTS, falTrainInput } from "../src/lib/fal-stack.ts";
import { createZip, readZip, type ZipEntry } from "../src/lib/zip.ts";
import { FAKE, fakeFal, gateEntries } from "./fal-fixtures.ts";

const script = fileURLToPath(new URL("../scripts/fal-smoke.mjs", import.meta.url));
const root = fileURLToPath(new URL("..", import.meta.url));
const gate = gateEntries();

// The dry run as a real process, with any network call turned into a crash.
function dryRun(archive: Uint8Array, args: string[] = [], env: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "c-micro-smoke-"));
  try {
    const zip = join(dir, `c-micro-${gate.trigger}-dataset.zip`);
    writeFileSync(zip, archive);
    const guard = join(dir, "no-network.mjs");
    writeFileSync(guard, "globalThis.fetch = () => { throw new Error(\"appel réseau pendant un dry run\"); };\n");
    const run = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "--import", pathToFileURL(guard).href, script, zip, ...args], {
      cwd: dir, encoding: "utf8", env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env },
    });
    return { status: run.status, out: `${run.stdout}${run.stderr}`, files: readdirSync(dir).sort() };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function sources(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap(name => {
    const path = join(dir, name);
    return statSync(join(root, path)).isDirectory() ? sources(path) : /\.(ts|tsx|mjs)$/.test(name) ? [path] : [];
  });
}

describe("fal smoke script", () => {
  it("dry run: checks the gate ZIP and prints the plan and budget, with no network call and no file written", () => {
    const run = dryRun(createZip(gate.all), [], { FAL_KEY: FAKE.key });
    assert.equal(run.status, 0, run.out);
    assert.match(run.out, /dry : 0 appel réseau, 0 \$/);
    assert.match(run.out, new RegExp(`gate\\.json PASS · trigger « ${gate.trigger} »`));
    assert.match(run.out, /Forme {6}OK : 15 JPEG, 15 légendes/);
    assert.match(run.out, /restent ici : captions_comfy\.txt, RAPPORT_GATE\.txt, gate\.json, LISEZMOI\.txt/);
    assert.match(run.out, /POST https:\/\/queue\.fal\.run\/fal-ai\/flux-lora-fast-training/);
    assert.match(run.out, /"trigger_word":"mira_v1","steps":1000,"create_masks":true,"is_style":false/);
    assert.match(run.out, /fal-ai\/flux-lora · force 0,75/);
    assert.match(run.out, /= 2,04 \$ \(≈ CHF 1,67\)/);
    assert.match(run.out, /non vérifié/);
    assert.match(run.out, /FAL_KEY {4}présente \(non affichée\)/);
    assert.ok(!run.out.includes(FAKE.key), "the key is never printed");
    assert.deepEqual(run.files, [`c-micro-${gate.trigger}-dataset.zip`, "no-network.mjs"]);
  });

  it("dry run refuses a ZIP that does not have the gate's shape, or a gate that is not PASS", () => {
    const four = dryRun(createZip(gate.training.slice(0, 8)));
    assert.equal(four.status, 1);
    assert.match(four.out, /ZIP refusé, rien n’est parti/);
    assert.match(four.out, /4 images sur 15/);
    const failed: ZipEntry[] = gate.all.map(entry => (entry.name === "gate.json" ? { name: entry.name, data: new TextEncoder().encode('{"verdict":"FAIL","trigger":"mira_v1"}') } : entry));
    const fail = dryRun(createZip(failed));
    assert.equal(fail.status, 1);
    assert.match(fail.out, /verdict FAIL, PASS exigé/);
  });

  it("guards --live: key required, budget capped, steps bounded", async () => {
    const smoke = await import("../scripts/fal-smoke.mjs");
    const options = smoke.parseArgs(["dataset.zip", "--live"]);
    assert.equal(options.live, true);
    assert.equal(options.steps, 1000);
    assert.match(smoke.liveBlocker(options, undefined) ?? "", /FAL_KEY/);
    assert.equal(smoke.liveBlocker(options, FAKE.key), null);
    assert.match(smoke.liveBlocker(smoke.parseArgs(["dataset.zip", "--steps", "2000"]), FAKE.key) ?? "", /au-dessus de --max-usd 3,00 \$/);
    assert.equal(smoke.liveBlocker(smoke.parseArgs(["dataset.zip", "--steps", "2000", "--max-usd", "5"]), FAKE.key), null);
    assert.throws(() => smoke.parseArgs(["dataset.zip", "--steps", "5"]), /20 à 2000/);
    assert.throws(() => smoke.parseArgs(["dataset.zip", "--budget", "9"]), /Option inconnue/);
  });

  it("live path, run against a fake fal: lean ZIP upload, subject training, LoRA download, one image at 0.75", async () => {
    const smoke = await import("../scripts/fal-smoke.mjs");
    const options = smoke.parseArgs(["dataset.zip"]);
    const prepared = smoke.prepare(createZip(gate.all), options);
    const fal = fakeFal();
    const saved = new Map<string, Uint8Array>();
    const logs: string[] = [];
    const result = await smoke.runLive(prepared, options, {
      key: FAKE.key, fetch: fal.fetch, log: (line: string) => logs.push(line),
      save: async (name: string, data: Uint8Array) => { saved.set(name, data); },
      sleep: async () => {}, now: Date.now,
    });

    assert.deepEqual([...saved.keys()], ["lora.safetensors", "config.json", "image-0.75.jpg"]);
    assert.equal(result.lora, FAKE.lora);
    const uploaded = fal.calls.find(call => call.method === "PUT")?.body as Uint8Array;
    assert.deepEqual(readZip(uploaded).map(entry => entry.name), gate.training.map(entry => entry.name).sort());
    const submits = fal.calls.filter(call => call.method === "POST" && call.url.startsWith(FAL_API.queue));
    assert.deepEqual(submits.map(call => call.url), [`${FAL_API.queue}/${FAL_ENDPOINTS.train}`, `${FAL_API.queue}/${FAL_ENDPOINTS.gen}`]);
    assert.deepEqual(submits[0].body, falTrainInput(FAKE.zipUrl, gate.trigger, 1000));
    const gen = submits[1].body as { prompt: string; loras: unknown; seed: number };
    assert.deepEqual(gen.loras, [{ path: FAKE.lora, scale: 0.75 }]);
    assert.equal(gen.prompt, `${gate.trigger}, plain grey background, soft even light`);
    assert.equal(gen.seed, 424242);
    for (const call of fal.calls) {
      const host = new URL(call.url).hostname;
      assert.equal(call.headers.authorization === `Key ${FAKE.key}`, host === "rest.fal.ai" || host === "queue.fal.run", `${call.method} ${call.url}`);
    }
    const printed = logs.join("\n");
    assert.ok(!printed.includes(FAKE.key));
    assert.ok(!printed.includes(FAKE.zipUrl), "the dataset URL is public for whoever has it: not printed");
    assert.match(printed, /entraînement : en file, position 2/);
    assert.match(printed, /Training step 500\/1000/);
  });

  it("keeps the fal key out of the static site: nothing in src/ reads FAL_KEY or imports the server-side client", () => {
    for (const file of sources("src")) {
      const text = readFileSync(join(root, file), "utf8");
      assert.doesNotMatch(text, /process\.env\.FAL_KEY|process\.env\["FAL_KEY"\]/, file);
      if (!file.endsWith("fal-api.ts")) assert.doesNotMatch(text, /from "[^"]*fal-api(\.ts)?"/, file);
    }
    const env = sources("src").flatMap(file => [...readFileSync(join(root, file), "utf8").matchAll(/process\.env\.(NEXT_PUBLIC_FAL\w*)/g)].map(match => match[1]));
    assert.deepEqual([...new Set(env)], ["NEXT_PUBLIC_FAL_PROXY_URL"]);
  });
});
