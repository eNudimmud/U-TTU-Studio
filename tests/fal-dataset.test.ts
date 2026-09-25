import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { inflateRawSync } from "node:zlib";
import { checkFalDataset, inferTrigger, pickTrainingEntries } from "../src/lib/fal-dataset.ts";
import { createZip, readZip, type ZipEntry } from "../src/lib/zip.ts";
import { fakeJpeg, gateEntries } from "./fal-fixtures.ts";

const encoder = new TextEncoder();
const hasZip = spawnSync("zip", ["-v"]).status === 0;
const text = (value: string) => encoder.encode(value);
const without = (entries: ZipEntry[], ...names: string[]) => entries.filter(entry => !names.includes(entry.name));
const replace = (entries: ZipEntry[], name: string, data: Uint8Array) => entries.map(entry => (entry.name === name ? { name, data } : entry));

describe("zip reader", () => {
  it("reads back what createZip writes, byte for byte", () => {
    const entries = [{ name: "01.jpg", data: fakeJpeg(1) }, { name: "légendes.txt", data: text("é\n") }];
    const back = readZip(createZip(entries));
    assert.deepEqual(back.map(entry => entry.name), ["01.jpg", "légendes.txt"]);
    assert.deepEqual(back.map(entry => [...entry.data]), entries.map(entry => [...entry.data]));
  });

  it("detects corruption unless told to skip the CRC", () => {
    const archive = createZip([{ name: "01.txt", data: text("mira_v1, front view\n") }]);
    archive[30 + "01.txt".length + 4] ^= 0xff;
    assert.throws(() => readZip(archive), /CRC/);
    assert.equal(readZip(archive, { verifyCrc: false }).length, 1);
    assert.throws(() => readZip(text("not a zip")), /fin d’archive/);
  });

  it("reads deflated archives from zip(1) when given an inflater", { skip: !hasZip && "zip absent" }, () => {
    const dir = mkdtempSync(join(tmpdir(), "c-micro-fal-"));
    try {
      writeFileSync(join(dir, "01.txt"), "mira_v1, front view, close-up portrait, ".repeat(20));
      assert.equal(spawnSync("zip", ["-q", "-9", "-D", join(dir, "set.zip"), "01.txt"], { cwd: dir }).status, 0);
      const archive = new Uint8Array(readFileSync(join(dir, "set.zip")));
      assert.throws(() => readZip(archive), /compression/);
      const [entry] = readZip(archive, { inflateRaw: data => inflateRawSync(data) });
      assert.equal(new TextDecoder().decode(entry.data), "mira_v1, front view, close-up portrait, ".repeat(20));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("fal dataset", () => {
  const gate = gateEntries();

  it("keeps the 15 images and captions of a gate ZIP, and nothing else", () => {
    const picked = pickTrainingEntries(readZip(createZip(gate.all)));
    assert.equal(gate.verdict, "PASS");
    assert.equal(picked.length, 30);
    assert.deepEqual(picked.map(entry => entry.name).slice(0, 4), ["01.jpg", "01.txt", "02.jpg", "02.txt"]);
    assert.ok(!picked.some(entry => /RAPPORT|gate\.json|LISEZMOI|captions_comfy/.test(entry.name)));
    assert.equal(inferTrigger(picked), gate.trigger);
  });

  it("accepts the gate's shape", () => {
    const check = checkFalDataset(gate.training, gate.trigger);
    assert.deepEqual(check.problems, []);
    assert.ok(check.ok);
    assert.deepEqual(check.captions, gate.captions);
  });

  it("refuses fal's 4-image minimum: the gate asks for 15", () => {
    const four = gate.training.filter(entry => Number(entry.name.slice(0, 2)) <= 4);
    const check = checkFalDataset(four, gate.trigger);
    assert.ok(!check.ok);
    assert.match(check.problems.join("\n"), /4 images sur 15 .*pas le minimum de fal/);
  });

  it("refuses extra files, missing captions, non-JPEG images and duplicated names", () => {
    const problems = (entries: ZipEntry[]) => checkFalDataset(entries, gate.trigger).problems.join("\n");
    assert.match(problems([...gate.training, { name: "gate.json", data: text("{}") }]), /Fichiers en trop : gate\.json/);
    assert.match(problems([...gate.training, { name: "16.jpg", data: fakeJpeg(16) }]), /Fichiers en trop : 16\.jpg/);
    assert.match(problems(without(gate.training, "07.txt")), /07\.txt manque/);
    assert.match(problems(replace(gate.training, "03.jpg", text("GIF89a"))), /03\.jpg n’est pas un JPEG/);
    assert.match(problems([...gate.training, gate.training[0]]), /Noms en double : 01\.jpg/);
  });

  it("refuses captions that break the gate's format", () => {
    const problems = (name: string, caption: string) => checkFalDataset(replace(gate.training, name, text(caption)), gate.trigger).problems.join("\n");
    assert.match(problems("02.txt", "front view, grey hoodie"), /02\.txt ne commence pas par le trigger/);
    assert.match(problems("02.txt", `${gate.trigger}, ${"word ".repeat(45)}`), /02\.txt : plus de 40 mots/);
    assert.match(problems("02.txt", `${gate.trigger}, front view\nsecond line`), /une seule ligne/);
    assert.match(problems("02.txt", gate.captions[0]), /légendes? en double/);
    assert.match(checkFalDataset(gate.training, "woman").problems.join("\n"), /Trigger « woman »/);
  });
});
