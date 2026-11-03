import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { compileReferences, resolveReferences, slotPrompt, type CatalogueEntry, type ReferenceCapacity } from "../src/lib/cinema/references.ts";
import { castReferences } from "../src/lib/render/cast-references.ts";
import { LTX_REFS_MAX, ltxTakeGraph } from "../src/lib/render/ltx-graph.ts";
import { takeGraphFor } from "../src/lib/render/run.ts";
import { rolesLtx } from "../src/lib/render/take-roles.ts";
import { takePrompt } from "../src/lib/render/take-prompt.ts";

// B7 · criterion 5 on both engines. Generic cards, plus the existing Fizz/Enki fixture data.
// No request is sent: there is no client here.

const characterA = {
  id: "character-a",
  name: "Character A",
  prompt: "Character A: a tall figure in a yellow coat. Full body, neutral light, plain background.",
  photos: ["Projets/p/Cast/a-1.png", "Projets/p/Cast/a-2.png", "Projets/p/Cast/a-3.png"],
  sheet: "Projets/p/Cast/a-sheet.png",
};
const characterB = {
  id: "character-b",
  name: "Character B",
  prompt: "Character B: a small grey animal with amber eyes. Full body, neutral light, plain background.",
  photos: ["Projets/p/Cast/b-1.png"],
  sheet: "Projets/p/Cast/b-sheet.png",
};
const decor = { id: "place", name: "The terrace", pictures: ["Projets/p/Decors/place-1.png", "Projets/p/Decors/place-2.png"] };

const P = "film-p0";
const img = (path: string) => ({ assetId: `Projets/${P}/${path}`, sha256: `sha-${path}` });
const card = (category: CatalogueEntry["category"], referenceId: string, name: string, files: string[]): CatalogueEntry =>
  ({ projectId: P, category, referenceId, name, images: files.map(img) });

// The same picture lists the CE1 fixtures use. Names stay in this test, never in production code.
const FIXTURES: CatalogueEntry[] = [
  card("cast", "enki", "Enki", ["Cast/enki-1.png", "Cast/enki-2.png", "Cast/enki-3.png"]),
  card("cast", "fizz", "Fizz", ["Cast/fizz-1.png"]),
  card("decor", "quai", "Harbour", ["Decors/quai-1.png", "Decors/quai-2.png"]),
];
const LTX: ReferenceCapacity = { roles: ["identity", "environment", "object", "style", "framing"], maxImages: LTX_REFS_MAX, maxBindings: 7 };

function owners(text: string): { characters: number; place: boolean; sheet: boolean; samePerson: boolean } {
  return {
    characters: (text.match(/show(?:s)? only /g) ?? []).length,
    place: /the place/i.test(text),
    sheet: /sheet/i.test(text),
    samePerson: /same person/i.test(text),
  };
}

describe("P0 · identities do not bleed", () => {
  const refs = castReferences([characterA, characterB]);
  const prompt = takePrompt({
    traits: [],
    lookPictures: refs.photos.length,
    cast: refs.groups,
    place: { name: decor.name, note: "A terrace above the clouds.", pictures: decor.pictures.length },
    line: "Character B sits beside Character A.",
    tags: "image",
  });
  const roles = rolesLtx(
    refs.groups.map((group, index) => ({ id: index === 0 ? characterA.id : characterB.id, name: group.name, description: group.description, pictures: group.pictures })),
    { id: decor.id, name: decor.name, pictures: 1 },
  );
  const pictures = [...refs.photos, decor.pictures[0]!];
  const graph = takeGraphFor({ seconds: 5, quality: "rapide", aspect: "horizontal", engine: "ltx", rendu: "apercu" }, "They sit on the terrace.", pictures, 3, undefined, roles);
  const ltxText = JSON.stringify(graph);

  it("gives every character the same number of pictures, and never the sheet alone", () => {
    assert.deepEqual(refs.groups.map(group => group.pictures), [1, 1]);
    assert.equal(Math.max(...refs.groups.map(group => group.pictures)), Math.min(...refs.groups.map(group => group.pictures)));
    assert.deepEqual(refs.photos, ["Projets/p/Cast/a-1.png", "Projets/p/Cast/b-1.png"]);
    assert.ok(refs.photos.every(path => !path.endsWith("sheet.png")));
    assert.ok(!refs.photos.includes(characterB.sheet));
  });

  it("does not present the place as a character, and never says they are the same person", () => {
    const read = owners(prompt);
    assert.equal(read.characters, 2);
    assert.equal(read.place, true);
    assert.equal(read.samePerson, false);
    assert.match(prompt, /show the place, The terrace\./);
    assert.doesNotMatch(prompt, /place[^.]{0,40}same person/i);
    assert.doesNotMatch(prompt, /The terrace shows only/);
  });

  it("sends LTX roles for two characters, with picture tags and no one-person preamble", () => {
    assert.ok(roles);
    assert.match(roles, /<ref_image_0>/);
    assert.match(roles, /<ref_image_1>/);
    assert.match(ltxText, /<ref_image_0>/);
    assert.match(ltxText, /different characters/);
    assert.match(ltxText, /the place, The terrace\. It gives no features to anyone/);
    assert.doesNotMatch(ltxText, /same person/i);
    assert.doesNotMatch(ltxText, /one person/i);
    assert.doesNotMatch(ltxText, /The person from <ref_image_0>/);
  });

  it("reuses the Fizz and Enki fixture lists: balanced, place is not a person, roles on LTX", () => {
    const { bindings, blocked } = resolveReferences({
      projectId: P,
      catalogue: FIXTURES,
      refs: [
        { role: "qui", referenceId: "fizz", name: "Fizz" },
        { role: "qui", referenceId: "enki", name: "Enki" },
        { role: "ou", referenceId: "quai", name: "Harbour" },
      ],
    });
    assert.equal(blocked, false);
    const compiled = compileReferences(bindings, LTX, { identityViews: 1 });
    const counts = new Map<string, number>();
    for (const slot of compiled.slots) {
      if (slot.role !== "identity") continue;
      const id = bindings.find(item => item.bindingId === slot.bindingId)!.referenceId;
      counts.set(id, slot.imageIndices.length);
    }
    assert.deepEqual([...counts.values()], [1, 1]);
    const text = slotPrompt(compiled, bindings, new Map(bindings.map(item => {
      const entry = FIXTURES.find(card => card.referenceId === item.referenceId && card.category === item.category)!;
      return [item.bindingId, { name: entry.name }] as const;
    })), index => `<ref_image_${index}>`);
    assert.match(text, /<ref_image_\d+> shows only Fizz\./);
    assert.match(text, /<ref_image_\d+> shows only Enki\./);
    assert.match(text, /the place, Harbour\. It gives no features to anyone/);
    assert.doesNotMatch(text, /same person/i);
    assert.doesNotMatch(text, /Harbour shows only/);
    const shot = ltxTakeGraph({ prompt: "They sit on the terrace.", pictures: compiled.orderedAssetIds, roles: text, seed: 1, seconds: 5, aspect: "horizontal" });
    const body = JSON.stringify(shot);
    assert.match(body, /<ref_image_/);
    assert.doesNotMatch(body, /The person from <ref_image_0>/);
    assert.equal(compiled.orderedAssetIds.length <= LTX_REFS_MAX, true);
  });

  it("adds no production name", () => {
    for (const file of ["src/lib/render/take-roles.ts", "src/lib/render/cast-references.ts", "src/lib/render/take-prompt.ts", "src/lib/cinema/references.ts"]) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /\b(enki|fizz|uttu|blanche)\b/i, file);
    }
  });
});
