import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FAL_ACCESS_MIN } from "../src/lib/fal-stack.ts";
import { invariantFieldError, prepareLaunch, runIfPrepareAllowed, type PrepareAttempt } from "../src/lib/prepare-preflight.ts";

const ready: PrepareAttempt = {
  proxyOn: true,
  refCount: 2,
  trigger: "mira_v1",
  invariants: "green eyes, freckles",
  token: "x".repeat(FAL_ACCESS_MIN),
  busy: false,
};

describe("prepare preflight", () => {
  it("launches only with a trigger, 2 or 3 photos and at least 2 invariants", () => {
    assert.deepEqual(prepareLaunch(ready), { launch: true });
    assert.deepEqual(prepareLaunch({ ...ready, refCount: 3 }), { launch: true });
    assert.deepEqual(prepareLaunch({ ...ready, invariants: "green eyes, freckles, scar" }), { launch: true });
  });

  it("does not launch when invariants are missing, duplicated or only one", async () => {
    for (const invariants of ["", "green eyes", "green eyes, green eyes", "a, b", "eyes"]) {
      const attempt = { ...ready, invariants };
      assert.equal(prepareLaunch(attempt).launch, false, invariants || "(vide)");
      let called = false;
      const ran = await runIfPrepareAllowed(attempt, async () => { called = true; });
      assert.equal(ran, null);
      assert.equal(called, false, invariants || "(vide)");
    }
  });

  it("does not launch when the trigger, the photos, the proxy or the code are incomplete", async () => {
    const attempts: PrepareAttempt[] = [
      { ...ready, trigger: "" },
      { ...ready, trigger: "mira" },
      { ...ready, refCount: 0 },
      { ...ready, refCount: 1 },
      { ...ready, refCount: 4 },
      { ...ready, proxyOn: false },
      { ...ready, token: "court" },
      { ...ready, busy: true },
    ];
    for (const attempt of attempts) {
      assert.equal(prepareLaunch(attempt).launch, false);
      let called = false;
      assert.equal(await runIfPrepareAllowed(attempt, async () => { called = true; }), null);
      assert.equal(called, false);
    }
  });

  it("names a short invariant list on the field, and stays quiet while it is empty", () => {
    assert.equal(invariantFieldError(""), null);
    assert.equal(invariantFieldError("   "), null);
    assert.match(invariantFieldError("green eyes") ?? "", /Encore un trait/);
    assert.match(invariantFieldError("a, b") ?? "", /3 lettres/);
    assert.equal(invariantFieldError("green eyes, freckles"), null);
  });
});
