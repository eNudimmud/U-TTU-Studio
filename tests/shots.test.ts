import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  assignOrdre, clearShotSequence, createProject, dropTakeFromShots, loadStudio, moveShot, parseShot, shotMarkdown, shotStem, shotsOf, writeBlob, writeShot, writeTake, type Shot, type Take,
} from "../src/lib/coffre/model.ts";
import { memoryVault } from "../src/lib/coffre/store.ts";

const filmed = (id: string, line: string): Take => ({
  id,
  at: "2026-10-07T12:00:00.000Z",
  sceneId: "le-quai",
  sceneName: "Le quai",
  line,
  settings: { seconds: 5, quality: "rapide", aspect: "vertical" },
  profile: "h3-4pas-5s-vertical",
  jobId: "0f6c1b1e-8d47-4f39-9e16-5f5d0f0b9a11",
  video: `Projets/uttu/Prises/${id}.mp4`,
  poster: null,
  prompt: "",
  gpuSeconds: null,
  costCredits: null,
  balanceBefore: null,
  balanceAfter: null,
  engine: "comfy",
  loraId: null,
  resolution: null,
  costUsd: null,
  costSource: null,
  announcedCredits: null,
  announcedHigh: null,
});

const panel = (patch: Partial<Shot> = {}): Shot => ({
  id: "gros-plan",
  name: "Gros plan",
  sequenceId: "quai-nuit",
  takeIds: ["prise-a"],
  note: "Elle regarde à gauche",
  ordre: 0,
  ...patch,
});

describe("plans du storyboard", () => {
  it("refuses a section name, keeps order, and writes the links", () => {
    assert.equal(shotStem("Plan"), "cadre");
    assert.equal(shotStem("Shot"), "cadre");
    assert.equal(shotStem(""), "cadre");
    assert.equal(shotStem("Gros plan"), "gros-plan");
    assert.equal(parseShot("index", "# Plans"), null);
    assert.equal(parseShot("shot", "# Shot"), null);
    assert.equal(parseShot("plan", "# Plan"), null);

    const first = panel({ id: "a", name: "A", ordre: 0, takeIds: ["prise-b", "prise-b", "prise-a"] });
    const second = panel({ id: "b", name: "B", ordre: 1, takeIds: [] });
    const loose = panel({ id: "c", name: "C", sequenceId: null, ordre: 4 });
    assert.deepEqual(shotsOf([second, loose, first], "quai-nuit").map(item => item.id), ["a", "b"]);
    assert.deepEqual(moveShot([first, second, loose], "b", -1).filter(item => item.sequenceId === "quai-nuit").sort((a, b) => a.ordre - b.ordre).map(item => item.id), ["b", "a"]);
    assert.equal(assignOrdre([first], panel({ id: "d", ordre: 9 })).ordre, 1);
    assert.deepEqual(dropTakeFromShots([first], "prise-b")[0]?.takeIds, ["prise-a"]);
    assert.equal(clearShotSequence([first, loose], "quai-nuit")[0]?.sequenceId, null);

    const text = shotMarkdown(panel(), "uttu", [{ id: "prise-a", line: "Elle entre" }], "Quai, la nuit");
    assert.match(text, /\[\[Projets\/uttu\/Sequences\/quai-nuit\|Quai, la nuit\]\]/);
    assert.match(text, /\[\[Projets\/uttu\/Prises\/prise-a\|Elle entre\]\]/);
    assert.match(text, /Note : Elle regarde à gauche/);
    assert.doesNotMatch(text, /class_type|SaveLoRA|panneau de nœuds/);
    const read = parseShot("gros-plan", text);
    assert.equal(read?.sequenceId, "quai-nuit");
    assert.deepEqual(read?.takeIds, ["prise-a"]);
    assert.equal(read?.note, "Elle regarde à gauche");
  });

  it("loads a plan from the project and never names the file shot.md", async () => {
    const store = memoryVault();
    await createProject(store, "Uttu");
    const take = filmed("prise-a", "Elle entre");
    await writeBlob(store, take.video, new Blob(["mp4"], { type: "video/mp4" }));
    await writeTake(store, take, [take]);
    await writeShot(store, panel(), [take], "Quai, la nuit");
    await writeShot(store, panel({ id: "shot", name: "Interdit" }));
    await writeShot(store, panel({ id: "plan", name: "Aussi interdit" }));
    const studio = await loadStudio(store);
    assert.equal(studio.shots.length, 1);
    assert.equal(studio.shots[0]?.name, "Gros plan");
    assert.equal(studio.shots[0]?.sequenceId, "quai-nuit");
    assert.equal(await store.get("Projets/uttu/Shots/shot.md"), null);
    assert.equal(await store.get("Projets/uttu/Shots/plan.md"), null);
    assert.match((await store.get("Projets/uttu/Shots/index.md"))?.text ?? "", /case du storyboard/);
    assert.match((await store.get("Projets/uttu/Templates/modele-shot.md"))?.text ?? "", /note courte/);
    const moc = (await store.get("Projets/uttu/_MOC.md"))?.text ?? "";
    assert.match(moc, /Shots\/gros-plan\|Gros plan/);
    assert.doesNotMatch(moc, /Shots\/shot\|/);
  });

  it("replaces the old empty-folder sentence and keeps a cleared sequence off the plan", async () => {
    const store = memoryVault();
    await createProject(store, "Uttu");
    const index = (await store.get("Projets/uttu/Shots/index.md"))?.text ?? "";
    await store.put({
      path: "Projets/uttu/Shots/index.md",
      text: index.replace("Un plan est une case du storyboard : une séquence, puis des prises, dans l’ordre.", "Un plan est une prise rangée dans ce projet."),
      updatedAt: Date.now(),
    });
    await writeShot(store, panel({ sequenceId: null, note: "" }));
    const seeded = await loadStudio(store);
    assert.match((await store.get("Projets/uttu/Shots/index.md"))?.text ?? "", /case du storyboard/);
    assert.equal(seeded.shots[0]?.sequenceId, null);
    const cleared = clearShotSequence(seeded.shots, "quai-nuit");
    assert.equal(cleared[0]?.sequenceId, null);
  });

  it("opens a plan from the project, the sequence, the take and the shelf", () => {
    const screens = readFileSync("src/components/app/screens.tsx", "utf8");
    const sheets = readFileSync("src/components/app/sheets.tsx", "utf8");
    const app = readFileSync("src/components/app/studio-app.tsx", "utf8");
    assert.match(screens, /setSheet\("shots"\)/);
    assert.match(screens, /shot\.inShot/);
    assert.match(sheets, /shot\.lead/);
    assert.match(sheets, /shot\.create/);
    assert.match(sheets, /group\.label === "Plans"/);
    assert.match(readFileSync("src/components/app/atelier-page.tsx", "utf8"), /studio\.shots/);
    assert.doesNotMatch(app, /<ShotSheet/);
    assert.doesNotMatch(screens + sheets, /class_type|SaveLoRA|panneau de nœuds/);
    const decisions = readFileSync("docs/DECISIONS.md", "utf8");
    const f12 = decisions.slice(0, decisions.indexOf("## F11"));
    assert.match(f12, /F12 — shots \/ storyboard/);
    assert.match(f12, /modele-shot\.md/);
    assert.match(f12, /0 crédit/);
    assert.match(f12, /Viñeta/);
    assert.doesNotMatch(readFileSync("src/lib/coffre/model.ts", "utf8").slice(readFileSync("src/lib/coffre/model.ts", "utf8").indexOf("export function shotStem")), /estimate_credits|run_template|submit_workflow/);
  });
});
