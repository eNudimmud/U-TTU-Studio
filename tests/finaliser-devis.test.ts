import { test } from "node:test";
import assert from "node:assert/strict";
import { finaliserVideoCredits, suiteQuote } from "../src/lib/suite/quote.ts";
import { outilQuote } from "../src/lib/outils/graphs.ts";
import { OUTILS } from "../src/lib/outils/catalogue.ts";

const finaliser = OUTILS.find(o => o.id === "vid-finaliser")!;

test("Agrandir une vidéo: the 7 measured runs (1280×736, 5.17 s, 24 fps → 1878×1080) cost 41–43", () => {
  const q = finaliserVideoCredits(5.17, { width: 1280, height: 736, fps: 24 });
  assert.ok(q.credits >= 41 && q.credits <= 43, `credits ${q.credits}`);
  assert.ok(q.high >= 43, `high ${q.high}`);
});

test("Agrandir une vidéo: the first measure (832×480, 5 s, 16 fps) stays ≈27.5", () => {
  const q = finaliserVideoCredits(5, { width: 832, height: 480, fps: 16 });
  assert.ok(Math.abs(q.credits - 27.5) <= 1, `credits ${q.credits}`);
});

test("Agrandir une vidéo: longer clips and higher frame rates cost more", () => {
  const base = finaliserVideoCredits(5, { width: 1280, height: 720, fps: 24 }).credits;
  assert.ok(finaliserVideoCredits(10, { width: 1280, height: 720, fps: 24 }).credits > base * 1.9);
  assert.ok(finaliserVideoCredits(5, { width: 1280, height: 720, fps: 30 }).credits > base);
});

test("Agrandir une vidéo: the tool quote uses the clip's size and fps", () => {
  const measured = outilQuote(finaliser, { seconds: 5.17, source: { width: 1280, height: 736, fps: 24 } })!;
  assert.ok(measured.credits >= 41 && measured.credits <= 43, `outil ${measured.credits}`);
  const small = outilQuote(finaliser, { seconds: 5, source: { width: 832, height: 480, fps: 16 } })!;
  assert.ok(small.credits < measured.credits);
  // Without facts the default (24 fps, 1080p out) never under-quotes the measured case.
  assert.ok(outilQuote(finaliser, { seconds: 5.17 })!.credits >= 41);
  assert.ok(suiteQuote("suite-finaliser-video", { seconds: 5.17, source: { width: 1280, height: 736, fps: 24 } })!.credits >= 41);
});
