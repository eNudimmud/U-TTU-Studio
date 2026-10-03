import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { describe, it } from "node:test";
import { COMFY_MEDIA_BOOT } from "../src/lib/comfy-media.ts";
import { FLUX_STACK, estimatePromptTest, estimateTrainRun } from "../src/lib/comfy-stack.ts";
import { centsToCredits, estimateTake } from "../src/lib/credits.ts";
import { RUN_GATE_JS } from "../src/lib/run-gate.ts";

type Run = { kind: string; turbo?: boolean; steps?: number };
type Estimate = { low: number; high: number } | null;
type Gate = {
  gateClassify(body: unknown): Run;
  gateEstimate(run: Run): Estimate;
  gateLabel(run: Run): string;
  gateDecide(estimate: Estimate, balance: number | null): { allow: boolean; tone: string; line: string };
  gateBalanceFrom(body: unknown): number | null;
};

function gate(): Gate {
  const context: { api?: Gate } = {};
  vm.createContext(context);
  vm.runInContext(`${RUN_GATE_JS}\nthis.api = { gateClassify, gateEstimate, gateLabel, gateDecide, gateBalanceFrom };`, context);
  return context.api!;
}

const round = (range: { low: number; high: number }) => ({ low: Math.round(range.low), high: Math.round(range.high) });

function take(turbo: boolean) {
  return JSON.stringify({
    client_id: "x",
    prompt: {
      "136": { class_type: "MiniMaxH3ReferenceToVideo", inputs: { prompt: ["138", 0] }, _meta: { title: "MiniMax H3" } },
      "146": { class_type: "PrimitiveBoolean", inputs: { value: turbo }, _meta: { title: "Boolean (Enable Lightning LoRA)" } },
      "92": { class_type: "SaveVideo", inputs: {} },
    },
  });
}

describe("lancement gardé dans le cadre", () => {
  it("names a take, a trained look and an image, and prices them like the studio", () => {
    const api = gate();
    const full = api.gateClassify(take(false));
    assert.deepEqual({ ...full }, { kind: "take", turbo: false });
    assert.deepEqual({ ...api.gateEstimate(full) }, round(estimateTake(false).credits));
    assert.equal(api.gateLabel(full), "La prise · 20 pas");
    const turbo = api.gateClassify(take(true));
    assert.deepEqual({ ...api.gateEstimate(turbo) }, round(estimateTake(true).credits));
    assert.equal(api.gateLabel(turbo), "La prise · turbo 4 pas");
    const train = api.gateClassify({ prompt: { "1": { class_type: "TrainLoraNode", inputs: { steps: 800 } }, "2": { class_type: "SaveImage", inputs: {} } } });
    assert.deepEqual({ ...train }, { kind: "train", steps: 800 });
    assert.deepEqual({ ...api.gateEstimate(train) }, round(estimateTrainRun(800, 1).credits));
    const defaulted = api.gateClassify({ prompt: { "1": { class_type: "TrainLoraNode", inputs: { steps: ["5", 0] } } } });
    assert.equal(defaulted.steps, FLUX_STACK.training.steps);
    const image = api.gateClassify({ prompt: { "9": { class_type: "SaveImage", inputs: {} } } });
    assert.deepEqual({ ...api.gateEstimate(image) }, round(estimatePromptTest().credits));
    assert.equal(api.gateEstimate(api.gateClassify("{")), null);
    assert.equal(api.gateClassify({ prompt: { "1": { class_type: "Mystery", inputs: {} } } }).kind, "other");
  });

  it("keeps Lancer off when the balance is below the low estimate", () => {
    const api = gate();
    const estimate = { low: 94, high: 281 };
    assert.deepEqual({ ...api.gateDecide(estimate, null) }, { allow: true, tone: "warn", line: "Solde non lu dans ce cadre. Vérifie-le avant de lancer." });
    assert.equal(api.gateDecide(estimate, 50).allow, false);
    assert.equal(api.gateDecide(estimate, 50).tone, "block");
    assert.equal(api.gateDecide(estimate, 120).tone, "warn");
    assert.equal(api.gateDecide(estimate, 120).allow, true);
    assert.equal(api.gateDecide(estimate, 400).tone, "ok");
    assert.equal(api.gateDecide(null, 400).allow, true);
    assert.equal(api.gateBalanceFrom({ amount_micros: 1000, currency: "usd" }), centsToCredits(1000));
    assert.equal(api.gateBalanceFrom({ amountMicros: 250 }), centsToCredits(250));
    assert.equal(api.gateBalanceFrom({ currency: "usd" }), null);
    assert.equal(api.gateBalanceFrom(null), null);
  });

  it("holds the visitor's run behind the dialog and never queues one itself", () => {
    const text = COMFY_MEDIA_BOOT;
    assert.ok(text.includes(RUN_GATE_JS), "the boot carries the same gate script");
    assert.match(text, /id = "uttu-gate"/);
    assert.match(text, /type: "uttu-credits"/);
    assert.match(text, /type: "uttu-run"/);
    assert.match(text, /postMessage\(message, location\.origin\)/);
    assert.match(text, /customers\|billing/);
    assert.match(text, /piniaStore\("auth"\)/);
    assert.doesNotMatch(text, /orig\("\/api\/prompt"|fetch\("\/api\/prompt"/);
    assert.ok(text.indexOf("gateRun(input, init).then") < text.indexOf("const pending = orig.apply(this, arguments)"));
    assert.ok(text.indexOf("if (!ok) return gateRefusal();") < text.indexOf("const sent = orig.apply(self, args)"));
    assert.match(text, /launch\.disabled = !decision\.allow/);
    assert.doesNotMatch(text, /window\.WebSocket\s*=/);
    const body = text.replace(/^<script type="module">/, "").replace(/<\/script>$/, "");
    const dir = mkdtempSync(join(tmpdir(), "uttu-boot-"));
    const file = join(dir, "boot.mjs");
    writeFileSync(file, body);
    const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    assert.equal(check.status, 0, check.stderr);
  });
});
