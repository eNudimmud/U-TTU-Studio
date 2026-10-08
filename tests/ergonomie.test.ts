import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseTraits } from "../src/lib/coffre/model.ts";
import {
  DECISIONS_APRES, DECISIONS_AVANT, DECISIONS_F30, GESTES_F30, GESTES_PLAFOND, MIN_TARGET, PATH_APRES, PATH_AVANT, RETOURS_APRES, RETOURS_AVANT,
  cssTargetViolations, disabledWithoutReason, keepLineBreaks, nextNumberedName, offeredLine, offeredName, pathCount, phraseKeyAction, posePlan, plainEnter, spendOnEnter, untouchedLook,
} from "../src/lib/ergonomie.ts";

const read = (path: string) => readFileSync(path, "utf8");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("parcours F32", () => {
  it("counts the shortest path before and after, and fails if the count rises", () => {
    const avant = pathCount(PATH_AVANT);
    const apres = pathCount(PATH_APRES);
    assert.deepEqual(avant, { gestes: 27, saisies: 8, taps: 19, ecrans: 13 });
    assert.deepEqual(apres, { gestes: 9, saisies: 0, taps: 9, ecrans: 7 });
    assert.equal(GESTES_PLAFOND, 9);
    assert.ok(apres.gestes <= GESTES_PLAFOND);
    assert.ok(apres.gestes < GESTES_F30);
    assert.equal(apres.saisies, 0);
    assert.ok(apres.gestes < avant.gestes);
    assert.ok(apres.ecrans < avant.ecrans);
    assert.equal(DECISIONS_AVANT, 9);
    assert.equal(DECISIONS_F30, 5);
    assert.equal(DECISIONS_APRES, 0);
    assert.equal(GESTES_F30, 15);
    assert.equal(RETOURS_AVANT, 3);
    assert.equal(RETOURS_APRES, 0);
    assert.equal(PATH_AVANT[0].screen, "mon-studio");
    assert.equal(PATH_APRES[0].screen, "projet");
    assert.equal(PATH_APRES.at(-1)?.screen, "sequence");
    assert.equal(PATH_APRES.some(step => step.kind === "saisie"), false);
    assert.deepEqual(PATH_APRES.map(step => step.screen), [
      "projet", "personnage", "personnage", "scene", "prise", "confirmation", "prise", "sequence", "sequence",
    ]);
  });

  it("offers a name and a line until the person changes them, and keeps the first place on the way to the take", () => {
    assert.equal(untouchedLook({ name: "", traits: [], photos: [], note: "" }), true);
    assert.equal(untouchedLook({ name: "Mira", traits: [], photos: [], note: "" }), false);
    assert.equal(offeredName("", "Personnage 1", false), "Personnage 1");
    assert.equal(offeredName("  ", "Lieu 1", false), "Lieu 1");
    assert.equal(offeredName("Mira", "Personnage 1", false), "Mira");
    assert.equal(offeredName("", "Personnage 1", true), "");
    assert.deepEqual(offeredLine(null, "Le personnage est dans le lieu."), { text: "Le personnage est dans le lieu.", followsLocale: true });
    assert.deepEqual(offeredLine("", "Le personnage est dans le lieu."), { text: "", followsLocale: false });
    assert.deepEqual(offeredLine("Elle avance.", "Le personnage est dans le lieu."), { text: "Elle avance.", followsLocale: false });
    assert.equal(keepLineBreaks("a\r\nb\rc", 240), "a\nb\nc");
    assert.equal(keepLineBreaks("abcdef", 3), "abc");
    const look = read("src/components/app/look-form.tsx");
    assert.match(look, /t\("look\.defaultName"\)/);
    assert.match(look, /offeredName\(/);
    assert.match(look, /plainEnter\(event\)/);
    assert.doesNotMatch(look, /u-ttu-look-ecrit/);
    const scene = read("src/components/app/scene-screen.tsx");
    assert.match(scene, /t\("scene\.defaultName"\)/);
    assert.match(scene, /t\("scene\.setAndTake"\)/);
    assert.match(scene, /const first = studio\.scenes\.length === 0/);
    assert.match(scene, /if \(first\) onNext\(\)/);
    assert.match(scene, /aria-describedby=\{posing && !draft\.trim\(\) \? "u-why-lieu"/);
    const take = read("src/components/app/screens.tsx");
    const prise = take.slice(take.indexOf("export function TakeScreen"), take.indexOf("export function SphereScreen"));
    assert.match(prise, /t\("take\.defaultLine"\)/);
    assert.match(prise, /phraseKeyAction\(/);
    assert.match(prise, /data-prise-gold/);
    assert.match(prise, /aria-describedby=\{action\.id === "bloque" \? "u-why-prise"/);
    assert.doesNotMatch(prise, /confirmRun\(/);
    assert.ok(prise.indexOf("data-prise-gold") < prise.indexOf("t(\"take.written\")"));
    const confirm = read("src/components/app/sheets.tsx");
    assert.match(confirm, /spendOnEnter\(/);
    assert.match(confirm, /u-confirm-cost/);
    assert.match(confirm, /u-confirm-sent/);
    assert.match(confirm, /aria-describedby=\{canConfirm \? "u-confirm-cost u-confirm-sent" : "u-why-confirm"\}/);
    const projet = read("src/components/app/lora-screen.tsx");
    assert.match(projet, /data-projet-gold/);
    assert.match(projet, /aria-describedby=\{!projectName\.trim\(\) \? "u-why-projet"/);
    const names = {
      fr: ["Personnage 1", "Lieu 1", "Le personnage est dans le lieu."],
      en: ["Character 1", "Place 1", "The character is in the place."],
      de: ["Figur 1", "Ort 1", "Die Figur ist an diesem Ort."],
      es: ["Personaje 1", "Lugar 1", "El personaje está en el lugar."],
    } as const;
    for (const locale of ["fr", "en", "de", "es"] as const) {
      const catalog = JSON.parse(read(`messages/${locale}.json`)) as {
        look: { placeholder: string; defaultName: string; written: string; traitsOptional: string };
        scene: { defaultName: string; written: string; setAndTake: string };
        take: { actionPlaceholder: string; written: string; defaultLine: string };
        guide: { stepCharacter: string; stepScene: string; stepTake: string; "scene-new": string };
      };
      assert.ok(parseTraits(catalog.look.placeholder).length >= 2, locale);
      assert.equal(catalog.look.defaultName, names[locale][0]);
      assert.equal(catalog.scene.defaultName, names[locale][1]);
      assert.equal(catalog.take.defaultLine, names[locale][2]);
      assert.match(catalog.look.traitsOptional, /invent|erfunden|inventa/i);
      assert.ok(catalog.look.written.length > 8, locale);
      assert.ok(catalog.scene.written.length > 8, locale);
      assert.ok(catalog.scene.setAndTake.length > 8, locale);
      assert.ok(catalog.take.written.length > 8, locale);
      assert.ok(catalog.take.actionPlaceholder.trim(), locale);
      assert.ok(catalog.guide.stepCharacter.length <= 90, catalog.guide.stepCharacter);
      assert.ok(catalog.guide.stepScene.length <= 90, catalog.guide.stepScene);
      assert.ok(catalog.guide.stepTake.length <= 90, catalog.guide.stepTake);
      assert.ok(catalog.guide["scene-new"].length <= 80, catalog.guide["scene-new"]);
      assert.doesNotMatch(catalog.guide.stepCharacter, /Mira/);
    }
  });

  it("lets Enter run the gesture on screen, and refuses a spend the quote does not show", () => {
    assert.equal(plainEnter({ key: "Enter" }), true);
    assert.equal(plainEnter({ key: "Enter", repeat: true }), false);
    assert.equal(plainEnter({ key: "Enter", shiftKey: true }), false);
    assert.equal(plainEnter({ key: "Enter", metaKey: true }), false);
    assert.equal(plainEnter({ key: "Enter", isComposing: true }), false);
    assert.equal(phraseKeyAction({ key: "Enter" }, false), "submit");
    assert.equal(phraseKeyAction({ key: "Enter", shiftKey: true }, false), "break");
    assert.equal(phraseKeyAction({ key: "Enter" }, true), "break");
    assert.equal(phraseKeyAction({ key: "Enter", repeat: true }, false), "ignore");
    assert.equal(phraseKeyAction({ key: "a" }, false), "ignore");
    const visible = { field: false, quoteVisible: true, textVisible: true, allowed: true };
    assert.equal(spendOnEnter({ key: "Enter" }, visible), true);
    assert.equal(spendOnEnter({ key: "Enter", shiftKey: true }, visible), false);
    assert.equal(spendOnEnter({ key: "Enter" }, { ...visible, field: true }), false);
    assert.equal(spendOnEnter({ key: "Enter" }, { ...visible, quoteVisible: false }), false);
    assert.equal(spendOnEnter({ key: "Enter" }, { ...visible, textVisible: false }), false);
    assert.equal(spendOnEnter({ key: "Enter", repeat: true }, visible), false);
    assert.equal(spendOnEnter({ key: "Enter" }, { ...visible, allowed: false }), false);
    const order: [string, string, string][] = [
      ["src/components/app/lora-screen.tsx", "u-projet-nom", "data-projet-gold"],
      ["src/components/app/look-form.tsx", "u-look-name", "data-look-gold"],
      ["src/components/app/scene-screen.tsx", "id=\"u-lieu\"", "data-lieu-gold"],
      ["src/components/app/screens.tsx", "u-prise-phrase", "data-prise-gold"],
      ["src/components/app/sheets.tsx", "u-confirm-cost", "data-confirm-gold"],
    ];
    for (const [path, field, gold] of order) {
      const source = read(path);
      assert.ok(source.indexOf(field) < source.indexOf(gold), `${path} ${field}`);
      assert.ok(source.indexOf("u-confirm-sent") < source.indexOf("data-confirm-gold") || path !== "src/components/app/sheets.tsx");
    }
    const css = read("src/components/app/app.css");
    assert.match(css, /\.u-app :focus-visible \{ outline: 2px solid var\(--u-gold\)/);
    assert.match(css, /\.u-field input:focus-visible/);
    assert.match(css, /\.u-chips input:focus-visible \{ outline: 2px solid var\(--u-gold\)/);
  });

  it("writes the next safe name, and reuses a shot that already holds the take", () => {
    assert.equal(nextNumberedName("Plan 1", []), "Plan 1");
    assert.equal(nextNumberedName("Plan 1", ["Plan 1"]), "Plan 2");
    assert.equal(nextNumberedName("Séquence 1", ["Séquence 1", "Séquence 2"]), "Séquence 3");
    assert.equal(nextNumberedName("  ", []), "");
    const held = posePlan("prise-1", [{ id: "seq", name: "Séquence 1" }], [{ id: "plan", name: "Plan 1", sequenceId: "seq", takeIds: ["prise-1"] }], { sequence: "Séquence 1", shot: "Plan 1" });
    assert.deepEqual(held, { openSequenceId: "seq", createSequence: null, createShotName: null, adoptShotId: null });
    const fresh = posePlan("prise-1", [], [], { sequence: "Séquence 1", shot: "Plan 1" });
    assert.equal(fresh?.createSequence, "Séquence 1");
    assert.equal(fresh?.createShotName, "Plan 1");
    assert.equal(posePlan("  ", [], [], { sequence: "Séquence 1", shot: "Plan 1" }), null);
  });
});

describe("cibles et boutons éteints", () => {
  it("rejects a hit target under 44 px, and lets a flex floor of 0 pass", () => {
    assert.equal(MIN_TARGET, 44);
    assert.deepEqual(cssTargetViolations(".u-link { height: 20px; }"), [".u-link { height: 20px }"]);
    assert.deepEqual(cssTargetViolations(".u-link { min-width: 0; min-height: 44px; }"), []);
    assert.deepEqual(cssTargetViolations(".u-node { width: 30px; height: 30px; }"), []);
    const css = read("src/components/app/app.css");
    assert.deepEqual(cssTargetViolations(css), []);
  });

  it("rejects a disabled button with no visible reason", () => {
    const bare = `<button type="button" disabled={!ready} onClick={go}>Suite</button>`;
    assert.equal(disabledWithoutReason(bare).length, 1);
    const told = `${bare}\n<Why on={!ready} text="Il manque un nom." />`;
    assert.deepEqual(disabledWithoutReason(told), []);
    const named = `<button type="button" disabled={!ready} aria-describedby="why">Suite</button>`;
    assert.deepEqual(disabledWithoutReason(named), []);
    const problems = sources("src/components").flatMap(path => disabledWithoutReason(read(path)).map(line => `${path} ${line}`));
    assert.deepEqual(problems, []);
  });
});
