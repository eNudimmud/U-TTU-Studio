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

/** « Tous les outils » on the studio home. */
export const openToolsHub = (page: Page) => page.goto("/studio#outils/tous");

/** My studio, all types. */
export const openCreations = async (page: Page) => {
  const link = page.locator("[data-top-creations]").filter({ visible: true }).first();
  if (await link.isVisible()) { await link.click(); return; }
  await page.goto("/mon-studio");
};

/** Opens Uttu from the bar. The panel starts closed. */
export async function openAssistant(page: Page) {
  const uttu = page.locator("[data-top-uttu]").filter({ visible: true }).first();
  await uttu.click();
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
