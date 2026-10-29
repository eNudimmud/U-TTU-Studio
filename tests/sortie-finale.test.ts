import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRenderClient, imageOutput, pickOutput, videoOutput } from "../src/lib/render/client.ts";
import { followTake } from "../src/lib/render/run.ts";
import { noeudSortie, saveNodes } from "../src/lib/render/sortie.ts";
import { OUTIL_BASES } from "../src/lib/outils/base.ts";
import { OUTILS, outilParId } from "../src/lib/outils/catalogue.ts";
import { outilExample, outilGraph } from "../src/lib/outils/graphs.ts";
import { finalGraph } from "../src/lib/montage/finaliser.ts";
import { NOEUD_SORTIE } from "../src/lib/workflows/registre.ts";

// JD, 29.10 18:30 (job 42d74633): « Copier un mouvement » showed his own selfie back.
// The render was right (node 246, SaveVideo). The history also lists node 240 (LoadVideo,
// the source clip), and numeric keys come first in order: « the first video » was the source.
const SOURCE = { filename: "eb7877032d0b7462b2eb898592ff8e088daee3197d3a50a31df9a84636491483.mp4", subfolder: "", type: "input" };
const RENDU = { filename: "uttu-vid-mouvement_00001_.mp4", subfolder: "video", type: "output" };
const JD_HISTORY = { "246": { images: [RENDU], animated: [true] }, "240": { images: [SOURCE] } };

test("a history with the source clip and the render: the render node wins, by id", () => {
  assert.deepEqual(Object.keys(JD_HISTORY), ["240", "246"], "numeric keys come back sorted: the source is first");
  assert.equal(videoOutput(JD_HISTORY, "246")?.filename, RENDU.filename);
  assert.equal(videoOutput(JD_HISTORY)?.filename, RENDU.filename, "an input file is never a result");
  // Even if the cloud marked the source as `output`, the node id keeps the render.
  const marked = { "240": { images: [{ ...SOURCE, type: "output" }] }, "246": { images: [RENDU] } };
  assert.equal(videoOutput(marked, "246")?.filename, RENDU.filename);
  assert.equal(videoOutput(marked, "999"), null, "a named node that saved nothing is a missing result, not another file");
});

test("Copier un mouvement reads node 246, the save after the animated frames", () => {
  assert.equal(NOEUD_SORTIE.video_wan_animate2, "246");
  const graph = outilGraph(outilParId("vid-mouvement")!, { files: { images: ["uttu.png"], video: "pose.mp4" }, prompt: "", seed: 7 });
  assert.equal(noeudSortie(graph, "video_wan_animate2"), "246");
  const save = graph["246"] as { class_type: string; inputs: Record<string, unknown> };
  assert.equal(save.class_type, "SaveVideo");
  assert.deepEqual(save.inputs.video, ["672:245", 0]);
  const create = graph["672:245"] as { inputs: Record<string, unknown> };
  assert.deepEqual(create.inputs.images, ["672:671", 0], "frames come from the sampler loop, not from the source clip");
  assert.deepEqual(create.inputs.audio, ["672:288", 1], "only the sound of the source is kept");
  assert.deepEqual((graph["672:590"] as { inputs: Record<string, unknown> }).inputs.input, ["189", 0]);
  assert.equal((graph["189"] as { inputs: Record<string, unknown> }).inputs.image, "uttu.png");
  assert.equal((graph["240"] as { inputs: Record<string, unknown> }).inputs.file, "pose.mp4");
});

test("followTake with the output node brings back the render, not the source", async () => {
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  const asked: string[] = [];
  const client = createRenderClient({
    auth: { kind: "key", key: "comfyui-0123456789abcdef" },
    fetch: async input => {
      const url = String(input);
      if (url === "/api/job/job-0123456789/status") return json({ status: "success" });
      if (url === "/api/jobs/job-0123456789") return json({ status: "completed", outputs: { "240": { images: [{ ...SOURCE, type: "output" }] }, "246": { images: [RENDU] } } });
      if (url.startsWith("/api/view?")) { asked.push(url); return new Response(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), { headers: { "content-type": "video/mp4" } }); }
      if (url.startsWith("/api/billing/usage/timeseries")) return json({ summary: { balance: { amount_micros: 2370, currency: "USD" } } });
      return new Response("not found", { status: 404 });
    },
  });
  const result = await followTake(client, "job-0123456789", 5001, () => {}, { sleep: async () => {}, measureTries: 1, measureMs: 1, outputNode: "246" });
  assert.equal(result.filename, RENDU.filename);
  assert.ok(asked.every(url => url.includes("uttu-vid-mouvement")));
});

test("every template base names its save node in the registry, and it is the only save node", () => {
  for (const [template, graph] of Object.entries(OUTIL_BASES)) {
    const saves = saveNodes(graph);
    assert.equal(saves.length, 1, `${template}: ${saves.join(",")}`);
    assert.equal(NOEUD_SORTIE[template], saves[0], template);
  }
});

test("every wired tool graph has one final node the studio can name", () => {
  const listed = new Set(Object.keys(NOEUD_SORTIE));
  for (const outil of OUTILS) {
    if (!outil.moteur || outil.bientot) continue;
    let graph;
    try { graph = outilGraph(outil, outilExample(outil)); } catch { continue; }
    const node = noeudSortie(graph, outil.template);
    assert.ok(node, `${outil.id}: no single save node`);
    // A tool that loads a file of the kind it saves must name its node explicitly.
    const same = { video: /LoadVideo/, image: /^LoadImage/, audio: /^Load(Audio|Video)/, mesh: /^$/ }[outil.sortie];
    if (Object.values(graph).some(n => same.test(n.class_type))) {
      assert.ok(NOEUD_SORTIE[outil.template], `${outil.id} loads a ${outil.sortie} and needs its node in NOEUD_SORTIE`);
      assert.equal(node, NOEUD_SORTIE[outil.template], outil.id);
    }
    listed.delete(outil.template);
  }
  for (const template of Object.keys(OUTIL_BASES)) listed.delete(template);
  assert.deepEqual([...listed], [], "every registry entry belongs to a real graph");
  // The montage pass also loads a video: its result is « save », never « load ».
  assert.equal(noeudSortie(finalGraph({ file: "m.mp4", ratio: "16:9", resolution: "1080p", nettoyer: "aucun" } as never)), "save");
});

test("an image tool with loaded pictures keeps its saved still", () => {
  const outputs = { "470": { images: [{ filename: "ref.png", subfolder: "", type: "input" }] }, "461": { images: [{ filename: "Qwen_00001_.png", subfolder: "", type: "output" }] } };
  assert.equal(imageOutput(outputs, NOEUD_SORTIE.image_qwen_image_2_1_image_edit)?.filename, "Qwen_00001_.png");
  assert.equal(pickOutput(outputs, "image")?.filename, "Qwen_00001_.png");
});

test("the studio passes the output node on every paid video, tool and suite run, and keeps it in the receipt", () => {
  const source = readFileSync("src/components/app/studio-session.tsx", "utf8");
  assert.ok((source.match(/outputNode,\n\s+deferMeasure: true/g) ?? []).length >= 4);
  assert.match(source, /receipt\.outputNode \?\?/);
  assert.match(source, /noeudSortie\(graph, creation \? undefined : row\.template\)/);
});

test("Mes créations lists what the job saved, never the loaded source", async () => {
  const { outputRefs } = await import("../src/lib/media/catalog.ts");
  const detail = { status: "completed", outputs: JD_HISTORY };
  assert.deepEqual(outputRefs(detail).map(ref => ref.filename), [RENDU.filename]);
  const marked = { status: "completed", outputs: { "240": { images: [{ ...SOURCE, type: "output" }] }, "246": { images: [RENDU] } } };
  assert.deepEqual(outputRefs(marked, "246").map(ref => ref.filename), [RENDU.filename]);
});
