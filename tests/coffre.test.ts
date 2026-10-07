import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coffreEntries, coffreZip } from "../src/lib/coffre/export.ts";
import { mergeCoffreZip, vaultPathFromZip } from "../src/lib/coffre/import.ts";
import { readFrontmatter, withFrontmatter } from "../src/lib/coffre/markdown.ts";
import {
  canonMarkdown, cleanTraits, createProject, loadStudio, lookCheck, loraMarkdown, parseCanon, parseLora, parseTake, parseTraits, removeLora, removeScene, removeTake, sceneMarkdown, selectProject, sha256Hex, slugify, takeId, takeMarkdown, uniqueId,
  writeBlob, writeClips, writeLook, writeLora, writeScene, writeState, writeTake, writeText, type Lora, type Scene, type Take,
} from "../src/lib/coffre/model.ts";
import { cleanPath, memoryVault } from "../src/lib/coffre/store.ts";
import { createZip, readZip } from "../src/lib/zip.ts";

const take = (patch: Partial<Take> = {}): Take => ({
  id: "20261003-153000-le-quai",
  at: "2026-10-03T15:30:00.000Z",
  sceneId: "le-quai",
  sceneName: "Le quai",
  line: "Elle traverse le quai.",
  settings: { seconds: 5, quality: "rapide", aspect: "vertical" },
  profile: "h3-4pas-5s-vertical",
  jobId: "0f6c1b1e-8d47-4f39-9e16-5f5d0f0b9a11",
  video: "Projets/atelier/Prises/20261003-153000-le-quai.mp4",
  poster: "Projets/atelier/Prises/20261003-153000-le-quai.jpg",
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
    const look = { name: "Mira", traits: ["yeux verts", "taches de rousseur"], photos: ["Projets/atelier/Refs/look-a-1.jpg", "Projets/atelier/Refs/look-a-2.jpg"], note: "Toujours la capuche." };
    const text = canonMarkdown(look, "atelier");
    assert.match(text, /!\[\[Projets\/atelier\/Refs\/look-a-1\.jpg\]\]/);
    assert.equal(readFrontmatter(text).fields.type, "personnage");
    assert.equal(readFrontmatter(text).fields.projet, "atelier");
    assert.equal(readFrontmatter(text).fields.gesture, "personnage");
    assert.deepEqual(parseCanon(text), look);
    assert.deepEqual(lookCheck(look), { ready: true, photos: true, name: true, traits: true });
    assert.equal(lookCheck({ ...look, photos: ["refs/a.jpg"] }).ready, false);
    assert.equal(lookCheck({ ...look, traits: ["yeux verts"] }).ready, false);
    assert.deepEqual(parseTraits("yeux verts, Yeux verts ; cicatrice\n"), ["yeux verts", "cicatrice"]);
    assert.equal(cleanTraits(Array.from({ length: 12 }, (_, index) => `trait ${index}`)).length, 8);
  });

  it("keeps a take's plan, setting, job and measured cost", () => {
    const text = takeMarkdown(take());
    assert.match(text, /!\[\[Projets\/atelier\/Prises\/20261003-153000-le-quai\.mp4\]\]/);
    assert.match(text, /cout_credits: 201/);
    assert.match(text, /moteur: "comfy"/);
    assert.equal(parseTake("20261003-153000-le-quai", takeMarkdown(take({ engine: "lora", loraId: "mira" })))?.engine, "lora");
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
    assert.equal(cleanPath("Projets/atelier/_MOC.md"), "Projets/atelier/_MOC.md");
    assert.equal(cleanPath("Projets/atelier/Lieux/le-quai.md"), "Projets/atelier/Lieux/le-quai.md");
    for (const bad of ["../x", "/abs", "a//b", "prises/../x", "a/b/c/d/e", ""]) assert.equal(cleanPath(bad), null, bad);
  });

  it("loads the studio from the vault and exports it as an Obsidian folder", async () => {
    const store = memoryVault();
    await writeBlob(store, "Projets/atelier/Refs/look-a-1.jpg", new Blob(["p1"], { type: "image/jpeg" }));
    await writeBlob(store, "Projets/atelier/Refs/look-a-2.jpg", new Blob(["p2"], { type: "image/jpeg" }));
    await writeLook(store, { name: "Mira", traits: ["yeux verts", "taches"], photos: ["Projets/atelier/Refs/look-a-1.jpg", "Projets/atelier/Refs/look-a-2.jpg", "Projets/atelier/Refs/missing.jpg"], note: "" });
    await writeScene(store, { id: "le-quai", name: "Le quai", note: "pluie fine", stills: [], previz: null, previzFile: null, camera: null, frames: [], render: null, shot: null, views: [] });
    await writeScene(store, { id: "la-serre", name: "La serre", note: "", stills: [], previz: null, previzFile: null, camera: null, frames: [], render: null, shot: null, views: [] });
    await writeState(store, "la-serre");
    await writeBlob(store, take().video, new Blob(["mp4"], { type: "video/mp4" }));
    await writeTake(store, take(), [take()]);
    const studio = await loadStudio(store);
    assert.equal(studio.project, "atelier");
    assert.deepEqual(studio.look.photos, ["Projets/atelier/Refs/look-a-1.jpg", "Projets/atelier/Refs/look-a-2.jpg"], "a photo missing from the vault is dropped");
    assert.deepEqual(studio.scenes.map(scene => scene.id).sort(), ["la-serre", "le-quai"]);
    assert.equal(studio.currentScene, "la-serre");
    assert.deepEqual(studio.role, { name: "", photos: [] });
    assert.equal(studio.takes.length, 1);
    assert.equal(studio.takes[0].costCredits, 201);
    assert.equal(studio.takes[0].poster, null, "a frame missing from the vault is not pointed at");
    await writeBlob(store, take().poster!, new Blob(["jpg"], { type: "image/jpeg" }));
    assert.equal((await loadStudio(store)).takes[0].poster, take().poster);
    const jobs = (await store.get("Projets/atelier/Journal.md"))?.text ?? "";
    assert.match(jobs, /\| 2026-10-03 15:30 \| \[\[Projets\/atelier\/Prises\/20261003-153000-le-quai\]\] \| Comfy \| h3-4pas-5s-vertical \| 140 \| 201 cr\. \|/);
    const entries = await coffreEntries(store);
    const names = entries.map(entry => entry.name);
    for (const name of ["U-TTU-Studio/Projets/atelier/Cast/canon.md", "U-TTU-Studio/README.md", "U-TTU-Studio/Projets/atelier/Journal.md", "U-TTU-Studio/Projets/atelier/Refs/look-a-1.jpg", "U-TTU-Studio/Projets/atelier/Lieux/le-quai.md", "U-TTU-Studio/Projets/atelier/Prises/20261003-153000-le-quai.mp4", "U-TTU-Studio/Projets/atelier/Prises/20261003-153000-le-quai.md", "U-TTU-Studio/MOC.md"]) {
      assert.ok(names.includes(name), name);
    }
    assert.equal(names.some(name => name.endsWith("/CANON.md") || name.endsWith("/jobs.md")), false);
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
      kind: "personnage",
      sceneId: null,
      trigger: "mira_uttu",
      file: "Projets/atelier/Assets/20261003-160000-mira.safetensors",
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
    await writeBlob(store, "Projets/atelier/Assets/clip-a.mp4", new Blob(["mp4"]));
    await writeClips(store, [{ path: "Projets/atelier/Assets/clip-a.mp4", format: "mp4", bytes: 3, seconds: 4, width: 720, height: 1280 }]);
    await writeLora(store, trained, weights, [], [trained]);
    const studio = await loadStudio(store);
    assert.equal(studio.loras.length, 1);
    assert.equal(studio.loras[0].trigger, "mira_uttu");
    assert.equal(studio.clips.length, 1);
    assert.equal(await sha256Hex(weights), await sha256Hex((await store.get(trained.file))?.blob ?? new Blob()));
    const jobs = (await store.get("Projets/atelier/Journal.md"))?.text ?? "";
    assert.match(jobs, /\[\[Projets\/atelier\/Cast\/20261003-160000-mira\]\] \| fal \| lora-1000pas-rang16 \| 400 \| 15\.00 \$/);
    const names = (await coffreEntries(store)).map(entry => entry.name).join("\n");
    assert.match(names, /Assets\/20261003-160000-mira\.safetensors/);
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
    assert.ok(files.includes("U-TTU-Studio/Projets/atelier/Cast/canon.md"));
    assert.ok(files.includes("U-TTU-Studio/MOC.md"));
    assert.ok(files.includes("U-TTU-Studio/Projets/atelier/Moteurs/references.md"));
    const moteur = new TextDecoder().decode(readZip(archive).find(entry => entry.name.endsWith("Moteurs/references.md"))?.data ?? new Uint8Array());
    assert.match(moteur, /type: "moteur"/);
    assert.doesNotMatch(moteur, /class_type|SaveLoRA|LoadImage/);
  });

  it("maps the coffre with wikilinks and merges a ZIP without dropping what is already here", async () => {
    const trained: Lora = {
      id: "20261003-160000-mira",
      at: "2026-10-03T16:00:00.000Z",
      name: "Mira",
      kind: "personnage",
      sceneId: null,
      trigger: "mira_uttu",
      file: "Projets/atelier/Assets/20261003-160000-mira.safetensors",
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
    const here = take();
    const elsewhere = take({
      id: "20261004-090000-la-serre",
      at: "2026-10-04T09:00:00.000Z",
      sceneId: "la-serre",
      sceneName: "La serre",
      line: "Elle entre.",
      video: "Projets/atelier/Prises/20261004-090000-la-serre.mp4",
      poster: "Projets/atelier/Prises/20261004-090000-la-serre.jpg",
      jobId: "1a6c1b1e-8d47-4f39-9e16-5f5d0f0b9a22",
    });
    const home = memoryVault();
    await writeBlob(home, "Projets/atelier/Refs/look-a-1.jpg", new Blob(["p1"]));
    await writeBlob(home, "Projets/atelier/Refs/look-a-2.jpg", new Blob(["p2"]));
    await writeLook(home, { name: "Mira", traits: ["yeux verts", "taches"], photos: ["Projets/atelier/Refs/look-a-1.jpg", "Projets/atelier/Refs/look-a-2.jpg"], note: "" });
    await writeScene(home, { id: "le-quai", name: "Le quai", note: "", stills: [], previz: null, previzFile: null, camera: null, frames: [], render: null, shot: null, views: [] });
    await writeScene(home, { id: "la-serre", name: "La serre", note: "", stills: [], previz: null, previzFile: null, camera: null, frames: [], render: null, shot: null, views: [] });
    await writeBlob(home, here.video, new Blob(["mp4-ici"]));
    await writeBlob(home, here.poster!, new Blob(["jpg-ici"]));
    await writeTake(home, here, [here]);
    const weights = new Blob(["lora-ici"]);
    await writeLora(home, trained, weights, [here], [trained]);
    const root = (await home.get("MOC.md"))?.text ?? "";
    assert.match(root, /\[\[Projets\/atelier\/_MOC\|Atelier\]\]/);
    const map = (await home.get("Projets/atelier/_MOC.md"))?.text ?? "";
    assert.match(map, /\[\[Projets\/atelier\/Cast\/canon\|Mira\]\]/);
    assert.match(map, /\[\[Projets\/atelier\/Lieux\/le-quai\|Le quai\]\]/);
    assert.match(map, /\[\[Projets\/atelier\/Prises\/20261003-153000-le-quai\|Elle traverse le quai\.\]\]/);
    assert.match(map, /\[\[Projets\/atelier\/Cast\/20261003-160000-mira\|Mira\]\]/);
    assert.match(map, /\[\[Projets\/atelier\/Journal\|Journal\]\]/);
    assert.doesNotMatch(map, /SaveLoRA|synchronis/i);
    await removeScene(home, { id: "la-serre", name: "La serre", note: "", stills: [], previz: null, previzFile: null, camera: null, frames: [], render: null, shot: null, views: [] });
    assert.doesNotMatch((await home.get("Projets/atelier/_MOC.md"))?.text ?? "", /la-serre/);

    const away = memoryVault();
    await writeScene(away, { id: "la-serre", name: "La serre", note: "verre", stills: [], previz: null, previzFile: null, camera: null, frames: [], render: null, shot: null, views: [] });
    await writeBlob(away, elsewhere.video, new Blob(["mp4-la"]));
    await writeBlob(away, elsewhere.poster!, new Blob(["jpg-la"]));
    await writeTake(away, elsewhere, [elsewhere]);
    const archive = await coffreZip(away);
    assert.ok(readZip(archive).some(entry => entry.name === "U-TTU-Studio/MOC.md"));

    const kept = await sha256Hex(weights);
    const poisoned = createZip([
      { name: "U-TTU-Studio/prises/20261003-153000-le-quai.md", data: new TextEncoder().encode("pas une fiche") },
      { name: "U-TTU-Studio/u-ttu-fal/secret.txt", data: new TextEncoder().encode("clef") },
      { name: "U-TTU-Studio/../hors.md", data: new TextEncoder().encode("hors") },
    ]);
    await mergeCoffreZip(home, poisoned);
    assert.equal((await loadStudio(home)).takes[0].line, "Elle traverse le quai.");
    assert.equal(await home.get("u-ttu-fal/secret.txt"), null);
    assert.equal(vaultPathFromZip("U-TTU-Studio/CANON.md"), "CANON.md");
    assert.equal(vaultPathFromZip("U-TTU-Studio/u-ttu-rendu.json"), null);

    const report = await mergeCoffreZip(home, archive);
    assert.ok(report.written > 0);
    const merged = await loadStudio(home);
    assert.deepEqual(merged.takes.map(item => item.id).sort(), [here.id, elsewhere.id]);
    assert.equal(merged.takes.find(item => item.id === here.id)?.costCredits, 201);
    assert.equal(merged.loras.length, 1);
    assert.equal(merged.loras[0].trigger, "mira_uttu");
    assert.equal(await sha256Hex((await home.get(trained.file))?.blob ?? new Blob()), kept);
    const jobs = (await home.get("Projets/atelier/Journal.md"))?.text ?? "";
    assert.match(jobs, /\[\[Projets\/atelier\/Prises\/20261003-153000-le-quai\]\]/);
    assert.match(jobs, /\[\[Projets\/atelier\/Prises\/20261004-090000-la-serre\]\]/);
    const after = (await home.get("Projets/atelier/_MOC.md"))?.text ?? "";
    assert.match(after, /\[\[Projets\/atelier\/Prises\/20261004-090000-la-serre\|Elle entre\.\]\]/);
    assert.match(after, /\[\[Projets\/atelier\/Lieux\/la-serre\|La serre\]\]/);
    assert.match(after, /\[\[Projets\/atelier\/Cast\/20261003-160000-mira\|Mira\]\]/);
  });

  it("keeps each project to itself, and still opens an old vault", async () => {
    const store = memoryVault();
    await createProject(store, "Mira");
    await writeLook(store, { name: "Mira", traits: ["yeux"], photos: [], note: "ici" });
    await createProject(store, "Léo");
    let studio = await loadStudio(store);
    assert.equal(studio.project, "leo");
    assert.equal(studio.look.name, "");
    assert.equal(studio.projects.length, 2);
    await selectProject(store, "mira");
    studio = await loadStudio(store);
    assert.equal(studio.look.name, "Mira");
    assert.equal(studio.look.note, "ici");
    assert.equal(studio.scenes.length, 0);

    const old = memoryVault();
    const scene: Scene = { id: "le-quai", name: "Le quai", note: "", stills: [], previz: null, previzFile: null, camera: null, frames: [], render: null, shot: null, views: [] };
    await writeText(old, "CANON.md", canonMarkdown({ name: "Nola", traits: [], photos: ["refs/a.jpg"], note: "" }));
    await writeBlob(old, "refs/a.jpg", new Blob(["p"]));
    await writeText(old, "scenes/le-quai.md", sceneMarkdown(scene));
    const moved = await loadStudio(old);
    assert.equal(moved.project, "nola");
    assert.equal(moved.scenes[0]?.name, "Le quai");
    assert.deepEqual(moved.look.photos, ["Projets/nola/Refs/a.jpg"]);
    assert.equal(await old.get("CANON.md"), null);
    assert.equal(await old.get("scenes/le-quai.md"), null);
    const moteur = (await old.get("Projets/nola/Moteurs/personnage.md"))?.text ?? "";
    assert.match(moteur, /compte de rendu/);
    assert.doesNotMatch(moteur, /class_type|Coffre|Vault/);
  });
});
