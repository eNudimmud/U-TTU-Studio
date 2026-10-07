import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { emptyMemory, type ProjectMemory } from "../src/lib/coffre/memory.ts";
import { filmOutgoingText, priseOutgoingText, prisePicturePaths } from "../src/lib/render/outgoing-text.ts";
import { SHOT_LINE, shotPrompt } from "../src/lib/render/shot.ts";
import { takePrompt } from "../src/lib/render/take-prompt.ts";

const read = (path: string) => readFileSync(path, "utf8");

describe("texte qui part", () => {
  it("is the take prompt, and leaves project memory out", () => {
    const place = { name: "Le quai", note: "pluie fine", stills: ["a.jpg"], render: "b.jpg" };
    const photos = ["look.jpg"];
    const text = priseOutgoingText({
      traits: ["yeux verts"],
      photos,
      place,
      line: "Elle traverse.",
      engine: "comfy",
    });
    assert.equal(text, takePrompt({
      traits: ["yeux verts"],
      lookPictures: 1,
      place: { name: "Le quai", note: "pluie fine", pictures: 2 },
      line: "Elle traverse.",
    }));
    assert.equal(prisePicturePaths(photos, place).length, 3);
    const lora = priseOutgoingText({
      traits: [],
      photos,
      place: null,
      line: "Elle avance.",
      engine: "lora",
      subject: "mira_uttu",
    });
    assert.match(lora, /^Image 1 shows mira_uttu, the same person\./);
    assert.equal(priseOutgoingText({ traits: [], photos: [], place: null, line: "Elle avance.", engine: "comfy" }), "");

    const memory: ProjectMemory = {
      ...emptyMemory(),
      bible: "La pluie ne s’arrête pas.",
      style: "Lumière froide, cadre serré.",
      lexique: "Quai : le bord, pas la rue.",
      prompts: "Elle ne se retourne pas.",
      notes: [{ file: "nuit.md", text: "La ville reste noire." }],
    };
    const held = [memory.bible, memory.style, memory.lexique, memory.prompts, memory.notes[0].text];
    for (const bit of held) assert.equal(text.includes(bit), false, bit);
    assert.doesNotMatch(text, /bible|lexique|prompt|nœud|node|seed/i);
  });

  it("uses the same words for a filmed path", () => {
    const text = filmOutgoingText({ subject: "mira_uttu", place: "Le quai", note: "pluie", frames: 5 });
    assert.equal(text, shotPrompt({ subject: "mira_uttu", place: "Le quai", note: "pluie", frames: 5, line: SHOT_LINE }));
    assert.match(text, /Image 1 to Image 5 show the place, Le quai/);
    assert.doesNotMatch(text, /La pluie ne s’arrête pas/);
  });

  it("shows that text before the gesture, and says when nothing leaves", () => {
    const screens = read("src/components/app/screens.tsx");
    const take = screens.slice(screens.indexOf("export function TakeScreen"), screens.indexOf("export function SphereScreen"));
    assert.ok(take.indexOf("<OutgoingTake />") < take.indexOf("className=\"u-primary\""));
    assert.ok(take.indexOf("className=\"u-primary\"") < take.indexOf("<CinemaGestures anchor />"));
    const scene = screens.slice(screens.indexOf("export function SceneScreen"), screens.indexOf("function clock"));
    assert.ok(scene.indexOf("<OutgoingFilm />") < scene.indexOf("className=\"u-primary\""));
    const sheets = read("src/components/app/sheets.tsx");
    const confirm = sheets.slice(sheets.indexOf("export function ConfirmSheet"), sheets.indexOf("export function FalSheet"));
    assert.ok(confirm.indexOf("<OutgoingTake />") < confirm.indexOf("confirmRun()"));
    const film = sheets.slice(sheets.indexOf("export function PrevizConfirmSheet"), sheets.indexOf("export function BlenderSheet"));
    assert.ok(film.indexOf("<OutgoingFilm />") < film.indexOf("confirmPreviz()"));
    const gestures = read("src/components/app/cinema-gestures.tsx");
    assert.ok(gestures.indexOf("cinema.noText") < gestures.indexOf("verb.tourner"));
    assert.match(read("src/components/app/fiches-screen.tsx"), /fiche\.noSend/);
    const context = read("src/components/app/studio-context.tsx");
    assert.match(context, /priseOutgoingText\(/);
    assert.match(context, /filmOutgoingText\(/);
    assert.doesNotMatch(context, /takePrompt\(|shotPrompt\(/);
    assert.doesNotMatch(context, /estimate_credits|dry_run|run_template|submit_workflow|partner_generate/);
  });
});
