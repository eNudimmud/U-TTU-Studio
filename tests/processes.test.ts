import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { COMFY_APPS } from "../src/lib/comfy-stack.ts";
import {
  CREATION_PROCESSES, VAULT_PROCESS_NOTE, processAction, processById, processModeLabels, processShareId, processesForMode,
} from "../src/lib/processes.ts";

const SHARE = {
  former: "798eb224b972",
  tester: "25954f3b0278",
} as const;

const WORKFLOW = {
  former: "e8d7c649-0cb5-466b-be1a-4d7caa9204c2",
  tester: "d5746aa7-b780-4e09-b877-0cf39309e875",
} as const;

describe("catalogue des processus", () => {
  it("liste les gestes, live puis scènes encore absentes", () => {
    assert.deepEqual(CREATION_PROCESSES.map(process => process.id), ["former", "tester", "entre", "avant", "apres"]);
    assert.deepEqual(CREATION_PROCESSES.map(process => process.title), [
      "Former mon look",
      "Tester un prompt",
      "Entre deux images",
      "Avant",
      "Après",
    ]);
    assert.deepEqual(CREATION_PROCESSES.map(process => process.state), ["live", "live", "soon", "soon", "soon"]);
  });

  it("branche les deux apps déjà partagées, et aucune autre", () => {
    const former = processById("former");
    const tester = processById("tester");
    assert.ok(former && tester);
    assert.equal(former.app, "train");
    assert.equal(tester.app, "prompt");
    assert.equal(former.appUrl, COMFY_APPS.train.url);
    assert.equal(tester.appUrl, COMFY_APPS.prompt.url);
    assert.equal(processShareId(former), SHARE.former);
    assert.equal(processShareId(tester), SHARE.tester);
    assert.equal(former.workflowId, WORKFLOW.former);
    assert.equal(tester.workflowId, WORKFLOW.tester);
    assert.match(former.appUrl, /^https:\/\/cloud\.comfy\.org\/\?share=/);
    for (const process of CREATION_PROCESSES.filter(item => item.state === "soon")) {
      assert.equal(process.app, null);
      assert.equal(process.appUrl, null);
      assert.equal(process.workflowId, null);
      assert.equal(processShareId(process), null);
      assert.equal(process.consent, null);
    }
    assert.equal(CREATION_PROCESSES.filter(process => process.state === "live").length, 2);
  });

  it("note le coffre et les modes, sans jargon de fichier", () => {
    for (const process of CREATION_PROCESSES) {
      assert.deepEqual(process.vault, VAULT_PROCESS_NOTE);
      assert.ok(process.modes.length > 0);
      assert.ok(process.pitch.length > 0);
      const text = `${process.title} ${process.pitch} ${process.consent ?? ""}`;
      assert.doesNotMatch(text, /workflow|\.json|c-micro|iframe|share=/i);
    }
    assert.deepEqual(processesForMode("creer").map(process => process.id), ["former", "tester"]);
    assert.ok(processesForMode("sphere").some(process => process.id === "entre" && process.state === "soon"));
    assert.equal(processModeLabels(processById("former")!), "Créer · Identité");
    assert.match(processById("former")!.consent ?? "", /crédit/i);
    assert.match(processById("tester")!.consent ?? "", /traceur/i);
  });

  it("rend Lancer pour le live, Bientôt pour l’absent, Après le lot si Créer attend le PASS", () => {
    const former = processById("former")!;
    const entre = processById("entre")!;
    assert.deepEqual(processAction(former), { label: "Lancer", enabled: true });
    assert.deepEqual(processAction(former, true), { label: "Après le lot", enabled: false });
    assert.deepEqual(processAction(entre), { label: "Bientôt", enabled: false });
    assert.deepEqual(processAction(entre, true), { label: "Bientôt", enabled: false });
  });
});

describe("cartes du catalogue", () => {
  const card = readFileSync("src/components/studio/process-card.tsx", "utf8");
  const sphere = readFileSync("src/components/studio/sphere-panel.tsx", "utf8");
  const create = readFileSync("src/components/studio/create-view.tsx", "utf8");
  const maison = readFileSync("src/components/studio/maison-panel.tsx", "utf8");

  it("affiche le libellé du geste et n’ouvre pas un onglet", () => {
    assert.match(card, /processAction/);
    assert.match(card, /action\.label/);
    assert.match(card, /disabled=\{!action\.enabled\}/);
    assert.doesNotMatch(card, /target="_blank"|window\.open|cloud\.comfy\.org/);
    assert.match(sphere, /ProcessCard/);
    assert.match(sphere, /ComfyRunPanel/);
    assert.match(sphere, /showFile=\{false\}/);
    assert.doesNotMatch(sphere, /target="_blank"|window\.open|cloud\.comfy\.org/);
    assert.match(create, /former-access/);
    assert.match(create, /launch\.request\(former\.id\)/);
    assert.match(create, /go\("sphere"\)/);
    assert.match(maison, /CREATION_PROCESSES/);
    assert.match(maison, /processes\//);
    assert.match(maison, /jobs\.md/);
    assert.doesNotMatch(maison, /cloud\.comfy\.org|fetch\(/);
  });
});
