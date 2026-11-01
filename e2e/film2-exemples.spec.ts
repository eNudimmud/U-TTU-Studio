import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { firstScreen } from './helpers/explore';
import { simulateComfy } from './helpers/film2-comfy';

// Refonte FILM · PR 4 — exemples refaits (DESIGN §6). Comfy simulated, 0 real credits.

const SHOTS = process.env.FILM2_SHOTS;
const SIZES = [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1024, height: 600 }, { width: 1280, height: 800 }];
const LOCALES = ['fr', 'en', 'de', 'es'] as const;

async function snap(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(300);
  const size = page.viewportSize();
  await page.screenshot({ path: join(SHOTS, `film2-${size?.width}x${size?.height}-${name}.png`) });
}

async function open(page: Page, locale = 'fr') {
  await page.context().addCookies([{ name: 'u-ttu-locale', value: locale, url: test.info().project.use.baseURL ?? 'http://127.0.0.1:3000' }]);
  await page.addInitScript(value => window.localStorage.setItem('u-ttu-locale', value), locale);
  await page.goto('/studio#prise');
  await expect(page.locator('[data-film-ready="true"]')).toBeVisible({ timeout: 30_000 });
}

test('chaque exemple : badge IMAGE|VIDÉO, ≈ X crédits estimés, un vrai après (vidéo pour une vidéo), jamais « gratuit », aux 4 tailles et 4 langues', async ({ page }) => {
  test.setTimeout(240_000);
  await simulateComfy(page);
  for (const locale of LOCALES) {
    await open(page, locale);
    const cards = page.locator('[data-film-exemple]');
    expect(await cards.count()).toBeGreaterThanOrEqual(3);
    for (const card of await cards.all()) {
      const badge = card.locator('[data-film-badge]');
      await expect(badge).toHaveText(/^(IMAGE|BILD|IMAGEN|VID[EÉ]O \d+ s)$/);
      await expect(card.locator('[data-film-ex-cout]')).toHaveText(/≈ \d+(,\d+)? \S+/);
      const apres = card.locator('[data-film-apres]');
      if (await badge.getAttribute('data-film-badge') === 'video') {
        await expect(apres.locator('video')).toHaveAttribute('src', /\.mp4$/);
        const avant = await card.locator('[data-film-avant] img').evaluateAll(nodes => nodes.map(node => (node as HTMLImageElement).src));
        expect(avant).not.toContain(await apres.locator('video').getAttribute('src'));
      } else {
        await expect(apres.locator('img')).toHaveAttribute('src', /\/exemples\/apres-/);
      }
    }
    expect(await page.locator('[data-film-exemples]').innerText()).not.toMatch(/gratuit|free|kostenlos|gratis/i);
  }
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await open(page);
    const actions = await firstScreen(page);
    expect(actions.length, `${size.width}×${size.height}\n${actions.join('\n')}`).toBeLessThanOrEqual(12);
    expect(actions.filter(line => / <44$/.test(line)), `${size.width}: touch targets`).toEqual([]);
    // One card per view: the next one peeks, its button does not count until it is swiped in.
    await expect(page.locator('[data-film-refaire]:visible')).toHaveCount(1);
    await page.locator('[data-film-exemples]').scrollIntoViewIfNeeded();
    await snap(page, '17-exemples');
  }
});

test('« Refaire cet exemple » (vidéo) : la carte se remplit à l’écran, surlignée, puis la confirmation ; 0 envoi avant « Lancer »', async ({ page }) => {
  test.setTimeout(240_000);
  const comfy = await simulateComfy(page);
  await open(page);
  await page.locator('[data-film-refaire="uttuQuai"]').click();
  const field = page.locator('[data-film-phrase]');
  await expect(field).toHaveValue(/Uttu marche sur le quai la nuit/);
  await expect(page.locator('.u-film-card[data-rempli]')).toBeVisible();
  await expect(field).toBeInViewport();
  await expect(page.locator('[data-film-qui]')).toContainText('Uttu');
  await expect(page.locator('[data-film-qui]')).toContainText(/de ta distribution/i);
  await expect(page.locator('[data-film-ou]')).toContainText('Le quai, la nuit');
  await snap(page, '18-exemple-rempli');
  await expect(page.locator('[data-film-confirm]')).toBeVisible({ timeout: 5_000 });
  // The references were provided: only the take is paid, at the price written on the card.
  await expect(page.locator('[data-film-etape]')).toHaveCount(1);
  await expect(page.locator('[data-film-etape="prise"]')).toBeVisible();
  await snap(page, '19-exemple-confirmer');
  expect(comfy.prompts.length, 'nothing is sent before Lancer').toBe(0);
  await page.locator('[data-film-lancer]').click();
  await expect(page.locator('[data-film-result]')).toBeVisible({ timeout: 120_000 });
  expect(comfy.prompts.filter(item => item.kind === 'video')).toHaveLength(1);
  expect(comfy.prompts.filter(item => item.kind === 'image')).toHaveLength(0);
  // Redone twice, the house references are not imported twice.
  await page.locator('[data-film-suivant]').click();
  await expect(page.locator('[data-film-exemples]')).toHaveCount(0);
});

test('« Refaire cet exemple » (image) : le formulaire DÉCOR se remplit, surligné, puis sa confirmation ; 0 envoi', async ({ page }) => {
  test.setTimeout(180_000);
  const comfy = await simulateComfy(page);
  await open(page);
  const list = page.locator('.u-film-ex-list');
  await list.evaluate(node => node.scrollTo({ left: node.scrollWidth }));
  await page.locator('[data-film-exemple="lieuPhoto"]').scrollIntoViewIfNeeded();
  await list.evaluate((node: HTMLElement) => { const card = node.querySelector<HTMLElement>('[data-film-exemple="lieuPhoto"]'); node.scrollTo({ left: card!.offsetLeft - node.offsetLeft }); });
  await expect(page.locator('[data-film-refaire="lieuPhoto"]')).toBeVisible();
  await page.locator('[data-film-refaire="lieuPhoto"]').click();
  await expect(page.locator('[data-decor-form]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-decor-form] input')).toHaveValue('Le quai, la nuit');
  await expect(page.locator('[data-decor-form][data-rempli]')).toBeVisible();
  await expect(page.locator('[role="dialog"][aria-labelledby="u-create-title"]')).toBeVisible({ timeout: 5_000 });
  await snap(page, '20-exemple-image-confirmer');
  expect(comfy.prompts.length, 'nothing is sent before the confirmation').toBe(0);
  await expect(page.locator('[data-depart]')).toHaveCount(0);
});
