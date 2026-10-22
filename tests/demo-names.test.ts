import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEMO_CAST, DEMO_DECOR } from "../src/lib/creation/demo.ts";

// The house examples are named in French in demo.ts; PRISE shows them through demoNames.<id>.
const load = (locale: string) => JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));

test("every house example has a name in FR, EN, DE and ES", () => {
  const fr = load("fr").demoNames;
  for (const card of [...DEMO_CAST, ...DEMO_DECOR]) {
    assert.equal(fr[card.id], card.name, card.id);
    for (const locale of ["en", "de", "es"]) {
      const name = load(locale).demoNames?.[card.id];
      assert.ok(typeof name === "string" && name.length > 0, `${locale} ${card.id}`);
      if (card.name !== "DJ") assert.notEqual(name, card.name, `${locale} ${card.id} still in French`);
    }
  }
});
