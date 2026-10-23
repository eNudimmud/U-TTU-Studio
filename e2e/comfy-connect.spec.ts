import { test, expect } from '@playwright/test';

// « Connecter mon compte Comfy » : a refused key shows its message inside the dialog,
// visible on screen, and the dialog is never cut off. Comfy is mocked, 0 credit.
const sizes = [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1024, height: 600 }, { width: 1280, height: 800 }] as const;

for (const size of sizes) test(`refused Comfy key shows a visible error at ${size.width}×${size.height}`, async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Viewports are set per case');
  await page.route(/\/api\/user(\?|$)/, r => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"unauthorized"}' }));
  await page.route(/\/api\/(prompt|upload)/, r => r.abort());
  await page.setViewportSize(size);
  await page.goto('/studio');
  await page.locator('main').getByRole('button', { name: 'Relier', exact: true }).first().click();
  const dialog = page.locator('dialog.u-native-sheet[open]');
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1);
  await dialog.locator('input[type=password]').fill('fake-test-key-123');
  await dialog.getByRole('button', { name: 'Relier', exact: true }).click();
  const error = dialog.locator('[data-connect-error]');
  await expect(error).toHaveText('Cette clé n’est pas reconnue par Comfy. Vérifie-la et réessaie.');
  await expect(error).toBeInViewport();
  expect((await error.boundingBox())!.height).toBeGreaterThan(0);
  await dialog.locator('input[type=password]').fill('fake-test-key-1234');
  await expect(error).toBeHidden();
});
