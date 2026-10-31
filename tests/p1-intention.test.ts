import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolveIntention, detectLang } from "../src/lib/intention/resolve.ts";
import { deName, fill, planIntention, uttuLine, type PlanContext } from "../src/lib/intention/plan.ts";
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

function context(partial: Partial<PlanContext> = {}): PlanContext {
  return { cast: [{ id: "elise", name: "Élise", sheet: "Projets/x/Cast/elise.webp", photos: [] }], decor: { id: "lab", name: "Le laboratoire", stills: ["Projets/x/Decors/lab.webp"] }, inherited: [], engineOverride: null, previousInPlace: false, format: "16:9", ...partial };
}

describe("P1 · choix moteur, références, assistant", () => {
  it("LTX par défaut, Klein compose l’image de départ, planche en référence 1", () => {
    const plan = planIntention(resolveIntention(SENTENCE_1, CTX), context());
    assert.equal(plan.engine, "ltx");
    assert.equal(plan.template, "video_ltx2_5_i2v");
    assert.equal(plan.identity, "planche");
    assert.equal(plan.keyframe, true);
    assert.deepEqual(plan.refs.map(ref => ref.kind), ["planche", "decor"]);
    assert.ok(plan.promptLines.some(line => line.includes("VHS camcorder look from 1994")));
    assert.match(plan.resolution, /^\d+×\d+$/);
  });

  it("trop de références pour LTX → H3 ; le choix manuel gagne et se dit", () => {
    const cast = ["a", "b", "c"].map(id => ({ id, name: id.toUpperCase(), sheet: `Projets/x/Cast/${id}.webp`, photos: [] }));
    const inherited = [{ characterId: "a", name: "A", identity: "", refs: [], state: { id: "s", characterId: "a", label: "tenue de chasseur", fromPlan: "plan-01", fromCode: "A-01", at: "", refs: ["Projets/x/Cast/a-chasseur.webp"] }, startsHere: false }];
    const plan = planIntention(resolveIntention("A, B et C dans le labo", CTX), context({ cast, inherited }));
    assert.equal(plan.auto, "h3");
    assert.equal(plan.refs.length, 5);
    const hand = planIntention(resolveIntention("A, B et C dans le labo", CTX), context({ cast, inherited, engineOverride: "ltx" }));
    assert.equal(hand.engine, "ltx");
    assert.equal(hand.refs.length, 4);
    assert.equal(hand.dropped.length, 1);
    assert.ok(hand.decisions.some(item => item.key === "engineManual"));
    assert.ok(hand.warnings.some(item => item.key === "refsDropped"));
  });

  it("assistant : la phrase type, en français, avec l’incertitude LTX", () => {
    const fr = catalog("fr");
    const plan = planIntention(resolveIntention("La caméra tourne autour d'Élise à 90°", CTX), context({ previousInPlace: true }));
    const { line, flags } = uttuLine(plan);
    const text = line.map(item => fill(at(fr, `p1.say.${item.key}`), item.vars)).join(" ");
    assert.ok(text.startsWith("Rotation de 90° autour d’Élise. Je conserve son apparence et l’éclairage du plan précédent."), text);
    assert.ok(flags.some(item => fill(at(fr, `p1.say.${item.key}`), item.vars) === "Ce style ne garantit pas ce mouvement au centimètre."));
    assert.equal(deName("MALO"), "de MALO");
  });

  it("assistant : nom inconnu et référence manquante signalés", () => {
    const plan = planIntention(resolveIntention("ZORA attend dans la forêt", CTX), context({ cast: [{ id: "malo", name: "MALO", sheet: null, photos: [] }], decor: { id: "foret", name: "Forêt", stills: [] } }));
    const keys = plan.warnings.map(item => item.key);
    assert.ok(keys.includes("unknownName"));
    assert.ok(keys.includes("missingRef"));
    assert.ok(keys.includes("missingDecorRef"));
  });

  it("chaque clé de l’assistant existe dans les 4 langues", () => {
    const fr = catalog("fr");
    const keys = Object.keys(at(fr, "p1.say") as unknown as Record<string, unknown>);
    for (const lang of ["en", "de", "es"]) {
      const other = catalog(lang);
      for (const key of keys) assert.ok(at(other, `p1.say.${key}`), `${lang} p1.say.${key}`);
    }
  });

  it("le prompt reçoit ambiance, état et rotation, la phrase part telle quelle", () => {
    const resolved = resolveIntention(SENTENCE_1, CTX);
    const inherited = [{ characterId: "elise", name: "Élise", identity: "", refs: [], state: { id: "s", characterId: "elise", label: "tenue de chasseur", fromPlan: "plan-01", fromCode: "A-01", at: "", refs: [] }, startsHere: false }];
    const plan = planIntention(resolved, context({ inherited }));
    const input = { ...emptyPlan("16:9"), castIds: ["elise"], castNames: ["Élise"], castPlanche: [true], decorId: "lab", decorName: "Laboratoire", action: SENTENCE_1 };
    const text = buildPrompt(input, { graph: "video_ltx2_5_i2v", son: false } as never, { lines: plan.promptLines }).text;
    assert.ok(text.includes(SENTENCE_1));
    assert.ok(text.includes("[état]        Élise: tenue de chasseur"));
    assert.ok(text.includes("[ambiance]"));
    assert.ok(text.includes("handheld"));
  });
});
