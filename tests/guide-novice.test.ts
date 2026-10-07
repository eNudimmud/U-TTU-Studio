import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

/** A disabled control whose own label already names the wait. */
const LABEL_IS_THE_REASON = [/disabled=\{importing\}/, /disabled=\{placeRun === "running"\}/];

function mutedControls(source: string): string[] {
  return source.split("disabled={").slice(1);
}

describe("guide novice", () => {
  it("says why, in four languages, without a node or a trained-file word", () => {
    const catalogs = ["fr", "en", "de", "es"].map(locale => JSON.parse(read(`messages/${locale}.json`)) as {
      why: Record<string, string>;
      guide: Record<string, string>;
      take: { soft: string };
      fiche: { lead: string };
    });
    for (const catalog of catalogs) {
      for (const key of ["unchanged", "needName", "needKey", "planFresh", "hold"]) {
        assert.equal(typeof catalog.why[key], "string", key);
        assert.ok(catalog.why[key].length > 8, catalog.why[key]);
      }
      for (const key of ["stepCharacter", "stepScene", "stepTake"]) {
        const line = catalog.guide[key];
        assert.equal(typeof line, "string", key);
        assert.ok(line.length <= 90, line);
        assert.doesNotMatch(line, /\b(lora|comfy|fal|nœud|noeud|coffre|vault)\b/i, line);
      }
      assert.doesNotMatch(catalog.take.soft, /SOFT ERROR/i);
      assert.doesNotMatch(catalog.fiche.lead, /Cinq gestes|Five gestures|Fünf Gesten|Cinco gestos/);
    }
    assert.equal(catalogs[0].take.soft, "Ça n\u2019a pas abouti.");
    assert.equal(catalogs[1].take.soft, "It did not land.");
    assert.equal(catalogs[2].take.soft, "Es ist nicht zustande gekommen.");
    assert.equal(catalogs[3].take.soft, "No ha salido.");
    assert.equal(catalogs[0].why.needKey, "Il manque la cl\u00e9.");
    assert.equal(catalogs[0].why.needName, "Il manque un nom.");
    assert.equal(catalogs[0].why.hold, "Le devis ou le solde ne laisse pas partir.");
  });

  it("puts the sentence under a muted control, and a line on the chain", () => {
    const screens = read("src/components/app/screens.tsx");
    const role = read("src/components/app/lora-screen.tsx");
    const sheets = read("src/components/app/sheets.tsx");
    assert.match(role, /t\("guide\.stepCharacter"\)/);
    assert.match(screens, /t\("guide\.stepScene"\)/);
    assert.match(screens, /t\("guide\.stepTake"\)/);
    for (const source of [screens, role, sheets]) {
      let from = 0;
      for (const control of mutedControls(source)) {
        const at = source.indexOf(`disabled={${control.slice(0, 80)}`, from);
        from = at + 1;
        const around = source.slice(Math.max(0, at - 240), at + 80);
        if (LABEL_IS_THE_REASON.some(pattern => pattern.test(around))) {
          assert.match(source.slice(Math.max(0, at - 240), at + 700), /scene\.training|sheet\.importing/);
          continue;
        }
        const rest = source.slice(at);
        const close = rest.search(/<\/button>/);
        assert.ok(close > 0, rest.slice(0, 80));
        assert.match(rest.slice(close, close + 80), /<Why /, rest.slice(0, 80));
      }
    }
    const css = read("src/components/app/app.css");
    const phone = css.slice(0, css.indexOf("@media (min-width: 720px)"));
    assert.match(phone, /\.u-why \{/);
    assert.match(phone, /\.u-micro \{/);
    assert.doesNotMatch(phone, /\.u-why \{[^}]*height: 100dvh/);
    assert.doesNotMatch(screens + role + sheets, /class_type|SaveLoRA|panneau de nœuds/);
  });
});
