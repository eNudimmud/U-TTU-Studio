import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simulateComfy } from './helpers/film2-comfy';

// U1.1 behind ?storyboard=u11. Comfy is simulated: the path under test never POSTs a paid job.
// JD's sentence must keep Blanche Of Castille as a place, and a close-up or "remove the rain"
// must not move or delete a shot.

const OUT = process.env.U11_SHOTS || '/opt/cursor/artifacts/u11';
const JD = 'Enki and Fizz meet at night in Blanche Of Castille; Enki hands Fizz a glowing golden thread while rain falls outside.';
const GENERIC = /^(The place|The moment|Arrival|A detail|The look|Opening|Heart|Ending)$/;

function castNote(name: string, photos: string[]): string {
  const list = photos.length ? `photos:\n${photos.map(path => `  - ${JSON.stringify(path)}`).join('\n')}` : 'photos: []';
  return `---
type: cast
date: "2026-11-01T00:00:00.000Z"
prompt: "A fictional character."
moteur: comfy
template: image_flux3_klein_t2i
devis: 4
cout: null
source: texte
statut: pret
nom: ${JSON.stringify(name)}
projet: atelier
sheet: null
${list}
vues: []
geste: ""
---
# ${name}
`;
}

function placeNote(name: string): string {
  return `---
type: lieu
projet: atelier
statut: brouillon
gesture: scene
nom: ${JSON.stringify(name)}
note: "A place."
images: []
---
# ${name}
`;
}

async function seed(page: Page) {
  const rows = [
    { path: '.uttu/projet.json', text: '{"actif":"atelier"}\n' },
    { path: 'Projets/atelier/_MOC.md', text: '# Atelier\n' },
    { path: 'Projets/atelier/Cast/enki.md', text: castNote('Enki', ['Projets/atelier/Cast/enki-1.webp', 'Projets/atelier/Cast/enki-2.webp', 'Projets/atelier/Cast/enki-3.webp']) },
    { path: 'Projets/atelier/Cast/fizz.md', text: castNote('Fizz', ['Projets/atelier/Cast/fizz-1.webp', 'Projets/atelier/Cast/fizz-2.webp', 'Projets/atelier/Cast/fizz-3.webp']) },
    { path: 'Projets/atelier/Lieux/blanche-of-castille.md', text: placeNote('Blanche Of Castille') },
    { path: 'Projets/atelier/Lieux/forest-at-dawn.md', text: placeNote('Forest at dawn') },
  ];
  await page.evaluate(async entries => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('uttu-coffre', 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains('files')) open.result.createObjectStore('files', { keyPath: 'path' });
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        for (const entry of entries) store.put({ ...entry, updatedAt: Date.now() });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, rows);
}

async function noOverflow(page: Page) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(extra, 'horizontal overflow').toBeLessThanOrEqual(1);
}

async function targets44(page: Page) {
  const small = await page.locator('[data-theme="obsidian"] :is(button, a, input, select, textarea, summary):visible').evaluateAll(nodes => nodes
    .filter(node => !(node as HTMLElement).closest('[aria-hidden="true"]'))
    .map(node => {
      const box = node.getBoundingClientRect();
      return { box, label: (node.getAttribute('aria-label') || node.textContent || node.tagName).trim().slice(0, 48), type: (node as HTMLInputElement).type };
    })
    .filter(item => item.type !== 'checkbox' && item.box.width > 0 && Math.min(item.box.height, item.box.width) < 43.5)
    .map(item => `${item.label} ${Math.round(item.box.width)}×${Math.round(item.box.height)}`));
  expect(small, 'targets under 44 px').toEqual([]);
}

test('U1.1: JD sentence, close-up and rain stay structural no-ops, zero paid POST', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the viewports are set in this test');
  test.setTimeout(180_000);
  mkdirSync(OUT, { recursive: true });
  const paid: string[] = [];
  page.on('request', request => {
    if (request.method() !== 'POST') return;
    if (/\/api\/prompt|fal\.ai|cloud\.comfy\.org\/api\/prompt/i.test(request.url())) paid.push(request.url());
  });
  await simulateComfy(page);
  await page.addInitScript(() => localStorage.setItem('u-ttu-locale', 'en'));
  await page.context().addCookies([{ name: 'u-ttu-locale', value: 'en', url: 'http://127.0.0.1:3000' }]);

  const shot = async (name: string) => {
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => undefined);
    const size = page.viewportSize()!;
    const file = `${size.width}x${size.height}-${name}.png`;
    await page.screenshot({ path: join(OUT, file) });
    await page.screenshot({ path: info.outputPath(file) });
  };

  for (const [width, height] of [[390, 844], [1280, 800]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/storyboard?storyboard=u11');
    await expect(page.locator('[data-storyboard-page][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
    await seed(page);
    await page.reload();
    await expect(page.locator('[data-u11][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-u11-phase="write"]')).toBeVisible();
    await page.locator('[data-u11-add]').click();
    await expect(page.locator('[data-u11-picker] [role="option"]').filter({ hasText: 'Enki' })).toBeVisible();
    await expect(page.locator('[data-u11-picker] [role="option"]').filter({ hasText: 'Fizz' })).toBeVisible();
    await expect(page.locator('[data-u11-picker] [role="option"]').filter({ hasText: 'Blanche Of Castille' })).toBeVisible();
    await expect(page.locator('[data-u11-picker] h6').first()).toHaveText(/Characters|Personnages|Figuren|Personajes/);
    await page.locator('[data-u11-story]').fill(JD);
    await expect(page.locator('[data-u11-chip="qui"]')).toHaveCount(2);
    await expect(page.locator('[data-u11-chip="ou"]')).toHaveText(/Blanche Of Castille/);
    await page.keyboard.press('Escape');
    await shot('step1-write');
    await noOverflow(page);
    await targets44(page);

    await page.locator('[data-u11-write]').click();
    await expect(page.locator('[data-u11-phase="work"]')).toBeVisible();
    await expect(page.locator('[data-u11-phase="work"]')).toContainText(/0 credits/);
    await shot('step2-working');
    await expect(page.locator('[data-u11-phase="plan"]')).toBeVisible({ timeout: 20_000 });
    const titles = page.locator('[data-u11-title]');
    await expect(titles.first()).toBeVisible();
    const before = await titles.allTextContents();
    expect(before.length).toBeGreaterThanOrEqual(2);
    for (const title of before) expect(title).not.toMatch(GENERIC);
    expect(before.some(title => /Enki/i.test(title))).toBeTruthy();
    await expect(page.locator('[data-u11-role="qui"]')).toHaveCount(2);
    await expect(page.locator('[data-u11-role="ou"]')).toContainText('Blanche Of Castille');
    expect((await page.locator('[data-u11-role="qui"]').allTextContents()).join(' ')).not.toMatch(/Blanche|Castille/);
    await expect(page.locator('[data-u11-quote]')).toContainText(/≈\s*[\d.,]+\s*credits estimated/i);
    await shot('step3-plan');
    await noOverflow(page);

    await page.locator('[data-u11-ask]').fill('Make it a close-up');
    await page.locator('[data-u11-ask]').press('Enter');
    await expect(page.locator('[data-u11-reply]').last()).toContainText(/close-up|every shot/i);
    expect((await page.locator('[data-u11-reply]').allTextContents()).join('\n')).not.toMatch(/did not catch/i);
    await expect(titles).toHaveText(before);
    await expect(page.locator('[data-u11-shot]')).toHaveCount(before.length);
    await expect(page.locator('[data-u11-framing]').first()).toHaveText(/Close/);
    await page.locator('[data-u11-reply]').last().scrollIntoViewIfNeeded();
    await shot('step3b-edit');

    await page.locator('[data-u11-ask]').fill('Remove the rain');
    await page.locator('[data-u11-ask]').press('Enter');
    await expect(page.locator('[data-u11-reply]').last()).toContainText(/Nothing was removed or moved/);
    expect((await page.locator('[data-u11-reply]').allTextContents()).join('\n')).not.toMatch(/did not catch/i);
    await expect(titles).toHaveText(before);
    await expect(page.locator('[data-u11-shot]')).toHaveCount(before.length);
    await expect(page.locator('[data-u11-undo]').last()).toBeVisible();

    await page.locator('[data-u11-play]').click();
    await expect(page.locator('[data-u11-animatic]')).toBeVisible();
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-u11-anim-close]')?.click());
    await expect(page.locator('[data-u11-animatic]')).toHaveCount(0);

    await page.locator('[data-u11-approve]').click();
    await expect(page.locator('[data-u11-approve-sheet]')).toBeVisible();
    await expect(page.locator('[data-u11-total]')).toContainText(/≈\s*[\d.,]+\s*credits estimated/i);
    await expect(page.locator('[data-u11-start]')).toBeEnabled();
    await shot('step4-approve');
    await noOverflow(page);
    await targets44(page);
    expect(paid, 'no paid Comfy POST').toEqual([]);
    await page.locator('[data-u11-back]').click();
  }

  for (const [width, height] of [[844, 390], [1024, 600]] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('[data-u11-phase="plan"]')).toBeVisible();
    await noOverflow(page);
    await targets44(page);
  }
  expect(paid, 'no paid Comfy POST after the whole pass').toEqual([]);
});
