import { test, expect } from '@playwright/test';
import { openAssistant } from './helpers/top-bar';

// The conversation must stay visible (it once collapsed to 0 px inside the scrolling panel)
// and German/Spanish requests must get a plan and a reply in their own language. 0 credit.
const cases = [
  { locale: 'fr', width: 390, height: 844, text: 'Prépare un personnage, puis un décor, puis monte les prises', reply: /Voici les étapes proposées/, steps: ['local:cast', 'local:decor', 'local:montage'] },
  { locale: 'en', width: 844, height: 390, text: 'Prepare a character, then edit the takes', reply: /Here is the proposed sequence/, steps: ['local:cast', 'local:montage'] },
  { locale: 'de', width: 1280, height: 800, text: 'Bereite eine Figur vor, dann eine Kulisse, dann schneide die Takes zusammen', reply: /Hier sind die vorgeschlagenen Schritte/, steps: ['local:cast', 'local:decor', 'local:montage'] },
  { locale: 'es', width: 1920, height: 1080, text: 'Prepara un personaje, luego un decorado y después monta las tomas', reply: /Estos son los pasos propuestos/, steps: ['local:cast', 'local:decor', 'local:montage'] },
] as const;

for (const c of cases) test(`assistant i18n: ${c.locale} ${c.width}×${c.height} shows the conversation and a localized plan`, async ({ page, context, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'Viewports are set per case');
  await context.addCookies([{ name: 'u-ttu-locale', value: c.locale, url: baseURL! }]);
  await page.addInitScript(l => { try { localStorage.setItem('u-ttu-locale', l); } catch {} }, c.locale);
  let paid = 0;
  await page.route(/\/api\/(prompt|upload)|typesafe\.ai|\/studio-agent\/interpret/, r => { paid++; return r.abort(); });
  await page.setViewportSize({ width: c.width, height: c.height });
  await page.goto('/studio#personnage');
  await openAssistant(page);
  const panel = page.locator('[data-assistant-panel]');
  await expect(panel).toBeVisible();
  const create = panel.locator('form').first();
  if (await create.locator('input').isVisible()) { await create.locator('input').fill('Agent i18n'); await create.locator('button').click(); }
  const input = panel.locator('[data-assistant-input]');
  await expect(input).toBeEnabled();
  await input.fill(c.text);
  await panel.locator('[data-agent-send]').click();
  const log = panel.locator('.u-agent-messages');
  await expect(log.locator('p[data-role=assistant]').last()).toContainText(c.reply);
  const box = await log.boundingBox();
  expect(box!.height).toBeGreaterThan(40);
  await log.locator('p[data-role=user]').last().scrollIntoViewIfNeeded();
  await expect(log.locator('p[data-role=user]').last()).toBeInViewport();
  for (const id of c.steps) await expect(panel.locator(`[data-agent-step="${id}"]`)).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(paid).toBe(0);
  await page.screenshot({ path: info.outputPath(`assistant-${c.locale}-${c.width}.png`) });
});
