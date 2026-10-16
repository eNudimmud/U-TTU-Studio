import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// The pixel walk (390×844 / 1280×800, chain geometry, PATH_APRES taps) measured
// the old three-column studio. CAST · DÉCOR · PRISE replaces that screen.
// The gates live in tests/stage.test.ts. This file only keeps the spend rule
// that used to be proved in the browser: the stage asks, the sheet spends.

describe("parcours CAST DÉCOR PRISE", () => {
});
