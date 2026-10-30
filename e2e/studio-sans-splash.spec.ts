import { expect, test, type Page } from "@playwright/test";

// F14 · /studio paints its home from the server HTML: the title, the creation bar and the film door
// (the LCP picture) do not wait for the scripts or the local studio. A stage address still opens
// behind the splash, and a saved link never flashes « Relier mon compte ». Nothing is sent, 0 credit.

const COPY = {
  fr: { title: "Qu’est-ce qu’on tourne ?", film: "Réaliser un film" },
  en: { title: "What are we shooting?", film: "Make a film" },
  de: { title: "Was drehen wir?", film: "Einen Film machen" },
  es: { title: "¿Qué rodamos?", film: "Hacer una película" },
} as const;

/** The page as the server sends it: no script of the app runs (the inline boot script still does). */
async function serverHtmlOnly(page: Page) {
  await page.route(/\/_next\/static\/chunks\//, route => route.abort());
}

for (const [locale, copy] of Object.entries(COPY)) {
  test(`${locale} · the home and its film picture are in the server HTML, no splash`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "u-ttu-locale", value: locale, url: baseURL! }]);
    await serverHtmlOnly(page);
    await page.goto("/studio");
    await expect(page.locator("h1#u-title")).toHaveText(copy.title);
    const door = page.locator("[data-entry-film]");
    await expect(door).toBeVisible();
    await expect(door).toContainText(copy.film);
    const hero = page.locator("[data-entry-hero]");
    await expect(hero).toHaveAttribute("fetchpriority", "high");
    await expect.poll(() => hero.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(page.locator("[data-splash]").filter({ visible: true })).toHaveCount(0);
    const box = (await door.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  });
}

test("a stage address shows the splash, not the home, before the studio opens", async ({ page }) => {
  await serverHtmlOnly(page);
  await page.goto("/studio#prise");
  await expect(page.locator("[data-splash]").filter({ visible: true })).toHaveCount(1);
  await expect(page.locator("[data-barre-home]")).toBeHidden();
});

test("a saved link never shows « Relier mon compte » on the early home", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("u-ttu-rendu", JSON.stringify({ mode: "session" })));
  await serverHtmlOnly(page);
  await page.goto("/studio");
  await expect(page.locator("[data-entry-film]")).toBeVisible();
  await expect(page.locator("[data-entry-link]")).toBeHidden();
});

test("the same home stays once the studio is ready: no second mount, the film door works", async ({ page }) => {
  await page.addInitScript(() => {
    // Tag the hero as soon as the server HTML has it; a remount would lose the tag.
    new MutationObserver((_, obs) => {
      const img = document.querySelector("[data-entry-hero]");
      if (img) { img.setAttribute("data-first", ""); obs.disconnect(); }
    }).observe(document, { childList: true, subtree: true });
  });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.goto("/studio");
  await expect(page.locator("[data-barre-home]:not([data-early])")).toBeVisible();
  await expect(page.locator("[data-entry-hero][data-first]")).toHaveCount(1);
  await expect(page.locator("[data-splash]")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.getAttributeNames().filter(name => name.startsWith("data-u-")))).toEqual([]);
  await page.locator("[data-entry-film]").click();
  await expect(page).toHaveURL(/#personnage$/);
  await expect(page.locator(".u-app")).toHaveAttribute("data-studio", "lora");
  expect(errors).toEqual([]);
});
