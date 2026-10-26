import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// User-visible copy never promises « free » and always says « crédits » in full.
const BANNED = /\bcr\.|gratuit|free\b|kostenlos|gratis/i;
// Search keywords for Uttu's FAQ: matched against what the user types, never shown.
const ALLOWED = /^uttu\.faq\.[^.]+\.k$/;

function strings(node: unknown, path: string, out: [string, string][]) {
  if (typeof node === "string") out.push([path, node]);
  else if (node && typeof node === "object") for (const [key, value] of Object.entries(node)) strings(value, path ? `${path}.${key}` : key, out);
  return out;
}

describe("copie sans « gratuit » ni « cr. »", () => {
  for (const lang of ["fr", "en", "de", "es"]) {
    it(`messages/${lang}.json`, () => {
      const all = strings(JSON.parse(readFileSync(`messages/${lang}.json`, "utf8")), "", []);
      const hits = all.filter(([key, text]) => !ALLOWED.test(key) && BANNED.test(text)).map(([key, text]) => `${key} = ${text}`);
      assert.deepEqual(hits, []);
      // An estimate always names its unit: « ≈ X crédits estimés », never « X estimés ».
      const bare = all.filter(([, text]) => /\{\w+\}\s*(estim|geschätzt)/i.test(text)).map(([key, text]) => `${key} = ${text}`);
      assert.deepEqual(bare, []);
    });
  }
  it("says credits in full when a take's cost is written to the vault", () => {
    assert.doesNotMatch(readFileSync("src/lib/coffre/model.ts", "utf8"), /\} cr\.`/);
  });
  it("says credits in full in Uttu's price simulator", () => {
    assert.doesNotMatch(readFileSync("src/components/app/uttu-free.tsx", "utf8"), /\} cr\./);
  });
});
