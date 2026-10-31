import { expect, test } from "@playwright/test";

// The home page opens in English for every new visitor (the browser language is not read), keeps a
// language the visitor picked, and opens a door that launches no render.
const FRESH = { cookies: [], origins: [] };
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1024, height: 600 },
  { width: 1280, height: 800 },
];

const EN = { lang: "en", kicker: "Open source · MIT · on ComfyUI", free: "Discover with Uttu" };
const CASES = ["en-US", "fr-CH", "de-DE", "es-ES", "ja-JP"].map(locale => ({ locale, ...EN }));
const SAVED = [
  { locale: "fr", lang: "fr-CH", kicker: "Open source · MIT · sur ComfyUI", free: "Découvrir avec Uttu" },
  { locale: "de", lang: "de", kicker: "Open Source · MIT · auf ComfyUI", free: "Mit Uttu entdecken" },
  { locale: "es", lang: "es", kicker: "Código abierto · MIT · en ComfyUI", free: "Descubrir con Uttu" },
];

for (const c of SAVED) {
  test(`home: a saved ${c.locale} choice is kept, even with an English browser`, async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Locale is set by the test");
    const context = await browser.newContext({ locale: "en-US", storageState: FRESH, viewport: { width: 1280, height: 800 } });
    await context.addCookies([{ name: "u-ttu-locale", value: c.locale, url: baseURL! }]);
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", c.lang);
    await expect(page.locator("[data-landing-kicker]")).toHaveText(c.kicker);
    await expect(page.locator("[data-try-free]")).toContainText(c.free);
    await context.close();
  });
}

for (const c of CASES) {
  test(`accueil : ${c.locale} au premier passage → ${c.lang}`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Locale is set by the test");
    const context = await browser.newContext({ locale: c.locale, storageState: FRESH, viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", c.lang);
    await expect(page.locator("[data-landing-kicker]")).toHaveText(c.kicker);
    await expect(page.locator("[data-try-free]")).toContainText(c.free);
    await expect(page.locator("[data-hero] [data-comfy-badge]")).toBeVisible();
    await context.close();
  });
}

test("accueil : le choix AA reste, même si le navigateur parle une autre langue", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Locale is set by the test");
  const context = await browser.newContext({ locale: "en-US", storageState: FRESH });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator(".u-lang select").selectOption("es");
  await expect(page.locator("[data-landing-kicker]")).toHaveText("Código abierto · MIT · en ComfyUI");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page.goto("/studio");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await context.close();
});

for (const viewport of VIEWPORTS) {
  test(`accueil à ${viewport.width}×${viewport.height} : accroche, porte du studio en premier et porte Uttu au premier écran`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Viewports are set by the test");
    const context = await browser.newContext({ locale: "en-US", storageState: FRESH, viewport });
    const page = await context.newPage();
    const spent: string[] = [];
    page.on("request", request => { if (/\/api\/(prompt|agent|router|chat)|api\.comfy|comfy\.cloud|fal\.ai/i.test(request.url())) spent.push(request.url()); });
    await page.goto("/");
    const enter = page.locator("[data-hero] [data-enter-studio]");
    const free = page.locator("[data-try-free]");
    await expect(page.locator("#landing-title")).toBeInViewport();
    await expect(enter).toBeInViewport();
    await expect(enter).toHaveClass(/hv-gold/);
    expect((await enter.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(free).toBeInViewport();
    const box = await free.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await free.click();
    await expect(page).toHaveURL(/\/studio$/);
    await expect(page.locator("[data-assistant-panel]")).toBeVisible();
    await expect(page.locator("[data-top-uttu]")).toHaveAttribute("aria-expanded", "true");
    expect(spent).toEqual([]);
    await context.close();
  });
}

for (const locale of ["fr", "en", "de", "es"]) {
  test(`accueil en ${locale} : aucun défilement de côté, cibles de 44 px, logo entier et badge ComfyUI`, async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Viewports are set by the test");
    const context = await browser.newContext({ storageState: FRESH, reducedMotion: "reduce" });
    await context.addCookies([{ name: "u-ttu-locale", value: locale, url: baseURL! }]);
    const page = await context.newPage();
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expect(page.locator("[data-hero] .hv-lockup")).toBeVisible();
      await expect(page.locator("[data-hero] [data-comfy-badge]")).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(150);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${locale} ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(viewport.width);
      const small = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".hv a, .hv button, .hv select")]
        .filter(el => el.offsetParent && getComputedStyle(el).visibility !== "hidden")
        .map(el => ({ el, box: el.getBoundingClientRect() }))
        .filter(({ box }) => box.width > 0 && box.height < 44)
        .map(({ el, box }) => `${el.tagName.toLowerCase()}.${el.className} ${Math.round(box.height)}px`));
      expect(small, `${locale} ${viewport.width}×${viewport.height}`).toEqual([]);
    }
    await context.close();
  });
}
