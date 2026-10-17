import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { GESTES_RETOUR } from "../src/lib/ergonomie.ts";

// The four-tap Chrome walk measured the old take card (data-reprise, rail).
// A filed take still plays from PRISE, with the pose button off and a reason.

describe("retour sur PRISE", () => {
  it("keeps play, a disabled pose and the export on a filed take", () => {
    assert.equal(GESTES_RETOUR, 4);
    const prise = readFileSync("src/components/app/prise-stage.tsx", "utf8");
    assert.match(prise, /data-lire-sequence/);
    assert.match(prise, /data-garder/);
    assert.match(prise, /data-envoyer-montage/);
    // P0: the sequence goes to the cut in plan order, kept take first, never a still for a plan that has a take.
    assert.match(prise, /sendSequence\(/);
    assert.match(prise, /still: entry\?\.take \? "" : stillOf\(plan\)/);
  });
});
