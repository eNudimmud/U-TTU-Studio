import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';

// Success test of the P0: a novice creates a character, places it in a décor, shoots 3 coherent shots
// and exports a short sequence, with no outside help, on phone and desktop. Comfy is simulated:
// this proves the orchestration and the tap count, never the quality of a paid model.

const still = readFileSync('public/exemples/cast-uttu.webp');
const decorStill = readFileSync('public/exemples/decor-quai-nuit.webp');
// VP9 + Opus: decodable by Chromium, Chrome and the CI alike.
const video = readFileSync('e2e/fixtures/prise-5s-vp9.mp4');
const TAP_BUDGET = 12;

type Job = { kind: 'image' | 'video'; at: number; still: Buffer };

async function simulateComfy(page: Page) {
  const jobs = new Map<string, Job>();
  const prompts: { kind: string; text: string }[] = [];
  let n = 0;
  let nextStill: Buffer = still;
  await page.addInitScript(() => localStorage.setItem('u-ttu-rendu', JSON.stringify({ mode: 'key', key: 'audit-fake-key-0123456789' })));
  await page.route(/overpass|nominatim|photon|panoramax|mapillary|tiles\.openfreemap|fal\.ai/, route => route.abort());
  await page.route(/\/api\/user$/, route => route.fulfill({ json: { id: 'novice' } }));
  await page.route(/\/api\/billing\/usage\/timeseries|customers\/balance/, route => route.fulfill({ json: { summary: { balance: { amount_micros: 500_000_000 } } } }));
  await page.route(/\/api\/upload\/image$/, route => route.fulfill({ json: { name: `entree-${++n}.webp` } }));
  await page.route(/\/api\/prompt$/, route => {
    const graph = route.request().postDataJSON()?.prompt ?? {};
    const nodes = Object.values(graph) as { class_type?: string; inputs?: Record<string, unknown> }[];
    const kind = nodes.some(node => /Video|LTXV|MiniMax/i.test(String(node.class_type))) ? 'video' : 'image';
    const text = nodes.flatMap(node => Object.values(node.inputs ?? {}).filter(value => typeof value === 'string' && value.length > 40)).join('\n');
    const id = `novice-job-${String(++n).padStart(4, '0')}`;
    jobs.set(id, { kind, at: Date.now(), still: nextStill });
    prompts.push({ kind, text });
    return route.fulfill({ json: { prompt_id: id, node_errors: {} } });
  });
  await page.route(/\/api\/job\/([^/]+)\/status$/, route => {
    const id = /job\/([^/]+)\/status/.exec(route.request().url())?.[1] ?? '';
    const job = jobs.get(id);
    return route.fulfill({ json: { status: job && Date.now() - job.at > 1200 ? 'success' : 'in_progress' } });
  });
  await page.route(/\/api\/jobs\/([^/?]+)$/, route => {
    const id = route.request().url().split('/').pop() ?? '';
    const job = jobs.get(id);
    return route.fulfill({ json: { status: 'success', outputs: { save: { images: [{ filename: `${id}.${job?.kind === 'video' ? 'mp4' : 'webp'}`, subfolder: '', type: 'output' }] } } } });
  });
  await page.route(/\/api\/view\?/, route => {
    const file = new URL(route.request().url()).searchParams.get('filename') ?? '';
    if (file.endsWith('.mp4')) return route.fulfill({ contentType: 'video/mp4', body: video });
    return route.fulfill({ contentType: 'image/webp', body: jobs.get(file.split('.')[0])?.still ?? still });
  });
  return { prompts, setStill(next: Buffer) { nextStill = next; } };
}

test('parcours débutant : personnage, décor, 3 plans, export MP4 en ≤ 12 taps', async ({ page }, info) => {
  test.setTimeout(240_000);
  const comfy = await simulateComfy(page);
  if (process.env.P0_DEBUG) page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') console.log('[console]', message.text().slice(0, 400)); });
  if (process.env.P0_DEBUG) page.on('pageerror', error => console.log('[pageerror]', error.message));
  const shots = process.env.P0_SHOTS_DIR;
  if (shots) mkdirSync(shots, { recursive: true });
  const mobile = (page.viewportSize()?.width ?? 1280) < 800;
  let taps = 0;
  let shot = 0;
  async function tap(target: Locator) {
    await expect(target).toBeEnabled();
    await target.click();
    taps += 1;
  }
  async function snap(name: string) {
    shot += 1;
    const file = `${String(shot).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: info.outputPath(file) });
    if (shots && mobile) await page.screenshot({ path: join(shots, `p0-apres-m390-${file}`) });
  }
  async function reachable(target: Locator) {
    // Mobile 390: the action is on screen without scrolling.
    const box = await target.boundingBox();
    expect(box).toBeTruthy();
    const height = page.viewportSize()?.height ?? 800;
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    expect(box!.y).toBeGreaterThanOrEqual(0);
  }

  await page.goto('/studio');
  await expect(page.getByRole('heading', { name: 'CAST' })).toBeVisible();
  await expect(page.locator('[data-soon="true"]')).toHaveCount(0);
  await snap('cast');

  // 1 · CAST: a name, a description, Créer, Lancer.
  await page.getByRole('textbox', { name: 'Nom' }).fill('Enki');
  await page.getByRole('textbox', { name: 'Texte', exact: true }).fill('Une femme de trente ans, manteau rouge, cheveux courts.');
  const castGold = page.locator('[data-cast-gold]');
  if (mobile) await reachable(castGold);
  await tap(castGold);
  await expect(page.locator('[data-fiabilite]')).toBeVisible();
  await snap('cast-confirmation');
  await tap(page.locator('[data-create-confirm]'));

  // 2 · DÉCOR: one suggestion opens the single confirmation.
  await expect(page.getByRole('heading', { name: 'DÉCOR' })).toBeVisible({ timeout: 30_000 });
  comfy.setStill(decorStill);
  await snap('decor');
  await tap(page.locator('[data-suggestion="create.suggestQuai"]'));
  await expect(page.locator('[data-fiabilite]')).toBeVisible();
  await tap(page.locator('[data-create-confirm]'));

  // 3 · PRISE in the default 16:9, LTX estimated quote, the user's camera words kept.
  await expect(page.locator('[data-maquette]')).toHaveAttribute('data-figures', '1', { timeout: 30_000 });
  await expect(page.getByRole('group', { name: 'Format du projet' }).getByRole('button', { name: '16:9', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.u-prise-quote:visible')).toHaveCount(1);
  await expect(page.locator('.u-prise-quote:visible')).toContainText('Estimé');
  await expect(page.locator('[data-avance-prise]')).not.toHaveAttribute('open', '');
  await page.getByRole('textbox', { name: 'Ce qui se passe', exact: true }).fill('Enki marche sur le quai, caméra à l\'épaule');
  const gold = page.locator('.u-prise-actions .u-primary');
  if (mobile) await reachable(gold);
  await snap('prise-plan-1');
  await tap(gold);
  const sheet = page.locator('[data-confirm-gold]');
  await expect(page.locator('dialog [data-fiabilite]')).toContainText('caméra à l’épaule');
  await snap('prise-confirmation');
  await tap(sheet);
  await expect(page.locator('[data-take-view] video')).toBeVisible({ timeout: 60_000 });
  const takePrompt = comfy.prompts.filter(item => item.kind === 'video').at(-1)?.text ?? '';
  expect(takePrompt).toMatch(/handheld camera/);
  expect(takePrompt).not.toMatch(/static camera|locked-off/);
  await snap('prise-1-arrivee');

  for (const [plan, words] of [['02', 'Enki se retourne vers la mer'], ['03', 'Enki regarde au loin, le vent dans le manteau']] as const) {
    await page.getByRole('textbox', { name: 'Plan suivant : ce qui se passe' }).fill(words);
    await expect(gold).toHaveText(`Tourner le plan ${plan}`);
    if (mobile) await reachable(gold);
    await tap(gold);
    await tap(page.locator('[data-confirm-gold]'));
    await expect(page.locator('#u-title')).toHaveText(`Plan ${plan}`);
    await expect(page.locator('[data-take-view] video')).toBeVisible({ timeout: 60_000 });
  }
  await expect(page.locator('.u-plan-card')).toHaveCount(3);
  await expect(page.locator('[data-fiab-archive]')).toContainText('Plan 03');
  await snap('prise-3-plans');

  // 4 · MONTAGE: the three takes as video clips, in order, then one tap to export.
  await tap(page.locator('.u-prise-actions [data-envoyer-montage]'));
  await expect(page.locator('.u-clip.is-video')).toHaveCount(3, { timeout: 30_000 });
  await snap('montage');
  const downloaded = page.waitForEvent('download', { timeout: 180_000 });
  await tap(page.locator('[data-export-open]'));
  const download = await downloaded;
  const path = info.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  await expect(page.locator('[data-export]')).toHaveAttribute('data-export', 'done');
  await snap('export');

  expect(taps).toBeLessThanOrEqual(TAP_BUDGET);
  info.annotations.push({ type: 'taps', description: String(taps) });
  expect(path.endsWith('.mp4') || path.endsWith('.webm')).toBe(true);
  const media = new Input({ source: new BlobSource(new Blob([readFileSync(path)])), formats: ALL_FORMATS });
  try {
    const track = await media.getPrimaryVideoTrack();
    expect(track).toBeTruthy();
    // Three 5 s takes. A real-time recording (no WebCodecs) may drift by a few frames.
    expect(await track!.computeDuration()).toBeGreaterThan(13.5);
    expect(await track!.computeDuration()).toBeLessThan(16.5);
    if (process.env.PLAYWRIGHT_CHANNEL === 'chrome') {
      expect(path.endsWith('.mp4')).toBe(true);
      expect(track!.codec).toBe('avc');
    }
  } finally { media.dispose(); }
  const vault = await page.evaluate(() => new Promise<string[]>((resolve, reject) => {
    const open = indexedDB.open('uttu-coffre');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => { const request = open.result.transaction('files').objectStore('files').getAllKeys(); request.onsuccess = () => resolve(request.result.map(String)); };
  }));
  expect(vault.filter(key => /\/Prises\/.*\.mp4$/.test(key))).toHaveLength(3);
  expect(comfy.prompts.filter(item => item.kind === 'video')).toHaveLength(3);
});
