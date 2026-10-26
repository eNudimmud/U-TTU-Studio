import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { liftDelta, openBand } from "../src/lib/mobile-band.ts";

describe("bande mobile, 390 px", () => {
  it("scrolls a field that the chain or the keyboard would cover", () => {
    assert.equal(liftDelta({ top: 100, bottom: 160 }, 80, 400), 0);
    assert.equal(liftDelta({ top: 420, bottom: 480 }, 80, 387), 93);
    assert.equal(liftDelta({ top: 10, bottom: 60 }, 80, 387), -70);
    assert.equal(liftDelta({ top: 100, bottom: 500 }, 80, 387), 20);
    assert.equal(liftDelta({ top: 10, bottom: 40 }, 80, 40), 0);
  });

});
describe("bande ouverte, chaîne en haut ou en bas", () => {
  it("phone upright: header at the top, chain at the bottom", () => {
    assert.deepEqual(openBand([{ top: 0, bottom: 56 }, { top: 780, bottom: 844 }], 0, 844, 60), { top: 64, bottom: 768 });
  });
  it("MONTAGE, landscape, large screen: the chain under the header is a top bar", () => {
    assert.deepEqual(openBand([{ top: 0, bottom: 56 }, { top: 64, bottom: 124 }], 0, 800, 60), { top: 132, bottom: 788 });
  });
  it("keyboard open: the bottom chain hidden under the keyboard does not count", () => {
    assert.deepEqual(openBand([{ top: 0, bottom: 56 }, { top: 780, bottom: 844 }], 0, 500, 60), { top: 64, bottom: 488 });
  });
  it("844×390 with the keyboard: no room between the bars, use the visible area", () => {
    const band = openBand([{ top: 0, bottom: 56 }, { top: 64, bottom: 124 }], 0, 160, 60);
    assert.deepEqual(band, { top: 4, bottom: 152 });
    assert.equal(liftDelta({ top: 300, bottom: 360 }, band.top, band.bottom), 208);
  });
});
