import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { EXEMPLE_PAR_GESTE } from "../src/lib/workflows/tuiles.ts";

describe("exemple de départ", () => {
  it("has the French labels and the same keys in every language", () => {
    const fr = JSON.parse(readFileSync("messages/fr.json", "utf8"));
    assert.equal(fr.gestes.startExample, "Partir de cet exemple");
    assert.equal(fr.depart.label, "Exemple — refais-le");
    for (const lang of ["en", "de", "es"]) {
      const other = JSON.parse(readFileSync(`messages/${lang}.json`, "utf8"));
      assert.deepEqual(Object.keys(other.depart).sort(), Object.keys(fr.depart).sort());
      assert.ok(other.gestes.startExample);
    }
  });
});
