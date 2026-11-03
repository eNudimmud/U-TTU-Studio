import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { negotiateLocale, requestLocaleFrom } from "../src/lib/i18n/config.ts";

describe("first-visit language", () => {
  it("follows the browser for fr, en, de and es", () => {
    assert.equal(negotiateLocale("en-US,en;q=0.9"), "en");
    assert.equal(negotiateLocale("fr-CH,fr;q=0.9,en;q=0.8"), "fr");
    assert.equal(negotiateLocale("de-CH"), "de");
    assert.equal(negotiateLocale("es-419,es;q=0.9"), "es");
  });

  it("respects q order and skips unsupported languages", () => {
    assert.equal(negotiateLocale("ja-JP,ja;q=0.9,de;q=0.8,en;q=0.7"), "de");
    assert.equal(negotiateLocale("en;q=0.5,es;q=0.9"), "es");
    assert.equal(negotiateLocale("fr;q=0,en"), "en");
  });

  it("defaults to English when the browser speaks none of them, or says nothing", () => {
    assert.equal(negotiateLocale("ja-JP,zh;q=0.8"), "en");
    assert.equal(negotiateLocale(""), "en");
    assert.equal(negotiateLocale(null), "en");
    assert.equal(negotiateLocale("*"), "en");
  });

  it("keeps the visitor's explicit choice over the default", () => {
    assert.equal(requestLocaleFrom("fr", "en-US,en;q=0.9"), "fr");
    assert.equal(requestLocaleFrom("es", "de-DE"), "es");
    assert.equal(requestLocaleFrom("de", null), "de");
  });

  it("opens in English for a first visit, whatever the browser language", () => {
    assert.equal(requestLocaleFrom(undefined, "fr-CH,fr;q=0.9"), "en");
    assert.equal(requestLocaleFrom(null, "de-DE"), "en");
    assert.equal(requestLocaleFrom("nope", "es-ES"), "en");
    assert.equal(requestLocaleFrom(undefined, "pt-BR"), "en");
    assert.equal(requestLocaleFrom(undefined, undefined), "en");
  });
});
