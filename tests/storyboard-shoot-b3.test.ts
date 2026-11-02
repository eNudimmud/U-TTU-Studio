import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { LTX_REFS_MAX } from "../src/lib/render/ltx-graph.ts";
import { takeGraphFor } from "../src/lib/render/run.ts";
import { castReferences } from "../src/lib/render/cast-references.ts";
import { takePrompt } from "../src/lib/render/take-prompt.ts";
import { rolesLtx } from "../src/lib/render/take-roles.ts";
import { refusTournageStoryboard, versPlanFilm } from "../src/lib/storyboard/film.ts";
import { planVide, storyboardVide } from "../src/lib/storyboard/storyboard.ts";
import type { TakeSettings } from "../src/lib/render/take-graph.ts";

// Generic fixtures. Nothing here is a production name, and nothing is sent.
const ada = { id: "ada", name: "Ada", prompt: "Ada: a tall woman in a long red coat. Full body, neutral light, plain background.", photos: ["Projets/p/Cast/ada-1.png", "Projets/p/Cast/ada-2.png", "Projets/p/Cast/ada-3.png"], sheet: "Projets/p/Cast/ada-sheet.png" };
const pip = { id: "pip", name: "Pip", prompt: "Pip: a small grey fox with amber eyes. Full body, neutral light, plain background.", photos: ["Projets/p/Cast/pip-1.jpg"], sheet: "Projets/p/Cast/pip-sheet.png" };

const ltx: TakeSettings = { seconds: 5, quality: "rapide", aspect: "horizontal", engine: "ltx", rendu: "apercu" };
const h3: TakeSettings = { seconds: 5, quality: "rapide", aspect: "horizontal", engine: "h3" };

function kleinText(graph: ReturnType<typeof takeGraphFor>): string {
  return Object.values(graph).map(node => typeof node.inputs?.prompt === "string" ? node.inputs.prompt : typeof node.inputs?.value === "string" ? node.inputs.value : "").join("\n");
}

describe("B3 · storyboard shoot refuses an unknown name", () => {
  it("returns REF_MISSING and does not describe a send when a character or a place is new", () => {
    assert.equal(refusTournageStoryboard({ origine: "storyboard", nouveaux: [{ nom: "Nobody" }], nouveauLieu: null }), "REF_MISSING");
    assert.equal(refusTournageStoryboard({ origine: "storyboard", nouveaux: [], nouveauLieu: { nom: "Nowhere" } }), "REF_MISSING");
    assert.equal(refusTournageStoryboard({ origine: "storyboard", nouveaux: [], nouveauLieu: null }), null);
    assert.equal(refusTournageStoryboard({ origine: "film", nouveaux: [{ nom: "Nobody" }], nouveauLieu: { nom: "Nowhere" } }), null);
    assert.equal(refusTournageStoryboard({ nouveaux: [{ nom: "Nobody" }], nouveauLieu: null }), null, "the film path still creates cards");
  });

  it("tournerPlan refuses before any creation, and the storyboard call marks its origin", () => {
    const session = readFileSync("src/components/app/studio-session.tsx", "utf8");
    const body = session.slice(session.indexOf("const tournerPlan"), session.indexOf("const cancelRun"));
    const guard = body.indexOf("refusTournageStoryboard");
    const create = body.indexOf("createCast");
    assert.ok(guard >= 0 && create > guard, "the refusal runs before a card is created");
    assert.match(body, /REF_MISSING/);
    const page = readFileSync("src/components/storyboard/storyboard-page.tsx", "utf8");
    assert.match(page, /origine:\s*"storyboard"/);
  });

  it("names the missing refs and still links a card that already exists", () => {
    const sb = storyboardVide({ id: "quai", titre: "Quai", idee: "", now: "2026-11-02T00:00:00.000Z" });
    const plan = { ...planVide("p1"), refs: [{ role: "qui" as const, nom: "Ada", id: null }, { role: "ou" as const, nom: "Harbour", id: "harbour" }] };
    const envoi = versPlanFilm({ ...sb, sequences: [{ id: "s1", titre: "", resume: "", plans: [plan] }] }, plan, { cast: [], decor: [{ id: "harbour", name: "Harbour" }] });
    assert.deepEqual(envoi.manquants, [{ role: "qui", nom: "Ada" }]);
    assert.equal(envoi.decorId, "harbour");
    assert.deepEqual(envoi.nouveaux, [{ nom: "Ada" }]);
    assert.equal(envoi.nouveauLieu, null);
  });
});

describe("B3 · LTX roles for two characters, H3 text unchanged", () => {
  const refs = castReferences([ada, pip]);
  const pictures = [...refs.photos, "Projets/p/Decors/harbour.png"];
  const roles = rolesLtx(
    refs.groups.map((group, index) => ({ id: index === 0 ? ada.id : pip.id, name: group.name, description: group.description, pictures: group.pictures })),
    { id: "harbour", name: "Harbour", pictures: 1 },
  );

  it("keeps the LTX reference cap", () => {
    assert.equal(LTX_REFS_MAX, 4);
  });

  it("the two-character LTX graph names each picture and drops the one-person preamble", () => {
    assert.ok(roles);
    const graph = takeGraphFor(ltx, "They sit on the terrace.", pictures, 7, undefined, roles);
    const text = kleinText(graph);
    assert.match(text, /<ref_image_0>/);
    assert.match(text, /<ref_image_1>/);
    assert.match(text, /<ref_image_2>/);
    assert.doesNotMatch(text, /one person/i);
    assert.doesNotMatch(text, /The person from <ref_image_0>/);
    assert.match(text, /different characters/);
    assert.match(text, /the place, Harbour/);
    assert.doesNotMatch(text, /gives no features to anyone\.\s*It is a person/i);
  });

  it("without roles the historical preamble is still the one-person line", () => {
    const text = kleinText(takeGraphFor(ltx, "They sit on the terrace.", pictures, 7));
    assert.match(text, /The person from <ref_image_0>/);
  });

  it("leaves the H3 text exactly as the grouped take prompt", () => {
    const prompt = takePrompt({
      traits: [],
      lookPictures: refs.photos.length,
      cast: refs.groups,
      place: { name: "Harbour", note: "", pictures: 1 },
      line: "They sit on the terrace.",
      tags: "picture",
    });
    const graph = takeGraphFor(h3, prompt, pictures, 7);
    assert.equal(graph["138"].inputs.value, prompt);
    assert.match(prompt, /<Picture 1> shows only Ada/);
    assert.match(prompt, /<Picture 2> shows only Pip/);
    assert.doesNotMatch(prompt, /<ref_image_/);
    assert.doesNotMatch(prompt, /same person/i);
    assert.doesNotMatch(JSON.stringify(graph), /<ref_image_/);
  });

  it("tournerPlan passes those roles into the LTX graph and not into H3", () => {
    const session = readFileSync("src/components/app/studio-session.tsx", "utf8");
    const body = session.slice(session.indexOf("const tournerPlan"), session.indexOf("const cancelRun"));
    assert.match(body, /rolesLtx\(/);
    assert.match(body, /engine === "ltx"/);
    assert.match(body, /who\.length >= 2/);
    const run = readFileSync("src/lib/render/run.ts", "utf8");
    assert.match(run, /takeGraphFor\([\s\S]*input\.roles/);
  });

  it("has no hard-coded character name in the shoot fix", () => {
    const files = ["src/lib/render/take-roles.ts", "src/lib/storyboard/film.ts", "src/lib/storyboard/devis.ts"];
    for (const file of files) assert.doesNotMatch(readFileSync(file, "utf8"), /\b(enki|fizz|uttu|blanche)\b/i, file);
  });
});
