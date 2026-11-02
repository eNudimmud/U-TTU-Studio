import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { STORYBOARD_CLOSED, storyboardHeld } from "../src/app/storyboard/closed.ts";

const LANGS = ["en", "fr", "de", "es"] as const;
const load = (lang: string) => JSON.parse(readFileSync(`messages/storyboard/${lang}.json`, "utf8")).storyboard as {
  hold: Record<string, string>;
  entry: Record<string, string>;
};

test("the storyboard gate is one constant, and sw is the only bypass", () => {
  assert.equal(STORYBOARD_CLOSED, true);
  assert.equal(storyboardHeld(undefined), true);
  assert.equal(storyboardHeld("u11"), true);
  assert.equal(storyboardHeld("legacy"), true);
  assert.equal(storyboardHeld("1"), true);
  assert.equal(storyboardHeld(""), true);
  assert.equal(storyboardHeld("sw"), false);
  assert.equal(storyboardHeld("sw", true), false);
  assert.equal(storyboardHeld("u11", false), false);
  assert.equal(storyboardHeld(undefined, false), false);
  const page = readFileSync("src/app/storyboard/[[...id]]/page.tsx", "utf8");
  const body = page.slice(page.indexOf("export default"));
  const gate = body.indexOf('if (asked === "sw")');
  const held = body.indexOf("if (storyboardHeld(asked))");
  assert.ok(gate >= 0 && held > gate, "sw is decided before the closed holding page");
  assert.equal(page.includes("storyboard-u11"), false);
});

test("holding copy in EN, FR, DE and ES names Uttu, the new board, and safe boards — no date, price, or Mira", () => {
  const banned = /Mira|\$|€|£|\bcr\.|\b20\d{2}\b|gratuit|\bfree\b|kostenlos|gratis/i;
  for (const lang of LANGS) {
    const { hold, entry } = load(lang);
    for (const key of ["eyebrow", "title", "gold", "coming", "body", "back", "home", "alt"]) {
      assert.ok(hold[key]?.trim(), `${lang} hold.${key}`);
    }
    assert.ok(hold.title.includes(hold.gold), `${lang} gold word`);
    assert.match(hold.body, /Uttu/);
    assert.match(hold.body, /4/);
    assert.match(hold.alt, /^Uttu$/);
    assert.equal(hold.eyebrow, "StoryWeave");
    assert.doesNotMatch(`${hold.title} ${hold.coming} ${hold.body} ${hold.back} ${entry.soon} ${entry.soonLead} ${entry.soonOpen}`, banned, lang);
  }
});
