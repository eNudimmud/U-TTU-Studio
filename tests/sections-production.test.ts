import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryVault } from "../src/lib/coffre/store.ts";
import { emptyProduction, fileResult, keepTake, nextTakeNumber, readProduction, type ProductionAsset } from "../src/lib/sections/model.ts";
import { animeImageGraph } from "../src/lib/sections/anime-graph.ts";
import { graphVerdict } from "../src/lib/cinema/workflow-policy.ts";
import { sectionVideoGraph } from "../src/lib/sections/video-graph.ts";
const asset = (id: string): ProductionAsset => ({ id, section:"anime", kind:"take", name:id, path:`Projets/test/Assets/${id}.png`, media:"image", prompt:"Portrait", at:"", refs:[], source:"comfy", credits:4, shotId:"shot-one", number:1 });
test("invalid results never enter the project or its costs", async () => {
  const store=memoryVault();
  await assert.rejects(fileResult(store,"test",asset("bad"),new Blob(["invalid"]),async()=>true),/vide ou illisible/);
  assert.equal((await store.list()).length,0);
});
test("failed media write does not record successful metadata or credits", async () => {
  const store=memoryVault(); const failing={...store,put:async()=>{throw Error("quota");}};
  await assert.rejects(fileResult(failing,"test",asset("quota"),new Blob(["valid"]),async()=>false),/quota/);
  assert.deepEqual(await readProduction(store,"test"),emptyProduction());
});
test("recovery is idempotent; a result is filed once",async()=>{
  const store=memoryVault(), a=asset("good");
  await fileResult(store,"test",a,new Blob(["valid"]),async()=>false);
  await fileResult(store,"test",a,new Blob(["valid"]),async()=>false);
  assert.equal((await readProduction(store,"test")).assets.length,1);
});
test("kept take is exclusive per shot and section; numbering is stable",()=>{
  const a=asset("a"),b={...asset("b"),number:3},c={...asset("c"),section:"cinema" as const,kept:true};
  const p=keepTake({...emptyProduction(),assets:[{...a,kept:true},b,c]},"b");
  assert.deepEqual(p.assets.map(a=>a.kept),[false,true,true]);
  assert.equal(nextTakeNumber(p,"anime","shot-one"),4);
});
test("anime references use PLUS .55, correct SDXL encoder and separate union lineart",()=>{
  const g=animeImageGraph({prompt:"ink and gouache",images:["u1.png","u2.png"],structure:"pose.png",seed:42,portrait:true});
  assert.equal(g["9"].inputs.weight,.55);assert.equal(g["12"].inputs.image,"pose.png");
  assert.equal(g["16"].inputs.type,"canny/lineart/anime_lineart/mlsd");
  assert.equal(g["19"].inputs.denoise,.55); assert.equal(g["13"].inputs.width,832);
  assert.equal(g["7"].inputs.ipadapter_file,"ip-adapter-plus_sdxl_vit-h.safetensors");
  assert.equal(graphVerdict(g,true).allowed,true);
});
test("text-only anime has no fabricated references or unused ControlNet",()=>{
  const g=animeImageGraph({prompt:"ink portrait",images:[],seed:2});
  assert.equal(g["9"],undefined);assert.equal(g["12"],undefined);assert.equal(g["19"].inputs.denoise,1);
  assert.throws(()=>animeImageGraph({prompt:"",images:[],seed:2}));
});
test("animation is a five-second open-weight graph bound to the selected frame",()=>{
  for (const section of ["cinema","anime"] as const) {
    const g=sectionVideoGraph({section,image:"chosen.png",prompt:"Slow pan",seed:7});
    assert.equal(g["97"].inputs.image,"chosen.png");
    assert.equal(g["129:161"].inputs.value,5);
    assert.equal(graphVerdict(g,true).allowed,true);
    if(section==="anime") { assert.match(String(g["129:95"].inputs.unet_name),/AniSora/); assert.equal(g["129:131"].inputs.value,false); }
  }
});
