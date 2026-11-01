import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { simulateComfy } from "./helpers/simulate-comfy";
import { OPEN_WEIGHTS_MODE } from "../src/lib/open-weights";

// Partner node: hidden in open-weights mode (contest build). Runs with NEXT_PUBLIC_OPEN_WEIGHTS_MODE=off.
test.skip(OPEN_WEIGHTS_MODE, "VEED Dubbing is a partner node, hidden in open-weights mode");

test.use({ hasTouch:true });

const SIZES=[{width:390,height:844},{width:844,height:390},{width:1024,height:600},{width:1280,height:800}];

test("Doubler une prise (VEED) : langues, version, devis par seconde, confirmation, aucun envoi avant", async ({ page }, info) => {
  await simulateComfy(page);
  const graphs:Record<string,{class_type:string;inputs:Record<string,unknown>}>[]=[];
  let cancels=0;
  await page.route(/\/api\/prompt$/,route=>{graphs.push(route.request().postDataJSON().prompt);return route.fallback();});
  await page.route(/\/api\/(queue|interrupt)$/,route=>{cancels++;return route.fulfill({json:{}});});
  await page.goto("/studio#outils/tous");
  await page.locator("[data-outils-search]").fill("doubler");
  const card=page.locator('[data-outil="vid-doubler"]').first();
  await expect(card).toBeVisible();
  await card.tap();
  const panel=page.locator('[data-tool-panel="vid-doubler"]');
  await expect(panel).toBeVisible();
  await expect(panel).not.toContainText(/gratuit/i);
  await panel.locator('[data-outil-sample="video"]').tap();
  const cost=panel.locator("[data-tool-go] .u-tool-go-cost");
  await expect(cost).toContainText("crédits estimés");
  const standard=Number((await cost.innerText()).replace(/\D/g,""));
  expect(standard).toBeGreaterThanOrEqual(33);
  await panel.locator('[data-doublage-source="fr"]').tap();
  await panel.locator('[data-doublage-cible="fr"]').tap();
  await expect(panel.locator("[data-doublage-same]")).toBeVisible();
  await panel.locator('[data-doublage-cible="en"]').tap();
  await expect(panel.locator("[data-doublage-same]")).toHaveCount(0);
  await panel.locator('[data-doublage-tier="pro"]').tap();
  await expect.poll(async()=>Number((await cost.innerText()).replace(/\D/g,""))).toBeGreaterThan(standard);
  const shots=process.env.VEED_SHOTS_DIR;
  for(const size of SIZES){
    await page.setViewportSize(size);
    for(const sel of ['[data-doublage-cible="en"]','[data-doublage-tier="pro"]',"[data-tool-go]"]){
      const el=panel.locator(sel);await el.scrollIntoViewIfNeeded();
      const b=await el.boundingBox();expect(b!.width,sel).toBeGreaterThanOrEqual(44);expect(b!.height,sel).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    if(shots&&info.project.name==="desktop"){
      mkdirSync(shots,{recursive:true});
      await panel.locator('[data-tool-step="doublage"]').scrollIntoViewIfNeeded();
      await page.screenshot({path:join(shots,`doubler-panneau-${size.width}x${size.height}.png`)});
    }
  }
  expect(graphs).toHaveLength(0);
  await panel.locator("[data-tool-go]").tap();
  const ask=panel.locator("[data-tool-ask]");
  await expect(ask).toBeVisible();
  await expect(ask).toContainText("crédits estimés");
  await expect(ask.locator("[data-doublage-quote]")).toContainText("Pro");
  await expect(ask.locator("[data-doublage-quote]")).toContainText("Anglais");
  if(shots&&info.project.name==="desktop"){
    for(const size of SIZES){ await page.setViewportSize(size); await ask.scrollIntoViewIfNeeded(); await page.screenshot({path:join(shots,`doubler-devis-${size.width}x${size.height}.png`)}); }
  }
  expect(graphs).toHaveLength(0);
  await panel.locator("[data-tool-confirm]").tap();
  await expect(panel.locator("[data-tool-done]")).toBeVisible({timeout:60000});
  expect(graphs).toHaveLength(1);
  const node=graphs[0]["5"];
  expect(node.class_type).toBe("VeedDubbingNode");
  expect(node.inputs.model).toBe("pro");
  expect(node.inputs["model.target_language"]).toBe("English (US)");
  expect(node.inputs["model.source_language"]).toBe("French");
  expect(cancels).toBe(0);
});
