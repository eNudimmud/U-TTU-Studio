import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  CAMERA_MOVES, CAMERA_POSE_OPTIONS, CINEMA_CATALOG, CINEMA_GESTURES, cinemaGestureGate, gestureInputsReady, gestureLanding, gestureReasonKey, isCameraMove,
} from "../src/lib/cinema-gestures.ts";
import { scaffoldFiles, treeFileLabel } from "../src/lib/coffre/project.ts";

const read = (path: string) => readFileSync(path, "utf8");

describe("gestes cinéma", () => {
  it("keeps a gesture off until the schema, the pictures and a measured quote are all there", () => {
    assert.deepEqual(cinemaGestureGate({ schemaRead: false, inputsReady: true, quoteMeasured: true }), { enabled: false, block: "partage" });
    assert.deepEqual(cinemaGestureGate({ schemaRead: true, inputsReady: false, quoteMeasured: true }), { enabled: false, block: "besoin" });
    assert.deepEqual(cinemaGestureGate({ schemaRead: true, inputsReady: true, quoteMeasured: false }), { enabled: false, block: "devis" });
    assert.deepEqual(cinemaGestureGate({ schemaRead: true, inputsReady: true, quoteMeasured: true }), { enabled: true, block: null });
    assert.equal(gestureReasonKey("raccord", "partage", { images: [], videos: [], pose: null }), "cinema.partage");
    assert.equal(gestureReasonKey("camera", "devis", { images: ["a.jpg"], videos: [], pose: "Pan Up" }), "cinema.devis");
    assert.equal(gestureReasonKey("raccord", "besoin", { images: ["a.jpg"], videos: [], pose: null }), "cinema.raccord.need");
    assert.equal(gestureReasonKey("effet", "besoin", { images: [], videos: [], pose: null }), "cinema.effet.need");
    assert.equal(gestureReasonKey("camera", "besoin", { images: [], videos: [], pose: null }), "cinema.camera.needStill");
    assert.equal(gestureReasonKey("camera", "besoin", { images: ["a.jpg"], videos: [], pose: null }), "cinema.camera.needMove");
  });

  it("asks for two different images, one still plus a move, or a filmed take plus an image", () => {
    const one = { images: ["a.jpg", "a.jpg"], videos: [], pose: null };
    assert.equal(gestureInputsReady("raccord", one), false);
    assert.equal(gestureInputsReady("raccord", { images: ["a.jpg", "b.jpg"], videos: [], pose: null }), true);
    assert.equal(gestureInputsReady("camera", { images: ["a.jpg"], videos: [], pose: "Static" }), false);
    assert.equal(gestureInputsReady("camera", { images: ["a.jpg"], videos: [], pose: "Zoom In" }), true);
    assert.equal(gestureInputsReady("camera", { images: [], videos: ["clip.mp4"], pose: "Pan Left" }), false);
    assert.equal(gestureInputsReady("effet", { images: ["a.jpg"], videos: [], pose: null }), false);
    assert.equal(gestureInputsReady("effet", { images: ["a.jpg"], videos: ["clip.mp4"], pose: null }), true);
    assert.equal(isCameraMove("Static"), false);
    assert.equal(isCameraMove("ClockWise (CW)"), true);
    assert.deepEqual(CAMERA_POSE_OPTIONS[0], "Static");
    assert.equal(CAMERA_MOVES.length, 8);
  });

  it("records the templates whose schemas were read, and lands the clip with the takes", () => {
    assert.equal(CINEMA_CATALOG.credits, 0);
    assert.equal(CINEMA_CATALOG.nodeCount, 3772);
    assert.equal(CINEMA_GESTURES.raccord.templateId, "video_ltx2_5_flf2v");
    assert.equal(CINEMA_GESTURES.raccord.schemaRead, true);
    assert.equal(CINEMA_GESTURES.raccord.nodes, 7);
    assert.equal(CINEMA_GESTURES.camera.templateId, "video_wan2_2_14B_fun_camera");
    assert.equal(CINEMA_GESTURES.camera.nodes, 37);
    assert.equal(CINEMA_GESTURES.effet.templateId, "templates_shane_video_restyle");
    assert.equal(CINEMA_GESTURES.effet.nodes, 25);
    const landed = gestureLanding("mira", "raccord-1", "quai");
    assert.equal(landed.prise, "Projets/mira/Prises/raccord-1.md");
    assert.equal(landed.video, "Projets/mira/Prises/raccord-1.mp4");
    assert.equal(landed.shot, "Projets/mira/Shots/quai.md");
    assert.equal(gestureLanding("mira", "raccord-1", null).shot, null);
    assert.throws(() => gestureLanding("mira", "prise", null));
    assert.throws(() => gestureLanding("../x", "raccord-1", null));
  });

  it("keeps the fiches plain, and the gabarits off the section names", () => {
    const fr = JSON.parse(read("messages/fr.json")) as { cinema: unknown };
    const copy = JSON.stringify(fr.cinema);
    assert.match(copy, /Partage manquant/);
    assert.match(copy, /Devis absent/);
    assert.doesNotMatch(copy, /video_ltx|wan2|class_type|LoadImage|nœud|graphe|seedance|UNET/i);
    const ui = read("src/components/app/cinema-gestures.tsx");
    assert.match(ui, /QUOTE_MEASURED = false/);
    assert.doesNotMatch(ui, /fetch\(|run_template|submit_workflow|partner_generate|estimate_credits|dry_run/);
    const screens = read("src/components/app/screens.tsx");
    const sheets = read("src/components/app/sheets.tsx");
    const take = screens.slice(screens.indexOf("export function TakeScreen"), screens.indexOf("export function SphereScreen"));
    assert.ok(take.indexOf("t(\"take.next\")") < take.indexOf("<CinemaGestures anchor />"));
    assert.ok(take.indexOf("className=\"u-primary\"") < take.indexOf("<CinemaGestures anchor />"));
    assert.match(sheets, /<CinemaGestures shotId=\{shot\.id\} \/>/);
    assert.doesNotMatch(sheets, /<CinemaGestures \/>/);
    const catalog = JSON.parse(read("messages/fr.json")) as { scene: { plan: string }; take: { resetPlan: string }; cinema: { raccord: { apart: string }; lead: string } };
    assert.equal(catalog.scene.plan, "Espace");
    assert.equal(catalog.take.resetPlan, "Remettre cette prise à zéro");
    assert.match(catalog.cinema.raccord.apart, /séquence/);
    assert.match(catalog.cinema.lead, /Tourner reste éteint/);
    const seeded = scaffoldFiles("mira", "Mira").map(file => file.path);
    assert.ok(seeded.includes("Projets/mira/Templates/modele-raccord.md"));
    assert.ok(seeded.includes("Projets/mira/Templates/modele-mouvement.md"));
    assert.ok(seeded.includes("Projets/mira/Templates/modele-effet.md"));
    assert.equal(seeded.some(path => /\/(?:raccord|mouvement|effet|camera)\.md$/.test(path)), false);
    assert.equal(treeFileLabel("Modèles", "modele-raccord.md"), "Modèle · Raccord");
    assert.equal(treeFileLabel("Modèles", "modele-mouvement.md"), "Modèle · Mouvement");
    assert.equal(treeFileLabel("Moteurs", "moteur-effet.md"), "Moteur · Effet");
    assert.match(read("src/lib/coffre/project.ts"), /devis de run est absent/);
  });
});
