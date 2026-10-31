import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simulateComfy } from './helpers/film2-comfy';

// Storyboard (SB5–SB10) behind ?storyboard=1. Comfy is simulated: 0 real credits. Proves the path,
// the saved files, the one confirmation and the 44 px targets on the paper theme.

const SHOTS = process.env.STORYBOARD_SHOTS;
const SIZES = [[390, 844], [844, 390], [1024, 600], [1280, 800]] as const;

async function targets44(page: Page) {
  const small = await page.locator('[data-theme="paper"] :is(button, a, input, select, textarea, summary):visible').evaluateAll(nodes => nodes
    .filter(node => !(node as HTMLElement).closest('.sr-only, [aria-hidden="true"]'))
    .map(node => { const box = node.getBoundingClientRect(); return { box, label: (node.getAttribute('aria-label') || node.textContent || node.tagName).trim().slice(0, 40), type: (node as HTMLInputElement).type } })
    .filter(item => item.type !== 'checkbox' && item.box.width > 0 && Math.min(item.box.height, item.box.width) < 43.5)
    .map(item => `${item.label} ${Math.round(item.box.width)}×${Math.round(item.box.height)}`));
  expect(small, 'targets under 44 px').toEqual([]);
}

test('flag off: /storyboard answers 404', async ({ page }) => {
  const response = await page.goto('/storyboard');
  expect(response?.status()).toBe(404);
});

test('idea → saved board → shot sheet → one confirmation; four sizes', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the four sizes are taken in one run');
  test.setTimeout(240_000);
  await simulateComfy(page);
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const snap = async (name: string) => {
    await page.waitForTimeout(350);
    const [w, h] = [page.viewportSize()!.width, page.viewportSize()!.height];
    await page.screenshot({ path: info.outputPath(`${w}x${h}-${name}.png`) });
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `${w}x${h}-${name}.png`) });
  };

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/storyboard?storyboard=1');
  await expect(page.locator('[data-storyboard-page][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-sb-idea]:visible')).toBeVisible();
  await page.locator('[data-sb-idea-field]:visible').fill('Uttu traverse la ville sous la pluie pour atteindre un toit à l’aube. Elle dit : « On y est presque. »');
  await page.locator('[data-sb-write]:visible').click();
  await expect(page.locator('[data-sb-writer-reply]')).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/storyboard\/[a-z0-9-]+/);
  await snap('00-written');
  const shots = page.locator('[data-sb-shot]');
  await expect(shots.first()).toBeVisible();
  const count = await shots.count();
  expect(count).toBeGreaterThanOrEqual(3);
  // Every shot written has a quote: the dock offers the whole board, priced.
  await expect(page.locator('[data-sb-film-all]')).toContainText(/≈ [\d,]+ crédits estimés/);
  await expect(page.locator('[data-sb-no-quote]')).toHaveCount(0);
  // The quoted words of the idea become a line, shown quoted on the board.
  await expect(page.locator('[data-sb-line]').first()).toContainText('On y est presque.');
  await expect(page.locator('[data-sb-shot]').filter({ hasText: /dit :/ })).toHaveCount(0);
  // Saved: a reload finds the same board.
  const url = page.url();
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator('[data-storyboard-page][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(shots).toHaveCount(count, { timeout: 30_000 });
  expect(page.url()).toBe(url);

  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.goto(url);
    await expect(page.locator('[data-storyboard-page][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
    const narrow = width < 800;
    if (narrow) {
      // Board first; the Uttu toggle swaps the column in.
      await expect(shots.first()).toBeVisible();
      await snap('02-board');
      await page.locator('[data-sb-toggle]').click();
      await expect(page.locator('[data-sb-chat]')).toBeVisible();
      await snap('04-uttu');
      await targets44(page);
      await page.locator('[data-sb-toggle]').click();
    } else {
      await expect(page.locator('[data-sb-chat]')).toBeVisible();
      await snap('02-board-uttu');
    }
    await targets44(page);
    await page.locator('[data-sb-open]').nth(1).click();
    const sheet = page.locator('[data-sb-sheet]');
    await expect(sheet).toBeVisible();
    await snap('03-sheet');
    await targets44(page);
    await expect(page.locator('[data-sb-sheet-film]')).toContainText(/≈ [\d,]+/);
    await page.locator('[data-sb-sheet-film]').click();
    const confirm = page.locator('[data-sb-confirm]');
    await expect(confirm).toBeVisible();
    await expect(confirm.locator('[data-sb-total]')).toContainText(/≈ [\d,]+ crédits estimés/);
    await expect(confirm).not.toContainText(/gratuit/i);
    await snap('05-confirm');
    await confirm.locator('[data-sb-cancel]').click();
    await expect(confirm).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    // The list.
    await page.locator('[data-sb-back]').click();
    await expect(page.locator('[data-sb-card]').first()).toBeVisible();
    await snap('01-list');
    await targets44(page);
  }

  // A correction in plain words changes the board without a render.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(url);
  await expect(page.locator('[data-storyboard-page][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await page.locator('[data-sb-ask]').fill('ajoute un plan');
  await page.locator('[data-sb-ask]').press('Enter');
  await expect(shots).toHaveCount(count + 1);

  // Print view: A4, six per page.
  await page.goto(`${url}/print`);
  await expect(page.locator('[data-sb-print-page]').first()).toBeVisible({ timeout: 60_000 });
  await snap('06-print');
});
