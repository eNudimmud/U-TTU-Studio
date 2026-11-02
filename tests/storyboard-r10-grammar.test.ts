// CE5-L · R10: a structural action is read from the whole command, never from an isolated word.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lireCorrection, lireReglage } from "../src/lib/storyboard/corriger.ts";

/** The storyboard page's local router (storyboard-page.tsx). */
const route = (text: string, selected?: number) =>
  lireCorrection(text) ?? (selected ? lireCorrection(text, selected) : null) ?? lireReglage(text, selected);
const structural = new Set(["ajouter", "retirer", "deplacer", "format", "raccourcir"]);

describe("CE5-L · R10 whole-command grammar", () => {
  it("never moves or removes a shot for a framing or a setting word", () => {
    for (const text of ["Make it a close-up", "Fais-en un gros plan", "Mach eine Nahaufnahme", "Hazlo un primer plano", "Move the camera up", "Pan up to the sky"]) {
      const read = route(text, 2);
      assert.ok(!read || !structural.has(read.type), `${text} → ${read?.type}`);
    }
  });

  it("removal or negation of an element is neither a structural action nor a local setting (4 languages)", () => {
    for (const text of ["Remove the rain", "Enlève la pluie", "Entferne den Regen", "Quita la lluvia", "no rain", "sans pluie", "ohne Regen", "sin lluvia", "cut the rain", "don't remove shot 3", "ne supprime pas le plan 3", "lösche Einstellung 3 nicht", "no borres el plano 3"]) {
      assert.equal(route(text, 2), null, text);
    }
  });

  it("a second clause or a second shot goes to clarification, never a guess", () => {
    for (const text of ["remove shot 3 and add a shot", "retire le plan 3 et le plan 4", "move shot 2 later then remove shot 4", "Einstellung 2 und Einstellung 3 entfernen", "quita el plano 2 y el plano 3", "add rain to the shot"]) {
      assert.equal(route(text, 2), null, text);
    }
  });

  it("keeps the explicit commands, with the object in scope (FR/EN/DE/ES)", () => {
    const cases: [string, number | undefined, unknown][] = [
      ["remove it", 2, { type: "retirer", n: 2 }],
      ["delete this shot", 2, { type: "retirer", n: 2 }],
      ["supprime ce plan", 2, { type: "retirer", n: 2 }],
      ["lösche die Einstellung", 2, { type: "retirer", n: 2 }],
      ["bórralo", 2, { type: "retirer", n: 2 }],
      ["please remove shot 3", undefined, { type: "retirer", n: 3 }],
      ["retire le plan 3 s'il te plaît", undefined, { type: "retirer", n: 3 }],
      ["move it earlier", 3, { type: "deplacer", n: 3, pas: -1 }],
      ["avance-le", 3, { type: "deplacer", n: 3, pas: -1 }],
      ["décale le plan 2 plus tard", undefined, { type: "deplacer", n: 2, pas: 1 }],
      ["verschiebe sie nach vorn", 3, { type: "deplacer", n: 3, pas: -1 }],
      ["mueve el plano 2 antes", undefined, { type: "deplacer", n: 2, pas: -1 }],
      ["noch eine Einstellung", undefined, { type: "ajouter", fin: false }],
      ["otro plano", undefined, { type: "ajouter", fin: false }],
      ["format réseaux", undefined, { type: "format", format: "portrait" }],
      ["acorta a 15 s", undefined, { type: "raccourcir", secondes: 15 }],
    ];
    for (const [text, selected, expected] of cases) assert.deepEqual(route(text, selected), expected, text);
  });

  it("a framing request stays a setting of the selected shot", () => {
    assert.deepEqual(route("Make it a close-up", 2), { type: "reglage", n: 2, camera: null, cadrage: "serre", note: "A close-up" });
  });
});
