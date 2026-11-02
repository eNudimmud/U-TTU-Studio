import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { simulateComfy } from './helpers/film2-comfy';

// B2: a simulated storyboard shot is filed on its plan and on the cut once, even if the page
// is left while the job is still running. Comfy is mocked. Nothing is spent and nothing is cancelled.

const still = readFileSync('public/exemples/cast-dj.webp').toString('base64');

function castNote(id: string, name: string): string {
  const photo = `Projets/atelier/Cast/${id}.webp`;
  return `---
type: cast
date: "2026-11-02T00:00:00.000Z"
prompt: "A person."
moteur: comfy
template: image_flux3_klein_t2i
devis: 4
cout: null
source: texte
statut: pret
nom: ${JSON.stringify(name)}
projet: atelier
sheet: null
photos:
  - ${JSON.stringify(photo)}
vues: []
geste: ""
---
# ${name}
`;
}

function lieuNote(): string {
  return `---
type: lieu
projet: atelier
statut: brouillon
nom: "Harbour"
note: "A terrace."
images:
  - "Projets/atelier/Lieux/harbour.webp"
---
# Harbour
`;
}

const board = {
  version: 1,
  id: 'quai',
  titre: 'Terrace',
  idee: 'Two shots.',
  logline: '',
  scenario: '',
  format: 'paysage',
  dureeCible: 30,
  musique: '',
  archive: false,
  creeLe: '2026-11-02T00:00:00.000Z',
  majLe: '2026-11-02T00:00:00.000Z',
  sequences: [{
    id: 's1',
    titre: 'Terrace',
    resume: '',
    plans: [
      { id: 'p1', titre: 'Opening', action: 'Ada waits on the terrace.', refs: [{ role: 'qui', nom: 'Ada', id: 'ada' }, { role: 'ou', nom: 'Harbour', id: 'harbour' }], cadrage: 'large', camera: 'fixe', duree: 5, format: 'paysage', rendu: 'fidele', planFilmId: 'sb-quai-p1', etat: 'a-tourner' },
      { id: 'p2', titre: 'Arrival', action: 'Pip sits beside Ada.', refs: [{ role: 'qui', nom: 'Pip', id: 'pip' }, { role: 'ou', nom: 'Harbour', id: 'harbour' }], cadrage: 'moyen', camera: 'fixe', duree: 5, format: 'paysage', rendu: 'fidele', planFilmId: 'sb-quai-p2', etat: 'a-tourner' },
    ],
  }],
};

async function seed(page: Page) {
  await page.evaluate(async ({ picture, boardText }) => {
    const bytes = Uint8Array.from(atob(picture), char => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'image/webp' });
    const rows: { path: string; text?: string; blob?: Blob }[] = [
      { path: '.uttu/projet.json', text: '{"actif":"atelier"}\n' },
      { path: 'Projets/atelier/_MOC.md', text: '# Atelier\n' },
      { path: 'Projets/atelier/Cast/ada.md', text: boardText.ada },
      { path: 'Projets/atelier/Cast/pip.md', text: boardText.pip },
      { path: 'Projets/atelier/Cast/ada.webp', blob },
      { path: 'Projets/atelier/Cast/pip.webp', blob },
      { path: 'Projets/atelier/Lieux/harbour.md', text: boardText.lieu },
      { path: 'Projets/atelier/Lieux/harbour.webp', blob },
      { path: 'Projets/atelier/Storyboard/quai.md', text: '# Terrace\n' },
      { path: 'Projets/atelier/.uttu/sb-quai.json', text: boardText.board },
    ];
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('uttu-coffre', 1);
      open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains('files')) open.result.createObjectStore('files', { keyPath: 'path' }); };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('files', 'readwrite');
        for (const row of rows) tx.objectStore('files').put({ ...row, updatedAt: Date.now() });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, { picture: still, boardText: { ada: castNote('ada', 'Ada'), pip: castNote('pip', 'Pip'), lieu: lieuNote(), board: JSON.stringify(board) } });
}

async function registre(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const text = await new Promise<string>((resolve, reject) => {
      const open = indexedDB.open('uttu-coffre', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('files', 'readonly');
        const req = tx.objectStore('files').get('Projets/atelier/.uttu/registre-plans.json');
        req.onsuccess = () => { db.close(); resolve(String(req.result?.text ?? '')); };
        req.onerror = () => reject(req.error);
      };
    });
    return text;
  });
}

test('a simulated shot left mid-render is on that shot and on the cut once', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one desktop run');
  test.setTimeout(180_000);
  const comfy = await simulateComfy(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/storyboard?storyboard=legacy');
  await expect(page.locator('[data-storyboard-page][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await seed(page);
  await page.goto('/storyboard/quai?storyboard=legacy');
  await expect(page.locator('[data-storyboard-page][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await page.locator('[data-sb-select="p2"]').click();
  const film = page.locator('[data-sb-film="p2"]');
  await expect(film).toBeVisible({ timeout: 30_000 });
  await film.click();
  await page.locator('[data-sb-start]').click();
  await expect.poll(() => comfy.prompts.filter(item => item.kind === 'video').length, { timeout: 30_000 }).toBe(1);
  // Leave while the mocked job is still in progress. Do not cancel it.
  await page.goto('/studio');
  await expect(page.locator('[data-barre]')).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => registre(page), { timeout: 40_000 }).toContain('sb-quai-p2');

  await page.goto('/storyboard/quai?storyboard=legacy');
  await expect(page.locator('[data-storyboard-page][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-sb-filmed]')).toContainText('1 / 2');
  await expect(page.locator('[data-sb-select="p2"]')).toHaveAttribute('data-sb-etat', 'tourne');
  await expect(page.locator('[data-sb-select="p1"]')).toHaveAttribute('data-sb-etat', 'a-tourner');
  await page.locator('[data-sb-select="p2"]').click();
  await expect(page.locator('[data-sb-open="p2"]')).toContainText(/Prise/);

  const filed = JSON.parse(await registre(page)) as { plans: { id: string; prises: { id: string }[] }[]; montage: { clips: { planId: string; priseId: string }[] } };
  const shot = filed.plans.find(plan => plan.id === 'sb-quai-p2');
  assertOne(shot?.prises.length, filed.plans.find(plan => plan.id === 'sb-quai-p1')?.prises.length ?? 0, filed.montage.clips);

  await page.goto('/studio#montage');
  await expect(page.locator('[data-film-montage] video')).toHaveCount(1, { timeout: 30_000 });
  await page.reload();
  await expect(page.locator('[data-film-montage] video')).toHaveCount(1, { timeout: 30_000 });
  expect(comfy.prompts.filter(item => item.kind === 'video')).toHaveLength(1);
  expect(comfy.prompts.filter(item => item.kind === 'image')).toHaveLength(0);
});

function assertOne(onShot: number | undefined, onOther: number, clips: { planId: string; priseId: string }[]) {
  expect(onShot).toBe(1);
  expect(onOther).toBe(0);
  expect(clips.filter(clip => clip.planId === 'sb-quai-p2')).toHaveLength(1);
  expect(clips.some(clip => clip.planId === 'sb-quai-p1')).toBe(false);
}
