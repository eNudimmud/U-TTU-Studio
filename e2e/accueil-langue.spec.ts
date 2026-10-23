import { expect, test } from "@playwright/test";

// The home page says what the studio is in the visitor's language, and opens a free door.
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1024, height: 600 },
  { width: 1280, height: 800 },
];

const CASES = [
  { locale: "en-US", lang: "en", kicker: "Open-source AI film studio on ComfyUI", free: "Try free (0 credits)" },
  { locale: "fr-CH", lang: "fr-CH", kicker: "Studio de cinéma IA open source sur ComfyUI", free: "Essayer gratuitement (0 crédit)" },
  { locale: "de-DE", lang: "de", kicker: "Open-Source-KI-Filmstudio auf ComfyUI", free: "Kostenlos testen (0 Credits)" },
  { locale: "es-ES", lang: "es", kicker: "Estudio de cine IA de código abierto en ComfyUI", free: "Probar gratis (0 créditos)" },
  { locale: "ja-JP", lang: "en", kicker: "Open-source AI film studio on ComfyUI", free: "Try free (0 credits)" },
];

for (const c of CASES) {
  test(`accueil : ${c.locale} au premier passage → ${c.lang}`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Locale is set by the test");
    const context = await browser.newContext({ locale: c.locale, viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", c.lang);
    await expect(page.locator("[data-landing-kicker]")).toHaveText(c.kicker);
    await expect(page.locator("[data-try-free]")).toContainText(c.free);
    await expect(page.locator("[data-comfy-badge]")).toBeVisible();
    await context.close();
  });
}

test("accueil : le choix AA reste, même si le navigateur parle une autre langue", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Locale is set by the test");
  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator(".u-lang select").selectOption("es");
  await expect(page.locator("[data-landing-kicker]")).toHaveText("Estudio de cine IA de código abierto en ComfyUI");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page.goto("/studio");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await context.close();
});

for (const viewport of VIEWPORTS) {
  test(`accueil à ${viewport.width}×${viewport.height} : accroche et porte gratuite au premier écran, 0 crédit`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Viewports are set by the test");
    const context = await browser.newContext({ locale: "en-US", viewport });
    const page = await context.newPage();
    const spent: string[] = [];
    page.on("request", request => { if (/\/api\/(prompt|agent|router|chat)|api\.comfy|comfy\.cloud|fal\.ai/i.test(request.url())) spent.push(request.url()); });
    await page.goto("/");
    const free = page.locator("[data-try-free]");
    await expect(page.locator("#landing-title")).toBeInViewport();
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
