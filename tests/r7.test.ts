import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TUILES, rewriteScene, tuileInText, tuileNeedsPair } from "../src/lib/cinema/tuiles.ts";
import { placeStoryboard } from "../src/lib/montage/arrivee.ts";
import { emptyEdit } from "../src/lib/montage/edit.ts";
import { exempleEdit } from "../src/lib/montage/exemple.ts";
import { chooseEdit, editFromShots, editHasClips } from "../src/lib/montage/from-takes.ts";
import {
  addFigure, addNeutral, applyTuile, astuce, autreEssai, captureLine, initialMaquette, MAX_FIGURES, moveFigure, nextRadius, pinch, removeFigure, scenePhrase, toggleLock, undoMaquette, uprightRotation, yawFigure,
} from "../src/lib/maquette/state.ts";
import { emptyPlan } from "../src/lib/prise/decision.ts";
import { GUIDE_CREDITS, GUIDE_MARK, guideQuote } from "../src/lib/prise/guide.ts";
import { buildPrompt } from "../src/lib/prise/prompt.ts";
import { DEFAULT_TAKE } from "../src/lib/render/take-graph.ts";
import { LIEUX_EXEMPLE, OSM_CREDIT, lieuNote, nominatimUrl, parseNominatim, pitchFor, zoomFor } from "../src/lib/repere/lieu.ts";

describe("tuiles et maquette", () => {
  it("places the camera from one named tile and writes the sentence", () => {
    const state = applyTuile(initialMaquette([{ id: "uttu", name: "Uttu" }]), "large");
    assert.equal(state.tuile, "large");
    assert.equal(state.orbit.radius, TUILES[0].radius);
    assert.equal(state.figures[0].name, "Uttu");
    assert.equal(tuileInText("on ouvre en plan large"), "large");
    assert.equal(tuileInText("plan taille, puis on reste"), "taille");
    assert.equal(rewriteScene("plan taille", "Plan large", TUILES.map(item => item.label)), "plan large");
  });

  it("locks the pose and the camera, then undoes a free try", () => {
    const start = initialMaquette();
    const locked = toggleLock(start, "pose");
    const stayed = moveFigure(locked, locked.figures[0].id, 3, 2);
    assert.equal(stayed.figures[0].x, locked.figures[0].x);
    const cam = toggleLock(start, "cam");
    const zoom = pinch(cam, 100, 200);
    assert.equal(zoom.orbit.radius, cam.orbit.radius);
    const free = pinch(start, 100, 200);
    assert.ok(free.orbit.radius < start.orbit.radius);
    assert.ok(nextRadius(6, 100, 200) < 6);
    const tried = autreEssai(start, () => 0.2);
    const back = undoMaquette(tried);
    assert.equal(back.figures[0].x, start.figures[0].x);
    assert.equal(back.past.length, 0);
  });

  it("gives a soft tip and a cinema line without a matrix", () => {
    const far = addFigure(initialMaquette(), { id: "kael", name: "Kael" });
    far.figures[0].x = -3;
    far.figures[1].x = 3;
    far.tuile = "taille";
    assert.equal(astuce(far).id, "loin");
    const close = applyTuile(initialMaquette(), "impact");
    assert.equal(astuce(close).id, "bord");
    const line = captureLine(initialMaquette(), "waist-up framing");
    assert.match(line, /Uttu alone/);
    assert.match(line, /waist-up framing/);
    assert.doesNotMatch(line, /facing|matrix|focal|\d+mm|theta|phi/i);
    const pair = captureLine(far, "waist-up framing");
    assert.match(pair, /facing Kael/);
  });

  it("starts with one standing figure and adds or removes the others", () => {
    const start = initialMaquette();
    assert.equal(start.figures.length, 1);
    assert.equal(start.figures[0].name, "Uttu");
    assert.equal(start.tuile, "regard");
    assert.deepEqual(uprightRotation(0.4), { x: 0, y: 0.4, z: 0 });
    assert.equal(applyTuile(start, "taille"), start);
    assert.equal(tuileNeedsPair("contre"), true);
    assert.equal(tuileNeedsPair("large"), false);
    const turned = yawFigure(start, start.figures[0].id, Math.PI / 4);
    assert.equal(turned.figures[0].yaw, Math.PI / 4);
    assert.equal(uprightRotation(turned.figures[0].yaw).x, 0);
    assert.equal(uprightRotation(turned.figures[0].yaw).z, 0);
    const two = addNeutral(start);
    assert.equal(two.figures.length, 2);
    assert.equal(two.figures[1].name, "Personnage");
    const sized = applyTuile(two, "taille");
    assert.equal(sized.tuile, "taille");
    const three = addFigure(two, { id: "coursiere", name: "La coursière" });
    assert.equal(three.figures.length, 3);
    assert.equal(scenePhrase(three.figures.map(figure => figure.name), "Plan taille"), "Uttu, Personnage et La coursière, plan taille.");
    assert.match(scenePhrase(start.figures.map(figure => figure.name), "Regard caméra"), /Uttu, regard caméra\./);
    const back = removeFigure(sized, "neutre-1");
    assert.equal(back.figures.length, 1);
    assert.equal(back.tuile, "regard");
    let full = start;
    for (let index = 0; index < MAX_FIGURES; index += 1) full = addNeutral(full, "Fig");
    assert.equal(full.figures.length, MAX_FIGURES);
    assert.equal(addNeutral(full, "Fig"), full);
  });
});

describe("devis guidé et prise gardée", () => {
  it("keeps the guided price as an unmeasured estimate", () => {
    const quote = guideQuote();
    assert.equal(quote.enabled, false);
    assert.equal(quote.credits, GUIDE_CREDITS);
    assert.equal(quote.mark, GUIDE_MARK);
    assert.equal(quote.statut, "hypothese");
    const text = buildPrompt(emptyPlan(), { graph: quote.graph, son: false }, { cadre: "Uttu on the left. waist-up framing." });
    assert.match(text.text, /\[maquette\]/);
    assert.match(text.text, /waist-up framing/);
  });

  it("lands a kept still on the timeline and keeps the sound bed", () => {
    const placed = placeStoryboard(
      { id: "suite", name: "Séquence", video: [], audio: [] },
      { id: "plan-01-garde", label: "Plan taille", seconds: 5, source: "Projets/uttu/Prises/plan-01-garde.webp" },
      true,
    );
    assert.equal(placed.video.at(-1)?.kind, "image");
    assert.equal(placed.audio.length, exempleEdit().audio.length);
    assert.deepEqual(placed.audio.map(clip => clip.track).sort(), ["musique", "voix"]);
    const kept = editFromShots(
      { id: "suite", name: "Séquence" },
      [{ id: "plan-01", name: "Plan", sequenceId: "suite", takeIds: ["t1"], note: "", ordre: 0 }],
      [{ id: "t1", line: "Plan taille", video: "Projets/uttu/Prises/t1.webp", settings: { ...DEFAULT_TAKE, seconds: 5 }, etat: "gardee" }],
    );
    assert.equal(kept.video[0]?.kind, "image");
    assert.equal(kept.video[0]?.source, "Projets/uttu/Prises/t1.webp");
  });
});

describe("statut du montage", () => {
  it("reads the clips on screen, including the example bed", () => {
    assert.equal(editHasClips(exempleEdit()), true);
    assert.equal(editHasClips(emptyEdit("vide", "Vide")), false);
    const shown = chooseEdit({ saved: [], sequences: [], shots: [], takes: [] });
    assert.equal(editHasClips(shown.edit), true);
    assert.equal(editHasClips(chooseEdit({ saved: [emptyEdit("seq", "Vide")], sequences: [], shots: [], takes: [] }).edit), false);
  });
});

describe("repérage", () => {
  it("asks Nominatim once, names the four examples, and keeps the licence line", () => {
    assert.equal(OSM_CREDIT, "© contributeurs OpenStreetMap, ODbL");
    assert.deepEqual(LIEUX_EXEMPLE.map(item => item.name), ["Montmartre", "Shibuya", "Brooklyn Bridge", "Genève"]);
    const url = nominatimUrl("Montmartre, Paris");
    assert.match(url, /nominatim\.openstreetmap\.org/);
    assert.equal(new URL(url).searchParams.get("q"), "Montmartre, Paris");
    assert.equal(parseNominatim([{ display_name: "Montmartre, Paris, France", lat: "48.8867", lon: "2.3431" }])?.name, "Montmartre");
    assert.equal(parseNominatim([]), null);
    assert.equal(pitchFor("dessus"), 0);
    assert.equal(zoomFor(true), 15);
    assert.match(lieuNote(LIEUX_EXEMPLE[0], "debout", false), /Montmartre/);
    assert.doesNotMatch(lieuNote(LIEUX_EXEMPLE[0], "debout", true), /https?:|class_type|node/i);
  });
});
