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

import { placeMenu } from "../src/lib/mobile-band.ts";

describe("placeMenu, collision avec header et onglets", () => {
  const band = { top: 64, bottom: 780 }; // 390×844: header 64, tabs from 780
  const size = { width: 280, height: 180 };

  it("ouvre au-dessus quand il y a la place (ancre basse)", () => {
    const box = placeMenu({
      anchor: { top: 520, bottom: 568, left: 16, width: 48 },
      size, band, viewportWidth: 390,
    });
    assert.equal(box.place, "above");
    assert.ok(box.top >= band.top);
    assert.ok(box.top + box.maxHeight <= 520);
  });

  it("ouvre en dessous quand le header mange l'espace au-dessus (ancre haute)", () => {
    // Ancre juste sous le header : 180 px ne rentrent pas au-dessus
    const box = placeMenu({
      anchor: { top: 120, bottom: 168, left: 16, width: 48 },
      size, band, viewportWidth: 390,
    });
    assert.equal(box.place, "below");
    assert.ok(box.top >= 168);
    assert.ok(box.top + size.height <= band.bottom);
  });

  it("passe en sheet dans la bande si ni dessus ni dessous ne suffisent", () => {
    const tight = { top: 64, bottom: 200 };
    const box = placeMenu({
      anchor: { top: 100, bottom: 148, left: 16, width: 48 },
      size: { width: 280, height: 220 },
      band: tight,
      viewportWidth: 390,
    });
    assert.equal(box.place, "sheet");
    assert.ok(box.top >= tight.top);
    assert.ok(box.top + box.maxHeight <= tight.bottom);
    assert.ok(box.left >= 8);
  });

  it("garde le menu dans le viewport en horizontal", () => {
    const box = placeMenu({
      anchor: { top: 520, bottom: 568, left: 350, width: 48 },
      size, band, viewportWidth: 390,
    });
    assert.ok(box.left + box.width <= 390 - 8);
    assert.ok(box.left >= 8);
  });

  it("844×390 paysage : sheet dans la bande étroite entre header et tabs", () => {
    const landscape = { top: 48, bottom: 326 };
    const box = placeMenu({
      anchor: { top: 160, bottom: 200, left: 40, width: 48 },
      size: { width: 300, height: 180 },
      band: landscape,
      viewportWidth: 844,
    });
    assert.ok(box.top >= landscape.top);
    assert.ok(box.top + box.maxHeight <= landscape.bottom);
  });
});
