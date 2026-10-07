import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import manifest from "../src/app/manifest.ts";
import { GUIDE_LINES, nextMoment } from "../src/lib/guide.ts";
import { resumeTab, tabFromLocation } from "../src/lib/studio-route.ts";

const read = (path: string) => readFileSync(path, "utf8");
const appFiles = readdirSync("src/components/app").filter(name => name.endsWith(".tsx")).map(name => `src/components/app/${name}`);

describe("le studio, une app", () => {
  it("opens on the next gesture and keeps old links working", () => {
    assert.equal(tabFromLocation("", ""), null);
    assert.equal(resumeTab({ lookReady: false, hasScene: true }), "lora");
    assert.equal(resumeTab({ lookReady: true, hasScene: false }), "scene");
    assert.equal(resumeTab({ lookReady: true, hasScene: true }), "prise");
    assert.equal(tabFromLocation("", "?step=look"), "look");
    assert.equal(tabFromLocation("#creer", ""), "look");
    assert.equal(tabFromLocation("#photos", ""), "look");
    assert.equal(tabFromLocation("#plateau", ""), "scene");
    assert.equal(tabFromLocation("#Take", ""), "prise");
    assert.equal(tabFromLocation("#sphère", ""), "sphere");
    assert.equal(tabFromLocation("#fiches", ""), "fiches");
    assert.equal(tabFromLocation("#fiche", ""), "fiches");
    assert.equal(tabFromLocation("#lora", ""), "lora");
    assert.equal(tabFromLocation("#personnage", ""), "lora");
    assert.equal(tabFromLocation("#rôle", ""), "lora");
    assert.equal(tabFromLocation("#Former", ""), "lora");
    assert.equal(tabFromLocation("#compte", ""), "compte");
    assert.equal(tabFromLocation("#inconnu", "?step=prise"), "prise");
    assert.match(read("src/app/studio/page.tsx"), /<StudioApp \/>/);
  });

  it("finishes a take inside the app: no Comfy tab, no Comfy frame as the studio", () => {
    for (const file of appFiles) {
      const text = read(file);
      assert.doesNotMatch(text, /cloud\.comfy\.org|comfy-embed|run_template/, file);
      assert.doesNotMatch(text, /@clerk\//, `${file} stays off Clerk`);
    }
    const context = read("src/components/app/studio-context.tsx");
    assert.match(context, /submitTake\(/);
    assert.match(context, /followTake\(/);
    assert.match(context, /saveInFlight\(localStorage, flight\)/, "a queued take survives a reload");
    assert.ok(context.indexOf("runGate(fresh, claim)") < context.indexOf("submitTake("), "the balance is re-read and gated before anything is sent");
    const sheets = read("src/components/app/sheets.tsx");
    assert.match(sheets, /Tourner · débit sur mon compte/);
    assert.match(sheets, /disabled=\{!gate\.allowed\}/);
    assert.match(read("src/components/app/lora-screen.tsx"), /Ce que tu envoies/);
    assert.match(read("src/components/app/lora-screen.tsx"), /Ce qu’il ne fera pas/);
    assert.match(read("src/components/app/lora-screen.tsx"), /Former ce personnage/);
    assert.match(read("src/components/app/studio-app.tsx"), /LoraScreen/);
    assert.match(context, /submitTraining\(/);
    assert.match(context, /submitLoraTake\(/);
    assert.ok(context.indexOf('falGate(fresh, quote, "formation")') < context.indexOf("submitTraining("), "the training quote is checked before anything is sent");
    assert.ok(context.indexOf('falGate(fresh, quote, "prise")') < context.indexOf("submitLoraTake("), "the take quote is checked before the LoRA is sent");
    assert.match(read("src/components/app/sheets.tsx"), /Former · débit sur mon compte fal/);
    assert.doesNotMatch(read("src/components/app/screens.tsx"), /Former ton double/);
    const scene = read("src/components/app/screens.tsx");
    const sceneScreen = scene.slice(scene.indexOf("export function SceneScreen"), scene.indexOf("function clock"));
    assert.match(sceneScreen, /filmAction/);
    assert.match(read("src/lib/render/shot.ts"), /Filmer ce plan/);
    assert.match(read("src/lib/render/take-graph.ts"), /minimax_h3/);
    assert.doesNotMatch(read("src/lib/render/take-graph.ts"), /flux-lora/);
    assert.doesNotMatch(read("src/lib/lora/place.ts"), /reference-to-video\/lora|take-graph/);
    assert.match(read("src/lib/lora/place.ts"), /flux-lora-fast-training/);
    assert.doesNotMatch(sceneScreen, /Préparer la prise|Blender ne tourne pas|Load3DAdvanced|RenderMesh/);
    assert.equal(sceneScreen.match(/u-primary/g)?.length, 1);
    assert.match(sceneScreen, /<details className="u-fold">/);
    assert.match(sceneScreen, /Ce que tient ce lieu/);
    assert.match(sceneScreen, /aria-label="Vue projet"/);
    assert.match(sceneScreen, /Aucun personnage sur ce lieu/);
    assert.match(sceneScreen, /Aucune prise pour ce lieu/);
    assert.match(read("src/lib/studio-comfort.ts"), /export function vueProjet/);
    const take = scene.slice(scene.indexOf("export function TakeScreen"), scene.indexOf("export function SphereScreen"));
    assert.match(take, /aria-label="Décors"/);
    assert.match(take, /aria-label="Distribution"/);
    assert.match(take, /className="u-pickers"/);
    assert.match(take, /weaveBrief/);
    assert.match(take, /Aucun personnage au coffre/);
    assert.match(take, /Aucun lieu au coffre/);
    assert.match(take, /Cette prise est dans la sphère et au coffre/);
    assert.match(read("src/components/app/studio-context.tsx"), /castFile\(current\.loras, loraPick\)/);
    assert.doesNotMatch(take, /Relier mon compte/);
    assert.match(take, /aria-label="Régler la prise"/);
    assert.match(take, /className="u-comfort"/);
    assert.match(take, /className="u-label">Moteur</);
    assert.match(take, /Ce que fait la prise/);
    assert.match(take, /label="Format"/);
    assert.match(take, /label="Durée"/);
    assert.match(take, /className="u-sound"/);
    assert.match(take, /engineMark/);
    assert.equal(take.match(/className="u-primary"/g)?.length, 1);
    assert.doesNotMatch(take, /seedance/i);
    assert.doesNotMatch(take, /className="u-desk"/);
    const chain = read("src/components/app/studio-app.tsx");
    assert.match(chain, /label: "Personnage"/);
    assert.match(chain, /label: "Scène"/);
    assert.match(chain, /label: "Prise"/);
    assert.doesNotMatch(chain, /label: "Look"|label: "Rôle"/);
    assert.match(chain, /aria-label="Personnage, scène, prise"/);
    assert.match(chain, /className="u-fiches-nav"/);
    assert.match(chain, /<FichesScreen /);
    assert.equal(chain.match(/label: "Personnage"|label: "Scène"|label: "Prise"/g)?.length, 3);
    const fiches = read("src/components/app/fiches-screen.tsx");
    assert.match(fiches, /Ce que le studio lance/);
    assert.match(fiches, /Lancer/);
    assert.match(fiches, /Relier/);
    assert.doesNotMatch(fiches, /u-primary/);
    assert.doesNotMatch(fiches, /seedance|graphe|class_type/i);
    assert.match(chain, /<LookScreen onNext=/);
    assert.match(chain, /onPhotos=/);
    assert.match(chain, /choice=\{choice\}/);
    const role = read("src/components/app/lora-screen.tsx");
    assert.match(role, /Deux façons de créer un personnage/);
    assert.match(role, /className="u-desk u-paths"/);
    assert.match(role, /characterPaths/);
    assert.match(role, /u-secondary/);
    const photos = read("src/components/app/screens.tsx");
    const look = photos.slice(photos.indexOf("export function LookScreen"), photos.indexOf("export function SceneScreen"));
    assert.match(look, /Pas de formation/);
    assert.equal(look.match(/u-primary/g)?.length, 1);
    assert.doesNotMatch(chain, /onTrain/);
    const pages = `${read("src/components/app/screens.tsx")}\n${read("src/components/app/lora-screen.tsx")}`;
    for (const label of ["Remettre ce look à zéro", "Remettre ce lieu à zéro", "Remettre ce plan à zéro", "Remettre ce personnage à zéro"]) {
      assert.ok(pages.includes(label), label);
    }
    const css = read("src/components/app/app.css");
    assert.match(css, /width: min\(560px, 100%\)/);
    assert.match(css, /@media \(min-width: 1080px\)/);
    assert.match(css, /margin-left: 232px/);
    assert.match(css, /grid-template-columns: minmax\(0, 1fr\) minmax\(320px, 440px\)/);
    assert.match(css, /\.u-paths \{ grid-template-columns: 1fr 1fr; align-items: stretch; \}/);
    assert.match(read("src/components/app/studio-app.tsx"), /aria-label="Coffre"><Coffre \/><span>Coffre<\/span>/);
    assert.match(read("src/app/globals.css"), /\.landing-copy \{ justify-content: space-between; /);
    assert.doesNotMatch(read("src/components/app/lora-screen.tsx"), /@clerk\//);
  });

  it("unbinds each linked account from the sheet the header actually opens", () => {
    const sheets = read("src/components/app/sheets.tsx");
    const credit = sheets.slice(sheets.indexOf("export function CreditSheet"), sheets.indexOf("export function CoffreSheet"));
    assert.match(credit, /Délier le compte de rendu/);
    assert.match(credit, /Délier le compte fal/);
    assert.ok(credit.indexOf("Délier le compte de rendu") < credit.indexOf("Délier le compte fal"), "each account has its own control");
    assert.match(credit, /connected &&/);
    assert.match(credit, /falLinked &&/);
    const context = read("src/components/app/studio-context.tsx");
    const falOff = context.slice(context.indexOf("const disconnectFal"), context.indexOf("const connectKey"));
    const comfyOff = context.slice(context.indexOf("const disconnect ="), context.indexOf("const exportCoffre"));
    assert.match(falOff, /saveFalKey\(localStorage, null\)/);
    assert.doesNotMatch(falOff, /removeLora|writeLora|coffreZip|deleteDatabase/);
    assert.match(comfyOff, /saveRenderLink\(localStorage, \{ mode: "none" \}\)/);
    assert.match(comfyOff, /tokens\.forget\(\)/);
    assert.doesNotMatch(comfyOff, /removeTake|removeLora|coffreZip|deleteDatabase/);
    const app = read("src/components/app/studio-app.tsx");
    assert.match(app, /"credits" : "relier"/);
    const coffre = sheets.slice(sheets.indexOf("export function CoffreSheet"), sheets.indexOf("export function ConfirmSheet"));
    assert.match(coffre, /MOC\.md/);
    assert.match(coffre, /ouvre ce dossier dans Obsidian/);
    assert.match(coffre, /Importer un coffre \(\.zip\)/);
    assert.match(coffre, /Une prise ou un personnage déjà ici reste/);
    assert.match(coffre, /Les clés restent hors du coffre/);
    assert.doesNotMatch(coffre, /synchronis/i);
    assert.match(read("src/components/app/studio-context.tsx"), /mergeCoffreZip\(/);
    assert.match(read("src/components/app/studio-context.tsx"), /Coffre ajouté/);
    assert.match(coffre, /role="status"/);
    assert.match(sheets, /Il paie la formation du personnage et les prises « Personnage »/);
    assert.match(sheets, /Il paie les prises « Références »/);
  });

  it("publishes from the result, with the file, and never posts by itself", () => {
    const publish = read("src/components/app/publish.tsx");
    assert.match(publish, /navigator\.share\(\{ files: \[/);
    assert.ok(publish.indexOf("async function share()") < publish.indexOf("navigator.share({ files"), "share runs only on the tap");
    assert.match(publish, /xComposerUrl\(caption\)/);
    assert.doesNotMatch(publish, /fetch\("https|api\.x\.com|api\.twitter\.com|upload\.twitter\.com/);
  });

  it("lets U*TTU guide in one short line, with her canon face", () => {
    for (const [moment, line] of Object.entries(GUIDE_LINES)) {
      assert.ok(line.length <= 80, `${moment} stays short`);
      assert.doesNotMatch(line, /\b(comfy|fal|lora|flux|seedance|night city)\b/i, moment);
    }
    const bubble = read("src/components/app/guide-bubble.tsx");
    assert.match(bubble, /\/images\/uttu-canon-portrait\.webp/, "her face comes from the canon portrait");
    assert.equal(nextMoment(["look-photos", "look-name"], { off: false, seen: ["look-photos"] }), "look-name");
    assert.equal(nextMoment(["look-photos"], { off: true, seen: [] }), null);
    assert.equal(nextMoment([false, null, "take-ready"], { off: false, seen: [] }), "take-ready");
  });

  it("installs as an app that opens on the next gesture", () => {
    const app = manifest();
    assert.equal(app.display, "standalone");
    assert.equal(app.start_url, "/studio");
    assert.equal(app.theme_color, "#0B0A09");
  });
});
