import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { simulateComfy } from "./helpers/simulate-comfy";
import { OPEN_WEIGHTS_MODE } from "../src/lib/open-weights";

// Partner node: hidden in open-weights mode (contest build). Runs with NEXT_PUBLIC_OPEN_WEIGHTS_MODE=off.
test.skip(OPEN_WEIGHTS_MODE, "Genjutsu (Higgsfield) is a partner node, hidden in open-weights mode");

test.use({ hasTouch:true });

test("Genjutsu natif : références, devis, confirmation, vidéo et Mes créations", async ({ page }, info) => {
  await simulateComfy(page);
  const graphs:Record<string,{class_type:string;inputs:Record<string,unknown>}>[]=[];
  let uploads=0,cancels=0;
  await page.route(/\/api\/prompt$/,route=>{graphs.push(route.request().postDataJSON().prompt);return route.fallback();});
  await page.route(/\/api\/upload\/image$/,route=>{uploads++;return route.fallback();});
  await page.route(/\/api\/(queue|interrupt)$/,route=>{cancels++;return route.fulfill({json:{}});});
  await page.goto("/studio#outils/tous");
  await page.locator("[data-outils-search]").fill("genjutsu");
  const card=page.locator('[data-outils-section="video"] [data-outil="vid-genjutsu"]');
  await expect(card).toHaveCount(1);
  await expect(card.locator("img")).toBeVisible();
  await card.tap();
  const panel=page.locator('[data-tool-panel="vid-genjutsu"]');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-model-current]')).toHaveText("Higgsfield Genjutsu");
  await expect(page.locator("[data-comfy-app], [data-comfy-app-open]")).toHaveCount(0);
  await panel.locator('[data-outil-sample="video"]').tap();
  await panel.locator('[data-outil-sample="image"]').tap();
  await expect(panel.locator('[data-outil-input="image"] img')).toHaveAttribute("src",/uttu-portrait/);
  const cost=panel.locator("[data-tool-go] .u-tool-go-cost");
  await expect(cost).toContainText("crédits estimés");
  const firstPrice=Number((await cost.innerText()).replace(/\D/g,""));
  expect(firstPrice).toBeGreaterThanOrEqual(480);
  await panel.locator('[data-tool-step="reglages"] > button').tap();
  await panel.locator('[data-genjutsu-resolution="720p"]').tap();
  await expect.poll(async()=>Number((await cost.innerText()).replace(/\D/g,""))).toBeGreaterThan(firstPrice*2);
  await panel.locator('[data-tool-step="references"] > button').tap();
  await panel.locator('[data-outil-sample="image2"]').tap();
  // The draft keeps both the selected quality and its references across a reload.
  await page.reload();
  await expect(cost).toContainText("crédits estimés");
  await panel.locator('[data-tool-step="reglages"] > button').tap();
  await expect(panel.locator('[data-genjutsu-resolution="720p"]')).toHaveAttribute("aria-pressed","true");
  for(const size of [{width:390,height:844},{width:844,height:390},{width:1024,height:600},{width:1280,height:800}]){
    await page.setViewportSize(size);
    const go=panel.locator("[data-tool-go]");
    await go.scrollIntoViewIfNeeded();
    const b=await go.boundingBox();expect(b!.width).toBeGreaterThanOrEqual(44);expect(b!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
  expect(uploads).toBe(0);expect(graphs).toHaveLength(0);
  await panel.locator("[data-tool-go]").tap();
  await expect(panel.locator("[data-tool-ask]")).toBeVisible();
  await expect(panel.locator("[data-tool-ask]")).toContainText("crédits estimés");
  await expect(panel.locator("[data-tool-ask]")).toContainText("720p");
  expect(uploads).toBe(0);expect(graphs).toHaveLength(0);
  if(process.env.GENJUTSU_SHOTS_DIR&&info.project.name==="mobile"){
    mkdirSync(process.env.GENJUTSU_SHOTS_DIR,{recursive:true});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:join(process.env.GENJUTSU_SHOTS_DIR,"genjutsu-confirmation-390x844.png")});
  }
  await panel.locator("[data-tool-confirm]").tap();
  await expect(panel.locator("[data-tool-done]")).toBeVisible({timeout:60000});
  expect(uploads).toBe(3);expect(graphs).toHaveLength(1);
  const graph=graphs[0];
  expect(graph["9"].class_type).toBe("HiggsfieldMotionTransferNode");
  expect(graph["9"].inputs["model.resolution"]).toBe("720p");
  expect(graph["9"].inputs["model.reference_images.image_1"]).toEqual(["14",0]);
  expect(graph["9"].inputs["model.reference_images.image_2"]).toEqual(["15",0]);
  expect(graph["9"].inputs["model.video"]).toEqual(["13",0]);
  await expect(page).toHaveURL(/#outils\/vid-genjutsu$/);
  const result=page.locator('[data-tool-result="video"]');
  await expect(result.locator("video")).toBeVisible();
  await expect(result.locator("[data-montage-add]")).toBeVisible();
  if(process.env.GENJUTSU_SHOTS_DIR&&info.project.name==="desktop"){
    mkdirSync(process.env.GENJUTSU_SHOTS_DIR,{recursive:true});
    await result.scrollIntoViewIfNeeded();
    await page.screenshot({path:join(process.env.GENJUTSU_SHOTS_DIR,"genjutsu-resultat-1280x800.png")});
  }
  expect(cancels).toBe(0);
  await page.goto("/mon-studio?type=videos");
  await expect(page.locator('[data-media-id^="render:"]').filter({hasText:"Genjutsu"})).toBeVisible();
});

test("Genjutsu : une source sous 4 s ne peut déclencher aucun envoi", async ({ page }) => {
  await simulateComfy(page);let posts=0;
  page.on("request",r=>{if(r.method()==="POST"&&/\/api\/(upload|prompt)/.test(r.url()))posts++;});
  await page.goto("/studio#outils/vid-genjutsu");
  const panel=page.locator('[data-tool-panel="vid-genjutsu"]');
  await panel.locator('[data-outil-input="video"] input[type=file]').setInputFiles("e2e/fixtures/genjutsu-3s.mp4");
  await panel.locator('[data-outil-sample="image"]').tap();
  await expect(panel.locator("[data-genjutsu-short]")).toBeVisible();
  await expect(panel.locator(".u-tool-go-cost")).toHaveCount(0);
  await panel.locator("[data-tool-go]").tap();
  await expect(panel.locator("[data-tool-ask]")).toHaveCount(0);
  expect(posts).toBe(0);
});

test("Genjutsu : le filtre des modèles s'applique aussi à l'accès direct", async ({ page }) => {
  await simulateComfy(page);let posts=0;
  await page.addInitScript(()=>localStorage.setItem("u-ttu-moteurs",JSON.stringify({openWeightsOnly:true,nanoBanana:false,engine:"ltx",engineManual:false})));
  page.on("request",r=>{if(r.method()==="POST"&&/\/api\/(upload|prompt)/.test(r.url()))posts++;});
  await page.goto("/studio#outils/tous");
  await expect(page.locator('[data-outil="vid-genjutsu"]')).toHaveCount(0);
  await page.goto("/studio#outils/vid-genjutsu");
  const panel=page.locator('[data-tool-panel="vid-genjutsu"]');
  await panel.locator("[data-tool-go]").tap();
  await expect(panel.locator("[data-tool-why]")).toBeVisible();
  await expect(panel.locator("[data-tool-ask]")).toHaveCount(0);
  expect(posts).toBe(0);
});
