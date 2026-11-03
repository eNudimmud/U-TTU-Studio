import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { placeStoryboard } from "../src/lib/montage/arrivee.ts";
import { emptyEdit } from "../src/lib/montage/edit.ts";
import { exempleEdit } from "../src/lib/montage/exemple.ts";
import { chooseEdit, editFromShots, editHasClips } from "../src/lib/montage/from-takes.ts";

import { emptyPlan } from "../src/lib/prise/decision.ts";
import { GUIDE_CREDITS, GUIDE_MARK, guideQuote } from "../src/lib/prise/guide.ts";
import { buildPrompt } from "../src/lib/prise/prompt.ts";
import { DEFAULT_TAKE } from "../src/lib/render/take-graph.ts";
import { LIEUX_EXEMPLE, OSM_CREDIT, lieuNote, nominatimUrl, parseNominatim, pitchFor, zoomFor } from "../src/lib/repere/lieu.ts";

describe("tuiles et maquette", () => {

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
    const shown = chooseEdit({ demo: true, saved: [], sequences: [], shots: [], takes: [] });
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
