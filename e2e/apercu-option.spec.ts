import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { simulateComfy } from './helpers/simulate-comfy';

// Aperçu ou Qualité finale: an option, never imposed. Qualité finale stays the default;
// Aperçu sends the LTX first pass only; MONTAGE tags each shot and finalises one shot or the whole edit.
const lea = readFileSync('public/exemples/cast-coursiere.webp');
const lab = readFileSync('public/exemples/decor-couloir.webp');
const SIZES = [[390, 844], [844, 390], [1024, 600], [1280, 800]] as const;

async function shots(page: Page, name: string, scrollTo?: string) {
  const dir = process.env.APERCU_SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  const before = page.viewportSize();
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    if (scrollTo) await page.locator(scrollTo).first().evaluate(element => element.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(dir, `${name}-${width}x${height}.png`) });
  }
  if (before) await page.setViewportSize(before);
}

test('Aperçu en option : devis, premier passage seul, étiquettes et Finaliser ce plan', async ({ page }, info) => {
  test.setTimeout(240_000);
  const mobile = info.project.name.includes('mobile');
  await simulateComfy(page);
  const graphs: Record<string, { class_type: string; inputs: Record<string, unknown> }>[] = [];
  await page.route(/\/api\/prompt$/, route => { graphs.push(route.request().postDataJSON()?.prompt ?? {}); return route.fallback(); });
  const nav = (name: string) => page.getByRole('navigation').getByRole('button', { name });
  const gold = page.locator('.u-prise-actions .u-primary');

  await page.goto('/studio#personnage');
  await page.getByLabel('Importer un personnage', { exact: true }).setInputFiles({ name: 'Léa.webp', mimeType: 'image/webp', buffer: lea });
  await expect(nav('CAST')).toContainText('Prêt');
  await nav('DÉCOR').click();
  await page.getByLabel('Importer un décor', { exact: true }).setInputFiles({ name: 'Le laboratoire.webp', mimeType: 'image/webp', buffer: lab });
  await expect(nav('DÉCOR')).toContainText('Prêt');
  await nav('PRISE').click();
  await expect(page.locator('[data-prise-ready]')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('textbox', { name: 'Ce qui se passe', exact: true }).fill('Léa traverse le laboratoire, caméra à l’épaule');

  // Default: Qualité finale, today's take, the button repeats the quote.
  const choice = page.locator('[data-rendu]');
  await expect(choice).toHaveAttribute('data-rendu', 'finale');
  await expect(gold).toHaveText('Tourner · ≈ 12 crédits estimés');
  await expect(choice.locator('[data-rendu-opt=apercu]')).toContainText('≈ 6 crédits estimés');
  for (const option of await choice.locator('.u-rendu-opt').all()) expect((await option.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await shots(page, 'prise-finale', '[data-rendu]');

  // Aperçu: half the estimate, first pass only, same seed.
  await choice.locator('[data-rendu-opt=apercu]').click();
  await expect(choice).toHaveAttribute('data-rendu', 'apercu');
  await expect(gold).toHaveText('Tourner · ≈ 6 crédits estimés');
  await expect(choice).toContainText('Un aperçu se finalise plus tard');
  await shots(page, 'prise-apercu', '[data-rendu]');
  if (mobile) await gold.scrollIntoViewIfNeeded();
  await gold.click();
  await page.locator('[data-confirm-gold]').click();
  await expect(page.locator('[data-take-view] video')).toBeVisible({ timeout: 60_000 });
  const apercu = graphs.filter(graph => graph['403']).at(-1)!;
  expect(apercu['403'].inputs.megapixels).toBe(0.4);
  expect(apercu['398:368']).toBeUndefined();
  expect(apercu['398:374'].inputs.samples).toEqual(['398:367', 0]);

  // Plan 2 back in Qualité finale: the two-pass graph, unchanged.
  await expect(choice).toHaveAttribute('data-rendu', 'apercu');
  await choice.locator('[data-rendu-opt=finale]').click();
  await page.getByRole('textbox', { name: 'Plan suivant : ce qui se passe' }).fill('Léa ouvre la porte du laboratoire');
  await expect(gold).toHaveText('Tourner le plan 2 · ≈ 12 crédits estimés');
  await gold.click();
  await page.locator('[data-confirm-gold]').click();
  await expect(page.locator('#u-title')).toHaveText('Plan 2');
  await expect(page.locator('[data-take-view] video')).toBeVisible({ timeout: 60_000 });
  const finale = graphs.filter(graph => graph['403']).at(-1)!;
  expect(finale['398:368']).toBeTruthy();

  // MONTAGE: one tag per shot.
  await page.locator('.u-prise-actions [data-envoyer-montage]').click();
  const clips = page.locator('.u-clip.is-video');
  await expect(clips).toHaveCount(2, { timeout: 30_000 });
  await expect(clips.nth(0).locator('.u-clip-tier')).toHaveText('Aperçu');
  await expect(clips.nth(1).locator('.u-clip-tier')).toHaveText('Qualité finale');
  // Export quality, said before exporting, with the way to Finaliser.
  await expect(page.locator('[data-export-quality] :is(.u-long-label, .u-short-label):visible')).toHaveText(/^(Export rapide : 540p, 12 images par seconde, 60 s au plus\.|540p · 12 images\/s · 60 s max)$/);
  const better = page.locator('[data-export-better]');
  expect((await better.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await shots(page, 'montage-export-qualite', '[data-export-quality]');

  await better.click();
  const whole = page.getByRole('dialog', { name: 'Finaliser le montage' });
  await expect(whole.locator('[data-final-sum]')).toContainText('1 plan en aperçu');
  await expect(whole.locator('[data-final-go]')).toContainText('crédits estimés');
  await shots(page, 'montage-finaliser');
  await whole.getByRole('button', { name: 'Fermer' }).click();

  // Finaliser ce plan: the Aperçu shot alone, the same enhance pass, then it replaces the aperçu.
  await clips.nth(0).locator('.u-clip-body').click();
  const one = page.locator('[data-final-plan]');
  await expect(one).toBeVisible();
  expect((await one.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await shots(page, 'montage-tags');
  await one.click();
  const plan = page.getByRole('dialog', { name: 'Finaliser ce plan' });
  await expect(plan.locator("[data-final-quote='mesure']")).toContainText('≈ 4,1 crédits estimés');
  await expect(plan.locator('[data-final-go]')).toHaveText('Finaliser · ≈ 4,1 crédits estimés');
  await shots(page, 'montage-finaliser-plan');
  await plan.locator('[data-final-confirm]').click();
  await plan.locator('[data-final-go]').click();
  await expect(plan.getByRole('status')).toHaveText('Plan finalisé : il remplace l’aperçu dans ton montage.', { timeout: 120_000 });
  const sent = graphs.at(-1)!;
  expect(Object.values(sent).some(node => /RTX/i.test(node.class_type))).toBe(true);
  expect(Object.values(sent).some(node => /LTXV|SamplerCustom/i.test(node.class_type))).toBe(false);
  await plan.getByRole('button', { name: 'Fermer' }).click();
  await expect(clips.nth(0).locator('.u-clip-tier')).toHaveText('Qualité finale');
});
