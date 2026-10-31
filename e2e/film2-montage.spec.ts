import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simulateComfy } from './helpers/film2-comfy';

// Refonte FILM · PR 8 — MONTAGE refait (?film2=1, Comfy simulated, 0 real credits).

const SHOTS = process.env.FILM2_SHOTS;
// A generation graph would start from text or noise; the enhancement starts from the exported film only.
const GENERATION = /LTXV|MiniMax|H3|Hunyuan|Wan|Flux|Klein|EmptyLatent|TextEncode|CLIPLoader/i;

async function starts(page: Page) {
  return page.locator('[data-fm-clip]').evaluateAll(nodes => nodes.map(node => ({ start: Number(node.getAttribute('data-start')), end: Number(node.getAttribute('data-end')) })));
}

test('un plan tourné est au montage sans tap ; outils nommés ; bac ; pas de trou ; Rendre plus net n’envoie qu’une amélioration', async ({ page }) => {
  test.setTimeout(300_000);
  const comfy = await simulateComfy(page);
  const prefix = `film2-${page.viewportSize()?.width}x${page.viewportSize()?.height}`;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const snap = async (name: string) => { if (SHOTS) { await page.waitForTimeout(300); await page.screenshot({ path: join(SHOTS, `${prefix}-${name}.png`) }); } };
  await page.addInitScript(() => {
    (window as unknown as { __inp: number }).__inp = 0;
    new PerformanceObserver(list => { for (const entry of list.getEntries()) (window as unknown as { __inp: number }).__inp = Math.max((window as unknown as { __inp: number }).__inp, entry.duration); })
      .observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  });

  await page.goto('/studio?film2=1#prise');
  await expect(page.locator('[data-film-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-film-phrase]').fill('Uttu marche sur le quai la nuit');
  await page.locator('[data-film-tourner]').click();
  await page.locator('[data-film-lancer]').click();
  await expect(page.locator('[data-film-result]')).toBeVisible({ timeout: 120_000 });

  // The shot is already in MONTAGE: open the stage, no « add » tap.
  await page.goto('/studio?film2=1#montage');
  const clips = page.locator('[data-fm-clip]');
  await expect(clips).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('[data-film-montage] video')).toHaveCount(1);

  // P7: every tool of the bar has a name (and a shortcut).
  const tools = page.locator('[data-fm-barre] button');
  for (const tool of await tools.all()) {
    expect((await tool.getAttribute('aria-label'))?.trim().length ?? 0).toBeGreaterThan(2);
    expect((await tool.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  for (const id of ['annuler', 'couper', 'enleverAvant', 'enleverApres', 'dupliquer', 'supprimer']) await expect(page.locator(`[data-fm-action="${id}"]`)).toBeVisible();
  // Only one primary button on the stage: Exporter.
  await expect(page.locator('[data-film-montage] .u-film-gold')).toHaveCount(1);
  await expect(page.locator('[data-film-montage]')).not.toContainText(/Finaliser/);

  // P6: a tap in « Mes plans » adds at the end.
  const bin = page.locator('[data-fm-bin-item]').first();
  await bin.click();
  await bin.click();
  await expect(clips).toHaveCount(3);
  let at = await starts(page);
  expect(at[1]!.start).toBeCloseTo(at[0]!.end, 1);
  expect(at[2]!.start).toBeCloseTo(at[1]!.end, 1);
  await snap('12-montage');

  // P2: « Enlever après » at 2 s on plan 1 (the playhead stays in the middle; the film slides).
  const px = ((await clips.first().boundingBox())!.width + 2) / (at[0]!.end - at[0]!.start);
  await page.locator('[data-fm-scroll]').evaluate((node, left) => { node.scrollLeft = left; node.dispatchEvent(new Event('scroll')); }, 2 * px);
  await expect(page.locator('[data-fm-clock]')).toContainText('0:02');
  await page.locator('[data-fm-action="enleverApres"]').click();
  at = await starts(page);
  expect(at[0]!.end).toBeCloseTo(2, 0);

  // P1: deleting plan 2 → plan 3 starts where plan 1 ends.
  await clips.nth(1).click();
  await expect(page.locator('[data-fm-props]')).toContainText('2');
  await page.locator('[data-fm-action="supprimer"]').click();
  await expect(clips).toHaveCount(2);
  at = await starts(page);
  expect(at[1]!.start).toBeCloseTo(at[0]!.end, 2);
  // P10: Annuler brings it back.
  await page.locator('[data-fm-action="annuler"]').click();
  await expect(clips).toHaveCount(3);
  await page.locator('[data-fm-action="retablir"]').click();
  await expect(clips).toHaveCount(2);

  const inp = await page.evaluate(() => (window as unknown as { __inp: number }).__inp);
  expect(inp, 'INP per tap').toBeLessThan(200);

  // P9: Exporter is the only primary; « Rendre plus net » is an export option with its price.
  const before = comfy.prompts.length;
  await page.locator('[data-fm-exporter]').click();
  const sheet = page.locator('[data-fm-export]');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText(/Rendre plus net · ≈ [\d,]+ crédits estimés/);
  await expect(sheet).not.toContainText(/gratuit/i);
  await sheet.locator('[data-fm-net]').check();
  await snap('13-exporter');
  await sheet.locator('[data-fm-exporter-go]').click();
  await expect(sheet.locator('[data-fm-sortie="done"], [data-fm-sortie="fail"]')).toBeVisible({ timeout: 120_000 });
  const sent = comfy.prompts.slice(before);
  expect(sent).toHaveLength(1);
  const graph = JSON.parse(sent[0]!.text) as Record<string, { class_type: string; inputs: Record<string, unknown> }>;
  const types = Object.values(graph).map(node => node.class_type);
  expect(types.some(type => /SeedVR|RTXVideoSuperResolution|Upscal/i.test(type)), types.join(',')).toBe(true);
  expect(types.filter(type => GENERATION.test(type)), 'no generation node').toEqual([]);
  expect(types.filter(type => /^Load(Video|Image)/.test(type)), 'one input: the exported film').toEqual(['LoadVideo']);
  // SeedVR2 restores in one step, conditioned on the film's own latent (never on text).
  for (const node of Object.values(graph).filter(item => item.class_type === 'KSampler')) expect(Number(node.inputs.steps)).toBeLessThanOrEqual(1);
  await expect(sheet.locator('[data-fm-sortie="done"]')).toBeVisible();
  await snap('14-exporte');
});
