import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// The pixel walk (390×844 / 1280×800, chain geometry, PATH_APRES taps) measured
// the old three-column studio. CAST · DÉCOR · PRISE replaces that screen.
// The gates live in tests/stage.test.ts. This file only keeps the spend rule
// that used to be proved in the browser: the stage asks, the sheet spends.

describe("parcours CAST DÉCOR PRISE", () => {
  it("asks to generate from PRISE and spends only on the confirm sheet", () => {
    const stage = readFileSync("src/components/app/stage-screens.tsx", "utf8");
    const prise = stage.slice(stage.indexOf("export function PriseStage"));
    assert.match(prise, /requestRun\(\)/);
    assert.doesNotMatch(prise, /confirmRun\(/);
    const sheets = readFileSync("src/components/app/sheets.tsx", "utf8");
    const confirm = sheets.slice(sheets.indexOf("export function ConfirmSheet"), sheets.indexOf("export function FalSheet"));
    assert.match(confirm, /confirmRun\(/);
    assert.match(confirm, /data-confirm-gold/);
    assert.match(confirm, /disabled=\{!canConfirm\}/);
  });
});
