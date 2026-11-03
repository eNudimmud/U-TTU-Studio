import { expect, test } from "@playwright/test";

// The overflow menu (phone landscape, and anywhere the burger is shown): Studio, My studio,
// Guide, search, language. Targets stay at 44 px and the page does not scroll sideways.

const SIZES = [[390, 844], [844, 390], [880, 1024]] as const;

for (const [width, height] of SIZES) {
  test(`navigation ${width}×${height} : cibles 44 px, pas de défilement de côté`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/studio");
    await expect(page.locator("[data-film-nav-to]")).toHaveCount(5);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const burger = page.locator("[data-top-burger]").filter({ visible: true }).first();
    if (await burger.count()) {
      await burger.click();
      const drawer = page.locator("[data-drawer]");
      await expect(drawer.locator("[data-top-studio]")).toBeVisible();
      await expect(drawer.locator("[data-top-creations]")).toBeVisible();
      await expect(drawer.locator("[data-top-guide]")).toBeVisible();
      const targets = await drawer.evaluate(root => [...root.querySelectorAll("a, button, select")].map(item => item.getBoundingClientRect()).filter(r => r.width && r.height).every(r => r.height >= 44 && r.width >= 44));
      expect(targets).toBe(true);
    }
  });
}
