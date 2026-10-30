import { expect, test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// PICKER_PICS: optional folder with alien.png / creature.png / paysage.png / batiment.webp (real refs for screenshots).
// PICKER_SHOTS: where to write screenshots. PICKER_BEFORE=1 only records the old picker.
test.use({ hasTouch: true });
const dir = process.env.PICKER_PICS, before = process.env.PICKER_BEFORE === '1';
const pic = (file: string, fallback: string) => { const path = dir && join(dir, file); const real = path && existsSync(path); return { buffer: readFileSync(real ? path : fallback), mimeType: (real ? file : fallback).endsWith('.png') ? 'image/png' : 'image/webp' }; };
const alien = pic('alien.png', 'public/exemples/cast-dj.webp'), creature = pic('creature.png', 'public/exemples/cast-coursiere.webp');
const paysage = pic('paysage.png', 'public/exemples/decor-toit-aube.webp'), batiment = pic('batiment.webp', 'public/exemples/decor-gare.webp');
async function shot(page: Page, name: string) { const out = process.env.PICKER_SHOTS; if (out) { mkdirSync(out, { recursive: true }); await page.screenshot({ path: join(out, name) }); } }
async function openPicker(page: Page) { await page.locator('[data-barre-plus]').tap(); await page.locator('[data-barre-attach=reference]').tap(); await expect(page.locator('[data-refs-sheet]')).toBeVisible(); }
async function createRef(page: Page, name: string, category: string, files: { buffer: Buffer; mimeType: string }[]) {
  await page.locator('[data-refs-new]').tap();
  await page.locator('[data-ref-name]').fill(name); await page.locator('[data-ref-category]').selectOption(category);
  await page.locator('[data-ref-photos]').setInputFiles(files.map((f, i) => ({ ...f, name: `photo-${i}.${f.mimeType === 'image/png' ? 'png' : 'webp'}` })));
  await page.locator('[data-ref-save]').tap(); await expect(page.locator('[data-ref-editor]')).toHaveCount(0);
}

test('le sélecteur de la bulle ne montre que les références nommées, sans doublon ni import brut', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  const paid: string[] = [];
  page.on('request', r => { if (r.method() === 'POST' && /\/api\/(prompt|upload\/)/.test(r.url())) paid.push(r.url()); });
  // JD's library: the same sheet imported twice under its camera name, and a loose building photo.
  await page.goto('/studio#personnage');
  for (let i = 0; i < 2; i++) {
    await page.getByLabel('Importer un personnage', { exact: true }).setInputFiles({ name: '1000052812.png', ...alien });
    await expect(page.getByText(/import/i).first()).toBeVisible();
    await page.waitForTimeout(600);
  }
  await page.goto('/studio#scene');
  await page.getByLabel('Importer un décor', { exact: true }).setInputFiles({ name: '1000052926.webp', ...batiment });
  await page.waitForTimeout(800);
  await page.goto('/studio'); await openPicker(page);
  await createRef(page, 'L’alien', 'cast', [alien]);
  await createRef(page, 'Fennec', 'cast', [creature, creature, creature]);
  await createRef(page, 'Planète rose', 'decor', [paysage]);
  await page.locator('[data-ref-search]').evaluate(e => e.scrollIntoView({ block: 'start' }));
  await shot(page, `${before ? 'avant' : 'apres'}-picker-390x844.png`);
  if (before) return;

  await expect(page.locator('[data-ref]')).toHaveCount(3);
  await expect(page.locator('[data-refs-sheet]')).not.toContainText('1000052812');
  await expect(page.locator('[data-refs-hidden]')).toBeVisible();
  // Search is kept.
  await page.locator('[data-ref-search]').fill('fen'); await expect(page.locator('[data-ref]')).toHaveCount(1); await page.locator('[data-ref-search]').fill('');
  // Edit / delete live behind a secondary menu.
  await expect(page.locator('[data-ref-edit]')).toHaveCount(0);
  await page.locator('[data-ref-menu]').first().tap();
  await expect(page.locator('[data-ref-edit]')).toHaveCount(1); await expect(page.locator('[data-ref-delete]')).toHaveCount(1);
  await page.locator('[data-ref-menu]').first().tap(); await expect(page.locator('[data-ref-edit]')).toHaveCount(0);
  // One tap attaches; reopening shows it selected; a second tap detaches.
  await page.locator('[data-ref]').filter({ hasText: 'L’alien' }).tap();
  await expect(page.locator('[data-refs-sheet]')).toHaveCount(0); await expect(page.locator('[data-barre-chip]')).toHaveCount(1);
  await page.locator('.u-barre-chip-add').tap();
  await expect(page.locator('[data-ref]').filter({ hasText: 'L’alien' })).toHaveAttribute('aria-pressed', 'true');
  
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1024, height: 600 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(size); await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    expect(await page.locator('[data-refs-sheet]').evaluate(e => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(0);
    const clipped = await page.locator('[data-refs-filters]').evaluate(e => e.scrollWidth - e.clientWidth); expect(clipped).toBeLessThanOrEqual(0);
    const small = await page.locator('[data-refs-sheet]').evaluate(el => [...el.querySelectorAll<HTMLElement>('button,input:not([hidden])')].filter(e => e.getClientRects().length).filter(e => e.getBoundingClientRect().width < 44 || e.getBoundingClientRect().height < 44).map(e => e.outerHTML.slice(0, 120)));
    expect(small).toEqual([]);
    await shot(page, `apres-selection-${size.width}x${size.height}.png`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-ref]').filter({ hasText: 'L’alien' }).tap();
  await expect(page.locator('[data-barre-chip]')).toHaveCount(0);
  expect(paid).toEqual([]);
});
