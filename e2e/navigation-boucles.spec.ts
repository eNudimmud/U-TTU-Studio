import { expect, test, type Page } from "@playwright/test";

// P1-2: the bottom bar's four tabs go to four different places, an old « Créer » link lands on
// the « Créer » tab (never on Film), the creation page has one prompt only, and « ← Tous les outils »
// never traps the phone's Back button between a tool and the list.

const current = (page: Page) => page.locator("[data-tabs] a[aria-current=page]");

test.describe("barre du bas et retours", () => {
  test.beforeEach(({}, info) => { test.skip(info.project.name !== "mobile", "bottom bar is the phone layout"); });

  test("quatre onglets, quatre destinations, un seul formulaire", async ({ page }) => {
    await page.goto("/studio");
    const tabs = page.locator("[data-tabs] a");
    await expect(tabs).toHaveCount(4);
    const hrefs = await tabs.evaluateAll(links => links.map(link => (link as HTMLAnchorElement).href));
    expect(new Set(hrefs).size).toBe(4);
    const seen = new Set<string>();
    for (const id of ["creer", "creations"]) {
      await page.locator(`[data-tabs] a[data-tab=${id}]`).click();
      await expect(current(page)).toHaveAttribute("data-tab", id);
      const where = new URL(page.url());
      seen.add(`${where.pathname}${where.hash}`);
      for (const box of await tabs.all()) expect((await box.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    // The film is a focused place: its own bar CAST · DÉCOR · PRISE · MONTAGE replaces the bottom bar.
    await page.locator("[data-tabs] a[data-tab=film]").click();
    await expect(page.locator("[data-film-nav-to]")).toHaveCount(4);
    const film = new URL(page.url());
    seen.add(`${film.pathname}${film.hash}`);
    expect(seen.size).toBe(3);
    await page.goto("/studio#outils");
    await expect(page.locator("textarea:visible")).toHaveCount(1);
  });

  test("un vieux lien #creer ouvre l'onglet Créer, pas Film", async ({ page }) => {
    await page.goto("/studio#creer");
    await expect(current(page)).toHaveAttribute("data-tab", "creer");
    await expect(page.locator("[data-barre-input]")).toBeVisible();
  });

  for (const card of ["[data-outil=img-klein]", "[data-outil-reperage]"]) {
    test(`retour d'un outil sans boucle (${card})`, async ({ page }) => {
      await page.goto("/mon-studio");
      await page.locator("[data-tabs] a[data-tab=creer]").click();
      await expect(current(page)).toHaveAttribute("data-tab", "creer");
      await page.locator(card).first().click();
      await expect(page.locator("[data-outils-back]")).toBeVisible();
      await page.locator("[data-outils-back]").click();
      await expect(page.locator("[data-outils-back]")).toHaveCount(0);
      await page.goBack();
      // Back leaves the list for the page before the tool was opened, never the tool again.
      await expect(page.locator("[data-outils-back]")).toHaveCount(0);
      await page.goBack();
      await expect(page).toHaveURL(/\/mon-studio$/);
    });
  }
});
