import { expect, test, type Page } from "@playwright/test";

// A new visitor gets English, whatever language the browser sends (decision of 2026-10-31: link previews,
// crawlers and first visits all see the same studio). A language the visitor picked is kept.
// Nothing is sent, 0 credit.
const FRESH = { cookies: [], origins: [] };
/** Accents and short words only French carries. A simple scan, not a grammar check. */
const FRENCH = /[éèêàùçœ«»]|\b(?:le|la|les|une|des|du|avec|pour|dans|ton|tes|vous|crédits?|prises?|décors?|montage|lieux?|personnages?|gratuit|outils|aucun|rien|déjà|tourner|finaliser)\b/i;
/** Names that stay as they are in every language: the language list and a real place name. */
const ALLOWED = /Français|français|Saint-François/g;

async function frenchIn(page: Page) {
  const text = await page.locator("body").innerText();
  return text.replace(ALLOWED, "").split("\n").map(line => line.trim()).filter(line => line && FRENCH.test(line));
}

test.describe("English by default", () => {

  test("a fresh French-speaking visitor gets the home page in English, with English link previews", async ({ browser, baseURL }, info) => {
    const context = await browser.newContext({ locale: "fr-CH", storageState: FRESH, viewport: info.project.use.viewport ?? undefined });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("[data-landing-kicker]")).toHaveText("Open source · MIT · on ComfyUI");
    await expect(page).toHaveTitle(/U\*TTU Studio/);
    expect(await page.title()).not.toMatch(FRENCH);
    const meta = (selector: string) => page.locator(selector).first().getAttribute("content");
    expect(await meta('meta[property="og:locale"]')).toBe("en_GB");
    for (const selector of ['meta[name="description"]', 'meta[property="og:title"]', 'meta[property="og:description"]', 'meta[name="twitter:title"]', 'meta[name="twitter:description"]']) {
      const content = await meta(selector);
      expect(content, selector).toBeTruthy();
      expect(content!, selector).not.toMatch(FRENCH);
    }
    expect(await meta('meta[property="og:image"]')).toMatch(/\/og(\/accueil)?\.jpg\?v=4$/);
    expect(await meta('meta[property="og:image:width"]')).toBe("1200");
    expect(await meta('meta[property="og:image:height"]')).toBe("630");
    expect(await frenchIn(page)).toEqual([]);
    const cookies = await context.cookies(baseURL!);
    expect(cookies.find(cookie => cookie.name === "u-ttu-locale")?.value ?? "en").toBe("en");
    await context.close();
  });

  test("the studio opens in English for a fresh visitor, examples included", async ({ browser }, info) => {
    const context = await browser.newContext({ locale: "fr-FR", storageState: FRESH, viewport: info.project.use.viewport ?? undefined });
    const page = await context.newPage();
    await page.goto("/studio");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("h1#u-title")).toHaveText("What are we shooting?");
    await expect(page.locator("[data-entry-film]")).toContainText("Make a film");
    expect(await frenchIn(page)).toEqual([]);
    await page.goto("/mon-studio");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(await frenchIn(page)).toEqual([]);
    await context.close();
  });

  test("a saved French choice is kept over the English default", async ({ browser, baseURL }, info) => {
    const context = await browser.newContext({ locale: "en-US", storageState: FRESH, viewport: info.project.use.viewport ?? undefined });
    await context.addCookies([{ name: "u-ttu-locale", value: "fr", url: baseURL! }]);
    const page = await context.newPage();
    await page.goto("/studio");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr-CH");
    await expect(page.locator("h1#u-title")).toHaveText("Qu’est-ce qu’on tourne ?");
    await context.close();
  });
});
