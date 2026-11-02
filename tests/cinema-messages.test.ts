// CE5: every cinema error has a sentence in EN/FR/DE/ES; the agent's `ineligible` is never shown as a network error.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CINEMA_MESSAGE_CODES, cinemaMessageKey } from "../src/lib/cinema/controller.ts";
import { CINEMA_ERROR_CODES } from "../src/lib/cinema/types.ts";

const LOCALES = ["en", "fr", "de", "es"] as const;
const read = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const at = (data: unknown, key: string) => key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], data);

describe("cinema messages", () => {
  it("every error code is covered and translated in the four catalogs", () => {
    for (const code of CINEMA_ERROR_CODES) assert.ok((CINEMA_MESSAGE_CODES as readonly string[]).includes(code), code);
    for (const locale of LOCALES) {
      const catalog = read(`messages/storyboard/${locale}.json`);
      for (const code of CINEMA_MESSAGE_CODES) {
        const text = at(catalog, cinemaMessageKey(code)!);
        assert.equal(typeof text, "string", `${locale} ${code}`);
        assert.doesNotMatch(String(text), /free|gratuit|kostenlos|gratis/i);
      }
    }
    assert.equal(cinemaMessageKey("INTENT_APPLIED"), null);
  });

  it("the agent's ineligible error has its own sentence in the four catalogs", () => {
    for (const locale of LOCALES) assert.equal(typeof at(read(`messages/${locale}.json`), "uttu.comfy.errors.ineligible"), "string", locale);
    assert.match(readFileSync(new URL("../src/components/app/uttu-free.tsx", import.meta.url), "utf8"), /ERROR_CODES[^;]*"ineligible"/);
  });
});
