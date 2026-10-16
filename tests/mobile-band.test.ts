import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { liftDelta } from "../src/lib/mobile-band.ts";

describe("bande mobile, 390 px", () => {
  it("scrolls a field that the chain or the keyboard would cover", () => {
    assert.equal(liftDelta({ top: 100, bottom: 160 }, 80, 400), 0);
    assert.equal(liftDelta({ top: 420, bottom: 480 }, 80, 387), 93);
    assert.equal(liftDelta({ top: 10, bottom: 60 }, 80, 387), -70);
    assert.equal(liftDelta({ top: 100, bottom: 500 }, 80, 387), 20);
    assert.equal(liftDelta({ top: 10, bottom: 40 }, 80, 40), 0);
  });

});