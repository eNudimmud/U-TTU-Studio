import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';

test('prévis réelle : filmer le canvas, retrouver le clip et le télécharger après fermeture', async ({ page, context }, info) => {
  const spent: string[] = [];
  await context.route(/\/api\/(prompt|upload|queue)|fal\.ai|comfy\.cloud/, route => { spent.push(route.request().url()); return route.abort(); });
  await context.route(/overpass|nominatim|photon|panoramax|mapillary|tiles\.openfreemap/, route => route.abort());
  await page.goto('/studio#personnage');
  await expect(page.getByLabel('Importer un personnage', { exact: true })).toBeEnabled();
  await page.getByLabel('Importer un personnage', { exact: true }).setInputFiles('public/exemples/cast-uttu.webp');
  await expect(page.getByRole('navigation').getByRole('button', { name: 'CAST' })).toContainText('Prêt');
  await page.getByRole('navigation').getByRole('button', { name: 'PRISE' }).click();
  await expect(page.locator('canvas.u-maquette-canvas')).toBeVisible();
  await page.locator('[data-avance-prise] > summary').click(); // the prévis tools live in « Avancé »
  await page.getByLabel('Phrase → scène', { exact: true }).fill('Deux personnages autour d’une table, la caméra tourne autour.');
  await page.locator('[data-composer]').click();
  await expect(page.locator('[data-maquette]')).toHaveAttribute('data-keys', '3');
  await page.locator('[data-filmer-previs]').click();
  await expect(page.getByText('Prévisualisation enregistrée dans Mon studio.', { exact: true })).toBeVisible();
  const preview = page.locator('[data-previs-clip]');
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate((video: HTMLVideoElement) => video.videoWidth)).toBeGreaterThan(0);
  await page.getByRole('link', { name: 'Mon studio', exact: true }).click();
  await expect(page.locator('.u-asset-grid article').filter({ hasText: 'Prévisualisation locale' })).toHaveCount(1);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/mon-studio');
  const card = reopened.locator('.u-asset-grid article').filter({ hasText: 'Prévisualisation locale' });
  await card.getByRole('button').first().click();
  const download = reopened.waitForEvent('download');
  await reopened.getByRole('link', { name: 'Télécharger la vidéo', exact: true }).click();
  const path = info.outputPath('previs-real.webm');
  await (await download).saveAs(path);
  const bytes = readFileSync(path);
  expect(bytes.length).toBeGreaterThan(1000);
  const input = new Input({ source: new BlobSource(new Blob([bytes])), formats: ALL_FORMATS });
  try {
    const duration = await input.computeDuration();
    expect(duration).toBeGreaterThan(3.5);
    expect(duration).toBeLessThan(7);
    expect(await input.getPrimaryVideoTrack()).not.toBeNull();
  } finally { input.dispose(); }
  await reopened.screenshot({ path: info.outputPath('previs-reopened.png'), fullPage: true });
  expect(spent).toEqual([]);
});
