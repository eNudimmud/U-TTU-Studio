import { expect, test } from '@playwright/test';

// F1 · PRISE stays light: three.js and the maquette load only when the « Maquette » group opens,
// and the maquette stops repainting once its group is folded again.
test('PRISE : la maquette 3D ne se charge qu’à l’ouverture et dort une fois repliée', async ({ page, context }) => {
  const spent: string[] = [];
  await context.route(/\/api\/(prompt|upload|queue)|fal\.ai|comfy\.cloud/, route => { spent.push(route.request().url()); return route.abort(); });
  await context.route(/overpass|nominatim|photon|panoramax|mapillary|tiles\.openfreemap/, route => route.abort());
  await page.addInitScript(() => {
    const w = window as unknown as { __paints: number };
    w.__paints = 0;
    const count = (proto: object | undefined, name: string) => {
      if (!proto) return;
      const original = (proto as Record<string, unknown>)[name] as ((...args: unknown[]) => unknown) | undefined;
      if (typeof original !== 'function') return;
      (proto as Record<string, unknown>)[name] = function (this: unknown, ...args: unknown[]) { w.__paints++; return original.apply(this, args); };
    };
    for (const ctx of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype]) { count(ctx, 'drawElements'); count(ctx, 'drawArrays'); }
    count(window.CanvasRenderingContext2D?.prototype, 'drawImage');
  });
  const paints = () => page.evaluate(() => (window as unknown as { __paints: number }).__paints);
  const threeLoaded = () => page.evaluate(() => Boolean((window as unknown as { __THREE__?: string }).__THREE__));

  await page.goto('/studio#personnage');
  await expect(page.getByLabel('Importer un personnage', { exact: true })).toBeEnabled();
  await page.getByLabel('Importer un personnage', { exact: true }).setInputFiles('public/exemples/cast-dj.webp');
  await expect(page.getByRole('navigation').getByRole('button', { name: 'CAST' })).toContainText('Prêt');
  await page.getByRole('navigation').getByRole('button', { name: 'PRISE' }).click();
  await expect(page.locator('[data-avance-prise]')).toBeAttached();
  await page.waitForTimeout(1500);

  // Closed: no three.js, no maquette in the DOM.
  expect(await threeLoaded()).toBe(false);
  await expect(page.locator('[data-maquette]')).toHaveCount(0);

  // Opened: the maquette mounts and draws.
  await page.locator('[data-avance-prise] > summary').click();
  await page.locator('[data-avance-toggle=maquette]').click();
  await expect(page.locator('canvas.u-maquette-canvas')).toBeVisible();
  await expect.poll(paints).toBeGreaterThan(0);

  // Folded again: kept mounted (state survives), but no more repaints.
  await page.locator('[data-avance-toggle=maquette]').click();
  await expect(page.locator('canvas.u-maquette-canvas')).toBeHidden();
  await expect(page.locator('[data-maquette]')).toHaveCount(1);
  await page.waitForTimeout(500);
  const folded = await paints();
  await page.waitForTimeout(2000);
  expect(await paints() - folded).toBe(0);

  // Reopened: it draws again.
  await page.locator('[data-avance-toggle=maquette]').click();
  await expect.poll(async () => (await paints()) - folded).toBeGreaterThan(0);
  expect(spent).toEqual([]);
});
