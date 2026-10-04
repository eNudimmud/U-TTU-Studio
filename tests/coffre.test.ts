import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coffreEntries } from "../src/lib/coffre/export.ts";
import { readFrontmatter, withFrontmatter } from "../src/lib/coffre/markdown.ts";
import {
  canonMarkdown, cleanTraits, loadStudio, lookCheck, loraMarkdown, parseCanon, parseLora, parseTake, parseTraits, removeLora, removeTake, sha256Hex, slugify, takeId, takeMarkdown, uniqueId,
  writeBlob, writeClips, writeLook, writeLora, writeScene, writeState, writeTake, type Lora, type Take,
} from "../src/lib/coffre/model.ts";
import { cleanPath, memoryVault } from "../src/lib/coffre/store.ts";
import { readZip } from "../src/lib/zip.ts";

const take = (patch: Partial<Take> = {}): Take => ({
  id: "20261003-153000-le-quai",
  at: "2026-10-03T15:30:00.000Z",
  sceneId: "le-quai",
  sceneName: "Le quai",
  line: "Elle traverse le quai.",
  settings: { seconds: 5, quality: "rapide", aspect: "vertical" },
  profile: "h3-4pas-5s-vertical",
  jobId: "0f6c1b1e-8d47-4f39-9e16-5f5d0f0b9a11",
  video: "prises/20261003-153000-le-quai.mp4",
  poster: "prises/20261003-153000-le-quai.jpg",
  prompt: "<Picture 1> shows the same person.",
  gpuSeconds: 140,
  costCredits: 201,
  balanceBefore: 5001,
  balanceAfter: 4800,
  engine: "comfy",
  loraId: null,
  resolution: null,
  costUsd: null,
  costSource: null,
  ...patch,
});

describe("coffre en markdown", () => {
  it("writes frontmatter Obsidian reads, and reads it back", () => {
    const text = withFrontmatter({ type: "look", nom: "Mira: « v1 »", traits: ["yeux verts", "taches"], photos: [], vide: null, n: 3, ok: true }, "# Mira\n");
    assert.match(text, /^---\ntype: "look"\nnom: "Mira: « v1 »"\ntraits:\n  - "yeux verts"\n  - "taches"\nphotos:\nvide: null\nn: 3\nok: true\n---\n/);
    const back = readFrontmatter(text);
    assert.deepEqual(back.fields, { type: "look", nom: "Mira: « v1 »", traits: ["yeux verts", "taches"], photos: [], vide: null, n: 3, ok: true });
    assert.equal(back.body, "# Mira\n");
    assert.deepEqual(readFrontmatter("pas de frontmatter").fields, {});
  });

  it("keeps the look, its traits and its photos in CANON.md", () => {
    const look = { name: "Mira", traits: ["yeux verts", "taches de rousseur"], photos: ["refs/look-a-1.jpg", "refs/look-a-2.jpg"], note: "Toujours la capuche." };
    const text = canonMarkdown(look);
    assert.match(text, /!\[\[refs\/look-a-1\.jpg\]\]/);
    assert.deepEqual(parseCanon(text), look);
    assert.deepEqual(lookCheck(look), { ready: true, photos: true, name: true, traits: true });
    assert.equal(lookCheck({ ...look, photos: ["refs/a.jpg"] }).ready, false);
    assert.equal(lookCheck({ ...look, traits: ["yeux verts"] }).ready, false);
    assert.deepEqual(parseTraits("yeux verts, Yeux verts ; cicatrice\n"), ["yeux verts", "cicatrice"]);
    assert.equal(cleanTraits(Array.from({ length: 12 }, (_, index) => `trait ${index}`)).length, 8);
  });

  it("keeps a take's plan, setting, job and measured cost", () => {
    const text = takeMarkdown(take());
    assert.match(text, /!\[\[prises\/20261003-153000-le-quai\.mp4\]\]/);
    assert.match(text, /cout_credits: 201/);
    assert.deepEqual(parseTake("20261003-153000-le-quai", text), take());
    assert.equal(parseTake("x", "---\ntype: \"prise\"\n---\n"), null);
  });

  it("names files safely", () => {
    assert.equal(slugify("Le Quai, la nuit !"), "le-quai-la-nuit");
    assert.equal(slugify("   "), "lieu");
    assert.equal(uniqueId("quai", ["quai", "quai-2"]), "quai-3");
    assert.equal(takeId(new Date(2026, 9, 3, 15, 30, 0), "Le Quai"), "20261003-153000-le-quai");
    assert.equal(cleanPath("prises/a.mp4"), "prises/a.mp4");
    assert.equal(cleanPath(".uttu/etat.json"), ".uttu/etat.json");
    for (const bad of ["../x", "/abs", "a//b", "prises/../x", "a/b/c/d/e", ""]) assert.equal(cleanPath(bad), null, bad);
  });

  it("loads the studio from the vault and exports it as an Obsidian folder", async () => {
    const store = memoryVault();
    await writeBlob(store, "refs/look-a-1.jpg", new Blob(["p1"], { type: "image/jpeg" }));
    await writeBlob(store, "refs/look-a-2.jpg", new Blob(["p2"], { type: "image/jpeg" }));
    await writeLook(store, { name: "Mira", traits: ["yeux verts", "taches"], photos: ["refs/look-a-1.jpg", "refs/look-a-2.jpg", "refs/missing.jpg"], note: "" });
    await writeScene(store, { id: "le-quai", name: "Le quai", note: "pluie fine", stills: [], previz: null, previzFile: null, render: null });
    await writeScene(store, { id: "la-serre", name: "La serre", note: "", stills: [], previz: null, previzFile: null, render: null });
    await writeState(store, "la-serre");
    await writeBlob(store, take().video, new Blob(["mp4"], { type: "video/mp4" }));
    await writeTake(store, take(), [take()]);
    const studio = await loadStudio(store);
    assert.deepEqual(studio.look.photos, ["refs/look-a-1.jpg", "refs/look-a-2.jpg"], "a photo missing from the vault is dropped");
    assert.deepEqual(studio.scenes.map(scene => scene.id).sort(), ["la-serre", "le-quai"]);
    assert.equal(studio.currentScene, "la-serre");
    assert.deepEqual(studio.role, { name: "", photos: [] });
    assert.equal(studio.takes.length, 1);
    assert.equal(studio.takes[0].costCredits, 201);
    assert.equal(studio.takes[0].poster, null, "a frame missing from the vault is not pointed at");
    await writeBlob(store, take().poster!, new Blob(["jpg"], { type: "image/jpeg" }));
    assert.equal((await loadStudio(store)).takes[0].poster, take().poster);
    const jobs = (await store.get("jobs.md"))?.text ?? "";
    assert.match(jobs, /\| 2026-10-03 15:30 \| \[\[prises\/20261003-153000-le-quai\]\] \| Comfy \| h3-4pas-5s-vertical \| 140 \| 201 cr\. \|/);
    const entries = await coffreEntries(store);
    const names = entries.map(entry => entry.name);
    for (const name of ["U-TTU-Studio/CANON.md", "U-TTU-Studio/README.md", "U-TTU-Studio/jobs.md", "U-TTU-Studio/refs/look-a-1.jpg", "U-TTU-Studio/scenes/le-quai.md", "U-TTU-Studio/prises/20261003-153000-le-quai.mp4", "U-TTU-Studio/prises/20261003-153000-le-quai.md"]) {
      assert.ok(names.includes(name), name);
    }
    assert.equal(names.filter(name => name.endsWith("README.md")).length, 1);
    assert.equal(names.some(name => /rendu|key|cle/i.test(name)), false, "the render link never enters the vault");
    await removeTake(store, take(), []);
    assert.equal((await loadStudio(store)).takes.length, 0);
    assert.equal(await store.get(take().poster!), null);
  });

  it("keeps a trained double next to the takes, and never a key", async () => {
    const trained: Lora = {
      id: "20261003-160000-mira",
      at: "2026-10-03T16:00:00.000Z",
      name: "Mira",
      trigger: "mira_uttu",
      file: "loras/20261003-160000-mira.safetensors",
      bytes: 4,
      sha256: "ab",
      steps: 1000,
      rank: 16,
      aspect: "9:16",
      clips: 10,
      endpoint: "minimax/h3/ref2va/trainer",
      requestId: "req-12345678",
      seconds: 400,
      costUsd: 15,
      costSource: "billing",
      balanceBefore: 40,
      balanceAfter: 25,
    };
    assert.deepEqual(parseLora(trained.id, loraMarkdown(trained)), trained);
    const store = memoryVault();
    const weights = new Blob(["lora"]);
    await writeBlob(store, "clips/clip-a.mp4", new Blob(["mp4"]));
    await writeClips(store, [{ path: "clips/clip-a.mp4", format: "mp4", bytes: 3, seconds: 4, width: 720, height: 1280 }]);
    await writeLora(store, trained, weights, [], [trained]);
    const studio = await loadStudio(store);
    assert.equal(studio.loras.length, 1);
    assert.equal(studio.loras[0].trigger, "mira_uttu");
    assert.equal(studio.clips.length, 1);
    assert.equal(await sha256Hex(weights), await sha256Hex((await store.get(trained.file))?.blob ?? new Blob()));
    const jobs = (await store.get("jobs.md"))?.text ?? "";
    assert.match(jobs, /\[\[loras\/20261003-160000-mira\]\] \| fal \| lora-1000pas-rang16 \| 400 \| 15\.00 \$/);
    const names = (await coffreEntries(store)).map(entry => entry.name).join("\n");
    assert.match(names, /loras\/20261003-160000-mira\.safetensors/);
    assert.doesNotMatch(names, /u-ttu-fal|fal-key/);
    await removeLora(store, trained, [], []);
    assert.equal((await loadStudio(store)).loras.length, 0);
  });

  it("produces a ZIP the reader opens", async () => {
    const store = memoryVault();
    await writeLook(store, { name: "Mira", traits: [], photos: [], note: "" });
    const { createZip } = await import("../src/lib/zip.ts");
    const archive = createZip(await coffreEntries(store), new Date(2026, 9, 3, 12, 0, 0));
    const files = readZip(archive).map(entry => entry.name);
    assert.ok(files.includes("U-TTU-Studio/CANON.md"));
  });
});
