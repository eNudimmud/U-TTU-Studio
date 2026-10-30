import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// F3 · A second paid send while the first render is still running in the cloud is refused with the
// true reason (« encore en cours dans le cloud : Léa »), not « attend encore sa récupération ».
// Nothing is sent twice. Comfy Cloud is simulated: nothing leaves, nothing is spent.
const still = readFileSync('public/exemples/cast-dj.webp');

async function cloud(context: BrowserContext) {
  let prompts = 0, statuses = 0, finished = false;
  const saves = new Map<string, string>();
  await context.addInitScript(() => {
    localStorage.setItem('u-ttu-rendu', JSON.stringify({ mode: 'key', key: 'e2e-fake-key-0123456789' }));
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

async function sendCast(page: Page, name: string) {
  await page.goto('/studio#personnage');
  await expect(page.getByRole('heading', { name: 'CAST' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nom' }).fill(name);
  await page.getByRole('textbox', { name: 'Texte', exact: true }).fill('Une femme de trente ans, manteau rouge, cheveux courts.');
  await page.locator('[data-cast-gold]').scrollIntoViewIfNeeded();
  await page.locator('[data-cast-gold]').click();
  await page.locator('[data-create-confirm]').click();
}

test('a second render while the first still runs says it is running, and sends nothing', async ({ page, context }) => {
  test.setTimeout(90_000);
  const comfy = await cloud(context);
  await sendCast(page, 'Léa');
  await expect.poll(comfy.prompts, { timeout: 20_000 }).toBe(1);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('u-ttu-operation') ?? '{}').jobId ?? null)).toBe('reprise-job-1');
  await page.close();

  const again = await context.newPage();
  await sendCast(again, 'Marc');
  await expect(again.getByText(/Un rendu est encore en cours dans le cloud : Léa\. Attends qu’il finisse/).first()).toBeVisible({ timeout: 15_000 });
  await expect(again.getByText(/attend encore sa récupération/)).toHaveCount(0);
  expect(comfy.prompts()).toBe(1);
});
