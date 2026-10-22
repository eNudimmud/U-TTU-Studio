import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { runStem } from "../src/lib/creation/stem.ts";
import { runStill } from "../src/lib/creation/still.ts";
import { RenderError, type RenderClient } from "../src/lib/render/client.ts";
import { followTake } from "../src/lib/render/run.ts";

// Rule: the studio never cancels a Comfy job. Interrupting only stops waiting on this device.
function cloud(controller: AbortController) {
  const calls: string[] = [];
  const client = {
    async upload() { calls.push("upload"); return "photo.png"; },
    async submit() { calls.push("submit"); controller.abort(); return "job-0123456789"; },
    async status() { calls.push("status"); return "executing"; },
    async job() { return { status: "executing", outputs: {} }; },
    async file() { calls.push("file"); return new Blob(["x"]); },
    async balance() { calls.push("balance"); return 100; },
    async cancel() { calls.push("cancel"); },
    async user() { return {}; },
  } as unknown as RenderClient;
  return { client, calls };
}
const stopped = (error: unknown) => error instanceof RenderError && error.code === "cancelled" && /continue chez Comfy/.test(error.message);
const fast = { sleep: async () => {}, now: () => 0, pollMs: 0 };

describe("on n'annule jamais un job Comfy", () => {
  it("still, stem and take stop waiting locally without any cancel call", async () => {
    const still = new AbortController(); const a = cloud(still);
    await assert.rejects(runStill(a.client, { kind: "texte-decor", prompt: "Un quai", pictures: [], seed: 1, clientId: "c", balanceBefore: 100 }, { ...fast, signal: still.signal }), stopped);
    assert.deepEqual(a.calls, ["submit"]);
    const stem = new AbortController(); const b = cloud(stem);
    await assert.rejects(runStem(b.client, { kind: "voix", text: "Bonjour.", seed: 1, clientId: "c", balanceBefore: 100 }, { ...fast, signal: stem.signal }), stopped);
    assert.deepEqual(b.calls, ["submit"]);
    const take = new AbortController(); take.abort(); const c = cloud(take);
    await assert.rejects(followTake(c.client, "job-0123456789", 100, () => {}, { ...fast, signal: take.signal }), stopped);
    assert.equal(c.calls.includes("cancel"), false);
  });

  it("no studio source calls a render client's cancel or deletes from the Comfy queue", () => {
    const files = (dir: string): string[] => readdirSync(dir).flatMap(name => { const p = join(dir, name); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(p) ? [p] : []; });
    const hits = files("src").flatMap(path => readFileSync(path, "utf8").split("\n").map((line, i) => ({ path, i, line })))
      .filter(({ line }) => /\b(client|render|renderClient|cloud)\??\.cancel\(|delete\s*:\s*\[/.test(line))
      .map(({ path, i, line }) => `${path}:${i + 1} ${line.trim()}`);
    assert.deepEqual(hits, []);
  });
});
