import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { COMFY_APPS } from "../src/lib/comfy-stack.ts";
import { buildManifest, buildReadme, buildReport, captionsBlock } from "../src/lib/gate/report.ts";
import { evaluateGate } from "../src/lib/gate/rules.ts";
import { crc32, createZip } from "../src/lib/zip.ts";
import { cleanInput } from "./fixtures.ts";

const encoder = new TextEncoder();
const hasUnzip = spawnSync("unzip", ["-v"]).status === 0;

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    assert.equal(crc32(encoder.encode("123456789")), 0xcbf43926);
    assert.equal(crc32(new Uint8Array()), 0);
  });

  it("writes a well-formed stored archive", () => {
    const archive = createZip([{ name: "a.txt", data: encoder.encode("abc") }, { name: "légendes.txt", data: encoder.encode("é\n") }], new Date(2026, 8, 24, 12, 30));
    const view = new DataView(archive.buffer);
    assert.equal(view.getUint32(0, true), 0x04034b50);
    const end = archive.length - 22;
    assert.equal(view.getUint32(end, true), 0x06054b50);
    assert.equal(view.getUint16(end + 10, true), 2);
    const directoryOffset = view.getUint32(end + 16, true);
    assert.equal(view.getUint32(directoryOffset, true), 0x02014b50);
  });

  it("is accepted by unzip -t", { skip: !hasUnzip && "unzip absent" }, () => {
    const dir = mkdtempSync(join(tmpdir(), "c-micro-zip-"));
    try {
      const payload = new Uint8Array(70000).map((_, i) => (i * 31) % 251);
      const path = join(dir, "dataset.zip");
      writeFileSync(path, createZip([{ name: "01.jpg", data: payload }, { name: "01.txt", data: encoder.encode("mira_v1, front view\n") }]));
      const test = spawnSync("unzip", ["-t", path], { encoding: "utf8" });
      assert.equal(test.status, 0, test.stdout + test.stderr);
      assert.match(test.stdout, /No errors detected/);
      assert.equal(spawnSync("unzip", ["-o", "-q", path, "-d", dir]).status, 0);
      assert.deepEqual(new Uint8Array(readFileSync(join(dir, "01.jpg"))), payload);
      assert.equal(readFileSync(join(dir, "01.txt"), "utf8"), "mira_v1, front view\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("gate report", () => {
  const input = cleanInput();
  const result = evaluateGate(input);
  const date = new Date(2026, 8, 24, 21, 5);

  it("documents the verdict, every check and every caption in slot order", () => {
    const report = buildReport(input, result, date);
    assert.match(report, /Verdict : PASS/);
    assert.match(report, /2026-09-24 à 21:05/);
    for (const check of result.checks) assert.ok(report.includes(`${check.id}  ${check.label}`), check.id);
    assert.ok(report.includes(`01  ${result.kept[0].name}`));
    for (const caption of result.captions) assert.ok(report.includes(caption));
  });

  it("gives the exact next steps with the App Mode link and honest estimates", () => {
    const readme = buildReadme(800, 4);
    assert.ok(readme.includes(COMFY_APPS.train.url));
    assert.match(readme, /Test à blanc : « Étapes d’entraînement » = 20/);
    assert.match(readme, /crédits \(≈ \d+\.\d{2}–\d+\.\d{2} \$\)/);
    assert.match(readme, /Estimations non mesurées/);
  });

  it("exports one caption line per image for the Comfy captions field", () => {
    const block = captionsBlock(result.captions);
    assert.equal(block.split("\n").length, 15);
    assert.ok(!block.endsWith("\n"));
    const manifest = buildManifest(input, result, date);
    assert.deepEqual(manifest.images.map(item => item.slot), Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(2, "0")));
    assert.equal(manifest.verdict, "PASS");
  });
});
