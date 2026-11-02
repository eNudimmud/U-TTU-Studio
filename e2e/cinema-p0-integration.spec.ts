import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { simulateComfy } from './helpers/film2-comfy';

// CE5 · P0 journey, integrated (docs/architecture CE5 §5): write a board, select a shot, a plain request is
// read for that shot only, undo, the footer's one video exit opens the real MONTAGE, and the session resumes on
// open with status reads only. Comfy is simulated, synthetic media only, no reference picture of a character:
// 0 real credits, and no POST to /api/prompt anywhere in the journey.

const SIZES = [[390, 844], [844, 390], [1024, 600], [1280, 800]] as const;
const FREE = /gratuit|\bfree\b|kostenlos|gratis/i;

function watchPosts(page: Page) {
  const posts: string[] = [];
  page.on('request', request => {
    if (request.method() !== 'POST') return;
    const path = new URL(request.url()).pathname.replace(/\/+$/, '');
    if (path.endsWith('/api/prompt') || path.endsWith('/interrupt') || path.endsWith('/queue')) posts.push(path);
  });
  return posts;
}

async function ready(page: Page) {
  await expect(page.locator('[data-storyboard-page][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-sb-workspace]')).toBeVisible({ timeout: 30_000 });
}

async function targets44(page: Page, scope: string) {
  const small = await page.locator(`${scope} :is(button, a, input, select, textarea, summary):visible`).evaluateAll(nodes => nodes
    .filter(node => !(node as HTMLElement).closest('.sr-only, [aria-hidden="true"]'))
    .map(node => { const box = node.getBoundingClientRect(); return { box, label: (node.getAttribute('aria-label') || node.textContent || node.tagName).trim().slice(0, 40), type: (node as HTMLInputElement).type }; })
    .filter(item => item.type !== 'checkbox' && item.box.width > 0 && Math.min(item.box.height, item.box.width) < 43.5)
    .map(item => `${item.label} ${Math.round(item.box.width)}×${Math.round(item.box.height)}`));
  expect(small, 'targets under 44 px').toEqual([]);
}

async function captions(page: Page) {
  const tiles = page.locator('[data-sb-strip] [data-sb-select]');
  const out: string[] = [];
  for (let i = 0; i < await tiles.count(); i++) { await tiles.nth(i).click(); out.push((await page.locator('[data-sb-caption]').innerText()).trim()); }
  return out;
}

test('P0: board → selected shot → plain request on that shot only → undo → MONTAGE export, without any paid POST', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one run covers the four sizes');
  test.setTimeout(300_000);
  await simulateComfy(page);
  const posts = watchPosts(page);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/storyboard');
  await expect(page.locator('[data-storyboard-page][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await page.locator('[data-sb-idea-field]:visible').fill('Une voyageuse traverse la ville sous la pluie pour atteindre un toit à l’aube. Elle dit : « On y est presque. »');
  await page.locator('[data-sb-write]:visible').click();
  await expect(page).toHaveURL(/\/storyboard\/[a-z0-9-]+/, { timeout: 30_000 });
  await ready(page);
  const url = page.url();
  const tiles = page.locator('[data-sb-strip] [data-sb-select]');
  const count = await tiles.count();
  expect(count).toBeGreaterThanOrEqual(3);
  const before = await captions(page);

  // One composer, scoped to the selected shot; no inactive keyframe button.
  await expect(page.locator('[data-sb-ask]')).toHaveCount(1);
  await expect(page.locator('[data-sb-keyframe]')).toHaveCount(0);
  await tiles.nth(1).click();
  await expect(page.locator('[data-sb-scope]')).toContainText(/02/);

  // A request that names no shot is read for the selected one (selection as data): only shot 2 goes.
  await page.locator('[data-sb-ask]').fill('retire-le');
  await page.locator('[data-sb-send]').click();
  await expect(tiles).toHaveCount(count - 1);
  expect(await captions(page)).toEqual([before[0], ...before.slice(2)]);

  // Undo brings the board back exactly.
  await page.locator('[data-sb-undo] button').click();
  await expect(tiles).toHaveCount(count);
  expect(await captions(page)).toEqual(before);

  // The footer has one video exit: the real MONTAGE export (no « coming soon » note), 44 px tall.
  await page.locator('[data-sb-export]').click();
  const exit = page.locator('[data-sb-export-video]');
  await expect(exit).toHaveCount(1);
  await expect(exit).toBeVisible();
  expect((await exit.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  await expect(exit).toHaveAttribute('href', /\/studio#montage$/);

  // Four sizes on the board: 44 px targets, no side scroll, one composer, never « free ».
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.goto(url);
    await ready(page);
    await expect(page.locator('[data-sb-ask]')).toHaveCount(1);
    await targets44(page, '[data-theme="paper"]');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `horizontal overflow ${width}×${height}`).toBeLessThanOrEqual(1);
    await expect(page.locator('[data-storyboard-page]')).not.toContainText(FREE);
  }

  // The exit lands on MONTAGE; the studio session opens, resumes (status reads only) and sends nothing.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(url);
  await ready(page);
  await page.locator('[data-sb-export]').click();
  await page.locator('[data-sb-export-video]').click();
  await expect(page).toHaveURL(/\/studio#montage$/);
  await expect(page.locator('.u-chain [aria-current="page"]')).toContainText('MONTAGE', { timeout: 30_000 });
  await page.waitForTimeout(1500);
  expect(posts, 'no paid POST, no cancel').toEqual([]);
});

test('P0: the legacy ?film2=0 link and the studio open on one plan composer, with no paid POST', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'sizes are set here');
  await simulateComfy(page);
  const posts = watchPosts(page);
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.goto('/studio?film2=0#prise');
    const field = page.locator('[data-film-phrase]');
    await expect(field).toHaveCount(1, { timeout: 30_000 });
    await expect(field).toBeVisible();
  }
  expect(posts).toEqual([]);
});

// CE5 · native agent: hidden outside JD's qualification flag; with it, an unread request is prepared and
// quoted in the confirmation surface (« ≈ X »), nothing is sent before « Start », and « Start » sends one
// request only. Comfy simulated: the one POST is answered by the mock, 0 real credits.
test('native agent: hidden by default; under qualification, quote, nothing before Start, one POST on Start', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one desktop run');
  test.setTimeout(180_000);
  await simulateComfy(page);
  const posts = watchPosts(page);
  type M = { storyboard: { uttu: { notUnderstood: string }; cinema: { agent: Record<string, string> } } };
  const read = (locale: string) => JSON.parse(readFileSync(`messages/storyboard/${locale}.json`, 'utf8')) as M;
  const locales = [read('fr'), read('en')];
  const either = (pick: (m: M) => string) => new RegExp(locales.map(m => pick(m).slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/storyboard');
  await expect(page.locator('[data-storyboard-page][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await page.locator('[data-sb-idea-field]:visible').fill('Une voyageuse traverse la ville sous la pluie pour atteindre un toit à l’aube.');
  await page.locator('[data-sb-write]:visible').click();
  await expect(page).toHaveURL(/\/storyboard\/[a-z0-9-]+/, { timeout: 30_000 });
  await ready(page);
  const board = page.url();
  const chat = page.locator('[data-sb-chat]');

  // Demo: the reply is the board's own « not understood », no agent surface.
  await page.locator('[data-sb-strip] [data-sb-select]').nth(1).click();
  await page.locator('[data-sb-ask]').fill('rends ce plan plus mélancolique');
  await page.locator('[data-sb-send]').click();
  await expect(chat).toContainText(either(m => m.storyboard.uttu.notUnderstood));
  await expect(page.locator('[data-sb-agent-confirm]')).toHaveCount(0);
  // Camera and mood words are never a dead end: written into the selected shot, nothing rendered, no dialog.
  await page.locator('[data-sb-ask]').fill('Make it more dramatic: low camera, slow push-in, rain on the stained glass.`');
  await page.locator('[data-sb-send]').click();
  await expect(chat).toContainText(/Plan 2 modifié|Shot 2 updated/);
  await expect(chat).toContainText(/low camera, slow push-in, rain on the stained glass/);
  await expect(page.locator('[data-sb-agent-confirm]')).toHaveCount(0);

  // Qualification: same request → prepared and quoted, nothing sent before « Start ».
  await page.goto(`${board}?cinema=qualification`);
  await ready(page);
  await page.locator('[data-sb-strip] [data-sb-select]').nth(1).click();
  await page.locator('[data-sb-ask]').fill('rends ce plan plus mélancolique');
  await page.locator('[data-sb-send]').click();
  const dialog = page.locator('[data-sb-agent-confirm]');
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.locator('[data-sb-agent-quote]')).toContainText('≈');
  await expect(dialog).not.toContainText(FREE);
  await page.waitForTimeout(1000);
  expect(posts, 'no POST before Start').toEqual([]);
  const box = await dialog.locator('[data-sb-agent-start]').boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(43.5);

  // Cancel sends nothing; « Start » sends exactly one request (mocked).
  await dialog.locator('[data-sb-agent-cancel]').click();
  await expect(dialog).toHaveCount(0);
  expect(posts).toEqual([]);
  await page.locator('[data-sb-ask]').fill('rends ce plan plus mélancolique');
  await page.locator('[data-sb-send]').click();
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.locator('[data-sb-agent-start]').click();
  await expect(dialog).toHaveCount(0);
  await expect(chat).toContainText(either(m => m.storyboard.cinema.agent.sent), { timeout: 15_000 });
  await page.waitForTimeout(3000);
  expect(posts, 'one approval = one POST').toEqual(['/api/prompt']);
});
