import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openCreations, openToolsHub } from './helpers/top-bar';

const portrait = readFileSync('public/exemples/cast-dj.webp');

async function savedScene(page: Page) {
  return page.evaluate(() => new Promise<{ props: number; keys: number }>((resolve, reject) => {
    const open = indexedDB.open('uttu-coffre', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('files', 'readonly');
      const read = tx.objectStore('files').get('Projets/atelier/.uttu/maquette-plan-01.json');
      tx.oncomplete = () => {
        const scene = JSON.parse(read.result?.text || '{}'); db.close();
        resolve({ props: scene.props?.length ?? 0, keys: scene.path?.length ?? 0 });
      };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));
}

test('contrat vidéo LTX simulé : confirmation renouvelée, reçu, reprise et ajout au montage depuis Mes créations', async ({ page }, info) => {
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
  await page.route(/\/api\/jobs\/video-recovery-123$/, route => route.fulfill({ json: { status: 'success', outputs: { '68': { images: [{ filename: 'raccord.mp4', subfolder: '', type: 'output' }] } } } })); // 68: SaveVideo of video_ltx2_5_flf2v
  await page.route(/\/api\/view\?/, route => route.fulfill({ contentType: 'video/mp4', body: video }));
  await page.goto('/studio#personnage');
  await expect(page.getByLabel('Importer un personnage', { exact: true })).toBeEnabled();
  await page.getByLabel('Importer un personnage', { exact: true }).setInputFiles({ name: 'Portrait.webp', mimeType: 'image/webp', buffer: portrait });
  await expect(page.getByRole('navigation').getByRole('button', { name: 'CAST' })).toContainText('Prêt');
  // Raccord now lives in the « Outils » hub, one click from the top bar, in the single tool panel.
  await openToolsHub(page);
  await page.locator('[data-outil="vid-raccord"]').click();
  const panel = page.locator('[data-tool-panel="vid-raccord"]');
  await panel.locator('[data-outil-input="image"] input[type=file]').setInputFiles({ name: 'image.webp', mimeType: 'image/webp', buffer: portrait });
  // Both pictures of a bridge are in view: « Image de départ » and « Image d’arrivée », no fold to open.
  await expect(panel.locator('[data-tool-step="references"]')).toHaveCount(0);
  await panel.locator('[data-outil-input="image2"] input[type=file]').setInputFiles({ name: 'image.webp', mimeType: 'image/webp', buffer: portrait });
  const prompt = panel.locator('[data-tool-step="consigne"] textarea');
  await prompt.fill('Raccord audit confirmé');
  expect(posts).toBe(0);
  await panel.locator('[data-tool-go]').click();
  await panel.locator('[data-tool-confirm]').evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
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
  // Nav badge flips once the cut is filled; vault write is awaited in montage-stage.
  await expect(page.getByRole('button', { name: /MONTAGE/ })).not.toContainText('Vide');
  await page.reload();
  await expect(page.getByRole('region', { name: 'MONTAGE' })).toBeVisible();
  await expect(page.locator('.u-clip.is-video')).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('video-recovered-montage.png'), fullPage: true });
  expect(posts).toBe(1);
});

test('stockage réel, import conservé après fermeture et confirmation accessible au clavier', async ({ page, context }, info) => {
  const paid: string[] = [];
  await context.route(/\/api\/(prompt|upload|queue)/, route => { paid.push(route.request().url()); return route.abort(); });
  await page.goto('/studio#personnage');
  await expect(page.getByLabel('Importer un personnage', { exact: true })).toBeEnabled();
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
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(credits).toBeFocused();
  await openCreations(page);
  const status = page.locator('[data-storage]');
  await expect(status).not.toHaveAttribute('data-storage', 'loading');
  if (await page.getByRole('button', { name: 'Protéger le stockage local', exact: true }).isVisible()) {
    await page.getByRole('button', { name: 'Protéger le stockage local', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Demande en cours…', exact: true })).toHaveCount(0);
  }
  const browserProtection = await page.evaluate(async () => navigator.storage?.persisted ? await navigator.storage.persisted() : null);
  await expect(status).toHaveAttribute('data-storage', browserProtection === null ? 'unsupported' : browserProtection ? 'persistent' : 'best-effort');
  await page.locator('[data-library-settings]').click();
  const zip = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter mon studio', exact: true }).click();
  const path = info.outputPath('studio-backup.zip');
  await (await zip).saveAs(path);
  expect(readFileSync(path).length).toBeGreaterThan(portrait.length);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/mon-studio');
  await expect(reopened.locator('.u-asset-grid article[data-kind="personnage"]').filter({ hasText: 'Portrait-archive' })).toHaveCount(1);
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
  await expect(page.getByLabel('Importer un personnage', { exact: true })).toBeEnabled();
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
  await panel.getByRole('checkbox').check();
  await identify.click();
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('u-ttu-operation'))).toBeNull();
  await page.keyboard.press('Escape');
  await page.goto('/mon-studio');
  await expect(page.locator('.u-asset-grid article[data-kind="personnage"]').filter({ hasText: 'Portrait récupéré' })).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('reconciled.png'), fullPage: true });
  expect(posts).toBe(0);
});

test('3D : import réellement conservé et contrat simulé de reprise sans deuxième génération', async ({ page, context }, info) => {
  const source = readFileSync('e2e/fixtures/triangle.gltf');
  const json = Buffer.concat([source, Buffer.alloc((4 - source.length % 4) % 4, 32)]);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + json.length, 8);
  header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const glb = Buffer.concat([header, json]);
  let posts = 0, done = false;
  await context.addInitScript(() => localStorage.setItem('u-ttu-rendu', JSON.stringify({ mode: 'key', key: 'audit-fake-mesh-key-0123456789' })));
  await context.route(/overpass|nominatim|photon|panoramax|mapillary|tiles\.openfreemap/, route => route.abort());
  await context.route(/\/api\/user$/, route => route.fulfill({ json: { id: 'audit' } }));
  await context.route(/\/api\/billing\/usage\/timeseries/, route => route.fulfill({ json: { summary: { balance: { amount_micros: 50000 } } } }));
  await context.route(/\/api\/upload\/image$/, route => route.fulfill({ json: { name: 'mesh-input.webp' } }));
  await context.route(/\/api\/prompt$/, route => { posts++; return route.fulfill({ json: { prompt_id: 'mesh-recovery-123', node_errors: {} } }); });
  await context.route(/\/api\/job\/mesh-recovery-123\/status$/, route => route.fulfill({ json: { status: done ? 'success' : 'in_progress' } }));
  await context.route(/\/api\/jobs\/mesh-recovery-123$/, route => route.fulfill({ json: { status: 'success', outputs: { save: { '3d': [{ filename: 'mesh.glb', subfolder: '', type: 'output' }] } } } }));
  await context.route(/\/api\/view\?/, route => route.fulfill({ contentType: 'model/gltf-binary', body: glb }));
  await page.goto('/studio#personnage');
  await expect(page.getByLabel('Importer un personnage', { exact: true })).toBeEnabled();
  await page.getByLabel('Importer un personnage', { exact: true }).setInputFiles({ name: 'Portrait.webp', mimeType: 'image/webp', buffer: portrait });
  await expect(page.getByRole('navigation').getByRole('button', { name: 'CAST' })).toContainText('Prêt');
  await page.getByRole('navigation').getByRole('button', { name: 'PRISE' }).click();
  await openPrevis(page); // keyframes and 3D imports live in « Avancé » › Prévis filmée
  await page.locator('[data-import-glb] input').setInputFiles({ name: 'Triangle.gltf', mimeType: 'model/gltf+json', buffer: source });
  await expect(page.locator('[data-retirer-prop]')).toHaveCount(1);
  await page.locator('[data-add-key]').click();
  await expect(page.locator('[data-maquette]')).toHaveAttribute('data-keys', '1');
  await expect(page.getByLabel('Modèles 3D enregistrés', { exact: true }).locator('option')).toHaveCount(2);
  await expect.poll(() => savedScene(page)).toEqual({ props: 1, keys: 1 });
  await page.reload();
  await openPrevis(page); // the maquette mounts when « Avancé » › Prévis opens
  await expect(page.locator('[data-retirer-prop]')).toHaveCount(1);
  await expect(page.locator('[data-maquette]')).toHaveAttribute('data-keys', '1');
  const panel = page.locator('[data-generer-3d]');
  const photo = panel.locator('input[type=file]');
  await photo.setInputFiles({ name: 'photo.webp', mimeType: 'image/webp', buffer: portrait });
  const confirm = panel.getByRole('checkbox');
  await confirm.click();
  await photo.setInputFiles({ name: 'autre.webp', mimeType: 'image/webp', buffer: portrait });
  await expect(confirm).toHaveAttribute('aria-checked', 'false');
  await expect(panel.locator('[data-mesh-go]')).toBeDisabled();
  expect(posts).toBe(0);
  await confirm.click();
  await panel.locator('[data-mesh-go]').evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect.poll(() => posts).toBe(1);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('u-ttu-operation') || '{}').jobId)).toBe('mesh-recovery-123');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('u-ttu-operation') || '{}').kind)).toBe('mesh');
  done = true;
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('u-ttu-operation'))).toBeNull();
  await openPrevis(page);
  const saved = page.getByLabel('Modèles 3D enregistrés', { exact: true });
  await expect(saved.locator('option')).toHaveCount(3);
  await saved.selectOption({ index: 2 });
  await expect(page.locator('[data-retirer-prop]')).toHaveCount(2);
  await expect.poll(() => savedScene(page)).toEqual({ props: 2, keys: 1 });
  // Explicit navigation flushes the current scene before closing this document.
  await openCreations(page);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/studio#prise');
  await openPrevis(reopened);
  await expect(reopened.locator('[data-retirer-prop]')).toHaveCount(2);
  await reopened.screenshot({ path: info.outputPath('models-reopened.png'), fullPage: true });
  await reopened.goto('/mon-studio');
  const models = reopened.locator('.u-asset-grid article').filter({ hasText: 'Triangle' });
  await expect(models).toHaveCount(1);
  await models.getByRole('button').first().click();
  const download = reopened.waitForEvent('download');
  await reopened.getByRole('link', { name: 'Télécharger le modèle 3D', exact: true }).click();
  const path = info.outputPath('model-reopened.gltf');
  await (await download).saveAs(path);
  expect(readFileSync(path)).toEqual(source);
  expect(posts).toBe(1);
});

// « Avancé », then its « Prévis » group (a real button with aria-expanded), each opened only if closed.
async function openPrevis(page: Page) {
  const avance = page.locator('[data-avance-prise]');
  await expect(avance).toBeVisible();
  if (await avance.getAttribute('open') === null) await avance.locator('> summary').click();
  await expect(avance).toHaveAttribute('open', '');
  const toggle = page.locator('[data-avance-toggle=previs]');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}
