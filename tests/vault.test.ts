import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { STUDIO_MODES } from "../src/lib/studio-modes.ts";
import { readZip } from "../src/lib/zip.ts";
import {
  OBSIDIAN_STEPS, STARTER_VAULT_PUBLIC, VAULT_DOCUMENTS, VAULT_FOLDERS, VAULT_MODE_MAP, VAULT_README, VAULT_ROOT,
  canonTemplate, jobsTemplate, readmeTemplate, starterVaultArchive, starterVaultEntries,
} from "../src/lib/vault.ts";

const decode = (data: Uint8Array) => new TextDecoder().decode(data);
const hasUnzip = spawnSync("unzip", ["-v"]).status === 0;

describe("vault schema", () => {
  it("keeps the canon folders and documents, in order", () => {
    assert.deepEqual(VAULT_FOLDERS.map(folder => folder.name), ["refs", "dataset", "loras", "scenes", "processes"]);
    assert.deepEqual(VAULT_DOCUMENTS.map(doc => doc.name), ["jobs.md", "CANON.md"]);
    assert.equal(VAULT_ROOT, "U-TTU-Studio");
  });

  it("maps every shell mode onto those places", () => {
    assert.deepEqual(VAULT_MODE_MAP.map(item => item.mode), STUDIO_MODES.map(mode => mode.id));
    assert.deepEqual(VAULT_MODE_MAP.map(item => item.label), STUDIO_MODES.map(mode => mode.label));
    const known = new Set([
      ...VAULT_FOLDERS.map(folder => `${folder.name}/`),
      ...VAULT_DOCUMENTS.map(doc => doc.name),
    ]);
    for (const item of VAULT_MODE_MAP) {
      assert.ok(item.places.length > 0, item.mode);
      for (const place of item.places) assert.ok(known.has(place), `${item.mode} → ${place}`);
    }
    assert.deepEqual(VAULT_MODE_MAP.find(item => item.mode === "creer")?.places, ["refs/", "dataset/"]);
    assert.deepEqual(VAULT_MODE_MAP.find(item => item.mode === "sphere")?.places, ["scenes/"]);
    assert.ok(OBSIDIAN_STEPS.some(step => /plugin/i.test(`${step.title} ${step.detail}`)));
  });
});

describe("starter vault zip", () => {
  it("packs the templates and the empty rooms", () => {
    const entries = starterVaultEntries();
    const names = entries.map(entry => entry.name);
    assert.deepEqual(names, [
      `${VAULT_ROOT}/${VAULT_README}`,
      `${VAULT_ROOT}/CANON.md`,
      `${VAULT_ROOT}/jobs.md`,
      ...VAULT_FOLDERS.map(folder => `${VAULT_ROOT}/${folder.name}/`),
    ]);
    const byName = new Map(entries.map(entry => [entry.name, entry]));
    assert.equal(decode(byName.get(`${VAULT_ROOT}/CANON.md`)!.data), canonTemplate());
    assert.match(canonTemplate(), /## Trigger/);
    assert.match(canonTemplate(), /## Invariants/);
    assert.equal(decode(byName.get(`${VAULT_ROOT}/jobs.md`)!.data), jobsTemplate());
    assert.match(jobsTemplate(), /## Modèle/);
    assert.match(jobsTemplate(), /dataset\//);
    assert.match(jobsTemplate(), /\.safetensors/);
    assert.equal(decode(byName.get(`${VAULT_ROOT}/${VAULT_README}`)!.data), readmeTemplate());
    assert.match(readmeTemplate(), /Obsidian/);
    assert.match(readmeTemplate(), /Aucun plugin/);
    for (const folder of VAULT_FOLDERS) {
      const entry = byName.get(`${VAULT_ROOT}/${folder.name}/`)!;
      assert.equal(entry.data.length, 0);
      assert.ok(entry.name.endsWith("/"));
    }
    for (const text of [canonTemplate(), jobsTemplate(), readmeTemplate()]) {
      assert.doesNotMatch(text, /https?:|fetch\(|fal\.ai/i);
    }
  });

  it("round-trips through the zip reader and matches the public file", () => {
    const built = readZip(starterVaultArchive());
    const shipped = readZip(new Uint8Array(readFileSync(STARTER_VAULT_PUBLIC)));
    assert.deepEqual(shipped.map(entry => entry.name), starterVaultEntries().map(entry => entry.name));
    assert.deepEqual(shipped.map(entry => decode(entry.data)), built.map(entry => decode(entry.data)));
    assert.deepEqual(shipped.map(entry => decode(entry.data)), starterVaultEntries().map(entry => decode(entry.data)));
  });

  it("is a valid archive with empty directories", { skip: !hasUnzip && "unzip absent" }, () => {
    const dir = mkdtempSync(join(tmpdir(), "uttu-vault-"));
    try {
      const test = spawnSync("unzip", ["-t", STARTER_VAULT_PUBLIC], { encoding: "utf8" });
      assert.equal(test.status, 0, test.stdout + test.stderr);
      const extract = spawnSync("unzip", ["-o", STARTER_VAULT_PUBLIC, "-d", dir], { encoding: "utf8" });
      assert.equal(extract.status, 0, extract.stdout + extract.stderr);
      for (const folder of VAULT_FOLDERS) {
        const listed = spawnSync("find", [join(dir, VAULT_ROOT, folder.name), "-type", "d"], { encoding: "utf8" });
        assert.equal(listed.status, 0, listed.stderr);
        assert.match(listed.stdout, new RegExp(`${folder.name}$`, "m"));
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
