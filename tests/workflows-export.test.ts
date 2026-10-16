import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { FINAL_GRAPH } from "../src/lib/prise/finaliser.ts";
import { graphForGeste } from "../src/lib/workflows/export.ts";
import { REGISTRE, gesteVisible, gestesOnglet } from "../src/lib/workflows/registre.ts";

interface Entry { id: string; onglet: string; template: string; partner: boolean; sentPartner: boolean | null; template_file: string; api_file: string | null }
const index = (JSON.parse(readFileSync("workflows/index.json", "utf8")) as { workflows: Entry[] }).workflows;
const read = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

describe("workflows exportés", () => {
  it("has one Comfy workflow file per gesture, in workflows/<tab>/", () => {
    for (const row of REGISTRE) {
      const entry = index.find(item => item.id === row.id);
      assert.ok(entry, row.id);
      assert.equal(entry.onglet, row.onglet, row.id);
      assert.equal(entry.template, row.template, row.id);
      assert.equal(entry.template_file, `workflows/${row.onglet}/${row.id}.json`);
      assert.ok(existsSync(entry.template_file), entry.template_file);
      const workflow = read(entry.template_file);
      assert.ok(Array.isArray(workflow.nodes), `${row.id}: UI format`);
    }
    assert.equal(index.length, REGISTRE.length + Object.keys(FINAL_GRAPH).length + 1, "plus montage-finaliser");
  });

  it("keeps each wired API graph equal to what the studio sends", () => {
    for (const row of REGISTRE) {
      const entry = index.find(item => item.id === row.id)!;
      const graph = graphForGeste(row);
      if (!graph) {
        assert.equal(entry.api_file, null, row.id);
        continue;
      }
      assert.equal(entry.api_file, `workflows/${row.onglet}/${row.id}.api.json`);
      assert.deepEqual(read(entry.api_file!), JSON.parse(JSON.stringify(graph)), `${row.id}: run scripts/export-workflows.mjs`);
    }
  });

  it("flags partner nodes the same way as the registry", () => {
    for (const row of REGISTRE) {
      const entry = index.find(item => item.id === row.id)!;
      assert.equal(entry.sentPartner ?? entry.partner, row.partenaire, row.id);
    }
  });

  it("uses FLUX 3 for images and LTX for the default take", () => {
    const first = (onglet: "cast" | "decor") => gestesOnglet(onglet).premiers.map(row => row.template);
    for (const template of [...first("cast"), ...first("decor")].filter(name => !name.startsWith("templates-1_click"))) {
      assert.match(template, /flux3/, template);
    }
    assert.equal(REGISTRE.find(row => row.id === "prise-plan")?.template, "video_ltx2_5_i2v");
    assert.equal(REGISTRE.find(row => row.id === "prise-plan-h3")?.template, "video_minimax_h3_r2v");
    assert.equal(REGISTRE.some(row => row.template.includes("nano_banana") && row.premier), false);
  });

  it("hides Nano Banana by default and every partner node under Open Weights Only", () => {
    assert.equal(REGISTRE.filter(row => row.option === "nano").some(row => gesteVisible(row)), false);
    assert.ok(REGISTRE.filter(row => row.option === "nano").every(row => gesteVisible(row, { nanoBanana: true })));
    const open = REGISTRE.filter(row => gesteVisible(row, { openWeightsOnly: true, nanoBanana: true }));
    assert.ok(open.length > 10);
    assert.equal(open.some(row => row.partenaire), false);
    for (const row of open) {
      const graph = graphForGeste(row);
      if (graph) assert.equal(Object.values(graph).some(node => /Gemini|Flux3ImageNode|ElevenLabs|Sonilo|Vidu/.test(node.class_type)), false, row.id);
    }
  });
});
