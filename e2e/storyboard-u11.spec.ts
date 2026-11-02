import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { STORYBOARD_CLOSED } from '../src/app/storyboard/closed';
import { simulateComfy } from './helpers/film2-comfy';

test.beforeEach(() => {
  test.skip(STORYBOARD_CLOSED, 'the storyboard is closed until StoryWeave; flip STORYBOARD_CLOSED in src/app/storyboard/closed.ts');
});

// The agent is mocked: TextGenerate answers are local JSON. No request leaves for Comfy or fal.
// Stories vary (French, two places, no dialogue, an unknown name). U1.1 is the default; ?storyboard=u11 still opens it.

const OUT = process.env.U11_SHOTS || '/opt/cursor/artifacts/u11';

function note(kind: 'cast' | 'lieu', name: string): string {
  if (kind === 'cast') return `---
type: cast
date: "2026-11-01T00:00:00.000Z"
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
photos: []
vues: []
geste: ""
---
# ${name}
`;
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

async function seed(page: Page, files: { path: string; text: string }[]) {
  const rows = [{ path: '.uttu/projet.json', text: '{"actif":"atelier"}\n' }, { path: 'Projets/atelier/_MOC.md', text: '# Atelier\n' }, ...files];
  await page.evaluate(async entries => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('uttu-coffre', 1);
      open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains('files')) open.result.createObjectStore('files', { keyPath: 'path' }); };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('files', 'readwrite');
        for (const entry of entries) tx.objectStore('files').put({ ...entry, updatedAt: Date.now() });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, rows);
}

function answerFor(prompt: string, nth: number, invalidFirst: boolean): string {
  if (invalidFirst && nth === 1) return 'not json';
  const project = /"projectId":"([^"]+)"/.exec(prompt)?.[1] ?? 'atelier';
  const board = /"storyboardId":"([^"]+)"/.exec(prompt)?.[1] ?? 'board';
  const refs = [...prompt.matchAll(/"category":"(cast|decor)","locked":(?:true|false),"name":"([^"]*)","referenceId":"([^"]+)"/g)]
    .map(match => ({ category: match[1]!, name: match[2]!, id: match[3]! }));
  const shotIds = [...prompt.matchAll(/"shotId":"([^"]+)"/g)].map(match => match[1]!);
  if (prompt.includes('Apply the request') && shotIds[0]) {
    return JSON.stringify({
      creativeGoal: 'Change', expectedResult: 'Framing only', rationale: 'The request is about framing.',
      operations: [{ kind: 'shot.patch', target: { projectId: project, storyboardId: board, shotId: shotIds[0], expectedRevision: 0 }, patch: { cadrage: 'serre' } }],
      unresolved: [],
    });
  }
  const cast = refs.filter(ref => ref.category === 'cast');
  const decor = refs.filter(ref => ref.category === 'decor');
  const first = { titre: 'Opening on the first place', action: 'Wide on the first place.', duree: 5, cadrage: 'large', camera: 'fixe', refs: [cast[0] && { role: 'qui', referenceId: cast[0].id, name: cast[0].name }, decor[0] && { role: 'ou', referenceId: decor[0].id, name: decor[0].name }].filter(Boolean) };
  const second = { titre: 'The second place, no words', action: 'They cross the second place in silence.', duree: 5, refs: [cast[1] && { role: 'qui', referenceId: cast[1].id, name: cast[1].name }, decor[1] && { role: 'ou', referenceId: decor[1].id, name: decor[1].name }].filter(Boolean), dialogue: { type: 'aucune', qui: null, texte: '' } };
  if (prompt.includes('Sacha')) (first.refs as { role: string; name: string }[]).push({ role: 'qui', name: 'Sacha' });
  return JSON.stringify({
    creativeGoal: 'Two places', expectedResult: 'A plan', rationale: 'From the library.',
    operations: [{ kind: 'storyboard.create', scope: { projectId: project, storyboardId: board }, shots: [first, second] }],
    unresolved: [],
  });
}

async function mockAgent(page: Page, invalidFirst = false) {
  const answers = new Map<string, string>();
  let n = 0;
  const posts: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && /fal\.ai|cloud\.comfy\.org/i.test(request.url())) posts.push(request.url());
  });
  await page.route(/\/api\/prompt$/, async route => {
    const graph = (route.request().postDataJSON()?.prompt ?? {}) as Record<string, { class_type?: string; inputs?: { prompt?: string } }>;
    const node = Object.values(graph).find(item => item?.class_type === 'TextGenerate');
    if (!node) return route.fallback();
    const id = `u11-text-${++n}`;
    answers.set(id, answerFor(String(node.inputs?.prompt ?? ''), n, invalidFirst));
    return route.fulfill({ json: { prompt_id: id, node_errors: {} } });
  });
  await page.route(/\/api\/job\/([^/]+)\/status$/, async route => {
    const id = /job\/([^/]+)\/status/.exec(route.request().url())?.[1] ?? '';
    if (!answers.has(id)) return route.fallback();
    return route.fulfill({ json: { status: 'success' } });
  });
  await page.route(/\/api\/jobs\/([^/?]+)$/, async route => {
    const id = route.request().url().split('/').pop()?.split('?')[0] ?? '';
    const text = answers.get(id);
    if (!text) return route.fallback();
    return route.fulfill({ json: { status: 'success', outputs: { '3': { text: [text] } } } });
  });
  return { posts, answers };
}

async function ready(page: Page) {
  await page.goto('/storyboard');
  await expect(page.locator('[data-storyboard-page][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
}

const SIZES = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1024, height: 600 },
  { width: 1280, height: 800 },
] as const;

async function target44(page: Page, selector: string) {
  const node = page.locator(selector).first();
  await node.scrollIntoViewIfNeeded();
  const box = await node.boundingBox();
  expect(box, selector).toBeTruthy();
  expect(box!.height, `${selector} height`).toBeGreaterThanOrEqual(44);
  expect(box!.width, `${selector} width`).toBeGreaterThanOrEqual(44);
}

test('U1.1 agent: varied stories, a proposal, a diff, no external paid call', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one browser, viewports set here');
  test.setTimeout(180_000);
  mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => localStorage.setItem('u-ttu-locale', 'en'));
  await page.context().addCookies([{ name: 'u-ttu-locale', value: 'en', url: 'http://127.0.0.1:3000' }]);
  await simulateComfy(page);
  const agent = await mockAgent(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await seed(page, [
    { path: 'Projets/atelier/Cast/lea.md', text: note('cast', 'Léa') },
    { path: 'Projets/atelier/Cast/noe.md', text: note('cast', 'Noé') },
    { path: 'Projets/atelier/Lieux/le-port.md', text: note('lieu', 'Le port') },
    { path: 'Projets/atelier/Lieux/le-marche.md', text: note('lieu', 'Le marché') },
  ]);
  await page.reload();
  await expect(page.locator('[data-u11][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-u11-agent-cost]')).toContainText(/≈\s*3\s*credits estimated/i);
  await expect(page.locator('[data-u11-phase="write"]')).not.toContainText(/0 credits/);
  const shot = async (name: string) => {
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => undefined);
    const size = page.viewportSize()!;
    await page.screenshot({ path: join(OUT, `${size.width}x${size.height}-${name}.png`) });
    await page.screenshot({ path: info.outputPath(`${size.width}x${size.height}-${name}.png`) });
  };
  await page.locator('[data-u11-story]').fill('Léa et Noé se retrouvent au port, puis ils traversent le marché sans un mot.');
  await shot('step1-write');
  await page.locator('[data-u11-write]').click();
  await expect(page.locator('[data-u11-phase="work"]')).toContainText(/Asking Uttu|credits estimated|Comfy/i);
  await shot('step2-working');
  await expect(page.locator('[data-u11-phase="plan"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-u11-title]')).toHaveText(['Opening on the first place', 'The second place, no words']);
  await expect(page.locator('[data-u11-role="ou"]')).toHaveCount(2);
  await expect(page.locator('[data-u11-role="qui"]')).toHaveCount(2);
  await expect(page.locator('[data-u11-facts]')).toContainText(/2 places/);
  await expect(page.locator('[data-u11-plan]')).not.toContainText('Sacha');
  await shot('step3-plan');

  const before = await page.locator('[data-u11-title]').allTextContents();
  await page.locator('[data-u11-ask]').fill('Tighten the opening');
  await page.locator('[data-u11-ask]').press('Enter');
  await expect(page.locator('[data-u11-preview]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-u11-title]')).toHaveText(before);
  await expect(page.locator('[data-u11-framing]').first()).not.toHaveText('Close');
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await target44(page, '[data-u11-apply]');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-u11-apply]').click();
  await expect(page.locator('[data-u11-preview]')).toHaveCount(0);
  await expect(page.locator('[data-u11-title]')).toHaveText(before);
  await expect(page.locator('[data-u11-framing]').first()).toHaveText('Close');
  await expect(page.locator('[data-u11-refusal]')).toHaveCount(0);
  await shot('step3b-edit');
  await target44(page, '[data-u11-undo]');
  await page.locator('[data-u11-undo]').click();
  await expect(page.locator('[data-u11-framing]').first()).toHaveText('Wide');
  await expect(page.locator('[data-u11-title]')).toHaveText(before);
  await page.locator('[data-u11-approve]').click();
  await expect(page.locator('[data-u11-total]')).toContainText(/credits estimated/i);
  await shot('step4-approve');
  expect(agent.posts, 'no external paid host').toEqual([]);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('[data-u11-back]').click();
  await shot('step3-plan');
  await page.locator('[data-u11-approve]').click();
  await shot('step4-approve');
});

test('an unknown name is a question, and a bad answer is one POST until the visitor re-reads', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop project only');
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem('u-ttu-locale', 'en'));
  await page.context().addCookies([{ name: 'u-ttu-locale', value: 'en', url: 'http://127.0.0.1:3000' }]);
  await simulateComfy(page);
  const agent = await mockAgent(page, true);
  await ready(page);
  await seed(page, [
    { path: 'Projets/atelier/Cast/mina.md', text: note('cast', 'Mina') },
    { path: 'Projets/atelier/Cast/otto.md', text: note('cast', 'Otto') },
    { path: 'Projets/atelier/Lieux/harbour.md', text: note('lieu', 'The harbour') },
    { path: 'Projets/atelier/Lieux/market.md', text: note('lieu', 'The market') },
  ]);
  await page.reload();
  await expect(page.locator('[data-u11][data-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await page.locator('[data-u11-story]').fill('Mina meets Otto at the harbour. Sacha is there too. Then the market, and nobody speaks.');
  await page.locator('[data-u11-write]').click();
  await expect(page.locator('[data-u11-phase="plan"]')).toBeVisible({ timeout: 40_000 });
  expect(agent.answers.size, 'an invalid answer is exactly one agent POST').toBe(1);
  await expect(page.locator('[data-u11-reading]')).toContainText(/could not read|understanding is limited/i);
  const reread = page.locator('[data-u11-reread]');
  await expect(reread).toContainText(/Re-read with Uttu/i);
  await expect(reread).toContainText(/≈\s*3\s*credits estimated/i);
  await expect(reread).not.toContainText(/\bfree\b/i);
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await target44(page, '[data-u11-reread]');
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await reread.click();
  await expect(page.locator('[data-u11-proposals]')).toContainText('Sacha', { timeout: 40_000 });
  expect(agent.answers.size, 'the re-read is a second approval, not a silent retry').toBe(2);
  expect((await page.locator('[data-u11-role="qui"]').allTextContents()).join(' ')).not.toContain('Sacha');
  await page.locator('[data-u11-proposal="qui"]').click();
  await expect(page.locator('[data-u11-plan]')).toContainText('Sacha');
  expect(agent.posts).toEqual([]);
});

test('without a Comfy account the page says understanding is limited and does not POST', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop project only');
  test.setTimeout(90_000);
  const posts: string[] = [];
  page.on('request', request => { if (request.method() === 'POST' && /\/api\/prompt|fal\.ai|cloud\.comfy\.org/i.test(request.url())) posts.push(request.url()); });
  await page.addInitScript(() => localStorage.setItem('u-ttu-locale', 'en'));
  await page.context().addCookies([{ name: 'u-ttu-locale', value: 'en', url: 'http://127.0.0.1:3000' }]);
  await ready(page);
  await expect(page.locator('[data-u11-phase="write"]')).toContainText(/understanding is limited/i);
  await expect(page.locator('[data-u11-agent-cost]')).toHaveCount(0);
  await page.locator('[data-u11-story]').fill('A person walks through a city at dawn, then waits.');
  await page.locator('[data-u11-write]').click();
  await expect(page.locator('[data-u11-reading]')).toContainText(/understanding is limited/i, { timeout: 20_000 });
  await expect(page.locator('[data-u11-title]').first()).toBeVisible();
  expect(posts).toEqual([]);
});
