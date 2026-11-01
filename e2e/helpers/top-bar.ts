import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Follows the shared top bar the way a visitor does: on a phone the burger drawer first,
 * then the menu (« Créer », « Mes créations »), then the entry.
 */
/**
 * Waits for a top-bar control to be visible, opening the burger drawer when the bar is in its
 * compact form. Retries because the bar can switch between full and compact (focus) form once
 * the studio hydrates and reads the address, which detaches the first controls on a slow runner.
 */
export async function revealInTopBar(page: Page, selector: string): Promise<Locator> {
  const target = page.locator(selector).filter({ visible: true }).first();
  await expect(async () => {
    if (!(await target.isVisible())) {
      const burger = page.locator("[data-top-burger]");
      if (await burger.isVisible() && (await burger.getAttribute("aria-expanded")) !== "true") await burger.click({ timeout: 2000 });
    }
    await expect(target).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
  return target;
}

export async function viaTopBar(page: Page, menu: "creer" | "creations", entry: string) {
  await expect(async () => {
    const toggle = await revealInTopBar(page, `[data-top-menu="${menu}"]`);
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click({ timeout: 2000 });
    await page.locator(entry).filter({ visible: true }).first().click({ timeout: 2000 });
  }).toPass({ timeout: 30000 });
}

/** « Voir tous les outils » from the « Créer » menu. */
export const openToolsHub = (page: Page) => viaTopBar(page, "creer", "[data-top-outils]");

/** « Mes créations », all types. */
export const openCreations = (page: Page) => viaTopBar(page, "creations", "[data-top-creations]");

/** Opens the docked assistant: the drawer on a phone, the account sheet on a wide screen. */
export async function openAssistant(page: Page) {
  const burger = page.locator("[data-top-burger]");
  if (await burger.isVisible()) {
    await burger.click();
    await page.locator("[data-drawer-assistant]").click();
    return;
  }
  await page.locator("header .u-credit").click();
  await page.locator("[data-sheet-assistant]").click();
}

/** Uttu's panel is minimal; the production plan waits behind « Plus d’options ». */
export async function showPlan(page: Page) {
  const more = page.locator("[data-assistant-panel] [data-uttu-more]");
  if ((await more.getAttribute("open")) === null) await more.locator("> summary").click();
}

/** Opens the assistant and its production plan. */
export async function openPlan(page: Page) {
  await openAssistant(page);
  await showPlan(page);
}
