import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  DECISIONS_APRES, DECISIONS_AVANT, MIN_TARGET, PATH_APRES, PATH_AVANT, RETOURS_APRES, RETOURS_AVANT,
  cssTargetViolations, disabledWithoutReason, nextNumberedName, pathCount, posePlan,
} from "../src/lib/ergonomie.ts";

const read = (path: string) => readFileSync(path, "utf8");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("parcours F29", () => {
  it("counts the shortest path before and after", () => {
    const avant = pathCount(PATH_AVANT);
    const apres = pathCount(PATH_APRES);
    assert.deepEqual(avant, { gestes: 27, saisies: 8, taps: 19, ecrans: 13 });
    assert.deepEqual(apres, { gestes: 15, saisies: 5, taps: 10, ecrans: 7 });
    assert.ok(apres.gestes < avant.gestes);
    assert.ok(apres.ecrans < avant.ecrans);
    assert.equal(DECISIONS_AVANT, 9);
    assert.equal(DECISIONS_APRES, 5);
    assert.equal(RETOURS_AVANT, 3);
    assert.equal(RETOURS_APRES, 0);
    assert.equal(PATH_AVANT[0].screen, "mon-studio");
    assert.equal(PATH_APRES[0].screen, "projet");
    assert.equal(PATH_APRES.at(-1)?.screen, "sequence");
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
