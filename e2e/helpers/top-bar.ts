import type { Page } from "@playwright/test";

/**
 * Follows the shared top bar the way a visitor does: on a phone the burger drawer first,
 * then the menu (« Créer », « Mes créations »), then the entry.
 */
export async function viaTopBar(page: Page, menu: "creer" | "creations", entry: string) {
  const burger = page.locator("[data-top-burger]");
  if (await burger.isVisible()) await burger.click();
  await page.locator(`[data-top-menu="${menu}"]`).filter({ visible: true }).first().click();
  await page.locator(entry).filter({ visible: true }).first().click();
}

/** « Voir tous les outils » from the « Créer » menu. */
export const openToolsHub = (page: Page) => viaTopBar(page, "creer", "[data-top-outils]");

/** « Mes créations », all types. */
export const openCreations = (page: Page) => viaTopBar(page, "creations", "[data-top-creations]");

/** Opens the docked assistant from the always-visible « U*TTU » button of the top bar. */
export async function openAssistant(page: Page) {
  await page.locator("[data-top-uttu]").click();
}
