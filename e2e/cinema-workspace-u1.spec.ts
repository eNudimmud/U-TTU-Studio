import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simulateComfy } from './helpers/film2-comfy';

// CE4 · U1 cinema workspace (docs/architecture/UX_REVIEW.md, prototypes/uttu-cinema-u1.html): one selectable
// shot strip, the selected shot large with its caption, a « Context » disclosure, one Uttu composer scoped to
// the selected shot. Comfy is simulated and nothing is filmed: 0 real credits.

const SHOTS = process.env.STORYBOARD_SHOTS;
const SIZES = [[390, 844], [844, 390], [1024, 600], [1280, 800]] as const;
const FREE = /gratuit|\bfree\b|kostenlos|gratis/i;

async function targets44(page: Page) {
  const small = await page.locator('[data-theme="paper"] :is(button, a, input, select, textarea, summary):visible').evaluateAll(nodes => nodes
    .filter(node => !(node as HTMLElement).closest('.sr-only, [aria-hidden="true"]'))
    .map(node => { const box = node.getBoundingClientRect(); return { box, label: (node.getAttribute('aria-label') || node.textContent || node.tagName).trim().slice(0, 40), type: (node as HTMLInputElement).type } })
    .filter(item => item.type !== 'checkbox' && item.box.width > 0 && Math.min(item.box.height, item.box.width) < 43.5)
    .map(item => `${item.label} ${Math.round(item.box.width)}×${Math.round(item.box.height)}`));
  expect(small, 'targets under 44 px').toEqual([]);
}

async function noSideScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, 'horizontal overflow').toBeLessThanOrEqual(1);
}

async function ready(page: Page) {
  await expect(page.locator('[data-storyboard-page][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-sb-workspace]')).toBeVisible({ timeout: 30_000 });
}

async function writeBoard(page: Page) {
  await page.goto('/storyboard');
  await expect(page.locator('[data-storyboard-page][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await page.locator('[data-sb-idea-field]:visible').fill('Uttu traverse la ville sous la pluie pour atteindre un toit à l’aube. Elle dit : « On y est presque. »');
  await page.locator('[data-sb-write]:visible').click();
  await expect(page.locator('[data-sb-writer-reply]')).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/storyboard\/[a-z0-9-]+/);
  await ready(page);
  await page.waitForTimeout(800); // saved
  return page.url();
}

async function setLocale(page: Page, locale: string) {
  const url = new URL(page.url());
  await page.context().addCookies([{ name: 'u-ttu-locale', value: locale, domain: url.hostname, path: '/' }]);
  await page.evaluate(value => localStorage.setItem('u-ttu-locale', value), locale);
}

test('U1: select a shot, scope the composer, open the context; the other shots stay as they were', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one run covers the four sizes');
  test.setTimeout(300_000);
  await simulateComfy(page);
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const snap = async (name: string) => {
    await page.waitForTimeout(350);
    const { width, height } = page.viewportSize()!;
    await page.screenshot({ path: info.outputPath(`${width}x${height}-${name}.png`) });
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `${width}x${height}-${name}.png`) });
  };

  await page.setViewportSize({ width: 1280, height: 800 });
  const url = await writeBoard(page);
  const tiles = page.locator('[data-sb-strip] [data-sb-select]');
  expect(await tiles.count()).toBeGreaterThanOrEqual(3);

  // One conversation, one composer; no board/Uttu toggle any more.
  await expect(page.locator('[data-sb-toggle]')).toHaveCount(0);
  await expect(page.locator('[data-sb-ask]')).toHaveCount(1);
  await expect(page.locator('[data-sb-chat]')).toHaveCount(1);

  // The first shot is selected by default and the composer says so.
  await expect(tiles.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-sb-scope]')).toContainText(/01/);

  // Select shot 2: the frame, the caption and the scope follow; focus stays on the tile.
  await tiles.nth(1).click();
  await expect(tiles.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(tiles.nth(0)).toHaveAttribute('aria-pressed', 'false');
  await expect(tiles.nth(1)).toBeFocused();
  await expect(page.locator('[data-sb-frame]')).toContainText(/02/);
  await expect(page.locator('[data-sb-scope]')).toContainText(/02/);
  // Keyboard: arrow-free, Tab-friendly; Enter/Space on a tile selects it.
  await tiles.nth(2).focus();
  await page.keyboard.press('Enter');
  await expect(tiles.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await tiles.nth(1).focus();
  await page.keyboard.press(' ');
  await expect(tiles.nth(1)).toHaveAttribute('aria-pressed', 'true');

  // CE5: no qualified keyframe workflow yet, so the inactive keyframe button is not shown at all.
  await expect(page.locator('[data-sb-keyframe]')).toHaveCount(0);

  // Context: closed by default, aria-expanded follows, references by role.
  const toggle = page.locator('[data-sb-context-toggle]');
  const context = page.locator('[data-sb-context]');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(context).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(context).toBeVisible();
  await expect(page.locator('[data-sb-ctx-versions]')).toBeVisible();
  await snap('u1-context');
  await toggle.click();
  await expect(context).toBeHidden();

  // Acceptance: change shot 2's camera through its sheet; every other caption stays the same.
  const captions: string[] = [];
  const count = await tiles.count();
  for (let i = 0; i < count; i++) { await tiles.nth(i).click(); captions.push((await page.locator('[data-sb-caption]').innerText()).trim()); }
  await tiles.nth(1).click();
  await page.locator('[data-sb-open]').click();
  const sheet = page.locator('[data-sb-sheet]');
  await expect(sheet).toBeVisible();
  const camera = sheet.locator('.sb-chips').nth(1).locator('.sb-chip');
  const target = camera.last();
  const before = await target.getAttribute('aria-pressed');
  await target.click();
  await expect(target).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('[data-sb-caption]')).not.toHaveText(captions[1]!);
  for (let i = 0; i < count; i++) {
    if (i === 1) continue;
    await tiles.nth(i).click();
    await expect(page.locator('[data-sb-caption]')).toHaveText(captions[i]!);
  }

  // A plain request with no shot number works on the selected shot (here: the scope line names it).
  await tiles.nth(1).click();
  await expect(page.locator('[data-sb-scope]')).toContainText(/02/);

  // The shot menu: duplicate inserts a copy right after and selects it; undo brings the board back.
  await page.locator('[data-sb-shot-menu]').click();
  await page.locator('[data-sb-duplicate]').click();
  await expect(tiles).toHaveCount(count + 1);
  await expect(tiles.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-sb-undo] button').click();
  await expect(tiles).toHaveCount(count);

  // Four sizes: no side scroll, 44 px targets, conversation in the flow, never « free ».
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.goto(url);
    await ready(page);
    await expect(page.locator('[data-sb-chat]')).toBeVisible();
    await expect(page.locator('[data-sb-ask]')).toBeVisible();
    await noSideScroll(page);
    await targets44(page);
    await expect(page.locator('[data-storyboard-page]')).not.toContainText(FREE);
    await page.locator('[data-sb-strip] [data-sb-select]').nth(1).click();
    await snap('u1-workspace');
    await page.locator('[data-sb-context-toggle]').click();
    await targets44(page);
    await noSideScroll(page);
    await snap('u1-workspace-context');
    await page.locator('[data-sb-ask]').scrollIntoViewIfNeeded();
    await snap('u1-composer');
  }

  // English by default, French, German, Spanish: the workspace copy follows, never « free ».
  await page.setViewportSize({ width: 1280, height: 800 });
  const expected = { en: 'Context', fr: 'Contexte', de: 'Kontext', es: 'Contexto' } as const;
  for (const [locale, word] of Object.entries(expected)) {
    await setLocale(page, locale);
    await page.goto(url);
    await ready(page);
    await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${locale}\\b`));
    await expect(page.locator('[data-sb-context-toggle]')).toContainText(word);
    await expect(page.locator('[data-storyboard-page]')).not.toContainText(FREE);
    await page.waitForTimeout(250);
    if (SHOTS && locale !== 'fr') await page.screenshot({ path: join(SHOTS, `1280x800-u1-${locale}.png`) });
  }
});
