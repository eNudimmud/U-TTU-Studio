import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { cameraChoice, cameraFromWords } from "../src/lib/prise/camera-words.ts";
import { buildPrompt } from "../src/lib/prise/prompt.ts";
import { emptyPlan } from "../src/lib/prise/decision.ts";
import { chosenTake, mergeTakeIds, planVersions, sequenceTakes, shownTake, takeIdsFromShotNote } from "../src/lib/prise/versions.ts";
import { etapeCourante, protocole } from "../src/lib/fiabilite.ts";
import { tabFromLocation } from "../src/lib/studio-route.ts";
import { chooseExportRoute, exportExtension } from "../src/lib/montage/encode.ts";
import { orderSequence } from "../src/lib/montage/arrivee.ts";
import type { Edit } from "../src/lib/montage/edit.ts";
import { planJson, planStateFromJson } from "../src/lib/prise/vault.ts";
import { resolveTakeQuote } from "../src/lib/render/billed-quote.ts";
import { takeProfile } from "../src/lib/render/take-graph.ts";
import { REGISTRE, gesteOuvert } from "../src/lib/workflows/registre.ts";

const read = (path: string) => readFileSync(path, "utf8");

describe("P0 · caméra : les mots de l'utilisateur gagnent", () => {
  it("reads camera words in FR, EN, DE and ES", () => {
    assert.equal(cameraFromWords("Enki marche, caméra à l'épaule")?.move, "epaule");
    assert.equal(cameraFromWords("handheld, she runs")?.move, "epaule");
    assert.equal(cameraFromWords("Handkamera, sie läuft")?.move, "epaule");
    assert.equal(cameraFromWords("cámara al hombro")?.move, "epaule");
    assert.equal(cameraFromWords("lent travelling avant sur son visage")?.move, "travelling-avant");
    assert.equal(cameraFromWords("la caméra tourne autour d'elle")?.move, "orbite");
    assert.equal(cameraFromWords("plan fixe, elle respire")?.move, "fixe");
    assert.equal(cameraFromWords("elle marche vers la caméra"), null);
  });

  it("never adds « static camera, locked-off » on the user's behalf", () => {
    const plan = { ...emptyPlan("16:9"), castIds: ["a"], castNames: ["Enki"], castPlanche: [false], action: "Enki marche vers la mer", camera: "fixe" as const };
    const free = buildPrompt(plan, { graph: "video_ltx2_5_i2v", son: false }).text;
    assert.doesNotMatch(free, /static camera|locked-off/);
    assert.doesNotMatch(free, /\[caméra\]/);
    const said = buildPrompt({ ...plan, action: "Enki marche, caméra à l'épaule" }, { graph: "video_ltx2_5_i2v", son: false }).text;
    assert.match(said, /\[caméra\]\s+handheld camera/);
    assert.doesNotMatch(said, /static camera|locked-off/);
    const fixed = buildPrompt({ ...plan, action: "Plan fixe sur Enki" }, { graph: "video_ltx2_5_i2v", son: false }).text;
    assert.match(fixed, /static camera, locked-off/);
  });

  it("keeps a moving tile, and flags it when the text says otherwise", () => {
    assert.deepEqual(cameraChoice("Enki regarde", "travelling-avant"), { move: "travelling-avant", source: "tuile", words: "", overridden: null });
    const over = cameraChoice("caméra à l'épaule", "travelling-avant");
    assert.equal(over.move, "epaule");
    assert.equal(over.source, "texte");
    assert.equal(over.overridden, "travelling-avant");
    assert.equal(cameraChoice("Enki regarde", "fixe").source, "libre");
  });
});

describe("P0 · 16:9 avec devis LTX estimé", () => {
  it("quotes LTX in 16:9 and 9:16, and keeps H3 to its billed profile only", () => {
    for (const aspect of ["horizontal", "vertical"] as const) {
      const quote = resolveTakeQuote(takeProfile({ seconds: 5, aspect, quality: "rapide", engine: "ltx" }), []);
      assert.equal(quote.source, "estimated", aspect);
    }
    assert.equal(resolveTakeQuote(takeProfile({ seconds: 5, aspect: "vertical", quality: "rapide", engine: "h3" }), []).source, "billed");
    assert.equal(resolveTakeQuote(takeProfile({ seconds: 5, aspect: "horizontal", quality: "rapide", engine: "h3" }), []).source, "unmeasured");
    const prise = read("src/components/app/prise-stage.tsx");
    assert.doesNotMatch(prise, /measuredProfile/);
    assert.match(prise, /planQuote\.source !== "unmeasured"/);
  });
});

describe("P0 · versions : une nouvelle prise n'écrase jamais la prise gardée", () => {
  const takes = [
    { id: "t1", at: "2026-10-17T10:00:00.000Z" },
    { id: "t3", at: "2026-10-17T12:00:00.000Z" },
    { id: "t2", at: "2026-10-17T11:00:00.000Z" },
  ];
  it("orders versions, shows the newest, sends the kept one", () => {
    const versions = planVersions(["t1", "t2", "t3", "gone"], takes);
    assert.deepEqual(versions.map(take => take.id), ["t1", "t2", "t3"]);
    assert.equal(shownTake(versions, null)?.id, "t3");
    assert.equal(shownTake(versions, "t1")?.id, "t1");
    assert.equal(chosenTake(versions, "t1")?.id, "t1");
    assert.equal(chosenTake(versions, "")?.id, "t3");
    assert.equal(chosenTake([], "t1"), null);
  });
  it("builds the cut in plan order and never loses a landed take on a late save", () => {
    const shots = [{ id: "plan-02", takeIds: ["t3"] }, { id: "plan-01", takeIds: ["t1", "t2"] }];
    const cut = sequenceTakes([{ id: "plan-01", garde: "t1" }, { id: "plan-02", garde: "" }, { id: "plan-03", garde: "" }], shots, takes);
    assert.deepEqual(cut.map(entry => [entry.planId, entry.take?.id ?? null]), [["plan-01", "t1"], ["plan-02", "t3"], ["plan-03", null]]);
    assert.deepEqual(mergeTakeIds(["t1"], ["t1", "t2"]), ["t1", "t2"]);
    const note = '---\ntype: "shot"\nprises:\n  - "20261017-203121-prise"\n  - "20261017-203300-prise"\nnote: ""\n---\n';
    assert.deepEqual(takeIdsFromShotNote(note), ["20261017-203121-prise", "20261017-203300-prise"]);
    assert.deepEqual(takeIdsFromShotNote("---\nprises:\nnote: x\n---"), []);
  });
  it("stores « Garder » in the plan", () => {
    const json = planJson(emptyPlan("16:9"), { etat: "gardee", garde: "20261017-203121-prise" });
    assert.equal(planStateFromJson(json).garde, "20261017-203121-prise");
    assert.equal(planStateFromJson(planJson(emptyPlan("16:9"), { garde: "../evil" })).garde, "");
  });
});

describe("P0 · carte de fiabilité en sept étapes", () => {
  it("names the first unmet step", () => {
    assert.equal(etapeCourante(protocole({ prepared: false, checked: false, quoted: false })), "preparer");
    assert.equal(etapeCourante(protocole({ prepared: true, checked: false, quoted: true })), "verifier");
    assert.equal(protocole({ prepared: true, checked: true, quoted: false }).estimer, "bloque");
    assert.equal(etapeCourante(protocole({ prepared: true, checked: true, quoted: true })), "confirmer");
    assert.equal(protocole({ prepared: true, checked: true, quoted: true, running: true }).executer, "encours");
    const failed = protocole({ prepared: true, checked: true, quoted: true, failed: true });
    assert.equal(failed.controler, "echec");
    assert.equal(failed.archiver, "attente");
    assert.equal(etapeCourante(protocole({ prepared: true, checked: true, quoted: true, landed: true, archived: true })), null);
  });
  it("is used by every paid confirmation (take, CAST, DÉCOR)", () => {
    assert.match(read("src/components/app/studio-frames.tsx"), /<FiabiliteCard/);
    assert.match(read("src/components/app/stage-screens.tsx"), /<FiabiliteCard/);
    assert.match(read("src/components/app/prise-stage.tsx"), /<FiabiliteCard/);
  });
});

describe("P0 · liens, jargon et gestes fermés", () => {
  it("opens DÉCOR from #decor and #décor", () => {
    assert.equal(tabFromLocation("#decor", ""), "scene");
    assert.equal(tabFromLocation("#d%C3%A9cor", ""), "scene");
    assert.equal(tabFromLocation("#cast", ""), "lora");
    assert.equal(tabFromLocation("#plan", ""), "prise");
  });
  it("hides closed gestures and moves the model options to Avancé", () => {
    const picker = read("src/components/app/geste-picker.tsx");
    assert.match(picker, /gesteVisible\(item, prefs\) && gesteOuvert\(item\)/);
    assert.doesNotMatch(picker, /gestes\.soon/);
    assert.match(picker, /<details className="u-fold u-avance"[\s\S]*<ModelOptions/);
    assert.ok(REGISTRE.filter(item => !gesteOuvert(item)).length >= 16);
  });
  it("keeps visible labels out of the code", () => {
    const stage = read("src/components/app/stage-screens.tsx");
    assert.doesNotMatch(stage, />Importer un (personnage|décor) · gratuit</);
    const prise = read("src/components/app/prise-stage.tsx");
    for (const word of ["Ce que l'app va faire", "Générer une prise", "Graphe :", ">Détails<", "Paroles ·", "Ce format n’est pas encore chiffré", ">Plans<"]) assert.equal(prise.includes(word), false, word);
  });
});

describe("P0 · export mobile sans impasse", () => {
  it("prefers WebCodecs MP4, then real-time recording, and says so when nothing works", () => {
    assert.deepEqual(chooseExportRoute({ video: "avc", audio: "aac", recorder: [] }), { kind: "webcodecs", video: "avc", audio: "aac", container: "mp4" });
    assert.equal(chooseExportRoute({ video: "vp9", audio: "opus", recorder: [] }).kind, "webcodecs");
    assert.deepEqual(chooseExportRoute({ video: null, audio: null, recorder: ["video/mp4", "video/webm"] }), { kind: "recorder", mime: "video/mp4", container: "mp4" });
    assert.deepEqual(chooseExportRoute({ video: null, audio: null, recorder: ["video/webm"] }), { kind: "recorder", mime: "video/webm", container: "webm" });
    assert.equal(chooseExportRoute({ video: null, audio: null, recorder: [] }).kind, "none");
    assert.equal(chooseExportRoute({ video: "vp9", audio: "opus", recorder: ["video/webm"], strict: true }).kind, "none");
    assert.equal(exportExtension(new Blob([], { type: "video/webm" })), "webm");
    assert.equal(exportExtension(new Blob([], { type: "video/mp4" })), "mp4");
    assert.doesNotMatch(read("src/lib/montage/encode.ts"), /Chrome récent sur ordinateur/);
  });
});

describe("P0 · Monter la séquence", () => {
  it("orders plans, keeps trims, replaces storyboard stand-ins and keeps hand-added clips", () => {
    const edit: Edit = {
      id: "suite", name: "Séquence", audio: [],
      video: [
        { id: "plan-storyboard-x", kind: "image" as const, source: "Projets/a/Assets/x.webp", label: "Storyboard · a", media: 5, start: 0, end: 5, takeId: "storyboard-x" },
        { id: "import-1", kind: "video" as const, source: "Projets/a/Assets/clip.mp4", label: "Clip", media: 4, start: 0, end: 4, takeId: null },
        { id: "plan-t2", kind: "video" as const, source: "Projets/a/Prises/t2.mp4", label: "t2", media: 5, start: 1, end: 4, takeId: "t2" },
      ],
    };
    const next = orderSequence(edit, [
      { id: "t1", label: "un", seconds: 5, source: "Projets/a/Prises/t1.mp4" },
      { id: "t2", label: "deux", seconds: 5, source: "Projets/a/Prises/t2.mp4" },
      { id: "t3", label: "trois", seconds: 5, source: "Projets/a/Prises/t3.mp4" },
    ], false);
    assert.deepEqual(next.video.map(clip => (clip.source ?? "").split("/").pop()), ["t1.mp4", "t2.mp4", "t3.mp4", "clip.mp4"]);
    assert.equal(next.video[1].start, 1);
    assert.ok(next.video.slice(0, 3).every(clip => clip.kind === "video"));
  });
});
