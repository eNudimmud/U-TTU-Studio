import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolveIntention, detectLang } from "../src/lib/intention/resolve.ts";

import { buildPrompt } from "../src/lib/prise/prompt.ts";
import { emptyPlan } from "../src/lib/prise/decision.ts";

const CTX = {
  cast: [{ id: "elise", name: "Élise", aliases: ["É*LISE", "Elise"] }, { id: "malo", name: "MALO" }, { id: "lea", name: "Léa", aliases: ["L*ÉA"] }],
  decor: [{ id: "lab", name: "Le laboratoire", aliases: ["labo", "laboratory", "Labor", "laboratorio"] }, { id: "foret", name: "La forêt", aliases: ["forest", "Wald", "bosque"] }, { id: "quai", name: "Un quai la nuit" }],
};

const SENTENCE_1 = "Élise traverse lentement le laboratoire, caméra à l'épaule, ambiance VHS 1994";
const SENTENCE_2 = "La caméra tourne autour d'Élise à 90°, plongée légère, 8 secondes, format vertical";

function catalog(lang: string): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(`../messages/${lang}.json`, import.meta.url), "utf8")) as Record<string, unknown>;
}
function at(tree: Record<string, unknown>, path: string): string {
  return path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], tree) as string;
}

describe("P1 · résolveur d’intention", () => {
  it("Phrase 1 : Élise, laboratoire, lentement, épaule, VHS 1994", () => {
    const r = resolveIntention(SENTENCE_1, CTX);
    assert.equal(r.lang, "fr");
    assert.deepEqual(r.who.map(item => [item.id, item.words]), [["elise", "Élise"]]);
    assert.equal(r.where?.id, "lab");
    assert.equal(r.speed, "lent");
    assert.equal(r.camera.move, "epaule");
    assert.deepEqual(r.ambiance.map(item => item.label), ["VHS 1994"]);
    assert.equal(r.action, "Élise traverse lentement le laboratoire");
    assert.deepEqual(r.unknown, []);
    assert.equal(r.duration, null);
  });

  it("Phrase 2 : orbite de 90° autour d’Élise, plongée, 8 s, vertical", () => {
    const r = resolveIntention(SENTENCE_2, CTX);
    assert.equal(r.who[0]?.id, "elise");
    assert.equal(r.camera.move, "orbite");
    assert.equal(r.camera.degrees, 90);
    assert.equal(r.cadrage?.value, "plongee");
    assert.deepEqual(r.duration, { asked: 8, seconds: 8, words: "8 secondes" });
    assert.equal(r.format?.value, "9:16");
  });

  it("même intention en EN, DE et ES", () => {
    for (const [text, lang, camera] of [
      ["Élise slowly crosses the laboratory, handheld camera, VHS 1994 look", "en", "epaule"],
      ["Élise durchquert langsam das Labor, Handkamera, Stimmung VHS 1994", "de", "epaule"],
      ["Élise cruza lentamente el laboratorio, cámara al hombro, ambiente VHS 1994", "es", "epaule"],
    ] as const) {
      const r = resolveIntention(text, CTX);
      assert.equal(r.lang, lang, text);
      assert.equal(r.who[0]?.id, "elise", text);
      assert.equal(r.where?.id, "lab", text);
      assert.equal(r.speed, "lent", text);
      assert.equal(r.camera.move, camera, text);
      assert.equal(r.ambiance[0]?.label, "VHS 1994", text);
      assert.deepEqual(r.unknown, [], text);
    }
  });

  it("caméra : travelling, panoramique, fixe, contre-plongée, demi-tour", () => {
    assert.equal(resolveIntention("MALO avance, travelling arrière", CTX).camera.move, "travelling-arriere");
    assert.equal(resolveIntention("MALO avance, travelling avant", CTX).camera.move, "travelling-avant");
    assert.equal(resolveIntention("Panoramique sur la forêt, MALO au loin", CTX).camera.move, "panoramique");
    assert.equal(resolveIntention("MALO attend, plan fixe", CTX).camera.move, "fixe");
    assert.equal(resolveIntention("MALO en contre-plongée", CTX).cadrage?.value, "contre");
    const half = resolveIntention("Demi-tour autour de MALO", CTX);
    assert.equal(half.camera.move, "orbite");
    assert.equal(half.camera.degrees, 180);
  });

  it("noms : alias, étoiles, élision, plusieurs personnes dans l’ordre", () => {
    const r = resolveIntention("Léa rejoint Élise et MALO dans la forêt", CTX);
    assert.deepEqual(r.who.map(item => item.id), ["lea", "elise", "malo"]);
    assert.equal(r.where?.id, "foret");
    assert.equal(resolveIntention("Le regard d'Elise", CTX).who[0]?.id, "elise");
  });

  it("mots inconnus montrés, jamais remplacés", () => {
    const r = resolveIntention("ZORA attend Marlowe sur le quai la nuit", CTX);
    assert.deepEqual(r.unknown, ["ZORA", "Marlowe"]);
    assert.equal(r.who.length, 0);
    assert.equal(r.where?.id, "quai");
    assert.ok(r.action.includes("ZORA") && r.action.includes("Marlowe"));
    // German capitalises nouns: they are not suspects.
    assert.deepEqual(resolveIntention("Élise öffnet die Tür im Labor", CTX).unknown, []);
  });

  it("durée ramenée à 5 ou 8 s, avec la valeur demandée", () => {
    assert.deepEqual(resolveIntention("Élise court, 12 s", CTX).duration, { asked: 12, seconds: 8, words: "12 s" });
    assert.equal(resolveIntention("Élise court, 4 seconds", CTX).duration?.seconds, 5);
  });

  it("déterministe : même phrase, même résultat", () => {
    assert.deepEqual(resolveIntention(SENTENCE_1, CTX), resolveIntention(SENTENCE_1, CTX));
    assert.equal(detectLang(""), "en");
  });
});
