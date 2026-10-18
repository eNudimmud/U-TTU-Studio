import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { simulateComfy } from './helpers/simulate-comfy';

// P1 · 3 shots: one sentence per shot, the production memory carries Léa's outfit from A-01 to A-02, A-03 changes it.
// Neutral fixture names, test code only: the app seeds no example project.
const lea = readFileSync('public/exemples/cast-coursiere.webp');
const lab = readFileSync('public/exemples/decor-couloir.webp');
const SENTENCE = "Léa traverse lentement le laboratoire, caméra à l'épaule, ambiance VHS 1994";

async function vault(page: Page) {
  return page.evaluate(() => new Promise<{ path: string; text?: string }[]>((resolve, reject) => {
    const open = indexedDB.open('uttu-coffre');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('files').objectStore('files').getAll();
      request.onsuccess = () => { resolve(request.result.map(entry => ({ path: entry.path, text: entry.text }))); db.close(); };
      request.onerror = () => { reject(request.error); db.close(); };
    };
  }));
}

test('mémoire de production · 3 plans : A-02 et A-03 héritent de la tenue, A-03 la change', async ({ page }, info) => {
  test.setTimeout(240_000);
  const comfy = await simulateComfy(page);
  const dir = process.env.P1_SHOTS_DIR;
  if (dir) mkdirSync(dir, { recursive: true });
  const width = page.viewportSize()?.width ?? 1280;
  const prefix = `p1-${width < 800 ? 'm' : 'd'}${width}`;
  let n = 0;
  async function snap(name: string) {
    n += 1;
    const file = `${String(n).padStart(2, '0')}-${name}.png`;
    await page.waitForTimeout(350);
    await page.screenshot({ path: info.outputPath(file) });
    if (dir) await page.screenshot({ path: join(dir, `${prefix}-${file}`) });
  }
  const nav = (name: string) => page.getByRole('navigation').getByRole('button', { name });
  const text = page.getByRole('textbox', { name: 'Ce qui se passe', exact: true });
  const gold = page.locator('.u-prise-actions .u-primary');

  // A character and a place, imported (free). The memory is built from them on first open.
  await page.goto('/studio#personnage');
  await page.getByLabel('Importer un personnage', { exact: true }).setInputFiles({ name: 'Léa.webp', mimeType: 'image/webp', buffer: lea });
  await expect(nav('CAST')).toContainText('Prêt');
  await nav('DÉCOR').click();
  await page.getByLabel('Importer un décor', { exact: true }).setInputFiles({ name: 'Le laboratoire.webp', mimeType: 'image/webp', buffer: lab });
  await expect(nav('DÉCOR')).toContainText('Prêt');
  await nav('PRISE').click();
  await expect(page.locator('[data-prise-ready]')).toBeVisible({ timeout: 30_000 });

  // A-01: one sentence → chips, U*TTU's line; set Léa's outfit from here.
  await text.fill(SENTENCE);
  const chips = page.locator('[data-intention]');
  await expect(chips.locator('[data-chip="qui"]')).toContainText('Léa');
  await expect(chips.locator('[data-chip="ou"]')).toContainText('Le laboratoire');
  await expect(chips.locator('[data-chip="camera"]')).toContainText('caméra à l’épaule');
  await expect(chips.locator('[data-chip="ambiance"]')).toContainText('VHS 1994');
  await expect(chips.locator('[data-chip="inconnu"]')).toHaveCount(0);
  await expect(page.locator('[data-uttu-dit]')).toContainText('Caméra à l’épaule');
  const cont = page.locator('[data-cont="Léa"]');
  await expect(cont).toContainText('Léa · aucun état');
  await cont.locator('[data-changer-etat]').click();
  await cont.locator('input').fill('tenue de chasseur');
  await cont.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(cont).toContainText('✓ Léa · tenue de chasseur · depuis A-01');
  await page.locator('[data-intention]').evaluate(element => element.scrollIntoView({ block: 'center' }));
  await snap('a01-intention');
  await gold.click();
  await expect(page.locator('dialog [data-fiabilite]')).toContainText('tenue de chasseur');
  await expect(page.locator('dialog [data-fiabilite]')).toContainText('VHS 1994');
  await snap('a01-confirmation');
  await page.locator('[data-confirm-gold]').click();
  await expect(page.locator('[data-take-view] video')).toBeVisible({ timeout: 60_000 });
  const p1 = comfy.prompts.filter(item => item.kind === 'video').at(-1)?.text ?? '';
  expect(p1).toContain('Léa: tenue de chasseur');
  expect(p1).toContain('VHS camcorder look from 1994');

  // A-02: the next plan inherits the outfit without being told.
  await page.getByRole('textbox', { name: 'Plan suivant : ce qui se passe' }).fill('Léa ouvre la porte du laboratoire, travelling avant');
  await gold.click();
  await expect(page.locator('dialog [data-fiabilite]')).toContainText('Léa · tenue de chasseur (A-01)');
  await page.locator('[data-confirm-gold]').click();
  await expect(page.locator('#u-title')).toHaveText('Plan 2');
  await expect(page.locator('[data-take-view] video')).toBeVisible({ timeout: 60_000 });
  expect(comfy.prompts.filter(item => item.kind === 'video').at(-1)?.text ?? '').toContain('Léa: tenue de chasseur');
  await expect(cont).toContainText('✓ Léa · tenue de chasseur · depuis A-01');

  // A-03: inherits, then the outfit changes from this shot on.
  await page.locator('.u-plan-add').click();
  await expect(page.locator('#u-title')).toHaveText('Plan 3');
  await text.fill("La caméra tourne autour de Léa à 90°, dans le laboratoire");
  await expect(cont).toContainText('✓ Léa · tenue de chasseur · depuis A-01');
  await expect(page.locator('[data-uttu-dit]')).toContainText('Rotation de 90° autour de Léa.');
  await expect(page.locator('[data-uttu-dit]')).toContainText('Ce style ne garantit pas ce mouvement au centimètre.');
  await cont.locator('[data-changer-etat]').click();
  await cont.locator('input').fill('combinaison de labo');
  await cont.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(cont).toContainText('✓ Léa · combinaison de labo · depuis A-03');
  await page.locator('[data-intention]').evaluate(element => element.scrollIntoView({ block: 'center' }));
  await snap('a03-changement');
  await gold.click();
  await expect(page.locator('dialog [data-fiabilite]')).toContainText('Léa · combinaison de labo (A-03)');
  await page.locator('[data-confirm-gold]').click();
  await expect(page.locator('[data-take-view] video')).toBeVisible({ timeout: 60_000 });
  const p3 = comfy.prompts.filter(item => item.kind === 'video').at(-1)?.text ?? '';
  expect(p3).toContain('Léa: combinaison de labo');
  expect(p3).not.toContain('tenue de chasseur');
  expect(p3).toContain('orbits 90 degrees');
  await snap('a03-arrivee');

  // A-02 keeps its own outfit; the memory is in the vault as JSON and Obsidian notes.
  await page.locator('.u-plan-card[data-plan="plan-02"]').click();
  await expect(cont).toContainText('✓ Léa · tenue de chasseur · depuis A-01');
  if (process.env.P1_DEBUG) console.log((await vault(page)).map(entry => entry.path).filter(path => /memoire|Memoire/.test(path)), await page.locator('[data-statut-inline]').allTextContents());
  await expect.poll(async () => (await vault(page)).find(entry => entry.path.endsWith('/Memoire/Personnage-lea.md'))?.text ?? '', { timeout: 10_000 })
    .toMatch(/depuis A-01 : tenue de chasseur[\s\S]*depuis A-03 : combinaison de labo/);
  const memory = JSON.parse((await vault(page)).find(entry => entry.path.endsWith('/.uttu/memoire.json'))?.text ?? '{}');
  expect(memory.characters.some((item: { name: string }) => item.name === 'Léa')).toBe(true);
  expect(memory.history.filter((event: { kind: string }) => event.kind === 'generation')).toHaveLength(3);
  expect(comfy.prompts.filter(item => item.kind === 'video')).toHaveLength(3);
  await page.locator('[data-avance-prise] > summary').click();
  await page.locator('[data-memoire] > summary').click();
  await page.locator('[data-memoire]').scrollIntoViewIfNeeded();
  await snap('memoire-etats');
});
