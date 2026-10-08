import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { BILLED_MEASURE } from "../src/lib/render/billed-quote.ts";
import { castReady, decorReady, priseNext, priseReady, quotedCredits } from "../src/lib/stage.ts";

const read = (path: string) => readFileSync(path, "utf8");

describe("CAST, DÉCOR, PRISE", () => {
  it("treats two photos and the offered name as ready, and a cleared name as empty", () => {
    assert.equal(castReady({ name: "Personnage 1", photos: ["a", "b"] }), true);
    assert.equal(castReady({ name: "Personnage 1", photos: ["a"] }), false);
    assert.equal(castReady({ name: "Personnage 1", photos: ["a", "b", "c", "d"] }), false);
    assert.equal(castReady({ name: "  ", photos: ["a", "b"] }), false);
    assert.equal(decorReady(0), false);
    assert.equal(decorReady(1), true);
    assert.equal(priseReady({ cast: true, decor: true, line: "Le personnage est dans le lieu." }), true);
    assert.equal(priseReady({ cast: true, decor: true, line: "  " }), false);
    assert.equal(priseReady({ cast: false, decor: true, line: "Le personnage est dans le lieu." }), false);
  });

  it("offers generate only after the pieces, the account and a spendable quote", () => {
    const base = { cast: true, decor: true, line: "Elle avance.", connected: true, canSpend: true };
    assert.equal(priseNext({ ...base, cast: false }), "cast");
    assert.equal(priseNext({ ...base, decor: false }), "decor");
    assert.equal(priseNext({ ...base, line: "" }), "action");
    assert.equal(priseNext({ ...base, connected: false }), "connect");
    assert.equal(priseNext({ ...base, canSpend: false }), "hold");
    assert.equal(priseNext(base), "generate");
  });

  it("quotes the billed 4 credits and nothing when the setting is unmeasured", () => {
    assert.equal(quotedCredits({ source: "billed", measure: BILLED_MEASURE }), 4);
    assert.equal(quotedCredits({ source: "balance", credits: 4, at: "2026-10-07", runs: 1 }), 4);
    assert.equal(quotedCredits({ source: "unmeasured" }), null);
  });

  it("keeps one gold button per section, a reason when it is off, and the spend behind the confirm sheet", () => {
    const stage = read("src/components/app/stage-screens.tsx");
    const cast = stage.slice(stage.indexOf("export function CastStage"), stage.indexOf("export function DecorStage"));
    const decor = stage.slice(stage.indexOf("export function DecorStage"), stage.indexOf("export function PriseStage"));
    const prise = stage.slice(stage.indexOf("export function PriseStage"));
    assert.equal(cast.match(/className="u-primary"/g)?.length, 1);
    assert.equal(decor.match(/className="u-primary"/g)?.length, 1);
    assert.match(cast, /data-cast-gold/);
    assert.match(cast, /aria-describedby=\{!ready \? "u-why-cast"/);
    assert.match(decor, /data-decor-gold/);
    assert.match(decor, /aria-describedby=\{blocked \? "u-why-decor"/);
    assert.match(prise, /data-prise-gold/);
    assert.match(prise, /aria-describedby=\{blocked \? "u-why-prise"/);
    assert.match(prise, /requestRun\(\)/);
    assert.doesNotMatch(prise, /confirmRun\(/);
    assert.match(prise, /goCast\(\)/);
    assert.match(prise, /goDecor\(\)/);
    assert.match(prise, /data-lire-sequence/);
    assert.match(prise, /why\.alreadyFiled/);
    assert.match(prise, /t\("sheet\.export"\)/);
    assert.match(read("src/components/app/studio-app.tsx"), /data-state=\{marks\[step\.id\] \? "pret" : "vide"\}/);
    const drawer = read("src/components/app/studio-drawer.tsx");
    assert.match(drawer, /t\("nav\.character"\)/);
    assert.match(drawer, /t\("nav\.scene"\)/);
    assert.match(drawer, /t\("nav\.take"\)/);
    assert.match(drawer, /quoteSentence\(takeQuote\)/);
    assert.doesNotMatch(drawer, /className="u-primary"/);
  });
});
