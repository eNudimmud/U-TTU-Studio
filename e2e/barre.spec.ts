import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { simulateComfy } from "./helpers/simulate-comfy";
const quai = readFileSync("public/exemples/decor-quai-nuit.webp");

test("bulle : Image par défaut, menu Photos Audio Référence et réglages dans la même saisie", async ({ page }) => {
  await page.goto("/studio");
  const bar=page.locator("[data-barre]");
  await expect(bar).toHaveAttribute("data-mode","image");
  await expect(bar.locator("textarea")).toHaveCount(1);
  await expect(page.locator("[data-barre-cost]")).toContainText("crédits estimés");
  await bar.locator("[data-barre-plus]").click();
  await expect(bar.locator("[data-barre-attach]")).toHaveCount(3);
  await expect(bar.locator("[data-barre-attach=son]")).toContainText("Audio");
  await bar.locator("[data-barre-settings]").click();
  await expect(bar.locator("[data-barre-format='1:1']")).toBeVisible();
  await expect(bar.locator("[data-barre-resolution='720p']")).toBeVisible();
  await expect(bar.locator("[data-barre-duree]")).toHaveCount(0);
  await bar.locator("[data-barre-mode=video]").click();
  await bar.locator("[data-barre-settings]").click();
  await expect(bar.locator("[data-barre-duree='10']")).toBeVisible();
  await expect(bar.locator("textarea")).toHaveCount(1);
});

test("outil Animer : le résultat vidéo part au montage depuis la page outil", async ({ page }) => {
  test.setTimeout(120_000);
  const comfy = await simulateComfy(page);
  await page.goto("/studio#outils/vid-wan");
  const panel = page.locator("[data-tool-panel=vid-wan]");
  await panel.locator("[data-outil-input=image] input[type=file]").setInputFiles({ name: "quai.webp", mimeType: "image/webp", buffer: quai });
  await panel.locator("[data-tool-step=consigne] textarea").fill("La pluie tombe sur le quai");
  await panel.locator("[data-tool-go]").click();
  await panel.locator("[data-tool-confirm]").click();
  const result = page.locator("[data-tool-result=video]");
  await expect(result.locator("video")).toBeVisible({ timeout: 60_000 });
  expect(comfy.prompts.map(item => item.kind)).toEqual(["video"]);
  const add = result.locator("[data-tool-result-actions] [data-montage-add]");
  await expect(add).toHaveText("Ajouter au montage");
  await add.click();
  await expect(result.locator("[data-montage-done]")).toHaveText("Ajouté au montage", { timeout: 20_000 });
  await expect(page).toHaveURL(/#outils\/vid-wan$/);
  await page.goto("/studio#montage");
  const clip = page.locator(".u-clip.is-video");
  await expect(clip).toHaveCount(1, { timeout: 30_000 });
  const seconds = Number(await clip.getAttribute("data-clip-seconds"));
  expect(seconds).toBeGreaterThan(4);
  expect(seconds).toBeLessThan(6);
});

test("bulle : accès direct à l’agent Uttu unique", async ({ page }) => {
  await page.goto("/studio");
  await page.locator("[data-barre-mode=agent]").click();
  await expect(page.locator("[data-assistant-panel]")).toBeVisible();
  await expect(page.locator("[data-fil-agent]")).toHaveCount(0);
});

test("barre : « Tous les outils » descend aux outils de la même page, la barre reste", async ({ page }) => {
  await page.goto("/studio");
  await page.locator("[data-barre-all-link]").click();
  await expect(page).toHaveURL(/#outils\/tous$/);
  await expect(page.locator("[data-tous] [data-outil]").first()).toBeVisible();
  await expect(page.locator("[data-tous] [data-barre]")).toHaveCount(1);
});
