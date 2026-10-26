import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// The « barre unique »: one sentence, a mode, references on demand, settings when asked.
// Send runs nothing: it opens the real tool, already filled. Local only, no Comfy call.

const uttu = readFileSync("public/images/uttu-portrait.webp");
const quai = readFileSync("public/exemples/decor-quai-nuit.webp");

async function noComfy(page: Page) {
  const calls: string[] = [];
  await page.route(/\/api\/(prompt|comfy)/, route => { calls.push(route.request().url()); return route.abort(); });
  return calls;
}

async function smallTargets(page: Page, root: string) {
  return page.evaluate(sel => [...document.querySelectorAll<HTMLElement>(`${sel} button, ${sel} textarea, ${sel} a`)]
    .filter(el => el.offsetParent !== null)
    .map(el => ({ name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30), ...el.getBoundingClientRect().toJSON() }))
    .filter(r => r.width < 44 || r.height < 44), root);
}

test("barre : vide au départ, Image par défaut, réglages cachés, devis en crédits, 44 px", async ({ page }) => {
  await page.goto("/studio");
  const bar = page.locator("[data-barre]");
  await expect(bar).toBeVisible();
  await expect(page.locator("#u-title")).toContainText("Qu’est-ce qu’on tourne");
  await expect(bar).toHaveAttribute("data-mode", "image");
  await expect(bar.locator("[data-barre-chips]")).toHaveCount(0);
  await expect(bar.locator("[data-barre-settings]")).toHaveCount(0);
  await expect(bar.locator("[data-barre-send]")).toHaveAttribute("aria-label", /≈ \d+ crédits estimés/);
  await expect(page.locator("main")).not.toContainText(/\bcr\.|gratuit/);
  await expect(page.locator("[data-barre-all-link]")).toBeVisible();
  expect(await smallTargets(page, "[data-barre]")).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("barre : Vidéo avec Uttu et un décor ouvre PRISE déjà remplie", async ({ page }) => {
  test.setTimeout(150_000);
  const calls = await noComfy(page);
  await page.goto("/studio#personnage");
  await page.getByLabel("Importer un personnage", { exact: true }).setInputFiles({ name: "Uttu.webp", mimeType: "image/webp", buffer: uttu });
  await page.goto("/studio#scene");
  await page.getByLabel("Importer un décor", { exact: true }).setInputFiles({ name: "Quai de nuit.webp", mimeType: "image/webp", buffer: quai });
  await page.waitForTimeout(800);

  await page.goto("/studio#outils");
  const bar = page.locator("[data-barre]");
  await bar.locator("[data-barre-mode=video]").click();
  await expect(bar).toHaveAttribute("data-mode", "video");
  await expect(page.locator("[data-barre-route]")).toHaveAttribute("data-barre-route", "prise");
  await bar.locator("[data-barre-input]").fill("Uttu marche sur le quai, la nuit. La caméra la suit.");

  await bar.locator("[data-barre-plus]").click();
  await expect(bar.locator("[data-barre-attach]")).toHaveCount(3);
  await bar.locator("[data-barre-attach=reference]").click();
  const sheet = page.locator("[data-refs-sheet]");
  await expect(sheet).toBeVisible();
  await sheet.locator("[data-refs-filter=cast]").click();
  await expect(sheet.locator("[data-ref-kind=decor]")).toHaveCount(0);
  await sheet.locator("[data-ref-kind=cast]").filter({ hasText: "Uttu" }).click();
  await sheet.locator("[data-refs-filter=decor]").click();
  await sheet.locator("[data-ref-kind=decor]").filter({ hasText: "Quai de nuit" }).click();
  await expect(sheet.locator("[data-refs-join]")).toHaveText("Joindre 2 références");
  expect(await smallTargets(page, "[data-refs-sheet]")).toEqual([]);
  await sheet.locator("[data-refs-join]").click();
  await expect(sheet).toHaveCount(0);
  await expect(bar.locator("[data-barre-chip]")).toHaveCount(2);

  await bar.locator("[data-barre-settings]").click();
  await bar.locator("[data-barre-rendu=apercu]").click();
  await bar.locator("[data-barre-duree='8']").click();
  await bar.locator("[data-barre-format='9:16']").click();
  expect(await smallTargets(page, "[data-barre]")).toEqual([]);
  await bar.locator("[data-barre-send]").click();

  await expect(page).toHaveURL(/#prise/);
  await expect(page.locator("[data-prise-ready]")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("textbox", { name: "Ce qui se passe", exact: true })).toHaveValue("Uttu marche sur le quai, la nuit. La caméra la suit.");
  await expect(page.locator("[data-rendu]")).toHaveAttribute("data-rendu", "apercu");
  await expect(page.locator("main")).toContainText("Quai de nuit");
  expect(calls).toEqual([]);

  // Read once: a reload keeps the draft but never re-applies the bar.
  await page.reload();
  await expect(page.locator("[data-prise-ready]")).toBeVisible({ timeout: 30_000 });
});

test("barre : Image avec une référence ouvre Modifier, la photo et la phrase en place", async ({ page }) => {
  const calls = await noComfy(page);
  await page.goto("/studio");
  const bar = page.locator("[data-barre]");
  await bar.locator("[data-barre-input]").fill("Même visage, imperméable jaune");
  await bar.locator("[data-barre-plus]").click();
  await bar.locator("[data-barre-attach=reference]").click();
  await page.locator("[data-refs-sheet] [data-ref-kind=cast]").first().click();
  await page.locator("[data-refs-join]").click();
  await expect(page.locator("[data-barre-route]")).toHaveAttribute("data-barre-route", "ret-modifier");
  await bar.locator("[data-barre-input]").press("Enter");
  await expect(page).toHaveURL(/#outils\/ret-modifier$/);
  const panel = page.locator("[data-tool-panel]");
  await expect(panel.locator("textarea").first()).toHaveValue("Même visage, imperméable jaune");
  await expect(panel.locator("img").first()).toBeVisible();
  expect(calls).toEqual([]);
});

test("barre : Agent passe la phrase à l'assistant, rien ne part seul", async ({ page }) => {
  await page.goto("/studio");
  const bar = page.locator("[data-barre]");
  await bar.locator("[data-barre-mode=agent]").click();
  await expect(bar.locator("[data-barre-plus]")).toHaveCount(0);
  await bar.locator("[data-barre-input]").fill("Prépare un plan de 8 secondes avec mon personnage");
  await bar.locator("[data-barre-send]").click();
  const assistant = page.locator("[data-assistant-panel]");
  await expect(assistant).toBeVisible();
  await expect(assistant.locator("[data-assistant-input]")).toHaveValue("Prépare un plan de 8 secondes avec mon personnage");
});

test("barre : « Tous les outils » garde l'ancien accueil, à un geste", async ({ page }) => {
  await page.goto("/studio");
  await page.locator("[data-barre-all-link]").click();
  await expect(page).toHaveURL(/#outils\/tous$/);
  await expect(page.locator("[data-tous] [data-outil]").first()).toBeVisible();
  await page.locator("[data-barre-back]").click();
  await expect(page.locator("[data-barre]")).toBeVisible();
});
