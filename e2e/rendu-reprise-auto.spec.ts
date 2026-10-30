import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// F2 · A render sent before the tab closed is followed again by itself on the next visit, with a
// visible « Récupérer le rendu » on the page; nothing is sent twice, and a hidden page reads no status.
// Comfy Cloud is simulated at the context level: nothing leaves, nothing is spent.
const still = readFileSync('public/exemples/cast-dj.webp');

async function cloud(context: BrowserContext) {
  let prompts = 0, statuses = 0, finished = false;
  const saves = new Map<string, string>();
  await context.addInitScript(() => {
    localStorage.setItem('u-ttu-rendu', JSON.stringify({ mode: 'key', key: 'e2e-fake-key-0123456789' }));
    // Lets the test put the page in the background like a phone does.
    const w = window as unknown as { __hidden?: boolean };
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => Boolean(w.__hidden) });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (w.__hidden ? 'hidden' : 'visible') });
  });
  await context.route(/overpass|nominatim|photon|panoramax|mapillary|tiles\.openfreemap|fal\.ai/, route => route.abort());
  await context.route(/\/api\/user$/, route => route.fulfill({ json: { id: 'reprise' } }));
  await context.route(/\/api\/billing\/usage\/timeseries|customers\/balance/, route => route.fulfill({ json: { summary: { balance: { amount_micros: 500_000_000 } } } }));
  await context.route(/\/api\/upload\/image$/, route => route.fulfill({ json: { name: 'entree.webp' } }));
  await context.route(/\/api\/prompt$/, route => {
    prompts++;
    const graph = route.request().postDataJSON()?.prompt ?? {};
    const save = (Object.entries(graph) as [string, { class_type?: string }][]).find(([, node]) => /^Save/.test(String(node.class_type)))?.[0] ?? 'save';
    saves.set(`reprise-job-${prompts}`, save);
    return route.fulfill({ json: { prompt_id: `reprise-job-${prompts}`, node_errors: {} } });
  });
  await context.route(/\/api\/job\/([^/]+)\/status$/, route => { statuses++; return route.fulfill({ json: { status: finished ? 'success' : 'in_progress' } }); });
  await context.route(/\/api\/jobs\/([^/?]+)$/, route => {
    const id = route.request().url().split('/').pop() ?? '';
    return route.fulfill({ json: { status: 'success', outputs: { [saves.get(id) ?? 'save']: { images: [{ filename: `${id}.webp`, subfolder: '', type: 'output' }] } } } });
  });
  await context.route(/\/api\/jobs(\?.*)?$/, route => route.fulfill({ json: { jobs: [] } }));
  await context.route(/\/api\/view\?/, route => route.fulfill({ contentType: 'image/webp', body: still }));
  return { prompts: () => prompts, statuses: () => statuses, finish() { finished = true; } };
}

const castStep = (page: Page) => page.locator('.u-chain button').first();
const hide = (page: Page, hidden: boolean) => page.evaluate(value => {
  (window as unknown as { __hidden?: boolean }).__hidden = value;
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);

test('a render left running is followed again on return, saved without opening Crédits, never re-sent', async ({ page, context }) => {
  test.setTimeout(120_000);
  const comfy = await cloud(context);

  // 1 · Send a CAST render, then close the tab while the cloud is still working.
  await page.goto('/studio#personnage');
  await expect(page.getByRole('heading', { name: 'CAST' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nom' }).fill('Léa');
  await page.getByRole('textbox', { name: 'Texte', exact: true }).fill('Une femme de trente ans, manteau rouge, cheveux courts.');
  await page.locator('[data-cast-gold]').scrollIntoViewIfNeeded();
  await page.locator('[data-cast-gold]').click();
  await page.locator('[data-create-confirm]').click();
  await expect.poll(comfy.prompts, { timeout: 20_000 }).toBe(1);
  // The receipt that lets a later visit follow this job (no second POST).
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('u-ttu-operation') ?? '{}').jobId ?? null)).toBe('reprise-job-1');
  await page.close();

  // 2 · Come back: the studio says it follows the render, and the recovery button is on the page.
  const back = await context.newPage();
  await back.goto('/studio#personnage');
  const banner = back.locator('[data-rendu-suivi]');
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await expect(banner).toHaveAttribute('data-rendu-suivi', /queue|prepare|render/);
  const recover = banner.getByRole('button', { name: 'Récupérer le rendu' });
  await expect(recover).toBeVisible();
  const box = await recover.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await expect(castStep(back)).toHaveAttribute('data-state', 'vide');

  // 3 · In the background: no status reads at all.
  await hide(back, true);
  const before = comfy.statuses();
  await back.waitForTimeout(5_000);
  expect(comfy.statuses() - before).toBe(0);

  // 4 · The cloud finishes; back in the foreground the result is saved at once, without a tap.
  comfy.finish();
  await hide(back, false);
  await expect(castStep(back)).toHaveAttribute('data-state', 'pret', { timeout: 6_000 });
  await expect(banner).toHaveCount(0, { timeout: 6_000 });
  expect(comfy.prompts()).toBe(1);
});
