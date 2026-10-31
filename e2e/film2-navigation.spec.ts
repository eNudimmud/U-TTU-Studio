import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { firstScreen } from './helpers/explore';
import { simulateComfy } from './helpers/film2-comfy';

// Refonte FILM · PR 9 — navigation PRISE | MONTAGE (F9). Comfy simulated, 0 real credits.

const SHOTS = process.env.FILM2_SHOTS;
const SIZES = [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1024, height: 600 }, { width: 1280, height: 800 }];
const PRIMARY = '.u-primary, .u-film-gold';

test('Plans : ≤ 10 actions et 1 seul bouton primaire au 1er écran, deux vues PRISE | MONTAGE, aux 4 tailles', async ({ page }) => {
  test.setTimeout(180_000);
  await simulateComfy(page);
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto('/studio?film2=1#prise');
    await expect(page.locator('[data-film-ready="true"]')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(300);
    const actions = await firstScreen(page);
    expect(actions.length, `${size.width}×${size.height}\n${actions.join('\n')}`).toBeLessThanOrEqual(10);
    expect(actions.filter(line => / <44$/.test(line)), `${size.width}: touch targets`).toEqual([]);
    const primaries = await page.locator(PRIMARY).evaluateAll(nodes => nodes.filter(node => {
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0;
    }).length);
    expect(primaries, `${size.width}: primary buttons`).toBe(1);
    // Two views only; the four titles stay (CAST and DÉCOR are libraries behind Qui and Où, and in the menu).
    const views = page.locator('[data-film-nav] button');
    await expect(views).toHaveCount(2);
    await expect(views.nth(0)).toContainText('PRISE');
    await expect(views.nth(1)).toContainText('MONTAGE');
    await expect(page.locator('[data-rail], [data-tabs]')).toHaveCount(0);
  }
  // Nothing is lost: the menu still opens Créer, Film (with CAST and DÉCOR), Mes créations and search.
  await page.locator('[data-top-burger]').click();
  await page.locator('#u-drawer').getByRole('button', { name: /Film/ }).click();
  await expect(page.locator('#u-drawer [data-film="cast"]')).toBeVisible();
  await expect(page.locator('#u-drawer [data-film="decor"]')).toBeVisible();
  await expect(page.locator('#u-drawer [data-drawer-search]')).toBeVisible();
});

test('scénario A : 4 taps de l’entrée du studio au plan visible dans MONTAGE', async ({ page }) => {
  test.setTimeout(240_000);
  const comfy = await simulateComfy(page);
  const prefix = `film2-${page.viewportSize()?.width}x${page.viewportSize()?.height}`;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const snap = async (name: string) => { if (SHOTS) { await page.waitForTimeout(300); await page.screenshot({ path: join(SHOTS, `${prefix}-${name}.png`) }); } };
  let taps = 0;
  const tap = async (selector: string) => { await page.locator(selector).first().click(); taps += 1; };

  // Where « Entrer dans le studio » lands.
  await page.goto('/studio?film2=1');
  await tap('[data-entry-film]');
  await expect(page.locator('[data-film-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-film-nav-to="prise"]')).toHaveAttribute('aria-current', 'page');
  await snap('15-plans');
  await page.locator('[data-film-phrase]').fill('Uttu marche sur le quai la nuit');
  await tap('[data-film-tourner]');
  expect(comfy.prompts.length, 'nothing is sent before Lancer').toBe(0);
  await tap('[data-film-lancer]');
  await expect(page.locator('[data-film-result]')).toBeVisible({ timeout: 120_000 });
  await tap('[data-film-nav-to="montage"]');
  await expect(page.locator('[data-fm-clip]')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('[data-film-nav-to="montage"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-film-nav-to="montage"] small')).toHaveText(/\d+:\d\d/);
  expect(taps).toBe(4);
  await snap('16-montage-4-taps');
});
