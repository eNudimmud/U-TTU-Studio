import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Refonte FILM · PR 5 — la carte du plan (?film2=1). Comfy is simulated: this proves the path and
// the tap count, never the quality of a paid model. 0 real credits.

const still = readFileSync('public/exemples/cast-coursiere.webp');
const decorStill = readFileSync('public/exemples/decor-quai-nuit.webp');
const video = readFileSync('e2e/fixtures/prise-5s-vp9.mp4');
const SHOTS = process.env.FILM2_SHOTS;

type Job = { kind: 'image' | 'video'; at: number; save: string };

async function simulateComfy(page: Page) {
  const jobs = new Map<string, Job>();
  const prompts: { kind: string; at: number }[] = [];
  let n = 0;
  await page.addInitScript(() => localStorage.setItem('u-ttu-rendu', JSON.stringify({ mode: 'key', key: 'audit-fake-key-0123456789' })));
  await page.route(/overpass|nominatim|photon|panoramax|mapillary|tiles\.openfreemap|fal\.ai/, route => route.abort());
  await page.route(/\/api\/user$/, route => route.fulfill({ json: { id: 'novice' } }));
  await page.route(/\/api\/billing\/usage\/timeseries|customers\/balance/, route => route.fulfill({ json: { summary: { balance: { amount_micros: 500_000_000 } } } }));
  await page.route(/\/api\/upload\/image$/, route => route.fulfill({ json: { name: `entree-${++n}.webp` } }));
  await page.route(/\/api\/prompt$/, route => {
    const graph = route.request().postDataJSON()?.prompt ?? {};
    const entries = Object.entries(graph) as [string, { class_type?: string }][];
    const kind = entries.some(([, node]) => /Video|LTXV|MiniMax|Hunyuan|H3/i.test(String(node.class_type))) ? 'video' : 'image';
    const id = `film2-job-${String(++n).padStart(4, '0')}`;
    const save = entries.find(([, node]) => /^(Save|VHS_VideoCombine$)/.test(String(node.class_type)))?.[0] ?? 'save';
    jobs.set(id, { kind, at: Date.now(), save });
    prompts.push({ kind, at: Date.now() });
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
    return route.fulfill({ json: { status: 'success', outputs: { [job?.save ?? 'save']: { images: [{ filename: `${id}.${job?.kind === 'video' ? 'mp4' : 'webp'}`, subfolder: '', type: 'output' }] } } } });
  });
  let images = 0;
  await page.route(/\/api\/view\?/, route => {
    const file = new URL(route.request().url()).searchParams.get('filename') ?? '';
    if (file.endsWith('.mp4')) return route.fulfill({ contentType: 'video/mp4', body: video });
    return route.fulfill({ contentType: 'image/webp', body: images++ === 0 ? still : decorStill });
  });
  return { prompts };
}

async function onScreen(page: Page, target: Locator) {
  const box = await target.boundingBox();
  expect(box, 'visible').toBeTruthy();
  const view = page.viewportSize()!;
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(view.height + 0.5);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

test('carte du plan : de l’accueil au POST en ≤ 3 taps et 1 champ, puis la prise dans la carte et au montage', async ({ page }, info) => {
  test.setTimeout(180_000);
  const comfy = await simulateComfy(page);
  const width = page.viewportSize()?.width ?? 1280;
  const prefix = `film2-${width}x${page.viewportSize()?.height}`;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const snap = async (name: string) => {
    await page.waitForTimeout(300);
    await page.screenshot({ path: info.outputPath(`${name}.png`) });
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `${prefix}-${name}.png`) });
  };
  let taps = 0;
  const tap = async (target: Locator) => { await expect(target).toBeEnabled(); await target.click(); taps += 1; };

  await page.goto('/studio?film2=1');
  await snap('01-accueil');
  // Tap 1 · the film door opens the plan card, not CAST.
  await tap(page.locator('[data-entry-film]'));
  const field = page.locator('[data-film-phrase]');
  const gold = page.locator('[data-film-tourner]');
  await expect(field).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-film-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await onScreen(page, field);
  await onScreen(page, gold);
  await expect(gold).toHaveText(/Tourner le plan\s*· ≈ [\d,]+ crédits estimés/);
  // One field.
  await field.fill('Uttu marche sur le quai la nuit, la caméra la suit');
  await expect(page.locator('[data-film-qui]')).toContainText('Uttu');
  await expect(page.locator('[data-film-qui]')).toContainText('nouveau · sera créé');
  await expect(page.locator('[data-film-ou]')).toContainText('Le quai');
  await snap('02-plan-compris');
  expect(comfy.prompts).toHaveLength(0);
  // Tap 2 · Tourner opens one sheet with every step.
  await tap(gold);
  const sheet = page.locator('[data-film-confirm]');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('[data-film-etape]')).toHaveCount(3);
  await expect(sheet.locator('[data-film-etape="personnage"]')).toContainText('Créer le personnage « Uttu »');
  await expect(sheet.locator('[data-film-etape="lieu"]')).toContainText('Créer le lieu « Le quai »');
  await expect(sheet.locator('[data-film-etape="prise"]')).toContainText('Tourner le plan');
  // The total is the sum of the step quotes.
  const steps = (await sheet.locator('.u-film-step-cost').allInnerTexts()).map(text => Number(text.replace(/[^\d,.]/g, '').replace(',', '.')));
  const total = Number((await sheet.locator('[data-film-total]').innerText()).replace(/[^\d,.]/g, '').replace(',', '.'));
  expect(Math.abs(steps.reduce((a, b) => a + b, 0) - total)).toBeLessThan(0.11);
  // Plain words: no engine or service names outside « Ce qui sera envoyé ».
  expect(await sheet.innerText()).not.toMatch(/Comfy|H3|LTX/);
  await expect(sheet).not.toContainText('gratuit');
  await onScreen(page, page.locator('[data-film-lancer]'));
  await snap('03-confirmer');
  expect(comfy.prompts).toHaveLength(0);
  // Tap 3 · Lancer: character, then place, then the take.
  await tap(page.locator('[data-film-lancer]'));
  await expect.poll(() => comfy.prompts.length, { timeout: 30_000 }).toBeGreaterThan(0);
  expect(taps).toBeLessThanOrEqual(3);
  await expect(page.locator('[data-film-running]')).toBeVisible();
  await snap('04-en-cours');
  await expect(page.locator('[data-film-result] video')).toBeVisible({ timeout: 90_000 });
  expect(comfy.prompts.map(item => item.kind)).toEqual(['image', 'image', 'video']);
  await snap('05-resultat');
  console.log(`[film2] ${prefix}: ${taps} taps + 1 champ jusqu’au premier POST`);

  // Plan 2 · Qui and Où open the libraries as sheets; the cards made in plan 1 are picked, nothing is made twice.
  await page.locator('[data-film-suivant]').click();
  await field.fill('Elle attend sous la pluie');
  await page.locator('[data-film-qui]').click();
  const qui = page.locator('[data-film-choix="qui"]');
  await expect(qui).toBeVisible();
  await expect(qui.locator('[data-film-carte]')).toHaveCount(1);
  await snap('06-qui');
  // F16 · the same photo again is offered back, not imported twice.
  await qui.locator('[data-film-nouveau="photos"]').click();
  const src = await qui.locator('[data-film-carte] img').first().getAttribute('src');
  const bytes = await page.evaluate(async url => Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())), src!);
  await qui.locator('[data-film-nom]').fill('Uttu bis');
  await qui.locator('[data-film-photos]').setInputFiles({ name: 'uttu.webp', mimeType: 'image/webp', buffer: Buffer.from(bytes) });
  await expect(qui.locator('[data-film-deja]')).toContainText('Déjà dans ta galerie : Uttu');
  await snap('07-deja-la');
  await qui.locator('[data-film-deja-utiliser]').click();
  await expect(qui.locator('[data-film-carte][aria-pressed="true"]')).toHaveCount(1);
  await qui.locator('[data-film-choix-ok]').click();
  await expect(page.locator('[data-film-qui]')).toContainText('Uttu');
  await expect(page.locator('[data-film-qui]')).toContainText('de ta distribution');
  await page.locator('[data-film-ou]').click();
  const ou = page.locator('[data-film-choix="ou"]');
  await ou.locator('[data-film-carte]').first().click();
  await ou.locator('[data-film-choix-ok]').click();
  await expect(page.locator('[data-film-ou]')).toContainText('Le quai');
  await expect(page.locator('[data-film-ou]')).toContainText('de tes lieux');
  const before = comfy.prompts.length;
  await gold.click();
  await expect(sheet.locator('[data-film-etape]')).toHaveCount(1);
  await page.locator('[data-film-lancer]').click();
  await expect(page.locator('[data-film-result] video')).toBeVisible({ timeout: 90_000 });
  expect(comfy.prompts.slice(before).map(item => item.kind)).toEqual(['video']);

  // On the cut without a tap.
  await page.locator('[data-film-montage]').click();
  await expect(page.locator('.u-chain [aria-current="page"]')).toContainText('MONTAGE');
  await expect(page.locator('.u-chain button').nth(3)).toHaveAttribute('data-state', 'pret', { timeout: 20_000 });
});

for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1024, height: 600 }, { width: 1280, height: 800 }]) {
  test(`carte du plan ${size.width}×${size.height} : champ et bouton or au premier écran, un seul primaire`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'sizes are set here');
    await page.setViewportSize(size);
    await page.goto('/studio?film2=1#prise');
    const field = page.locator('[data-film-phrase]');
    await expect(field).toBeVisible({ timeout: 30_000 });
    await onScreen(page, field);
    await onScreen(page, page.locator('[data-film-tourner]'));
    await expect(page.locator('[data-film-plans] .u-film-gold:visible')).toHaveCount(1);
    const actions = await page.locator('[data-film-plans] button:visible, [data-film-plans] textarea:visible').count();
    expect(actions).toBeLessThanOrEqual(10);
    // Off by default: the classic PRISE without the flag.
    await page.goto('/studio?film2=0#prise');
    await expect(page.locator('[data-film-plans]')).toHaveCount(0);
  });
}
