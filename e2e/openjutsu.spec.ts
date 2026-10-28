import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

test.use({ hasTouch: true });

test("OpenJutsu : outil vidéo trouvé, panneau tactile et ouverture explicite de Comfy", async ({ page, context }, info) => {
  let posts = 0, appVisits = 0;
  context.on("request", request => {
    if (request.method() === "POST" && /\/api\/(prompt|upload|jobs|anchor)/.test(request.url())) posts++;
  });
  await context.route("https://comfy.org/hub/apps/openjutsu/", route => {
    appVisits++;
    return route.fulfill({ contentType: "text/html; charset=utf-8", body: "<h1>OpenJutsu — app Comfy simulée</h1>" });
  });
  await page.goto("/studio#outils/tous");
  const card = page.locator('[data-outils-section="video"] [data-outil="vid-openjutsu"]');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("App Comfy");
  await expect(card.locator("img")).toBeVisible();
  await page.locator("[data-outils-search]").fill("openjutsu");
  await expect(page.locator("[data-studio-entry] [data-outil]")).toHaveCount(1);
  if (process.env.OPENJUTSU_SHOTS_DIR && info.project.name === "desktop") {
    mkdirSync(process.env.OPENJUTSU_SHOTS_DIR, { recursive: true });
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(process.env.OPENJUTSU_SHOTS_DIR, "openjutsu-outils-1280x800.png") });
  }
  await card.tap();
  const panel = page.locator('[data-comfy-app="openjutsu"]');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("5 à 15 secondes");
  await expect(panel.locator("[data-comfy-app-cost]")).toContainText("facturée séparément");
  await expect(panel.locator("[data-tool-go], [data-tool-ask], input[type=file]")).toHaveCount(0);
  const link = panel.locator("[data-comfy-app-open]");
  await expect(link).toHaveAttribute("href", "https://comfy.org/hub/apps/openjutsu/");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(appVisits).toBe(0);
  for (const size of [{ width:390,height:844 },{ width:844,height:390 },{ width:1024,height:600 },{ width:1280,height:800 }]) {
    await page.setViewportSize(size);
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    if (process.env.OPENJUTSU_SHOTS_DIR && info.project.name === "mobile" && size.width === 390) {
      await panel.scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(process.env.OPENJUTSU_SHOTS_DIR, "openjutsu-mobile-390x844.png") });
    }
  }
  const popupPromise = context.waitForEvent("page");
  await link.tap();
  const popup = await popupPromise;
  await expect(popup.getByRole("heading")).toHaveText("OpenJutsu — app Comfy simulée");
  expect(appVisits).toBe(1);
  expect(posts).toBe(0);
  await popup.close();
  await page.locator("[data-outils-back]").tap();
  await expect(page).toHaveURL(/#outils\/tous$/);
  await expect(page.locator('[data-outil="vid-openjutsu"]')).toBeVisible();
});

test("OpenJutsu : les préférences s'appliquent aussi à un lien direct", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("u-ttu-moteurs", JSON.stringify({ openWeightsOnly:true,nanoBanana:false,engine:"ltx",engineManual:false })));
  await page.goto("/studio#outils/vid-openjutsu");
  await expect(page.locator("[data-comfy-app-hidden]")).toBeVisible();
  await expect(page.locator("[data-comfy-app-open]")).toHaveCount(0);
  await page.locator("[data-outils-back]").tap();
  await expect(page.locator('[data-outil="vid-openjutsu"]')).toHaveCount(0);
});
