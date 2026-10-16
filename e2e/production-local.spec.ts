import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';

const image = readFileSync('public/exemples/cast-uttu.webp');
const video = readFileSync('e2e/fixtures/final-1080p.mp4');
const paid = /\/api\/(prompt|upload|queue)|fal\.ai|comfy\.cloud/;

async function offline(page: Page) {
  await page.route(/overpass|nominatim|photon|panoramax|mapillary|tiles\.openfreemap/, route => route.abort());
}
async function importCast(page: Page) {
  await page.goto('/studio#personnage');
  await page.getByLabel('Importer un personnage', { exact: true }).setInputFiles({ name: 'Alice.webp', mimeType: 'image/webp', buffer: image });
  await expect(page.locator('[data-depart=cast]')).toHaveCount(0);
  await expect(page.getByRole('navigation').getByRole('button', { name: 'CAST' })).toContainText('Prêt');
}
async function readVault(page: Page) {
  return page.evaluate(() => new Promise<{ path: string; text?: string; bytes?: number }[]>((resolve, reject) => {
    const open = indexedDB.open('uttu-coffre');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('files');
      const request = tx.objectStore('files').getAll();
      request.onsuccess = () => { resolve(request.result.map(entry => ({ path: entry.path, text: entry.text, bytes: entry.blob?.size }))); db.close(); };
      request.onerror = () => { reject(request.error); db.close(); };
    };
  }));
}

test('import gratuit → plan conservé → montage → vrai MP4 et réouverture', async ({ page, context }, info) => {
  const submissions: string[] = [];
  await page.route(paid, route => { submissions.push(route.request().url()); return route.abort(); });
  await offline(page);
  await importCast(page);
  await page.getByRole('navigation').getByRole('button', { name: 'DÉCOR' }).click();
  await page.getByLabel('Importer un décor', { exact: true }).setInputFiles({ name: 'Quai.webp', mimeType: 'image/webp', buffer: image });
  await expect(page.locator('[data-depart=decor]')).toHaveCount(0);
  await expect(page.getByRole('navigation').getByRole('button', { name: 'DÉCOR' })).toContainText('Prêt');
  await page.getByRole('navigation').getByRole('button', { name: 'PRISE' }).click();
  await expect(page.locator('[data-maquette]')).toHaveAttribute('data-figures', '1');
  await page.getByRole('group', { name: 'Format du projet' }).getByRole('button', { name: '9:16', exact: true }).click();
  await page.getByRole('textbox', { name: 'Ce qui se passe', exact: true }).fill('Alice traverse le quai audit');
  await expect.poll(async () => (await readVault(page)).some(entry => /\/Shots\//.test(entry.path) && entry.text?.includes('Alice traverse le quai audit'))).toBe(true);
  await page.locator('[data-envoyer-montage]').click();
  await expect(page.locator('[data-montage]')).toHaveAttribute('data-montage', 'projet');
  await expect(page.locator('.u-clip.is-video')).toHaveCount(1);
  expect((await readVault(page)).filter(entry => /\/Prises\/.*\.md$/.test(entry.path))).toHaveLength(0); // an image is not a generated take
  await page.locator('[data-export-open]').click();
  const downloaded = page.waitForEvent('download');
  await page.locator('[data-export-gold]').click();
  const download = await downloaded;
  const path = info.outputPath('export-local.mp4');
  await download.saveAs(path);
  await expect(page.locator('[data-export]')).toHaveAttribute('data-export', 'done');
  const media = new Input({ source: new BlobSource(new Blob([readFileSync(path)])), formats: ALL_FORMATS });
  try {
    const track = await media.getPrimaryVideoTrack();
    expect(track?.codec).toBe('avc');
    expect(track?.displayWidth).toBe(540);
    expect(track?.displayHeight).toBe(960);
    expect(await track!.computeDuration()).toBeCloseTo(5, 0);
    expect((await media.getPrimaryAudioTrack())?.codec).toBe('aac');
  } finally { media.dispose(); }
  await page.screenshot({ path: info.outputPath('export-local.png'), fullPage: true });
  await page.close();
  const reopened = await context.newPage();
  await offline(reopened);
  await reopened.goto('/studio#montage');
  await expect(reopened.locator('.u-clip.is-video')).toHaveCount(1);
  await reopened.getByRole('navigation').getByRole('button', { name: 'PRISE' }).click();
  await expect(reopened.getByRole('textbox', { name: 'Ce qui se passe', exact: true })).toHaveValue('Alice traverse le quai audit');
  await expect(reopened.locator('[data-maquette]')).toHaveAttribute('data-figures', '1');
  expect(submissions).toEqual([]);
});

test('contrat cloud simulé : confirmation, un seul POST, reprise et vraie vidéo enregistrée', async ({ page }, info) => {
  // Network is intercepted. This checks orchestration, never validates a paid model.
  await offline(page);
  await page.addInitScript(() => localStorage.setItem('u-ttu-rendu', JSON.stringify({ mode: 'key', key: 'audit-fake-key-0123456789' })));
  let posts = 0;
  let done = false;
  let sent: Record<string, any> = {};
  await page.route(/\/api\/user$/, route => route.fulfill({ json: { id: 'audit' } }));
  await page.route(/\/api\/billing\/usage\/timeseries/, route => route.fulfill({ json: { summary: { balance: { amount_micros: done ? 49998 : 50000 } } } }));
  await page.route(/\/api\/upload\/image$/, route => route.fulfill({ json: { name: 'portrait.webp' } }));
  await page.route(/\/api\/prompt$/, route => { posts++; sent = route.request().postDataJSON().prompt; return route.fulfill({ json: { prompt_id: 'audit-job-123456', node_errors: {} } }); });
  await page.route(/\/api\/job\/audit-job-123456\/status$/, route => route.fulfill({ json: { status: done ? 'success' : 'in_progress' } }));
  await page.route(/\/api\/jobs\/audit-job-123456$/, route => route.fulfill({ json: { status: 'success', outputs: { save: { images: [{ filename: 'audit.mp4', subfolder: '', type: 'output' }] } } } }));
  await page.route(/\/api\/view\?/, route => route.fulfill({ contentType: 'video/mp4', body: video }));
  await importCast(page);
  await page.getByRole('navigation').getByRole('button', { name: 'PRISE' }).click();
  await expect(page.locator('[data-maquette]')).toHaveAttribute('data-figures', '1');
  await page.getByRole('group', { name: 'Format du projet' }).getByRole('button', { name: '9:16', exact: true }).click();
  await page.getByRole('textbox', { name: 'Ce qui se passe', exact: true }).fill('Alice tend la main audit');
  await expect(page.locator('[data-engine]')).toHaveAttribute('data-engine', 'ltx');
  expect(posts).toBe(0); // The default LTX quote is estimated; only confirmation may submit.
  await page.locator('[data-engine]').getByRole('button', { name: /MiniMax H3/ }).click();
  await expect(page.locator('[data-engine]')).toHaveAttribute('data-engine', 'h3');
  // R10 examples remain previews: never charge for a take that silently omits its selected decor.
  const example = page.getByRole('button', { name: /^Exemple Le quai, la nuit$/i });
  await example.click();
  await expect(page.getByRole('button', { name: 'Générer une prise', exact: true })).toBeDisabled();
  expect(posts).toBe(0);
  await example.click();
  await page.getByRole('button', { name: 'Générer une prise', exact: true }).click();
  await expect(page.locator('[data-confirm-gold]')).toBeEnabled();
  expect(posts).toBe(0);
  await page.locator('[data-confirm-gold]').evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect.poll(() => posts).toBe(1);
  expect(sent["138"].inputs.value).toContain('Alice tend la main audit');
  expect(sent["115"].inputs.aspect_ratio).toContain('9:16');
  expect(sent["132"].inputs.value).toBe(5);
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('u-ttu-operation') || '{}').jobId)).toBe('audit-job-123456');
  done = true;
  await page.reload();
  await expect(page.locator('.u-prise video[controls]')).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('navigation').getByRole('button', { name: 'PRISE' })).toContainText('Prêt');
  await expect(page.getByText('Un rendu attend sa récupération. Ouvrez Crédits puis Récupérer le rendu.')).toHaveCount(0);
  const entries = await readVault(page);
  expect(entries.filter(entry => /\/Prises\/.*\.mp4$/.test(entry.path)).map(entry => entry.bytes)).toEqual([video.length]);
  expect(entries.filter(entry => /\/Prises\/.*\.md$/.test(entry.path))).toHaveLength(1);
  expect(posts).toBe(1);
  await page.locator('[data-envoyer-montage]').click();
  await expect(page.locator('.u-clip.is-video')).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('recovered-take.png'), fullPage: true });
});

test('deux vidéos importées → montage de six secondes → MP4 lisible', async ({ page }, info) => {
  const submissions: string[] = [];
  await page.route(paid, route => { submissions.push(route.request().url()); return route.abort(); });
  await offline(page);
  await page.goto('/studio#personnage');
  const gallery = page.getByRole('button', { name: 'Galerie', exact: true });
  if (info.project.name === 'mobile') {
    await gallery.click();
    await expect(gallery).toHaveAttribute('aria-pressed', 'true');
  }
  await page.locator('.u-assets input[type=file]').setInputFiles([
    { name: 'ClipA.mp4', mimeType: 'video/mp4', buffer: video },
    { name: 'ClipB.mp4', mimeType: 'video/mp4', buffer: video },
  ]);
  await page.locator('.u-filter').getByRole('button', { name: 'Plans', exact: true }).click();
  await expect(page.locator('.u-pick')).toHaveCount(2);
  await page.getByRole('button', { name: 'ClipA', exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter au montage', exact: true }).click();
  await expect(page.locator('.u-clip.is-video')).toHaveCount(1);
  await page.getByRole('navigation').getByRole('button', { name: 'CAST' }).click();
  if (info.project.name === 'mobile') {
    await gallery.click();
    await expect(gallery).toHaveAttribute('aria-pressed', 'true');
  }
  await page.locator('.u-filter').getByRole('button', { name: 'Plans', exact: true }).click();
  await page.getByRole('button', { name: 'ClipB', exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter au montage', exact: true }).click();
  await expect(page.locator('.u-clip.is-video')).toHaveCount(2);
  await page.locator('[data-export-open]').click();
  const downloaded = page.waitForEvent('download');
  await page.locator('[data-export-gold]').click();
  const path = info.outputPath('two-clips.mp4');
  await (await downloaded).saveAs(path);
  await expect(page.locator('[data-export]')).toHaveAttribute('data-export', 'done');
  const bytes = readFileSync(path);
  const media = new Input({ source: new BlobSource(new Blob([bytes])), formats: ALL_FORMATS });
  try {
    const track = await media.getPrimaryVideoTrack();
    expect(track?.codec).toBe('avc');
    expect(await track!.computeDuration()).toBeCloseTo(6, 0);
    expect((await media.getPrimaryAudioTrack())?.codec).toBe('aac');
  } finally { media.dispose(); }
  // Decode both clips in the actual browser, and reject an all-black export.
  const samples = await page.evaluate(async base64 => {
    const blob = new Blob([Uint8Array.from(atob(base64), ch => ch.charCodeAt(0))], { type: 'video/mp4' });
    const element = document.createElement('video');
    const url = URL.createObjectURL(blob);
    try {
      await new Promise<void>((resolve, reject) => { element.onloadeddata = () => resolve(); element.onerror = () => reject(new Error('decode')); element.src = url; });
      const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 18;
      const ctx = canvas.getContext('2d')!;
      const levels: number[] = [];
      for (const time of [1, 4]) {
        await new Promise<void>(resolve => { element.onseeked = () => resolve(); element.currentTime = time; });
        ctx.drawImage(element, 0, 0, 32, 18);
        levels.push([...ctx.getImageData(0, 0, 32, 18).data].filter((_, index) => index % 4 !== 3).reduce((a, b) => a + b, 0));
      }
      return levels;
    } finally { element.removeAttribute('src'); element.load(); URL.revokeObjectURL(url); }
  }, bytes.toString('base64'));
  expect(samples.every(level => level > 1000)).toBe(true);
  await page.screenshot({ path: info.outputPath('two-clips.png'), fullPage: true });
  expect(submissions).toEqual([]);
});
