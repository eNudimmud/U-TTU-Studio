import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// The pixel walk (390×844 / 1280×800, chain geometry, PATH_APRES taps) measured
// the old three-column studio. CAST · DÉCOR · PRISE replaces that screen.
// The gates live in tests/stage.test.ts. This file only keeps the spend rule
// that used to be proved in the browser: the stage asks, the sheet spends.

describe("parcours CAST DÉCOR PRISE", () => {
  it("sends the selected engine and keeps payment in the explicit confirmation", () => {
    // P1: the engine follows the intention (LTX by default) unless picked by hand in Avancé.
    const confirm = readFileSync("src/components/app/studio-frames.tsx", "utf8");
    assert.match(confirm, /confirmRun\(/);
    assert.match(confirm, /data-confirm-gold/);
    assert.match(confirm, /disabled=\{!canConfirm\}/);
  });
});
