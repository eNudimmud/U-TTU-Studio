import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simulateComfy } from './helpers/film2-comfy';

// U1.1 is the default /storyboard. ?storyboard=u11 still opens it. ?storyboard=legacy is the paper page.
// ?storyboard=0 still hides the storyboard on this device. Comfy is simulated: 0 real credits.

const SHOTS = process.env.STORYBOARD_SHOTS;
const SIZES = [[390, 844], [844, 390], [1024, 600], [1280, 800]] as const;
const FREE = /gratuit|\bfree\b|kostenlos|gratis/i;

async function targets44(page: Page, scope: string) {
  const small = await page.locator(`${scope} :is(button, a, input, select, textarea, summary):visible`).evaluateAll(nodes => nodes
    .filter(node => !(node as HTMLElement).closest('.sr-only, [aria-hidden="true"]'))
    .map(node => { const box = node.getBoundingClientRect(); return { box, label: (node.getAttribute('aria-label') || node.textContent || node.tagName).trim().slice(0, 40), type: (node as HTMLInputElement).type } })
    .filter(item => item.type !== 'checkbox' && item.box.width > 0 && Math.min(item.box.height, item.box.width) < 43.5)
    .map(item => `${item.label} ${Math.round(item.box.width)}×${Math.round(item.box.height)}`));
  expect(small, 'targets under 44 px').toEqual([]);
}

test('open to everyone: /storyboard is U1.1; ?storyboard=0 hides it, ?storyboard=1 brings U1.1 back', async ({ page }) => {
  expect((await page.goto('/storyboard'))?.status()).toBe(200);
  await expect(page.locator('[data-u11]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-sb-idea]')).toHaveCount(0);
  expect((await page.goto('/storyboard?storyboard=u11'))?.status()).toBe(200);
  await expect(page.locator('[data-u11]')).toBeVisible({ timeout: 60_000 });
  expect((await page.goto('/storyboard?storyboard=0'))?.status()).toBe(404);
  await page.goto('/studio?storyboard=0');
  const bar = page.locator('[data-barre]');
  await bar.locator('[data-barre-plus]').click();
  await expect(bar.locator('[data-barre-attach]')).toHaveCount(3);
  await expect(page.locator('[data-barre-storyboard]')).toHaveCount(0);
  expect((await page.goto('/storyboard'))?.status()).toBe(404);
  expect((await page.goto('/storyboard?storyboard=1'))?.status()).toBe(200);
  await expect(page.locator('[data-u11]')).toBeVisible({ timeout: 60_000 });
  expect((await page.goto('/storyboard'))?.status()).toBe(200);
  await expect(page.locator('[data-u11]')).toBeVisible({ timeout: 60_000 });
});

test('U1.1 default: four sizes, 44 px targets, no side scroll', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'the four sizes are taken in one run');
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.goto('/storyboard');
    await expect(page.locator('[data-u11][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-u11-phase="write"]')).toBeVisible();
    await expect(page.locator('[data-storyboard-page]')).not.toContainText(FREE);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `horizontal overflow ${width}×${height}`).toBeLessThanOrEqual(1);
    await targets44(page, '[data-theme="obsidian"]');
  }
});

test('legacy hatch: ?storyboard=legacy still opens the paper page; an unknown name makes no POST', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one desktop check of the hatch');
  await simulateComfy(page);
  const posts: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && /\/api\/prompt$/.test(new URL(request.url()).pathname)) posts.push(request.url());
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/storyboard?storyboard=legacy');
  await expect(page.locator('[data-storyboard-page][data-theme="paper"][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-u11]')).toHaveCount(0);
  await page.locator('[data-sb-idea-field]:visible').fill('Uttu traverse la ville sous la pluie pour atteindre un toit à l’aube. Elle dit : « On y est presque. »');
  await page.locator('[data-sb-write]:visible').click();
  await expect(page.locator('[data-sb-no-quote]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-sb-film-all]')).toHaveCount(0);
  await expect(page.locator('[data-storyboard-page]')).not.toContainText(FREE);
  expect(posts, 'an unknown name does not start a render').toEqual([]);
  const url = page.url();
  await page.goto(`${url.split('?')[0]}/print?storyboard=legacy`);
  await expect(page.locator('[data-sb-print-page]').first()).toBeVisible({ timeout: 60_000 });
});

test('bubble: « Make a storyboard » for everyone, carrying the idea to /storyboard', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.goto('/studio');
  const bar = page.locator('[data-barre]');
  const idea = 'Uttu traverse la ville sous la pluie.';
  await bar.locator('textarea').fill(idea);
  await bar.locator('[data-barre-plus]').click();
  const item = page.locator('[data-barre-storyboard]');
  await expect(item).toBeVisible();
  expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(item).not.toContainText(/gratuit|free|kostenlos|gratis/i);
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    const { width, height } = page.viewportSize()!;
    await page.screenshot({ path: join(SHOTS, `${width}x${height}-07-bubble-entry.png`) });
  }
  await item.click();
  await expect(page).toHaveURL(/\/storyboard\?idee=/);
  await expect(page.locator('[data-u11][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-u11-story]')).toHaveValue(idea);
  await page.locator('[data-u11-write]').click();
  await expect(page.locator('[data-u11-phase="plan"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-u11-plan]')).toContainText(/ville/i);
  await expect(page.locator('[data-storyboard-page]')).not.toContainText(FREE);
  if (SHOTS) {
    const { width, height } = page.viewportSize()!;
    await page.waitForTimeout(350);
    await page.screenshot({ path: join(SHOTS, `${width}x${height}-08-from-bubble.png`) });
  }
  void info;
});
