import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { describe, it } from "node:test";
import { COMFY_MEDIA_BOOT } from "../src/lib/comfy-media.ts";
import { centsToCredits } from "../src/lib/credits.ts";
import { RUN_GATE_JS } from "../src/lib/run-gate.ts";

type Gate = {
  gateLabel(body: unknown): string;
  gateDecide(balance: number | null): { allow: boolean; tone: string; line: string };
  gateBalanceFrom(body: unknown): number | null;
};

function gate(): Gate {
  const context: { api?: Gate } = {};
  vm.createContext(context);
  vm.runInContext(`${RUN_GATE_JS}\nthis.api = { gateLabel, gateDecide, gateBalanceFrom };`, context);
  return context.api!;
}

describe("lancement gardé dans une page Comfy", () => {
  it("names the run and quotes no uncalibrated number", () => {
    const api = gate();
    assert.equal(api.gateLabel(JSON.stringify({ prompt: { a: { class_type: "MiniMaxH3ReferenceToVideo", inputs: {} } } })), "Une prise vidéo");
    assert.equal(api.gateLabel({ prompt: { a: { class_type: "SaveImage", inputs: {} } } }), "Une image");
    assert.equal(api.gateLabel("{"), "Ce rendu");
    const unknown = api.gateDecide(null);
    assert.equal(unknown.allow, true);
    assert.match(unknown.line, /non calibré/);
    const empty = api.gateDecide(0);
    assert.equal(empty.allow, false);
    const read = api.gateDecide(8862);
    assert.equal(read.allow, true);
    assert.match(read.line, /8.862 crédits/);
    assert.doesNotMatch(`${unknown.line}${read.line}`, /Estimation|à \d/);
    assert.equal(api.gateBalanceFrom({ amount_micros: 1000 }), centsToCredits(1000));
    assert.equal(api.gateBalanceFrom({ amountMicros: 250 }), centsToCredits(250));
    assert.equal(api.gateBalanceFrom({ currency: "usd" }), null);
    assert.equal(api.gateBalanceFrom(null), null);
  });

  it("holds the visitor's run behind the dialog, never queues one itself, and parses as a module", () => {
    const text = COMFY_MEDIA_BOOT;
    assert.ok(text.includes(RUN_GATE_JS), "the boot carries the same gate script");
    assert.match(text, /id = "uttu-gate"/);
    assert.match(text, /type: "uttu-credits"/);
    assert.match(text, /postMessage\(message, location\.origin\)/);
    assert.match(text, /customers\|billing/);
    assert.match(text, /piniaStore\("auth"\)/);
    assert.doesNotMatch(text, /orig\("\/api\/prompt"|fetch\("\/api\/prompt"/);
    assert.ok(text.indexOf("gateRun(input, init).then") < text.indexOf("const pending = orig.apply(this, arguments)"));
    assert.ok(text.indexOf("if (!ok) return gateRefusal();") < text.indexOf("const sent = orig.apply(self, args)"));
    assert.match(text, /launch\.disabled = !decision\.allow/);
    assert.doesNotMatch(text, /window\.WebSocket\s*=/);
    const dir = mkdtempSync(join(tmpdir(), "uttu-boot-"));
    const file = join(dir, "boot.mjs");
    writeFileSync(file, COMFY_MEDIA_BOOT.replace(/^<script type="module">/, "").replace(/<\/script>$/, ""));
    const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    assert.equal(check.status, 0, check.stderr);
  });
});
