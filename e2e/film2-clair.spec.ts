import { expect, test, type Page } from '@playwright/test';
import { simulateComfy } from './helpers/film2-comfy';

// Refonte FILM · PR 7 — réglages en clair (?film2=1). No engine, model or plumbing word in the default
// view of Plans, CAST and DÉCOR; no « Avancé » fold; every option of « Réglages du plan » says its effect.

const JARGON = /\bH3\b|\bLTX\b|Klein|\bMP\b|Avancé|16:9|9:16|planche|Prévis|Mémoire|Comfy/;

async function jargon(page: Page) {
  const text = await page.locator('main, [data-film-plans], body').first().innerText();
  return text.split('\n').filter(line => JARGON.test(line));
}

for (const section of ['prise', 'personnage', 'decor']) {
  test(`vue par défaut sans jargon : #${section}`, async ({ page }) => {
    await simulateComfy(page);
    await page.goto(`/studio?film2=1#${section}`);
    await expect(page.locator('#u-title')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);
    expect(await jargon(page)).toEqual([]);
    await expect(page.locator('details:visible', { hasText: /Avancé/ })).toHaveCount(0);
  });
}

test('« Réglages du plan » : chaque option dit son effet, le choix part dans la prise et reste', async ({ page }, info) => {
  test.setTimeout(180_000);
  const comfy = await simulateComfy(page);
  const SHOTS = process.env.FILM2_SHOTS;
  const prefix = `film2-${page.viewportSize()?.width}x${page.viewportSize()?.height}`;
  await page.goto('/studio?film2=1#prise');
  await expect(page.locator('[data-film-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-film-phrase]').fill('Uttu marche sur le quai la nuit');
  const chips = page.locator('[data-film-chips] > *');
  expect(await chips.count()).toBeLessThanOrEqual(6);
  const before = await page.locator('[data-film-tourner] .u-film-price').innerText();
  await page.locator('[data-film-chips] button', { hasText: '5 s' }).click();
  const sheet = page.locator('[data-film-reglages]');
  await expect(sheet).toBeVisible();
  // Every option names its effect (a sub-line) and is a real touch target; no jargon in the sheet.
  const options = sheet.locator('[data-film-reglage]');
  expect(await options.count()).toBeGreaterThanOrEqual(14);
  for (const option of await options.all()) {
    expect((await option.locator('small').innerText()).trim().length).toBeGreaterThan(3);
    expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  expect((await sheet.innerText()).split('\n').filter(line => JARGON.test(line))).toEqual([]);
  expect(await sheet.innerText()).not.toMatch(/gratuit|free\b/i);
  await expect(sheet.locator('[data-film-reglage="rendu-fidele"]')).toHaveAttribute('aria-pressed', 'true');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${prefix}-10-reglages.png` });
  await sheet.locator('[data-film-reglage="camera-suit"]').click();
  await sheet.locator('[data-film-reglage="format-portrait"]').click();
  await sheet.locator('[data-film-reglage="paroles-replique"]').click();
  await sheet.locator('[data-film-paroles-texte]').fill('On y va');
  await sheet.locator('[data-film-reglage="rendu-rapide"]').click();
  await sheet.locator('[data-film-reglages-ok]').click();
  await expect(sheet).toBeHidden();
  await expect(page.locator('[data-film-chips]')).toContainText('Suit le personnage');
  await expect(page.locator('[data-film-chips]')).toContainText('Rapide');
  await expect(page.locator('[data-film-tourner] .u-film-price')).not.toHaveText(before);
  // Kept for the next visit.
  await page.reload();
  await expect(page.locator('[data-film-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-film-phrase]').fill('Uttu marche sur le quai la nuit');
  await expect(page.locator('[data-film-chips]')).toContainText('Suit le personnage');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${prefix}-11-reglages-choisis.png` });
  // The take sent carries the camera and the line; the engine name only shows in « Ce qui sera envoyé ».
  await page.locator('[data-film-tourner]').click();
  const confirm = page.locator('[data-film-confirm]');
  await confirm.locator('[data-film-envoye]').click();
  await expect(confirm.locator('[data-film-moteur]')).toContainText('LTX');
  await page.locator('[data-film-lancer]').click();
  await expect(page.locator('[data-film-result]')).toBeVisible({ timeout: 120_000 });
  const take = comfy.prompts.filter(item => item.kind === 'video');
  expect(take).toHaveLength(1);
  expect(take[0]!.text).toContain('follows the character');
  expect(take[0]!.text).toContain('On y va');
  info.annotations.push({ type: 'prompts', description: comfy.prompts.map(item => item.kind).join(',') });
});

test('services partenaires payants : non par défaut, un seul interrupteur expliqué', async ({ page }) => {
  await simulateComfy(page);
  await page.goto('/studio?film2=1#prise');
  await expect(page.locator('[data-film-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await page.locator('button.u-credit').click();
  const box = page.locator('[data-compte-partenaires]');
  await expect(box).toBeVisible();
  const toggle = box.getByRole('switch');
  await expect(toggle).not.toBeChecked();
  await expect(box.locator('#u-compte-partenaires-sous')).toContainText('Non par défaut');
  await toggle.check();
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('u-ttu-moteurs') ?? '{}')).partenaires).toBe(true);
});
