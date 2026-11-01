import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simulateComfy } from './helpers/film2-comfy';

// MONTAGE gap · « Autre prise » and « Modifier et refaire » on the result (Comfy simulated, 0 real credits).
// Both are one more take of the same plan: only the take is quoted, the cut keeps the first take,
// every take is in « Mes plans ».

const SHOTS = process.env.FILM2_SHOTS;
const SIZES = [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1024, height: 600 }, { width: 1280, height: 800 }];

async function big(target: Locator) {
  const box = await target.boundingBox();
  expect(box, 'visible').toBeTruthy();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.width).toBeGreaterThanOrEqual(44);
}

async function lancer(page: Page) {
  const sheet = page.locator('[data-film-confirm]');
  await expect(sheet).toBeVisible();
  return sheet;
}

test('Autre prise et Modifier et refaire : une prise de plus du même plan, seule la prise est chiffrée', async ({ page }) => {
  test.setTimeout(300_000);
  const comfy = await simulateComfy(page);
  const view = page.viewportSize()!;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });

  await page.goto('/studio#prise');
  await expect(page.locator('[data-film-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-film-phrase]').fill('Uttu marche sur le quai la nuit');
  await page.locator('[data-film-tourner]').click();
  await page.locator('[data-film-lancer]').click();
  await expect(page.locator('[data-film-result] video')).toBeVisible({ timeout: 120_000 });
  await expect(page.locator('h1')).toContainText('Plan 1');

  const autre = page.locator('[data-film-autre]');
  const refaire = page.locator('[data-film-refaire-plan]');
  await expect(autre).toHaveText(/Autre prise\s*≈ [\d,]+ crédits estimés/);
  await expect(page.locator('[data-film-result]')).not.toContainText(/gratuit/i);
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await autre.scrollIntoViewIfNeeded();
    await big(autre);
    await big(refaire);
    if (SHOTS) { await page.waitForTimeout(300); await page.screenshot({ path: join(SHOTS, `film2-${size.width}x${size.height}-21-autre-prise.png`) }); }
  }
  await page.setViewportSize(view);

  // « Autre prise »: the cards exist now, so the sheet has one step; nothing is sent before Lancer.
  let before = comfy.prompts.length;
  await autre.click();
  let sheet = await lancer(page);
  await expect(sheet.locator('[data-film-etape]')).toHaveCount(1);
  await expect(sheet.locator('[data-film-etape="prise"]')).toBeVisible();
  await expect(sheet.locator('[data-film-apres-lancer]')).toContainText('le montage garde la première');
  await expect(sheet.locator('[data-film-apres-lancer]')).not.toContainText('ajouté au montage');
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `film2-${view.width}x${view.height}-22-autre-prise-confirmer.png`) });
  expect(comfy.prompts.length).toBe(before);
  await page.locator('[data-film-lancer]').click();
  await expect(page.locator('[data-film-fini]')).toContainText('Prise 2 de ce plan', { timeout: 120_000 });
  expect(comfy.prompts.slice(before).map(item => item.kind)).toEqual(['video']);
  await expect(page.locator('h1')).toContainText('Plan 1');

  // « Modifier et refaire »: same plan, the sentence stays and can be changed; still one step.
  await refaire.click();
  const field = page.locator('[data-film-phrase]');
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('Uttu marche sur le quai la nuit');
  await expect(page.locator('[data-film-result]')).toHaveCount(0);
  await field.fill('Uttu court sur le quai la nuit');
  before = comfy.prompts.length;
  await page.locator('[data-film-tourner]').click();
  sheet = await lancer(page);
  await expect(sheet.locator('[data-film-etape]')).toHaveCount(1);
  expect(comfy.prompts.length).toBe(before);
  await page.locator('[data-film-lancer]').click();
  await expect(page.locator('[data-film-fini]')).toContainText('Prise 3 de ce plan', { timeout: 120_000 });
  expect(comfy.prompts.slice(before).map(item => item.kind)).toEqual(['video']);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `film2-${view.width}x${view.height}-23-prise-3.png`) });

  // The cut keeps the first take; the three takes are in « Mes plans ».
  await page.goto('/studio#montage');
  await expect(page.locator('[data-fm-bin-item]')).toHaveCount(3, { timeout: 30_000 });
  await expect(page.locator('[data-fm-clip]')).toHaveCount(1);
});
