import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { CAST_VIEWS_MAX, castDescription, castReferences } from "../src/lib/render/cast-references.ts";
import { takePrompt } from "../src/lib/render/take-prompt.ts";

// Generic names on purpose: the fix must never depend on who the characters are.
const ada = { name: "Ada", prompt: "Ada: a tall woman in a long red coat, short black hair. Full body, neutral light, plain background.", photos: ["Projets/p/Cast/ada-1.png", "Projets/p/Cast/ada-2.png", "Projets/p/Cast/ada-3.png"], sheet: "Projets/p/Cast/ada-sheet.png" };
const pip = { name: "Pip", prompt: "Pip: a small grey fox with amber eyes. Full body, neutral light, plain background.", photos: ["Projets/p/Cast/pip-1.jpg"], sheet: "Projets/p/Cast/pip-sheet.png" };
const sheetOnly = { name: "Zed", prompt: "Zed, the character of this film shot: night chase. Full body, neutral light, plain background.", photos: [], sheet: "Projets/p/Cast/zed-sheet.png" };

describe("#212 · références CAST : vues propres d'abord, équilibrées", () => {
  it("sends a clean photo, never the sheet, when the card has one", () => {
    const refs = castReferences([pip]);
    assert.deepEqual(refs.photos, ["Projets/p/Cast/pip-1.jpg"]);
    assert.ok(!refs.photos.some(path => path.endsWith("sheet.png")));
  });

  it("falls back to the sheet only when no clean view exists", () => {
    assert.deepEqual(castReferences([sheetOnly]).photos, ["Projets/p/Cast/zed-sheet.png"]);
  });

  it("keeps one picture for a lone character (count unchanged)", () => {
    assert.equal(castReferences([ada]).photos.length, 1);
  });

  it("balances pictures per character: nobody gets more than the scarcest one, capped", () => {
    const refs = castReferences([ada, pip]);
    assert.deepEqual(refs.groups.map(group => group.pictures), [1, 1]);
    assert.deepEqual(refs.photos, ["Projets/p/Cast/ada-1.png", "Projets/p/Cast/pip-1.jpg"]);
    const rich = { ...pip, photos: ["a.jpg", "b.jpg", "c.jpg"] };
    const both = castReferences([ada, rich]);
    assert.deepEqual(both.groups.map(group => group.pictures), [CAST_VIEWS_MAX, CAST_VIEWS_MAX]);
    const counts = both.groups.map(group => group.pictures);
    assert.equal(Math.max(...counts), Math.min(...counts), "no character outweighs another");
  });

  it("orders pictures character by character, clean views before any sheet", () => {
    const refs = castReferences([pip, sheetOnly, ada]);
    assert.deepEqual(refs.photos, ["Projets/p/Cast/pip-1.jpg", "Projets/p/Cast/zed-sheet.png", "Projets/p/Cast/ada-1.png"]);
  });

  it("reads a one-line description from the card text, without boilerplate", () => {
    assert.equal(castDescription(ada), "a tall woman in a long red coat, short black hair");
    assert.equal(castDescription(pip), "a small grey fox with amber eyes");
    assert.equal(castDescription(sheetOnly), "", "a shot line is not a description of who the character is");
  });
});

describe("#212 · texte de la prise à plusieurs personnages", () => {
  const refs = castReferences([ada, { ...pip, photos: ["x.jpg", "y.jpg"] }]);
  const text = takePrompt({ traits: [], lookPictures: refs.photos.length, cast: refs.groups, place: { name: "Harbour", note: "", pictures: 1 }, line: "They cross the quay.", tags: "image" });

  it("never says several characters are the same person", () => {
    assert.doesNotMatch(text, /same person/i);
    assert.match(text, /These are 2 different characters: never blend, swap or copy features between them\./);
  });

  it("maps each picture range to its own named character with its description", () => {
    assert.match(text, /^Image 1 and Image 2 show only Ada \(a tall woman in a long red coat, short black hair\)\./);
    assert.match(text, /Image 3 and Image 4 show only Pip \(a small grey fox with amber eyes\)\./);
    assert.match(text, /Image 5 shows the place, Harbour\./);
  });

  it("says outfit only for a character whose sheet mentions clothing", () => {
    assert.match(text, /Keep Ada's own face, species, body, colours and outfit\./);
    assert.match(text, /Keep Pip's own face, species, body and colours\./);
    assert.doesNotMatch(text, /Pip's own[^.]*outfit/);
  });

  it("leaves the lone-character text exactly as before", () => {
    const lone = castReferences([ada]);
    const single = takePrompt({ traits: [], lookPictures: 1, subject: "Ada", cast: undefined, place: null, line: "She walks.", tags: "image" });
    assert.equal(single, "Image 1 shows Ada, the same person. Keep this person for the whole shot. The shot: She walks.");
    assert.equal(takePrompt({ traits: [], lookPictures: 1, cast: lone.groups, subject: "Ada", place: null, line: "She walks.", tags: "image" }), single, "a one-member cast falls back to the old text");
  });
});

describe("#212 · le film envoie la même liste que le texte", () => {
  const source = readFileSync("src/components/app/studio-session.tsx", "utf8");
  it("no longer puts a sheet before a character's photos", () => {
    assert.doesNotMatch(source, /sheet \? \[(card|who)\.sheet\] : (card|who)\.photos\.slice\(0, 1\)/);
  });
  it("tournerPlan and confirmRun share castReferences", () => {
    assert.ok((source.match(/castReferences\(/g) ?? []).length >= 2);
  });
  it("has no hard-coded character name in the fix", () => {
    const fix = readFileSync("src/lib/render/cast-references.ts", "utf8") + readFileSync("src/lib/render/take-prompt.ts", "utf8");
    assert.doesNotMatch(fix, /\b(enki|fizz|uttu|blanche)\b/i);
  });
});
