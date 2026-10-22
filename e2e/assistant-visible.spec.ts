import { test, expect } from '@playwright/test';

// The U*TTU assistant must be reachable in one click from the top bar on every screen. 0 credit.
const sizes = [
  { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 },
  { width: 1280, height: 800 }, { width: 1920, height: 1080 },
] as const;
const pages = ['/studio', '/studio#personnage', '/studio#scene', '/studio#prise', '/mon-studio'] as const;

for (const size of sizes) test(`U*TTU button visible and opens the assistant at ${size.width}×${size.height}`, async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Viewports are set per case');
  await page.route(/\/api\/(prompt|upload)|typesafe\.ai|\/studio-agent\/interpret/, r => r.abort());
  await page.setViewportSize(size);
  for (const path of pages) {
    await page.goto(path);
    const button = page.locator('header [data-top-uttu]');
    await expect(button, path).toBeVisible();
    const box = (await button.boundingBox())!;
    expect(box.height, path).toBeGreaterThanOrEqual(44);
    expect(box.width, path).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width, path).toBeLessThanOrEqual(size.width);
    // No overlap with its neighbours in the top bar.
    for (const other of await page.locator('header .u-top-tools > *').filter({ visible: true }).all()) {
      if (await other.getAttribute('data-top-uttu') !== null) continue;
      const o = await other.boundingBox(); if (!o) continue;
      const overlap = box.x < o.x + o.width - 1 && o.x < box.x + box.width - 1 && box.y < o.y + o.height - 1 && o.y < box.y + box.height - 1;
      expect(overlap, `${path} overlaps ${await other.getAttribute('class')}`).toBe(false);
    }
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    const panel = page.locator('[data-assistant-panel]');
    await expect(panel, path).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(panel.locator('h2')).toHaveText('U*TTU');
    await button.click();
    await expect(panel).toBeHidden();
  }
});
