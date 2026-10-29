import { expect, test } from "@playwright/test";
import { openAssistant, openCreations, openToolsHub } from "./helpers/top-bar";

// One top bar on every page: Créer, project switcher, search over tools and creations,
// recent tasks, the docked assistant, and the tool switch card. All local, nothing is sent.

test("barre du haut : Créer → outil, recherche Ctrl+K, assistant qui suit la navigation", async ({ page }) => {
  await page.goto("/studio#personnage");
  await expect(page.locator("[data-topbar]")).toBeVisible();
  await openToolsHub(page);
  await expect(page).toHaveURL(/#outils\/tous$/);
  await expect(page.locator("[data-outils-hub] [data-outil]")).toHaveCount(41);

  await page.keyboard.press("Control+k");
  const palette = page.locator("[data-palette]");
  await expect(palette).toBeVisible();
  await palette.locator("[data-palette-input]").fill("détour");
  await palette.locator("[data-palette-outil]").first().click();
  await expect(page).toHaveURL(/#outils\/[a-z0-9-]+$/);
  await expect(page.locator("[data-tool-panel]")).toHaveCount(1);

  await openAssistant(page);
  const assistant = page.locator("[data-assistant-panel]");
  await expect(assistant).toBeVisible();
  await assistant.locator("[data-assistant-input]").fill("faire parler mon personnage");
  await expect(assistant.locator("[data-assistant-outil]").first()).toBeVisible();
  await openCreations(page);
  await expect(page).toHaveURL(/\/mon-studio/);
  await expect(page.locator("[data-assistant-panel]")).toBeVisible();
});

test("carte d'outil : récents et « Voir tous les outils » sans quitter le panneau", async ({ page }) => {
  await page.goto("/studio#outils/img-qwen");
  await expect(page.locator("[data-tool-panel=img-qwen]")).toBeVisible();
  await page.goto("/studio#outils/ret-modifier");
  const panel = page.locator("[data-tool-panel=ret-modifier]");
  await expect(panel).toBeVisible();
  await panel.locator("[data-tool-switch] > button").click();
  await panel.locator("[data-recent-outil=img-qwen]").click();
  await expect(page).toHaveURL(/#outils\/img-qwen$/);
  const back = page.locator("[data-tool-panel=img-qwen]");
  await back.locator("[data-tool-switch] > button").click();
  await back.locator("[data-switch-all]").click();
  await expect(page).toHaveURL(/#outils\/tous$/);
});

test("sélecteur de projet : créer un projet en un geste, il devient le projet en cours", async ({ page }) => {
  await page.goto("/studio#personnage");
  const burger = page.locator("[data-top-burger]");
  if (await burger.isVisible()) await burger.click();
  const switcher = page.locator("[data-project-switcher]").filter({ visible: true }).first();
  await switcher.locator("button").first().click();
  await switcher.locator("[data-project-new]").fill("Court métrage");
  await switcher.locator("[data-project-create]").click();
  await expect(page.locator("[data-project-switcher]").filter({ visible: true }).first()).toContainText("Court métrage");
});

test("Mes créations : onglets par type dans l'adresse, densité gardée", async ({ page }) => {
  await page.goto("/mon-studio?type=sons");
  await expect(page.locator("[data-creations-tab=sons]")).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-creations-tab=personnages]").click();
  await expect(page).toHaveURL(/type=personnages/);
  await page.locator("[data-creations-density=dense]").click();
  await page.reload();
  await expect(page.locator("[data-creations-tab=personnages]")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-creations-density=dense]")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#coffre")).toBeVisible();
});

