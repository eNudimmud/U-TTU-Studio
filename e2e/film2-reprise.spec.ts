import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simulateComfy } from './helpers/film2-comfy';

// Refonte FILM · PR 6 — confirmation unique et chaînage (?film2=1, Comfy simulated, 0 real credits).
// A failed step says why, keeps what was made, and « Réessayer » sends only what is missing.

const SHOTS = process.env.FILM2_SHOTS;
const credits = (text: string) => Number(text.replace(/[^\d,.]/g, '').replace(',', '.'));

async function apart(page: Page, a: Locator, b: Locator) {
  const one = (await a.boundingBox())!;
  const two = (await b.boundingBox())!;
  const overlap = one.x < two.x + two.width && two.x < one.x + one.width && one.y < two.y + two.height && two.y < one.y + one.height;
  expect(overlap, 'the error does not cover the button').toBe(false);
}

test('une étape échoue : son image est gardée, « Réessayer » ne renvoie que ce qui manque', async ({ page }, info) => {
  test.setTimeout(240_000);
  // The place (2nd image) fails once, then the take (1st video) fails once.
  const comfy = await simulateComfy(page, { fail: (index, kind) => (kind === 'image' && index === 2) || (kind === 'video' && index === 1) });
  const prefix = `film2-${page.viewportSize()?.width}x${page.viewportSize()?.height}`;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const snap = async (name: string) => { if (SHOTS) { await page.waitForTimeout(300); await page.screenshot({ path: join(SHOTS, `${prefix}-${name}.png`) }); } };
  await page.goto('/studio?film2=1#prise');
  const field = page.locator('[data-film-phrase]');
  const gold = page.locator('[data-film-tourner]');
  await expect(page.locator('[data-film-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await field.fill('Uttu marche sur le quai la nuit');
  await gold.click();
  const sheet = page.locator('[data-film-confirm]');
  await expect(sheet.locator('[data-film-etape]')).toHaveCount(3);
  // The sheet's total is the sum of the step quotes; plain words outside « Ce qui sera envoyé ».
  const steps = (await sheet.locator('.u-film-step-cost').allInnerTexts()).map(credits);
  expect(Math.abs(steps.reduce((a, b) => a + b, 0) - credits(await sheet.locator('[data-film-total]').innerText()))).toBeLessThan(0.11);
  expect(await sheet.innerText()).not.toMatch(/Comfy|H3|LTX/);
  await sheet.locator('[data-film-envoye]').click();
  await expect(sheet.locator('[data-film-sent]')).toBeVisible();
  await page.locator('[data-film-lancer]').click();

  // Step 2 (the place) fails: the character is kept, the reason is shown, nothing is cancelled.
  const error = page.locator('[data-film-error]');
  await expect(error).toBeVisible({ timeout: 60_000 });
  expect(comfy.prompts.map(item => item.kind)).toEqual(['image', 'image']);
  await expect(error).toContainText('Uttu');
  // The reason is the step's own, not a stale notice from the step before.
  await expect(error).not.toContainText('rangé');
  await expect(gold).toContainText('Réessayer');
  await apart(page, error, gold);
  await snap('08-echec');
  const placeAndTake = credits(await gold.innerText());

  // Retry: the place, then the take. Not the character again.
  await gold.click();
  await expect(error).toBeVisible({ timeout: 60_000 });
  expect(comfy.prompts.map(item => item.kind)).toEqual(['image', 'image', 'image', 'video']);
  await expect(page.locator('[data-film-garde]')).toContainText('Le quai');
  const takeOnly = credits(await gold.innerText());
  expect(takeOnly).toBeLessThan(placeAndTake);
  await apart(page, error, gold);

  // Retry: the take alone, exactly 1 prompt.
  await gold.click();
  await expect(page.locator('[data-film-result] video')).toBeVisible({ timeout: 60_000 });
  expect(comfy.prompts.map(item => item.kind)).toEqual(['image', 'image', 'image', 'video', 'video']);
  await expect(page.locator('[data-film-error]')).toHaveCount(0);
  await snap('09-reprise-ok');
});
