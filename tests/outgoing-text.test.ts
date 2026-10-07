import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { emptyMemory, type ProjectMemory } from "../src/lib/coffre/memory.ts";
import { triggerPhrase } from "../src/lib/lora/dataset.ts";
import { placeTrainInput, placeTrigger } from "../src/lib/lora/place.ts";
import { trainingRequest } from "../src/lib/lora/train.ts";
import { filmOutgoingText, lieuOutgoingText, personnageOutgoingText, priseOutgoingText, prisePicturePaths } from "../src/lib/render/outgoing-text.ts";
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
    const sceneFile = read("src/components/app/scene-screen.tsx");
    const scene = sceneFile.slice(sceneFile.indexOf("export function SceneScreen"));
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

  it("shows the character call word and the place word, and leaves project memory out", () => {
    const memory: ProjectMemory = {
      ...emptyMemory(),
      bible: "La pluie ne s’arrête pas.",
      style: "Lumière froide, cadre serré.",
      lexique: "Quai : le bord, pas la rue.",
      prompts: "Elle ne se retourne pas.",
      notes: [{ file: "nuit.md", text: "La ville reste noire." }],
    };
    const held = [memory.bible, memory.style, memory.lexique, memory.prompts, memory.notes[0].text];
    const call = personnageOutgoingText("Mira");
    assert.equal(call, triggerPhrase("Mira"));
    assert.equal(call, "mira_uttu");
    assert.equal(personnageOutgoingText("  "), "");
    const trained = trainingRequest("https://example.invalid/clips.zip", { trigger: call, steps: 1000, aspect: "9:16" });
    assert.equal(trained.trigger_phrase, call);
    assert.equal("prompt" in trained, false);
    const place = lieuOutgoingText("Le quai");
    assert.equal(place, placeTrigger("Le quai"));
    assert.equal(place, "le_quai_lieu");
    assert.equal(lieuOutgoingText(""), "lieu_lieu");
    const formed = placeTrainInput("https://example.invalid/vues.zip", place);
    assert.equal(formed.trigger_word, place);
    assert.equal("prompt" in formed, false);
    assert.match(read("src/lib/lora/place.ts"), /new Blob\(\[input\.trigger\], \{ type: "text\/plain" \}\)/);
    for (const bit of held) {
      assert.equal(call.includes(bit), false, bit);
      assert.equal(place.includes(bit), false, bit);
    }

    const lora = read("src/components/app/lora-screen.tsx");
    const form = lora.slice(lora.indexOf('training.phase === "idle" && <div className="u-stack">'), lora.indexOf("vault.loras.some"));
    assert.match(lora, /!showFile && <ProjectMemory \/>/);
    assert.ok(form.indexOf("<ProjectMemory />") < form.indexOf("<OutgoingPersonnage />"));
    assert.ok(form.indexOf("<OutgoingPersonnage />") < form.indexOf('className="u-primary"'));
    const screens = read("src/components/app/scene-screen.tsx");
    const scene = screens.slice(screens.indexOf("export function SceneScreen"), screens.indexOf("function VueProjet"));
    assert.match(scene, /<ProjectMemory \/>/);
    assert.ok(scene.indexOf("<ProjectMemory />") < scene.indexOf("<OutgoingFilm />"));
    const editor = screens.slice(screens.indexOf("function SceneEditor"));
    assert.ok(editor.indexOf("<OutgoingLieu />") < editor.indexOf('id="u-former-lieu"'));
    const sheets = read("src/components/app/sheets.tsx");
    const train = sheets.slice(sheets.indexOf("export function TrainConfirmSheet"), sheets.indexOf("export function PrevizConfirmSheet"));
    assert.ok(train.indexOf("<OutgoingPersonnage />") < train.indexOf("confirmTraining()"));
    const lieu = sheets.slice(sheets.indexOf("export function PlaceTrainSheet"), sheets.indexOf("export function PlaceSceneSheet"));
    assert.ok(lieu.indexOf("<OutgoingLieu />") < lieu.indexOf("confirmPlaceTrain()"));
    const parked = sheets.slice(sheets.indexOf("export function PlaceSceneSheet"), sheets.indexOf("export function MemorySheet"));
    assert.doesNotMatch(parked, /OutgoingLieu|lieuOutgoingText|placeSceneInput/);
    const context = read("src/components/app/studio-context.tsx");
    const confirmTrain = context.slice(context.indexOf("const confirmTraining"), context.indexOf("const cancelTraining"));
    const confirmPlace = context.slice(context.indexOf("const confirmPlaceTrain"), context.indexOf("const requestPlaceScene"));
    assert.match(confirmTrain, /personnageOutgoingText\(/);
    assert.match(confirmPlace, /lieuOutgoingText\(/);
    assert.doesNotMatch(confirmTrain, /memory\.|bible|lexique/);
    assert.doesNotMatch(confirmPlace, /memory\.|bible|lexique/);
    assert.doesNotMatch(context, /estimate_credits|dry_run|run_template|submit_workflow|partner_generate/);
    const app = read("src/components/app/studio-app.tsx");
    assert.match(app, /"lora-memory"/);
    assert.match(app, /"scene-memory"/);
    for (const locale of ["fr", "en", "de", "es"] as const) {
      const catalog = JSON.parse(read(`messages/${locale}.json`)) as {
        _human: string;
        sent: { noName: string; noViews: string; memoryOut: string };
        guide: { "lora-memory": string; "scene-memory": string; "take-memory": string };
      };
      assert.equal(catalog.guide["lora-memory"], catalog.guide["take-memory"]);
      assert.equal(catalog.guide["scene-memory"], catalog.guide["take-memory"]);
      assert.match(catalog.sent.noName, /personnage|character|Figur|personaje/);
      assert.match(catalog.sent.noViews, /lieu|location|Drehort|localización/);
      assert.doesNotMatch(catalog.sent.noName + catalog.sent.noViews + catalog.sent.memoryOut, /Coffre|Vault|Tresor|Cofre|Layout|Raumplan|plano de espacio/i);
      if (locale !== "fr") assert.equal(catalog._human, "native_open");
    }
  });
});
