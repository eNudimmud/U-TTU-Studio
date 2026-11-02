import { expect, test, type Page } from '@playwright/test';
import { STORYBOARD_CLOSED } from '../src/app/storyboard/closed';
import { simulateComfy } from './helpers/film2-comfy';

// While STORYBOARD_CLOSED is true, /storyboard (and u11 / legacy) is the holding page.
// ?storyboard=sw is not gated. ?storyboard=0 still hides the door. Flip the constant to restore the board.

const SIZES = [[390, 844], [844, 390], [1024, 600], [1280, 800]] as const;
const FREE = /gratuit|\bfree\b|kostenlos|gratis/i;
const PRICE = /\$|€|£|\bcr\./i;

function watchPrompts(page: Page) {
  const posts: string[] = [];
  page.on('request', request => {
    if (request.method() !== 'POST') return;
    const path = new URL(request.url()).pathname.replace(/\/+$/, '');
    if (path.endsWith('/api/prompt')) posts.push(path);
  });
  return posts;
}

async function targets44(page: Page, scope: string) {
  const small = await page.locator(`${scope} :is(button, a, input, select, textarea, summary):visible`).evaluateAll(nodes => nodes
    .filter(node => !(node as HTMLElement).closest('.sr-only, [aria-hidden="true"]'))
    .map(node => { const box = node.getBoundingClientRect(); return { box, label: (node.getAttribute('aria-label') || node.textContent || node.tagName).trim().slice(0, 40), type: (node as HTMLInputElement).type } })
    .filter(item => item.type !== 'checkbox' && item.box.width > 0 && Math.min(item.box.height, item.box.width) < 43.5)
    .map(item => `${item.label} ${Math.round(item.box.width)}×${Math.round(item.box.height)}`));
  expect(small, 'targets under 44 px').toEqual([]);
}

async function noSideScroll(page: Page, label: string) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, `horizontal overflow ${label}`).toBeLessThanOrEqual(1);
}

test('closed: /storyboard, u11 and legacy hold; sw is not gated; nothing is posted', async ({ page }) => {
  test.skip(!STORYBOARD_CLOSED, 'the board is open again');
  const posts = watchPrompts(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  for (const url of ['/storyboard', '/storyboard?storyboard=u11', '/storyboard?storyboard=legacy', '/storyboard/kept-safe']) {
    expect((await page.goto(url))?.status()).toBe(200);
    const hold = page.locator('[data-storyboard-holding][data-storyboard-gate="closed"]');
    await expect(hold).toBeVisible();
    await expect(page.locator('[data-u11], [data-storyboard-page]')).toHaveCount(0);
    await expect(hold.locator('[data-uttu-portrait]')).toBeVisible();
    await expect(hold.locator('h1')).toContainText(/tissée|woven|gewebt|tejida/);
    await expect(hold).toContainText('Uttu');
    await expect(hold).not.toContainText('Mira');
    await expect(hold).not.toContainText(FREE);
    await expect(hold).not.toContainText(PRICE);
    await expect(page.locator('[data-storyboard-back]')).toHaveAttribute('href', '/studio');
  }

  expect((await page.goto('/storyboard?storyboard=sw'))?.status()).toBe(200);
  await expect(page.locator('[data-storyboard-gate="sw"]')).toBeVisible();
  await expect(page.locator('[data-storyboard-gate="closed"]')).toHaveCount(0);
  await expect(page.locator('[data-u11]')).toHaveCount(0);

  expect((await page.goto('/storyboard?storyboard=0'))?.status()).toBe(404);
  await page.waitForTimeout(400);
  expect(posts, 'no /api/prompt POST').toEqual([]);
  expect(errors, 'no page errors').toEqual([]);
});

test('closed: four sizes, 44 px targets, no side scroll, the portrait stays', async ({ page }, info) => {
  test.skip(!STORYBOARD_CLOSED, 'the board is open again');
  test.skip(info.project.name !== 'desktop', 'the four sizes are taken in one run');
  await page.context().addCookies([{ name: 'u-ttu-locale', value: 'en', domain: '127.0.0.1', path: '/' }]);
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.goto('/storyboard');
    const hold = page.locator('[data-storyboard-holding]');
    await expect(hold).toBeVisible();
    await expect(hold.locator('h1')).toContainText('woven');
    await noSideScroll(page, `${width}×${height}`);
    await targets44(page, '[data-storyboard-holding]');
    await page.screenshot({ path: info.outputPath(`holding-${width}x${height}.png`), fullPage: false });
  }
});

test('closed: the studio keeps the door, marked Soon, and it opens the holding page', async ({ page }) => {
  test.skip(!STORYBOARD_CLOSED, 'the board is open again');
  await page.goto('/studio');
  const bar = page.locator('[data-barre]');
  await bar.locator('[data-barre-plus]').click();
  const item = page.locator('[data-barre-storyboard]');
  await expect(item).toBeVisible();
  await expect(item.locator('[data-storyboard-soon]')).toHaveText(/Soon|Bientôt|Bald|Pronto/);
  expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await item.click();
  await expect(page).toHaveURL(/\/storyboard/);
  await expect(page.locator('[data-storyboard-holding][data-storyboard-gate="closed"]')).toBeVisible();

  await page.goto('/studio');
  const entry = page.locator('[data-storyboard-entry]');
  await expect(entry).toBeVisible({ timeout: 20_000 });
  await expect(entry.locator('[data-storyboard-soon]')).toBeVisible();
  await entry.locator('a').click();
  await expect(page.locator('[data-storyboard-holding][data-storyboard-gate="closed"]')).toBeVisible();
});

test('open to everyone: /storyboard is U1.1; ?storyboard=0 hides it, ?storyboard=1 brings U1.1 back', async ({ page }) => {
  test.skip(STORYBOARD_CLOSED, 'holding page covers this until StoryWeave; flip STORYBOARD_CLOSED');
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
  test.skip(STORYBOARD_CLOSED, 'holding page covers this until StoryWeave; flip STORYBOARD_CLOSED');
  test.skip(test.info().project.name !== 'desktop', 'the four sizes are taken in one run');
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.goto('/storyboard');
    await expect(page.locator('[data-u11][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-u11-phase="write"]')).toBeVisible();
    await expect(page.locator('[data-storyboard-page]')).not.toContainText(FREE);
    await noSideScroll(page, `${width}×${height}`);
    await targets44(page, '[data-theme="obsidian"]');
  }
});

test('legacy hatch: ?storyboard=legacy still opens the paper page and prices a board', async ({ page }) => {
  test.skip(STORYBOARD_CLOSED, 'holding page covers this until StoryWeave; flip STORYBOARD_CLOSED');
  test.skip(test.info().project.name !== 'desktop', 'one desktop check of the hatch');
  await simulateComfy(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/storyboard?storyboard=legacy');
  await expect(page.locator('[data-storyboard-page][data-theme="paper"][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-u11]')).toHaveCount(0);
  await page.locator('[data-sb-idea-field]:visible').fill('Uttu traverse la ville sous la pluie pour atteindre un toit à l’aube. Elle dit : « On y est presque. »');
  await page.locator('[data-sb-write]:visible').click();
  await expect(page.locator('[data-sb-film-all]')).toContainText(/≈ [\d.,]+ (crédits estimés|credits estimated)/, { timeout: 30_000 });
  await expect(page.locator('[data-storyboard-page]')).not.toContainText(FREE);
  const url = page.url();
  await page.goto(`${url.split('?')[0]}/print?storyboard=legacy`);
  await expect(page.locator('[data-sb-print-page]').first()).toBeVisible({ timeout: 60_000 });
});

test('bubble: « Make a storyboard » for everyone, carrying the idea to /storyboard', async ({ page }) => {
  test.skip(STORYBOARD_CLOSED, 'holding page covers this until StoryWeave; flip STORYBOARD_CLOSED');
  test.setTimeout(120_000);
  await page.goto('/studio');
  const bar = page.locator('[data-barre]');
  const idea = 'Uttu traverse la ville sous la pluie.';
  await bar.locator('textarea').fill(idea);
  await bar.locator('[data-barre-plus]').click();
  const item = page.locator('[data-barre-storyboard]');
  await expect(item).toBeVisible();
  expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(item).not.toContainText(FREE);
  await item.click();
  await expect(page).toHaveURL(/\/storyboard\?idee=/);
  await expect(page.locator('[data-u11][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-u11-story]')).toHaveValue(idea);
  await page.locator('[data-u11-write]').click();
  await expect(page.locator('[data-u11-phase="plan"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-u11-plan]')).toContainText(/ville/i);
  await expect(page.locator('[data-storyboard-page]')).not.toContainText(FREE);
});
