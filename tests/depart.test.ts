import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { DEPARTS, montrerDepart } from "../src/lib/creation/depart.ts";
import { EXEMPLE_PAR_GESTE } from "../src/lib/workflows/tuiles.ts";

describe("exemple de départ", () => {
  it("has a real house file for each step", () => {
    for (const item of Object.values(DEPARTS)) assert.ok(existsSync(`public${item.image}`), item.image);
  });
  it("fills CAST and DÉCOR through a gesture that has an example", () => {
    assert.ok(EXEMPLE_PAR_GESTE[DEPARTS.cast.geste]);
    assert.ok(EXEMPLE_PAR_GESTE[DEPARTS.decor.geste]);
  });
  it("shows only on an empty step with no asset of the visitor", () => {
    assert.equal(montrerDepart({ mesAssets: 0, rempli: false }), true);
    assert.equal(montrerDepart({ mesAssets: 1, rempli: false }), false);
    assert.equal(montrerDepart({ mesAssets: 0, rempli: true }), false);
  });
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
