import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

describe("un run, un résultat", () => {
  it("keeps the job on the fiche and opens outputs there", () => {
    const screens = read("src/components/app/screens.tsx");
    const sceneFile = read("src/components/app/scene-screen.tsx");
    const take = screens.slice(screens.indexOf("export function TakeScreen"), screens.indexOf("export function SphereScreen"));
    const scene = sceneFile.slice(sceneFile.indexOf("export function SceneScreen"));
    const role = read("src/components/app/lora-screen.tsx");
    const sheets = read("src/components/app/sheets.tsx");
    const app = read("src/components/app/studio-app.tsx");
    assert.match(take, /t\("job\.running"\)/);
    assert.match(take, /t\("job\.done"\)/);
    assert.match(take, /t\("job\.outputs"\)/);
    assert.match(take, /t\("take\.soft"\)/);
    assert.match(take, /t\("take\.inSphere"\)/);
    assert.match(take, /resumeRun/);
    assert.doesNotMatch(take, /goSphere|take\.seeSphere/);
    assert.match(scene, /t\("job\.outputs"\)/);
    assert.match(scene, /u-soft-error/);
    assert.match(scene, /resumePreviz/);
    assert.match(scene, /t\("take\.soft"\)/);
    assert.match(role, /t\("job\.outputs"\)/);
    assert.match(role, /t\("job\.done"\)/);
    assert.match(role, /resumeTraining/);
    assert.match(role, /t\("take\.soft"\)/);
    assert.match(sheets, /export function OutputsSheet/);
    assert.match(sheets, /t\("job\.lead"\)/);
    assert.match(sheets, /t\("job\.empty"\)/);
    assert.match(read("src/components/app/stage-screens.tsx"), /t\("job\.running"\)/);
    assert.match(read("src/components/app/atelier-page.tsx"), /studio\.takes/);
    assert.doesNotMatch(app, /<OutputsSheet/);
    assert.doesNotMatch(screens + sceneFile + sheets + role, /class_type|SaveLoRA|panneau de nœuds|estimate_credits|run_template|submit_workflow|partner_generate/);
  });

  it("names the four languages and does not spend", () => {
    const fr = JSON.parse(read("messages/fr.json")) as { job: Record<string, string> };
    const en = JSON.parse(read("messages/en.json")) as { job: Record<string, string> };
    const de = JSON.parse(read("messages/de.json")) as { job: Record<string, string> };
    const es = JSON.parse(read("messages/es.json")) as { job: Record<string, string> };
    assert.equal(fr.job.outputs, "Sorties");
    assert.equal(fr.job.done, "Abouti");
    assert.equal(fr.job.running, "En cours");
    assert.equal(en.job.outputs, "Outputs");
    assert.equal(en.job.done, "Landed");
    assert.equal(de.job.outputs, "Ausgaben");
    assert.equal(de.job.done, "Zustande gekommen");
    assert.equal(es.job.outputs, "Salidas");
    assert.equal(es.job.done, "Ha salido");
    assert.doesNotMatch(`${de.job.done} ${de.job.outputs} ${de.job.lead}`, /Einstellung|Angebot|Charakter|Tresor|Vault/);
    assert.doesNotMatch(`${fr.job.lead} ${es.job.lead}`, /Coffre|Vault|Cofre/);
    const decisions = read("docs/DECISIONS.md");
    const f13 = decisions.slice(0, decisions.indexOf("## F12"));
    assert.match(f13, /F13 — un run, un résultat/);
    assert.match(f13, /Sorties/);
    assert.match(f13, /0 crédit/);
    assert.match(f13, /`run_template`, `submit_workflow` et `partner_generate` n’ont pas été appelés/);
    const context = read("src/components/app/studio-context.tsx");
    const resume = context.slice(context.indexOf("const resumeRun"), context.indexOf("const keepFrames"));
    assert.match(resume, /readInFlight\(localStorage\)/);
    assert.match(resume, /readLoraTakeFlight\(localStorage\)/);
    assert.doesNotMatch(resume, /submitTake|submitLoraTake|submitTraining|startRender|estimate_credits/);
  });
});
