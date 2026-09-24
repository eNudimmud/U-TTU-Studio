import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCaption, checkTrigger, cleanVariables, findInvariantHits, normalize, parseInvariants, repeatedTerms } from "../src/lib/gate/captions.ts";
import { colorStats, dhash, hamming, median, medianAbsoluteDeviation, sharpness, toGray } from "../src/lib/gate/pixels.ts";

describe("captions", () => {
  it("normalizes accents, case and punctuation", () => {
    assert.equal(normalize("  Yeux VERTS, cicatrice (joue gauche)! "), "yeux verts cicatrice joue gauche");
  });

  it("cleans free variables into a single comma-separated line", () => {
    assert.equal(cleanVariables(" black coat ,, rainy street.\nneon light; "), "black coat, rainy street, neon light");
  });

  it("builds trigger, angle, framing, then variables", () => {
    assert.equal(buildCaption("mira_v1", "profil", "pied", "red coat"), "mira_v1, side profile view, full body shot, red coat");
    assert.equal(buildCaption("mira_v1", null, null, ""), "mira_v1");
  });

  it("parses invariants once each, ignoring noise", () => {
    assert.deepEqual(parseInvariants("green eyes; Freckles\nfreckles, a, scar on left cheek"), ["green eyes", "Freckles", "scar on left cheek"]);
  });

  it("matches invariants on whole words only", () => {
    assert.deepEqual(findInvariantHits("Green eyes, soft light", ["green eyes"]), ["green eyes"]);
    assert.deepEqual(findInvariantHits("evergreen eyeshadow", ["green eyes"]), []);
    assert.deepEqual(findInvariantHits("tiny scars", ["scar"]), ["scar"]);
  });

  it("finds copied segments and words but ignores generic vocabulary", () => {
    const copied = Array.from({ length: 10 }, (_, i) => `long silver hair, place ${i}`);
    assert.deepEqual(repeatedTerms(copied)[0], { term: "long silver hair", count: 10 });
    const varied = ["soft light, cafe", "harsh light, street", "neon light, club", "window light, office", "rim light, stage"];
    assert.deepEqual(repeatedTerms(varied), []);
  });

  it("explains why a trigger is refused", () => {
    assert.match(checkTrigger("mira") ?? "", /chiffre/);
    assert.match(checkTrigger("girl_01") ?? "", /mot courant/);
    assert.equal(checkTrigger("uttu_v1"), null);
  });
});

function image(width: number, height: number, pixel: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const [r, g, b] = pixel(x, y);
    data.set([r, g, b, 255], (y * width + x) * 4);
  }
  return data;
}

describe("pixels", () => {
  const checker = image(64, 64, (x, y) => ((x >> 2) + (y >> 2)) % 2 ? [255, 255, 255] : [0, 0, 0]);
  const flat = image(64, 64, () => [128, 128, 128]);
  const soft = image(64, 64, (x, y) => { const v = 128 + 60 * Math.sin(x / 9) * Math.cos(y / 11); return [v, v, v]; });

  it("ranks sharp detail above soft gradients and flat fields", () => {
    const sharpScore = sharpness(toGray(checker, 64, 64), 64, 64);
    const softScore = sharpness(toGray(soft, 64, 64), 64, 64);
    assert.ok(sharpScore > 1000, `checker ${sharpScore}`);
    assert.ok(softScore < 100, `soft ${softScore}`);
    assert.equal(sharpness(toGray(flat, 64, 64), 64, 64), 0);
  });

  it("hashes gradients and detects their mirror", () => {
    const ramp = image(90, 80, x => [x * 2, x * 2, x * 2]);
    const { hash, mirror } = dhash(toGray(ramp, 90, 80), 90, 80);
    assert.equal(hash, "ffffffffffffffff");
    assert.equal(mirror, "0000000000000000");
    assert.equal(hamming(hash, mirror), 64);
    const flipped = image(90, 80, x => [(89 - x) * 2, (89 - x) * 2, (89 - x) * 2]);
    assert.equal(dhash(toGray(flipped, 90, 80), 90, 80).hash, mirror);
  });

  it("measures luma and colourfulness", () => {
    const gray = colorStats(flat);
    assert.equal(Math.round(gray.luma), 128);
    assert.equal(gray.saturation, 0);
    const red = colorStats(image(4, 4, () => [255, 0, 0]));
    assert.equal(Math.round(red.luma), 76);
    assert.equal(red.saturation, 1);
  });

  it("computes robust statistics", () => {
    assert.equal(median([5, 1, 3]), 3);
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.equal(medianAbsoluteDeviation([1, 2, 3, 4, 100]), 1);
    assert.equal(hamming("0f", "f0"), 8);
    assert.equal(hamming("", "00"), Number.POSITIVE_INFINITY);
  });
});
