import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseTraits } from "../src/lib/coffre/model.ts";
import {
  DECISIONS_APRES, DECISIONS_AVANT, DECISIONS_F30, GESTES_F30, MIN_TARGET, PATH_APRES, PATH_AVANT, RETOURS_APRES, RETOURS_AVANT,
  cssTargetViolations, disabledWithoutReason, nextNumberedName, pathCount, posePlan, untouchedLook,
} from "../src/lib/ergonomie.ts";

const read = (path: string) => readFileSync(path, "utf8");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("parcours F31", () => {
  it("counts the shortest path before and after, and fails if the count rises", () => {
    const avant = pathCount(PATH_AVANT);
    const apres = pathCount(PATH_APRES);
    assert.deepEqual(avant, { gestes: 27, saisies: 8, taps: 19, ecrans: 13 });
    assert.deepEqual(apres, { gestes: 9, saisies: 0, taps: 9, ecrans: 7 });
    assert.ok(apres.gestes < GESTES_F30);
    assert.ok(apres.gestes <= 9);
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
  });

  it("writes the novice defaults once, and keeps the first place on the way to the take", () => {
    assert.equal(untouchedLook({ name: "", traits: [], photos: [], note: "" }), true);
    assert.equal(untouchedLook({ name: "Mira", traits: [], photos: [], note: "" }), false);
    assert.equal(untouchedLook({ name: "", traits: ["yeux"], photos: [], note: "" }), false);
    assert.equal(untouchedLook({ name: " ", traits: [], photos: [], note: " " }), true);
    assert.equal(untouchedLook({ name: "", traits: [], photos: [], note: "pluie" }), false);
    const look = read("src/components/app/look-form.tsx");
    assert.match(look, /t\("look\.defaultName"\)/);
    assert.match(look, /untouchedLook\(look\)/);
    assert.match(look, /parseTraits\(placeholder\)/);
    assert.match(look, /u-ttu-look-ecrit/);
    const scene = read("src/components/app/scene-screen.tsx");
    assert.match(scene, /t\("scene\.defaultName"\)/);
    assert.match(scene, /const first = studio\.scenes\.length === 0/);
    assert.match(scene, /if \(first\) onNext\(\)/);
    const take = read("src/components/app/screens.tsx");
    const prise = take.slice(take.indexOf("export function TakeScreen"), take.indexOf("export function SphereScreen"));
    assert.match(prise, /u-ttu-plan/);
    assert.match(prise, /t\("take\.actionPlaceholder"\)/);
    assert.match(prise, /data-prise-gold/);
    assert.ok(prise.indexOf("data-prise-gold") < prise.indexOf("t(\"take.written\")"));
    for (const locale of ["fr", "en", "de", "es"]) {
      const catalog = JSON.parse(read(`messages/${locale}.json`)) as {
        look: { placeholder: string; defaultName: string; written: string };
        scene: { defaultName: string; written: string };
        take: { actionPlaceholder: string; written: string };
        guide: { stepCharacter: string; stepScene: string; stepTake: string; "scene-new": string };
      };
      assert.ok(parseTraits(catalog.look.placeholder).length >= 2, locale);
      assert.ok(catalog.look.defaultName.trim(), locale);
      assert.ok(catalog.scene.defaultName.trim(), locale);
      assert.ok(catalog.take.actionPlaceholder.trim(), locale);
      assert.ok(catalog.look.written.length > 8, locale);
      assert.ok(catalog.scene.written.length > 8, locale);
      assert.ok(catalog.take.written.length > 8, locale);
      assert.ok(catalog.guide.stepCharacter.length <= 90, catalog.guide.stepCharacter);
      assert.ok(catalog.guide.stepScene.length <= 90, catalog.guide.stepScene);
      assert.ok(catalog.guide.stepTake.length <= 90, catalog.guide.stepTake);
      assert.ok(catalog.guide["scene-new"].length <= 80, catalog.guide["scene-new"]);
    }
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
