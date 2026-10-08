import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  DECISIONS_APRES, DECISIONS_AVANT, DECISIONS_F30, GESTES_PLAFOND, MIN_TARGET, PATH_APRES, PATH_AVANT, PATH_F30, RETOURS_APRES, RETOURS_AVANT, RETOURS_F30,
  cssTargetViolations, disabledWithoutReason, nextNumberedName, offeredName, pathCount, posePlan,
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
  it("counts the shortest path, and fails if F31 grows past its ceiling", () => {
    const avant = pathCount(PATH_AVANT);
    const f30 = pathCount(PATH_F30);
    const apres = pathCount(PATH_APRES);
    assert.deepEqual(avant, { gestes: 27, saisies: 8, taps: 19, ecrans: 13 });
    assert.deepEqual(f30, { gestes: 15, saisies: 5, taps: 10, ecrans: 7 });
    assert.deepEqual(apres, { gestes: 9, saisies: 0, taps: 9, ecrans: 7 });
    assert.equal(GESTES_PLAFOND, 9);
    assert.ok(apres.gestes <= GESTES_PLAFOND);
    assert.ok(apres.gestes < f30.gestes);
    assert.ok(apres.saisies < f30.saisies);
    assert.ok(apres.ecrans <= f30.ecrans);
    assert.equal(DECISIONS_AVANT, 9);
    assert.equal(DECISIONS_F30, 5);
    assert.equal(DECISIONS_APRES, 0);
    assert.ok(DECISIONS_APRES < DECISIONS_F30);
    assert.equal(RETOURS_AVANT, 3);
    assert.equal(RETOURS_F30, 0);
    assert.equal(RETOURS_APRES, 0);
    assert.equal(PATH_AVANT[0].screen, "mon-studio");
    assert.equal(PATH_F30[0].screen, "projet");
    assert.equal(PATH_APRES[0].screen, "projet");
    assert.equal(PATH_APRES.at(-1)?.screen, "sequence");
    assert.equal(PATH_APRES.filter(step => step.kind === "saisie").length, 0);
    assert.deepEqual(PATH_APRES.map(step => step.screen), [
      "projet", "personnage", "personnage", "scene", "prise", "confirmation", "prise", "sequence", "sequence",
    ]);
  });

  it("offers a name until the person clears the field", () => {
    assert.equal(offeredName("", "Personnage 1", false), "Personnage 1");
    assert.equal(offeredName("  ", "Lieu 1", false), "Lieu 1");
    assert.equal(offeredName("Mira", "Personnage 1", false), "Mira");
    assert.equal(offeredName("", "Personnage 1", true), "");
    const fr = JSON.parse(read("messages/fr.json")) as {
      look: { defaultName: string; traitsOptional: string };
      scene: { defaultName: string; setAndTake: string };
      take: { defaultLine: string };
    };
    assert.equal(fr.look.defaultName, "Personnage 1");
    assert.equal(fr.scene.defaultName, "Lieu 1");
    assert.match(fr.look.traitsOptional, /Rien n’est inventé/);
    assert.match(fr.scene.setAndTake, /puis la prise/);
    assert.match(fr.take.defaultLine, /lieu/);
    assert.match(read("src/components/app/scene-screen.tsx"), /setAndTake/);
    assert.match(read("src/components/app/scene-screen.tsx"), /onNext\(\)/);
    assert.match(read("src/components/app/look-form.tsx"), /defaultName/);
    assert.match(read("src/components/app/studio-app.tsx"), /defaultLine/);
    assert.match(read("src/components/app/screens.tsx"), /key !== "Enter"/);
    assert.match(read("src/components/app/sheets.tsx"), /key !== "Enter"/);
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
