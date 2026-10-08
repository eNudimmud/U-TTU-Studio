import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { GESTES_RETOUR } from "../src/lib/ergonomie.ts";

// The four-tap Chrome walk measured the old take card (data-reprise, rail).
// A filed take still plays from PRISE, with the pose button off and a reason.

describe("retour sur PRISE", () => {
  it("keeps play, a disabled pose and the export on a filed take", () => {
    assert.equal(GESTES_RETOUR, 4);
    const stage = readFileSync("src/components/app/stage-screens.tsx", "utf8");
    const prise = stage.slice(stage.indexOf("export function PriseStage"));
    assert.match(prise, /data-lire-sequence/);
    assert.match(prise, /t\("take\.pose"\)/);
    assert.match(prise, /why\.alreadyFiled/);
    assert.match(prise, /t\("sheet\.export"\)/);
    assert.ok(prise.indexOf("data-lire-sequence") < prise.indexOf("why.alreadyFiled"));
  });
});
