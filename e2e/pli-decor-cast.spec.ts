import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { simulateComfy } from './helpers/simulate-comfy';

// DÉCOR keeps its text field and gold button on the first screen; CAST says what is ready after an import.
const SIZES = [[390, 844], [844, 390], [1024, 600], [1280, 800]] as const;

async function onFirstScreen(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  const height = page.viewportSize()!.height;
  expect(box, selector).not.toBeNull();
  expect(box!.y, selector).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, selector).toBeLessThanOrEqual(height);
  return box!;
}

test('DÉCOR shows its text field and gold button without scrolling', async ({ page }) => {
  await simulateComfy(page);
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.goto('/studio#decor');
    await expect(page.getByRole('heading', { name: 'DÉCOR' })).toBeVisible();
    expect(await page.evaluate(() => window.scrollY), `${width}x${height}`).toBe(0);
    const field = await onFirstScreen(page, '[data-decor-form] textarea');
    const gold = await onFirstScreen(page, '[data-decor-gold]');
    expect(gold.height).toBeGreaterThanOrEqual(44);
    // The pinned gold bar never covers the text field.
    const bar = await page.locator('.u-create-bar').boundingBox();
    expect(field.y + field.height, `${width}x${height}`).toBeLessThanOrEqual(bar!.y + 1);
  }
});

test('CAST: after an import the gold button goes on to DÉCOR', async ({ page }) => {
  await simulateComfy(page);
  await page.goto('/studio#personnage');
  await page.getByLabel('Importer un personnage', { exact: true }).setInputFiles({ name: 'Uttu.webp', mimeType: 'image/webp', buffer: readFileSync('public/exemples/cast-dj.webp') });
  const gold = page.locator('[data-cast-gold]');
  await expect(gold).toHaveAttribute('data-cast-ready', '');
  await expect(gold).toBeEnabled();
  await expect(gold).toContainText('Continuer vers DÉCOR');
  await expect(page.locator('#u-why-cast')).toHaveCount(0);
  await gold.click();
  await expect(page.getByRole('heading', { name: 'DÉCOR' })).toBeVisible();
});
