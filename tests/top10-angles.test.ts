// Top 10, batch 1 (29.10.2026): 8 angles of a character, 8 angles of a set, one camera move.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRenderClient, pickOutputs } from "../src/lib/render/client.ts";
import { followTake } from "../src/lib/render/run.ts";
import { noeudSortie } from "../src/lib/render/sortie.ts";
import { ANGLES_LOT } from "../src/lib/outils/base-top10.ts";
import { outilEtat, outilParId, outilsOnglet } from "../src/lib/outils/catalogue.ts";
import { CAMERAS, OUTIL_CAMERAS } from "../src/lib/outils/generique.ts";
import { outilGraph, outilQuote } from "../src/lib/outils/graphs.ts";
import { gesteOuvert, gesteParId, NOEUD_SORTIE, TEMPLATES_OFFICIELS } from "../src/lib/workflows/registre.ts";

type Node = { class_type: string; inputs: Record<string, unknown> };

describe("top 10 · angles", () => {
  for (const [id, geste, onglet] of [["ret-angles-perso", "cast-angle", "cast"], ["ret-angles-decor", "decor-angles", "decor"]] as const) {
    it(`${id}: one picture in, 8 angles out through one final node`, () => {
      const outil = outilParId(id)!;
      assert.equal(outil.geste, geste);
      assert.equal(outil.lot, 8);
      assert.equal(outilEtat(outil).kind, "pret");
      assert.ok(outilsOnglet(onglet).includes(outil));
      const graph = outilGraph(outil, { files: { images: ["uttu.png"] }, prompt: "", seed: 42 }) as Record<string, Node>;
      assert.equal((graph["25"]).inputs.image, "uttu.png");
      assert.equal(noeudSortie(graph, outil.template), "991");
      assert.equal(NOEUD_SORTIE[outil.template], "991");
      const batch = graph["990"];
      assert.equal(batch.class_type, "BatchImagesNode");
      const links = Object.entries(batch.inputs);
      assert.deepEqual(links.map(([key]) => key), ANGLES_LOT.map((_, index) => `images.image${index}`));
      for (const [, link] of links) assert.equal(graph[(link as [string, number])[0]].class_type, "VAEDecode");
      assert.deepEqual(graph["991"].inputs.images, ["990", 0]);
      const samplers = Object.values(graph).filter(node => node.class_type === "KSampler");
      assert.equal(samplers.length, 8);
      for (const sampler of samplers) assert.equal(sampler.inputs.seed, 42);
      assert.equal(Object.values(graph).some(node => node.class_type.startsWith("Preview")), false);
    });
  }

  it("prices the lots from their measured jobs", () => {
    assert.deepEqual(outilQuote(outilParId("ret-angles-perso")!), { credits: 11, high: 17, kind: "estime" });
    assert.deepEqual(outilQuote(outilParId("ret-angles-decor")!), { credits: 9, high: 14, kind: "estime" });
    assert.deepEqual(outilQuote(outilParId("ret-camera")!), { credits: 3, high: 5, kind: "estime" });
    for (const id of ["cast-angle", "decor-angles", "outil-ret-camera"]) {
      const row = gesteParId(id)!;
      assert.equal(row.nature, "mesure", id);
      assert.ok(gesteOuvert(row), id);
      assert.equal(row.partenaire, false, id);
    }
    assert.ok((TEMPLATES_OFFICIELS as readonly string[]).includes("template_qwen_multiangle.app"));
  });
});

describe("top 10 · déplacer la caméra", () => {
  it("keeps every preset inside the CameraAngle ranges", () => {
    for (const id of OUTIL_CAMERAS) {
      const { horizontal_angle, vertical_angle, zoom } = CAMERAS[id];
      assert.ok(horizontal_angle >= 0 && horizontal_angle <= 360, id);
      assert.ok(vertical_angle >= -30 && vertical_angle <= 60, id);
      assert.ok(zoom >= 0 && zoom <= 10, id);
    }
  });

  it("puts the chosen camera on node 221 and saves on node 2", () => {
    const outil = outilParId("ret-camera")!;
    assert.deepEqual(outil.reglages, ["camera"]);
    const graph = outilGraph(outil, { files: { images: ["quai.png"] }, prompt: "", seed: 3, camera: "contre-plongee" }) as Record<string, Node>;
    assert.equal(graph["1"].inputs.image, "quai.png");
    assert.equal(graph["221"].inputs.vertical_angle, -30);
    assert.deepEqual(graph["221"].inputs.image, ["1", 0]);
    assert.equal(noeudSortie(graph, outil.template), "2");
    const plain = outilGraph(outil, { files: { images: ["quai.png"] }, prompt: "", seed: 3 }) as Record<string, Node>;
    assert.equal(plain["221"].inputs.horizontal_angle, 45, "three-quarter by default");
  });
});

describe("top 10 · un nœud, plusieurs images", () => {
  const save = (n: number) => ({ filename: `Angles_0000${n}_.png`, subfolder: "", type: "output" });
  const outputs = { "25": { images: [{ filename: "uttu.png", subfolder: "", type: "input" }] }, "991": { images: [1, 2, 3].map(save) } };

  it("lists every file of the final node, never the loaded picture", () => {
    assert.deepEqual(pickOutputs(outputs, "image", "991").map(ref => ref.filename), ["Angles_00001_.png", "Angles_00002_.png", "Angles_00003_.png"]);
    assert.deepEqual(pickOutputs(outputs, "image", "25"), []);
  });

  it("followTake with `all` brings the other pictures back as extras", async () => {
    const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const client = createRenderClient({
      auth: { kind: "key", key: "comfyui-0123456789abcdef" },
      fetch: async input => {
        const url = String(input);
        if (url === "/api/job/job-0123456789/status") return json({ status: "success" });
        if (url === "/api/jobs/job-0123456789") return json({ status: "completed", outputs });
        if (url.startsWith("/api/view?")) return new Response(png, { headers: { "content-type": "image/png" } });
        if (url.startsWith("/api/billing/usage/timeseries")) return json({ summary: { balance: { amount_micros: 2370, currency: "USD" } } });
        return new Response("not found", { status: 404 });
      },
    });
    const options = { sleep: async () => {}, measureTries: 1, measureMs: 1, output: "image" as const, outputNode: "991" };
    const all = await followTake(client, "job-0123456789", 5001, () => {}, { ...options, all: true });
    assert.equal(all.filename, "Angles_00001_.png");
    assert.deepEqual(all.extras?.map(item => item.filename), ["Angles_00002_.png", "Angles_00003_.png"]);
    const one = await followTake(client, "job-0123456789", 5001, () => {}, options);
    assert.equal(one.extras, undefined);
  });
});
