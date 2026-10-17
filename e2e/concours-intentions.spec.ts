import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Concours: image clé (Klein), couverture photo sur la carte, intentions caméra.
// Tout le réseau payant est simulé : rien ne valide un modèle, rien n'est facturé.
const image = readFileSync('public/exemples/cast-uttu.webp');
const jpg = readFileSync('public/og.jpg');

async function offline(page: Page) {
  await page.route(/overpass|nominatim|photon|mapillary/, route => route.abort());
}

test('phrase → caméra : travelling arrière de 5 m et contre-plongée posent un trajet', async ({ page }, info) => {
  const spent: string[] = [];
  await page.route(/\/api\/(prompt|upload|queue)|fal\.ai|comfy\.cloud/, route => { spent.push(route.request().url()); return route.abort(); });
  await offline(page);
  await page.route(/panoramax|tiles\.openfreemap/, route => route.abort());
  await page.goto('/studio?demo=1#prise');
  await page.getByRole('navigation').getByRole('button', { name: 'PRISE' }).click();
  await expect(page.locator('canvas.u-maquette-canvas')).toBeVisible();
  const phrase = page.getByLabel('Phrase → scène', { exact: true });
  await phrase.fill('Deux personnages, travelling arrière de 5 m.');
  await page.locator('[data-composer]').click();
  await expect(page.locator('[data-maquette]')).toHaveAttribute('data-keys', '2');
  await expect(page.getByText(/travelling arrière de 5 m/i).last()).toBeVisible();
  await page.getByText(/travelling arrière de 5 m/i).last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('camera-intention.png'), fullPage: false });
  await phrase.fill('Uttu seule, contre-plongée.');
  await page.locator('[data-composer]').click();
  await expect(page.getByText(/contre-plongée/i).last()).toBeVisible();
  await phrase.fill('La caméra tourne autour de 270° vers la gauche.');
  await page.locator('[data-composer]').click();
  await expect(page.locator('[data-maquette]')).toHaveAttribute('data-keys', '4');
  expect(spent).toEqual([]);
});

test('carte : « Voir où il y a des photos » demande les tuiles Panoramax gratuites, avec attribution', async ({ page }, info) => {
  const tiles: string[] = [];
  await offline(page);
  await page.route(/tiles\.openfreemap\.org\/styles\//, route => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'fond', type: 'background', paint: { 'background-color': '#111' } }] } }));
  await page.route(/api\.panoramax\.xyz\/api\/map\//, route => { tiles.push(route.request().url()); return route.fulfill({ status: 204, body: '' }); });
  await page.goto('/studio');
  await page.getByRole('navigation').getByRole('button', { name: 'DÉCOR' }).click();
  const toggle = page.locator('[data-couverture]');
  await expect(toggle).toHaveText('Voir où il y a des photos');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.u-repere-credit')).not.toContainText('Panoramax');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.u-repere-credit')).toContainText('Panoramax');
  await expect(page.locator('#u-couv-note')).toContainText('Panoramax');
  await expect.poll(() => tiles.length, { timeout: 30_000 }).toBeGreaterThan(0);
  expect(tiles.every(url => !url.includes('mapillary'))).toBe(true);
  await toggle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: info.outputPath('couverture.png'), fullPage: false });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.u-repere-credit')).not.toContainText('Panoramax');
});

test('image clé simulée : devis estimé, confirmation, un POST Klein, puis la prise LTX part de cette seule image', async ({ page }, info) => {
  await offline(page);
  await page.route(/panoramax|tiles\.openfreemap/, route => route.abort());
  await page.addInitScript(() => localStorage.setItem('u-ttu-rendu', JSON.stringify({ mode: 'key', key: 'audit-fake-key-0123456789' })));
  const graphs: Record<string, any>[] = [];
  const done = new Set<string>();
  await page.route(/\/api\/user$/, route => route.fulfill({ json: { id: 'audit' } }));
  await page.route(/\/api\/billing\/usage\/timeseries/, route => route.fulfill({ json: { summary: { balance: { amount_micros: 50000 } } } }));
  await page.route(/\/api\/upload\/image$/, route => route.fulfill({ json: { name: `ref-${graphs.length}.png` } }));
  await page.route(/\/api\/prompt$/, route => {
    graphs.push(route.request().postDataJSON().prompt);
    const id = graphs.length === 1 ? 'key-job-123456' : 'take-job-123456';
    return route.fulfill({ json: { prompt_id: id, node_errors: {} } });
  });
  await page.route(/\/api\/job\/key-job-123456\/status$/, route => { done.add('key'); return route.fulfill({ json: { status: 'success' } }); });
  await page.route(/\/api\/jobs\/key-job-123456$/, route => route.fulfill({ json: { status: 'success', outputs: { save: { images: [{ filename: 'uttu-still_0001.png', subfolder: '', type: 'output' }] } } } }));
  await page.route(/\/api\/job\/take-job-123456\/status$/, route => route.fulfill({ json: { status: 'in_progress' } }));
  await page.route(/\/api\/view\?/, route => route.fulfill({ contentType: 'image/jpeg', body: jpg }));

  await page.goto('/studio#personnage');
  await page.getByLabel('Importer un personnage', { exact: true }).setInputFiles({ name: 'Uttu.webp', mimeType: 'image/webp', buffer: image });
  await expect(page.getByRole('navigation').getByRole('button', { name: 'CAST' })).toContainText('Prêt');
  await page.getByRole('navigation').getByRole('button', { name: 'DÉCOR' }).click();
  await page.getByLabel('Importer un décor', { exact: true }).setInputFiles({ name: 'Quai.webp', mimeType: 'image/webp', buffer: image });
  await expect(page.getByRole('navigation').getByRole('button', { name: 'DÉCOR' })).toContainText('Prêt');
  await page.getByRole('navigation').getByRole('button', { name: 'PRISE' }).click();
  await expect(page.locator('[data-maquette]')).toHaveAttribute('data-figures', '1');
  await page.getByRole('group', { name: 'Format du projet' }).getByRole('button', { name: '9:16', exact: true }).click();
  await page.getByRole('textbox', { name: 'Ce qui se passe', exact: true }).fill('Uttu regarde le quai');

  const compose = page.getByRole('button', { name: /^Composer l’image clé · estimé 4 crédits$/ });
  await expect(compose).toBeEnabled();
  await compose.click();
  const confirm = page.locator('[data-keyframe-confirm]');
  await expect(confirm).toContainText('Estimé : 4 crédits, plafond 6');
  expect(graphs).toHaveLength(0);
  await confirm.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('keyframe-confirm.png'), fullPage: false });
  await page.locator('[data-keyframe-send]').evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.locator('[data-keyframe="image-cle"] img')).toBeVisible({ timeout: 60_000 });
  expect(graphs).toHaveLength(1);
  const klein = graphs[0];
  const loads = Object.values(klein).filter((node: any) => node.class_type === 'LoadImage');
  expect(loads).toHaveLength(2); // Uttu puis le quai
  expect(JSON.stringify(klein)).toContain('Vertical 9:16 framing');
  expect(JSON.stringify(klein)).toContain('flux3_image_klein');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('u-ttu-operation'))).toBeNull();

  await page.getByRole('button', { name: 'Garder ce cadre', exact: true }).click();
  await expect(page.locator('[data-keyframe="validee"]')).toBeVisible();
  await page.locator('[data-keyframe="validee"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('keyframe-kept.png'), fullPage: false });
  await page.getByRole('button', { name: 'Générer la prise depuis l’image clé', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('keyframe-actions.png'), fullPage: false });
  await page.getByRole('button', { name: 'Générer la prise depuis l’image clé', exact: true }).click();
  await expect(page.locator('[data-confirm-gold]')).toBeEnabled();
  expect(graphs).toHaveLength(1);
  await page.locator('[data-confirm-gold]').click();
  await expect.poll(() => graphs.length).toBe(2);
  const take = graphs[1];
  const pictures = Object.values(take).filter((node: any) => node.class_type === 'LoadImage');
  expect(pictures).toHaveLength(1); // l'image clé est la première image LTX
  expect(JSON.stringify(take)).not.toContain('frame_decode');
});
