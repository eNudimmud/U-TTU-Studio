// CE5-L · identities: CAST cards without pictures and CAST references take part; dedupe by ID; homonyms clarify.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { catalogue, contexteDuCatalogue, referencesDuCatalogue } from "../src/lib/storyboard/identites.ts";
import { definirPersonnage, ecrireStoryboard, titreDeLIdee, type Gabarits } from "../src/lib/storyboard/ecrire.ts";
import fr from "../messages/storyboard/fr.json" with { type: "json" };

const gabarits = (fr as { storyboard: { gabarits: Gabarits } }).storyboard.gabarits;
const opts = { dureeCible: 15 as const, format: "paysage" as const, formatChoisi: true, gabarits, now: "2026-11-01T12:00:00.000Z", suffixe: "a1" };
const refs = (sb: ReturnType<typeof ecrireStoryboard>["storyboard"]) => sb.sequences.flatMap(seq => seq.plans.flatMap(plan => plan.refs));

describe("CE5-L · identities", () => {
  it("a CAST card without picture exists; « exists » and « ready » are two states", () => {
    const cat = catalogue([{ id: "fizz", name: "Fizz", sheet: null, photos: [] }, { id: "enki", name: "Enki", sheet: "x.png", photos: [] }], [], []);
    assert.deepEqual(cat.cast.known.map(item => item.id).sort(), ["enki", "fizz"]);
    assert.deepEqual(cat.cast.ready, ["enki"]);
  });

  it("a card and its reference with the same ID are one identity; CAST and DÉCOR stay apart", () => {
    const cat = catalogue([{ id: "fizz", name: "Fizz", photos: [] }], [{ id: "nef", name: "La nef" }], [
      { id: "fizz", name: "Fizz", category: "cast", images: ["a.png"] },
      { id: "blanche", name: "Blanche", category: "cast" },
      { id: "quai", name: "Quai Nord", category: "decor" },
    ]);
    assert.deepEqual(cat.cast.known.map(item => item.name).sort(), ["Blanche", "Fizz"]);
    assert.deepEqual(cat.cast.ready, ["fizz"]);
    assert.deepEqual(cat.decor.known.map(item => item.name).sort(), ["La nef", "Quai Nord"]);
    assert.deepEqual(cat.cast.ambiguous, []);
  });

  it("two IDs with the same name are never merged: the name is ambiguous", () => {
    const cat = catalogue([{ id: "fizz-1", name: "Fizz" }, { id: "fizz-2", name: "fizz " }], [], []);
    assert.deepEqual(cat.cast.known, []);
    assert.deepEqual(cat.cast.ambiguous, ["fizz"]);
    // The native agent sees both, by ID, so it has to ask.
    assert.deepEqual(referencesDuCatalogue([{ id: "fizz-1", name: "Fizz" }, { id: "fizz-2", name: "fizz" }], [], []).map(ref => ref.referenceId), ["fizz-1", "fizz-2"]);
  });

  it("no second « Fizz »: a known identity without picture is linked, never listed as new", () => {
    const ctx = contexteDuCatalogue(catalogue([{ id: "fizz", name: "Fizz", sheet: null, photos: [] }], [], []));
    const ecrit = ecrireStoryboard("Fizz traverse la ville sous la pluie.", ctx, opts);
    assert.ok(refs(ecrit.storyboard).some(ref => ref.role === "qui" && ref.id === "fizz"));
    assert.ok(!ecrit.nouveaux.includes("Fizz"));
    assert.ok(ecrit.repris.includes("Fizz"));
  });

  it("a homonym is neither linked nor created: the writer asks who", () => {
    const ctx = contexteDuCatalogue(catalogue([{ id: "fizz-1", name: "Fizz" }, { id: "fizz-2", name: "Fizz" }, { id: "enki", name: "Enki" }], [], []));
    const ecrit = ecrireStoryboard("Fizz traverse la ville.", ctx, opts);
    assert.ok(!refs(ecrit.storyboard).some(ref => ref.role === "qui"));
    assert.ok(!ecrit.nouveaux.includes("Fizz"));
    assert.deepEqual(ecrit.question, { type: "qui" });
    assert.equal(definirPersonnage(ecrit.storyboard, "Fizz", ctx, gabarits.quelquun), ecrit.storyboard);
  });

  it("the idea's shot is titled from its action; titles never cut a list of names", () => {
    const ctx = contexteDuCatalogue(catalogue([{ id: "uttu", name: "Uttu" }], [], []));
    const action = ecrireStoryboard("Uttu traverse le quai sous la pluie.", ctx, opts).storyboard.sequences[0]!.plans.find(plan => plan.titre !== gabarits.plans.etablir.titre && plan.titre !== gabarits.plans.fin.titre)!;
    assert.equal(action.titre, "Uttu traverse le quai");
    assert.equal(titreDeLIdee("Fizz, Enki et Blanche traversent la nef; puis ils sortent"), "Fizz, Enki et Blanche traversent");
    assert.equal(titreDeLIdee("Uttu says “We have one hour.”"), "Uttu “We have one hour.”");
  });
});
