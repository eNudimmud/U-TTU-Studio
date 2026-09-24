import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCaption, findInvariantHits, parseInvariants, wordCount } from "../src/lib/gate/captions.ts";
import { CAPTION_EXAMPLES, EXAMPLE_TRIGGER } from "../src/lib/gate/coaching.ts";
import { GATE, evaluateGate } from "../src/lib/gate/rules.ts";
import { STRENGTH_SLIDER, TEST_GRID, gridPrompt, inUsageBand } from "../src/lib/test-grid.ts";
import { INVARIANTS, cleanDataset, cleanInput } from "./fixtures.ts";

const FACE_WORDS = /\b(eyes?|hair|face|freckles?|lips|skin|nose|jaw|cheekbones?)\b/i;

describe("caption coaching", () => {
  const { fail, pass } = CAPTION_EXAMPLES;

  it("shows a PASS example the gate accepts and a FAIL example G15 blocks", () => {
    const passing = cleanDataset();
    passing[3] = { ...passing[3], angle: pass.angle, framing: pass.framing, variables: pass.variables.join(", ") };
    assert.equal(evaluateGate(cleanInput(passing)).verdict, "PASS");
    const failing = cleanDataset();
    failing[3] = { ...failing[3], angle: fail.angle, framing: fail.framing, variables: fail.variables.join(", ") };
    const g15 = evaluateGate(cleanInput(failing)).checks.find(item => item.id === "G15");
    assert.equal(g15?.status, "fail");
    assert.deepEqual(g15?.imageIds, [failing[3].id]);
  });

  it("keeps both examples in the caption format, identity only on the FAIL side", () => {
    for (const example of [fail, pass]) {
      const caption = buildCaption(EXAMPLE_TRIGGER, example.angle, example.framing, example.variables.join(", "));
      assert.ok(caption.startsWith(`${EXAMPLE_TRIGGER}, `), caption);
      assert.ok(wordCount(caption) <= GATE.maxCaptionWords, caption);
    }
    assert.ok(findInvariantHits(fail.variables.join(", "), parseInvariants(INVARIANTS)).length >= 2);
    assert.match(fail.variables.join(", "), FACE_WORDS);
    assert.doesNotMatch(pass.variables.join(", "), FACE_WORDS);
  });
});

describe("test grid", () => {
  it("sweeps 0.60 / 0.75 / 0.90 around the 0.70–0.85 usage band, on slider stops", () => {
    assert.deepEqual([...TEST_GRID.strengths], [0.6, 0.75, 0.9]);
    assert.deepEqual(TEST_GRID.strengths.map(inUsageBand), [false, true, false]);
    for (const value of TEST_GRID.strengths) {
      assert.ok(value >= STRENGTH_SLIDER.min && value <= STRENGTH_SLIDER.max, String(value));
      const stops = (value - STRENGTH_SLIDER.min) / STRENGTH_SLIDER.step;
      assert.ok(Math.abs(stops - Math.round(stops)) < 1e-9, `${value} is not a slider stop`);
    }
  });

  it("builds distinct trigger-first prompts that never describe the face", () => {
    const prompts = TEST_GRID.rows.map(row => gridPrompt(EXAMPLE_TRIGGER, row.scene));
    assert.equal(new Set(prompts).size, TEST_GRID.rows.length);
    for (const prompt of prompts) {
      assert.ok(prompt.startsWith(`${EXAMPLE_TRIGGER}, `), prompt);
      assert.doesNotMatch(prompt, FACE_WORDS);
      assert.deepEqual(findInvariantHits(prompt, parseInvariants(INVARIANTS)), []);
    }
    assert.deepEqual(TEST_GRID.rows.map(row => row.optional), [false, false, true]);
  });
});
