import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { genjutsuQuote, genjutsuSeconds } from "../src/lib/outils/genjutsu.ts";
import { outilEtat, outilParId, outilRow, outilsPublics } from "../src/lib/outils/catalogue.ts";
import { outilExample, outilGraph, outilQuote } from "../src/lib/outils/graphs.ts";
import { GENJUTSU_BASE } from "../src/lib/outils/genjutsu-base.ts";

const tool = outilParId("vid-genjutsu")!;

test("the base matches the API export downloaded from Comfy Cloud", () => {
  const live=JSON.parse(readFileSync("workflows/outils/sources/api_higgsfield_genjutsu_motion_transfer.api.json","utf8"));
  for(const node of Object.values(live) as { _meta?:unknown }[])delete node._meta;
  delete live["13"].inputs["video-preview"];
  delete live["10"].inputs.codec;
  assert.deepEqual(GENJUTSU_BASE,live);
});

test("Genjutsu is a native video tool backed by the listed Comfy template and partner filter", () => {
  assert.equal(tool.template, "api_higgsfield_genjutsu_motion_transfer");
  assert.equal(outilEtat(tool).kind, "pret");
  assert.equal(outilRow(tool)?.partenaire, true);
  assert.equal(outilRow(tool)?.nature, "hypothese");
  assert.ok(outilsPublics().some(t => t.id === tool.id));
  assert.equal(outilsPublics({ openWeightsOnly:true }).some(t => t.id === tool.id), false);
});

test("the graph keeps official wiring and separates video, character, optional place and quality", () => {
  const input = { files:{video:"source.mp4",images:["uttu.png","decor.png"]},prompt:"Replace the dancer",seed:42,resolution:"720p" as const };
  const graph = outilGraph(tool, input);
  assert.equal(graph["9"].class_type, "HiggsfieldMotionTransferNode");
  assert.equal(graph["9"].inputs.model,"genjutsu-v1.0");
  assert.deepEqual(graph["9"].inputs["model.video"],["13",0]);
  assert.deepEqual(graph["9"].inputs["model.reference_images.image_1"],["14",0]);
  assert.deepEqual(graph["9"].inputs["model.reference_images.image_2"],["15",0]);
  assert.equal(graph["13"].inputs.file,"source.mp4");
  assert.equal(graph["14"].inputs.image,"uttu.png");
  assert.equal(graph["15"].inputs.image,"decor.png");
  assert.equal(graph["9"].inputs["model.prompt"],input.prompt);
  assert.equal(graph["9"].inputs["model.resolution"],"720p");
  assert.equal(graph["9"].inputs["model.seed"],42);
  assert.deepEqual(graph["10"].inputs.video,["9",0]);
  assert.equal(graph["10"].inputs.filename_prefix,"video/uttu-vid-genjutsu");
  assert.equal(GENJUTSU_BASE["14"].inputs.image,"snow_queen_ref.png");
  assert.deepEqual(JSON.parse(readFileSync("workflows/outils/outil-vid-genjutsu.api.json","utf8")),outilGraph(tool,outilExample(tool)));
});

test("a character alone removes the optional reference rather than silently duplicating it", () => {
  const graph=outilGraph(tool,{files:{video:"clip.mp4",images:["uttu.png"]},prompt:"",seed:0});
  assert.equal(graph["15"],undefined);
  assert.equal(graph["9"].inputs["model.reference_images.image_2"],undefined);
  assert.equal(graph["9"].inputs["model.resolution"],"480p");
  assert.throws(()=>outilGraph(tool,{files:{video:"clip.mp4"},prompt:"",seed:0}),/Image manquant/);
  assert.throws(()=>outilGraph(tool,{files:{images:["uttu.png"]},prompt:"",seed:0}),/Vidéo manquant/);
});

test("quotes depend on actual seconds and quality, never a flat 5-second block", () => {
  assert.deepEqual(genjutsuQuote(5),{credits:480,high:720,kind:"estime"});
  assert.equal(genjutsuQuote(5,"720p")?.credits,1028);
  assert.equal(genjutsuQuote(5,"1080p")?.credits,2463);
  assert.equal(genjutsuQuote(4)?.credits,384);
  assert.ok(genjutsuQuote(5.1)!.credits>genjutsuQuote(5)!.credits);
  assert.deepEqual(outilQuote(tool,{seconds:5,resolution:"720p"}),genjutsuQuote(5,"720p"));
  assert.throws(()=>genjutsuQuote(5,"bad" as never),/invalide/);
});

test("unreadable and short sources cannot quote; long clips quote exactly the first 30 seconds", () => {
  for(const seconds of [undefined,NaN,Infinity,-1,0,3.99])assert.equal(genjutsuQuote(seconds),null);
  assert.equal(outilQuote(tool),null);
  assert.equal(genjutsuSeconds(31),30);
  assert.deepEqual(genjutsuQuote(80),genjutsuQuote(30));
});
