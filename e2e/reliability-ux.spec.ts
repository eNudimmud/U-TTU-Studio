import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const portrait = readFileSync('public/exemples/cast-uttu.webp');

test('contrat vidéo LTX simulé : confirmation renouvelée, reçu, reprise et ajout au montage depuis Mon studio', async ({ page }, info) => {
  const video = readFileSync('e2e/fixtures/final-1080p.mp4');
  let posts = 0;
  let done = false;
  await page.addInitScript(() => localStorage.setItem('u-ttu-rendu', JSON.stringify({ mode: 'key', key: 'audit-fake-video-key-0123456789' })));
  await page.route(/overpass|nominatim|photon|panoramax|mapillary|tiles\.openfreemap/, route => route.abort());
  await page.route(/\/api\/user$/, route => route.fulfill({ json: { id: 'audit' } }));
  await page.route(/\/api\/billing\/usage\/timeseries/, route => route.fulfill({ json: { summary: { balance: { amount_micros: 50000 } } } }));
  await page.route(/\/api\/upload\/image$/, route => route.fulfill({ json: { name: 'input.webp' } }));
  await page.route(/\/api\/prompt$/, route => { posts++; return route.fulfill({ json: { prompt_id: 'video-recovery-123', node_errors: {} } }); });
  await page.route(/\/api\/job\/video-recovery-123\/status$/, route => route.fulfill({ json: { status: done ? 'success' : 'in_progress' } }));
  await page.route(/\/api\/jobs\/video-recovery-123$/, route => route.fulfill({ json: { status: 'success', outputs: { save: { images: [{ filename: 'raccord.mp4', subfolder: '', type: 'output' }] } } } }));
  await page.route(/\/api\/view\?/, route => route.fulfill({ contentType: 'video/mp4', body: video }));
  await page.goto('/studio#personnage');
  await page.getByLabel('Importer un personnage', { exact: true }).setInputFiles({ name: 'Portrait.webp', mimeType: 'image/webp', buffer: portrait });
  await expect(page.getByRole('navigation').getByRole('button', { name: 'CAST' })).toContainText('Prêt');
  await page.getByRole('navigation').getByRole('button', { name: 'PRISE' }).click();
  const panel = page.locator('[data-video-gestes]');
  await panel.locator('[data-video-geste="prise-raccord"]').click();
  for (const label of ['Première image', 'Dernière image']) await panel.getByLabel(label, { exact: true }).setInputFiles({ name: 'image.webp', mimeType: 'image/webp', buffer: portrait });
  const prompt = panel.getByRole('textbox');
  await prompt.fill('Raccord audit');
  await expect(panel.locator('[data-video-go]')).toBeDisabled();
  const consent = panel.getByRole('checkbox');
  await consent.click();
  await prompt.fill('Raccord audit confirmé');
  await expect(consent).toHaveAttribute('aria-checked', 'false');
  await consent.click();
  expect(posts).toBe(0);
  await panel.locator('[data-video-go]').evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect.poll(() => posts).toBe(1);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('u-ttu-operation') || '{}').jobId)).toBe('video-recovery-123');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('u-ttu-operation') || '{}').kind)).toBe('video');
  done = true;
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('u-ttu-operation')), { timeout: 60000 }).toBeNull();
  await page.goto('/mon-studio');
  const card = page.locator('.u-asset-grid article[data-kind="plan"]').filter({ hasText: 'Raccord' });
  await expect(card).toHaveCount(1);
  await card.getByRole('button').first().click();
  await page.locator('.u-asset-detail').getByRole('button', { name: 'Ajouter au montage', exact: true }).click();
  await expect(page).toHaveURL(/\/studio\?project=atelier#montage$/);
  await expect(page.locator('.u-clip.is-video')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.u-clip.is-video')).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('video-recovered-montage.png'), fullPage: true });
  expect(posts).toBe(1);
});

test('stockage réel, import conservé après fermeture et confirmation accessible au clavier', async ({ page, context }, info) => {
  const paid: string[] = [];
  await context.route(/\/api\/(prompt|upload|queue)/, route => { paid.push(route.request().url()); return route.abort(); });
  await page.goto('/studio#personnage');
  await page.getByLabel('Importer un personnage', { exact: true }).setInputFiles({ name: 'Portrait-archive.webp', mimeType: 'image/webp', buffer: portrait });
  await expect(page.getByRole('navigation').getByRole('button', { name: 'CAST' })).toContainText('Prêt');
  const credits = page.locator('header .u-credit');
  await credits.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(credits).toBeFocused();
  await page.getByRole('link', { name: 'Mon studio', exact: true }).click();
  const status = page.locator('[data-storage]');
  await expect(status).not.toHaveAttribute('data-storage', 'loading');
  if (await page.getByRole('button', { name: 'Protéger le stockage local', exact: true }).isVisible()) {
    await page.getByRole('button', { name: 'Protéger le stockage local', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Demande en cours…', exact: true })).toHaveCount(0);
  }
  const browserProtection = await page.evaluate(async () => navigator.storage?.persisted ? await navigator.storage.persisted() : null);
  await expect(status).toHaveAttribute('data-storage', browserProtection === null ? 'unsupported' : browserProtection ? 'persistent' : 'best-effort');
  const zip = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter mon studio', exact: true }).click();
  const path = info.outputPath('studio-backup.zip');
  await (await zip).saveAs(path);
  expect(readFileSync(path).length).toBeGreaterThan(portrait.length);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/mon-studio');
  await expect(reopened.locator('.u-gallery > article').filter({ hasText: 'Portrait-archive' })).toHaveCount(1);
  await reopened.screenshot({ path: info.outputPath('storage-reopened.png'), fullPage: true });
  expect(paid).toEqual([]);
});

test('contrat simulé : identifier un envoi ambigu ne crée jamais un autre rendu', async ({ page }, info) => {
  let posts = 0;
  const key = 'audit-fake-recovery-key-0123456789';
  await page.addInitScript(key => localStorage.setItem('u-ttu-rendu', JSON.stringify({ mode: 'key', key })), key);
  await page.route(/\/api\/user$/, route => route.fulfill({ json: { id: 'audit' } }));
  await page.route(/\/api\/billing\/usage\/timeseries/, route => route.fulfill({ json: { summary: { balance: { amount_micros: 50000 } } } }));
  await page.route(/\/api\/(prompt|upload|queue)/, route => { posts++; return route.abort(); });
  await page.route(/\/api\/job\/existing-job-123\/status$/, route => route.fulfill({ json: { status: 'success' } }));
  await page.route(/\/api\/jobs\/existing-job-123$/, route => route.fulfill({ json: { status: 'success', outputs: { save: { images: [{ filename: 'recovered.webp', subfolder: '', type: 'output' }] } } } }));
  await page.route(/\/api\/view\?/, route => route.fulfill({ contentType: 'image/webp', body: portrait }));
  await page.goto('/studio#personnage');
  await page.getByLabel('Importer un personnage', { exact: true }).setInputFiles({ name: 'Initial.webp', mimeType: 'image/webp', buffer: portrait });
  await expect(page.getByRole('navigation').getByRole('button', { name: 'CAST' })).toContainText('Prêt');
  await page.evaluate(async key => {
    const account = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))), byte => byte.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('u-ttu-operation', JSON.stringify({ version: 1, kind: 'cast', project: 'atelier', id: 'recovered-cast', name: 'Portrait récupéré', prompt: 'Test de récupération', at: '2026-10-16T00:00:00Z', account, refs: [], template: 'image_flux3_klein_t2i', quote: 4, balanceBefore: 100, jobId: null }));
  }, key);
  await page.reload();
  await page.locator('header .u-credit').click();
  const panel = page.locator('[data-recovery]');
  await expect(panel).toHaveAttribute('data-recovery', 'ambiguous');
  const identify = page.getByRole('button', { name: 'Récupérer ce rendu existant', exact: true });
  await expect(identify).toBeDisabled();
  await page.getByLabel('Identifiant du rendu retrouvé', { exact: true }).fill('existing-job-123');
  await expect(identify).toBeDisabled();
  await page.getByRole('checkbox').check();
  await identify.click();
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('u-ttu-operation'))).toBeNull();
  await page.keyboard.press('Escape');
  await page.goto('/mon-studio');
  await expect(page.locator('.u-gallery > article').filter({ hasText: 'Portrait récupéré' })).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('reconciled.png'), fullPage: true });
  expect(posts).toBe(0);
});
