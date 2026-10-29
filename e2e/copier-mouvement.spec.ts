import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { simulateComfy } from "./helpers/simulate-comfy";

test.use({ hasTouch:true });

// 29.10: a 5 s phone clip never reached Comfy. Every upload transits the studio relay,
// and Vercel refuses a body above ~4 MB with 413. The relay is simulated with that limit.
const RELAY_LIMIT = 4_000_000;

test("Copier un mouvement : la vidéo de pose est ré-encodée sous la limite du relais, puis la prise aboutit", async ({ page }) => {
  await simulateComfy(page);
  const graphs:Record<string,{inputs:Record<string,unknown>}>[]=[];
  // In-page, so the real file size is seen (Playwright drops large multipart bodies).
  await page.addInitScript(limit=>{
    const w=window as unknown as { __uploads:{name:string;type:string;bytes:number;file:Blob}[] };
    w.__uploads=[];
    const real=window.fetch.bind(window);
    window.fetch=async(input,init)=>{
      const url=typeof input==="string"?input:input instanceof URL?input.href:input.url;
      const file=init?.body instanceof FormData?init.body.get("image"):null;
      if(/\/api\/upload\/image$/.test(url)&&file instanceof File){
        if(file.size>limit)return new Response("Request Entity Too Large",{status:413});
        w.__uploads.push({name:file.name,type:file.type,bytes:file.size,file});
      }
      return real(input,init);
    };
  },RELAY_LIMIT);
  await page.route(/\/api\/prompt$/,route=>{graphs.push(route.request().postDataJSON().prompt);return route.fallback();});
  await page.goto("/studio#outils/tous");
  await page.locator("[data-outils-search]").fill("mouvement");
  await page.locator('[data-outil="vid-mouvement"]').first().tap();
  const panel=page.locator('[data-tool-panel="vid-mouvement"]');
  await expect(panel).toBeVisible();
  const clip=process.env.MOUVEMENT_CLIP;
  if(clip)await panel.locator('[data-outil-input="video"] input[type=file]').setInputFiles(clip);
  else await panel.locator('[data-outil-sample="video"]').tap();
  await panel.locator('[data-outil-sample="image"]').tap();
  await expect(panel.locator("[data-tool-go] .u-tool-go-cost")).toContainText("crédits estimés");
  await panel.locator("[data-tool-go]").tap();
  await expect(panel.locator("[data-tool-ask]")).toContainText("crédits");
  await panel.locator("[data-tool-confirm]").tap();
  await expect(panel.locator("[data-tool-done], [data-tool-fail]").first()).toBeVisible({ timeout:60_000 });
  if(process.env.MOUVEMENT_SHOT)await page.screenshot({path:process.env.MOUVEMENT_SHOT});
  await expect(panel.locator("[data-tool-fail]")).toHaveCount(0);
  await expect(panel.locator("[data-tool-done]")).toBeVisible();
  await expect(panel.locator("[data-tool-fail]")).toHaveCount(0);
  const uploads=await page.evaluate(()=>(window as unknown as { __uploads:{name:string;type:string;bytes:number}[] }).__uploads.map(({name,type,bytes})=>({name,type,bytes})));
  const video=uploads.find(item=>item.type.startsWith("video/"));
  expect(video,"pose video uploaded").toBeTruthy();
  expect(video!.type).toBe("video/mp4");
  expect(video!.bytes).toBeLessThan(RELAY_LIMIT);
  // The sample is 2,6 Mo at 24 fps for 5 s: one 16 fps window at 482-wide is lighter.
  if(!clip)expect(video!.bytes).toBeLessThan(2_601_822);
  if(process.env.MOUVEMENT_DUMP){
    const b64=await page.evaluate(async()=>{const u=(window as unknown as { __uploads:{type:string;file:Blob}[] }).__uploads.find(x=>x.type.startsWith("video/"))!;const bytes=new Uint8Array(await u.file.arrayBuffer());let s="";for(const c of bytes)s+=String.fromCharCode(c);return btoa(s);});
    writeFileSync(process.env.MOUVEMENT_DUMP,Buffer.from(b64,"base64"));
  }
  expect(graphs).toHaveLength(1);
  expect(String(graphs[0]["240"].inputs.file)).not.toBe("");
  expect(String(graphs[0]["189"].inputs.image)).not.toBe("");
});
