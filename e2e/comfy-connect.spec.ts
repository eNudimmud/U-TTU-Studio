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
  // Measure once the slide-up animation has ended, not mid-flight.
  await dialog.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
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

// « Se connecter avec Comfy » opens Comfy's own login on this origin (proxied), then links by
// itself once Comfy's session appears. Comfy is mocked: no account, no network, 0 credit.
const KEY = 'comfyui-0123456789abcdef0123456789abcdef';
const USER = { id: 'u1', email: 'test@example.invalid' };

async function openSheet(page: import('@playwright/test').Page) {
  await page.route(/\/api\/(prompt|upload)/, r => r.abort());
  await page.goto('/studio');
  await page.locator('main').getByRole('button', { name: 'Relier', exact: true }).first().click();
  const dialog = page.locator('dialog.u-native-sheet[open]');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('Se connecter avec Comfy: opens the proxied login, then links the Comfy session by itself', async ({ page, context }) => {
  await context.route(/\/cloud\/login/, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Comfy login (mock)</title><p>login</p>' }));
  await page.route(/\/api\/user(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }));
  const dialog = await openSheet(page);
  const login = dialog.locator('[data-connect-login]');
  await expect(login).toHaveText('Se connecter avec Comfy');
  await expect(login).toHaveAttribute('href', '/cloud/login');
  expect((await login.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const popupPromise = context.waitForEvent('page');
  await login.click();
  const popup = await popupPromise;
  expect(new URL(popup.url()).pathname).toBe('/cloud/login');
  await expect(dialog.locator('[data-connect-waiting]')).toBeVisible();
  // Comfy's login writes its session in this origin's IndexedDB (same origin as the popup).
  await popup.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('firebaseLocalStorageDb', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('firebaseLocalStorage', 'readwrite');
      tx.objectStore('firebaseLocalStorage').put({ fbase_key: 'firebase:authUser:test:[DEFAULT]', value: { apiKey: 'AIzaTest_key-1', stsTokenManager: { refreshToken: 'r1', accessToken: 'jwt.test', expirationTime: Date.now() + 3_600_000 } } });
      tx.oncomplete = () => { open.result.close(); resolve(); };
    };
  }));
  await expect(page.locator('dialog.u-native-sheet[open]')).toHaveCount(0, { timeout: 15_000 });
  expect(await page.evaluate(() => localStorage.getItem('u-ttu-rendu'))).toContain('session');
});

test('no Comfy session yet: the old « Session déjà ouverte » link explains what to do', async ({ page }) => {
  const dialog = await openSheet(page);
  await dialog.getByRole('button', { name: 'Session déjà ouverte' }).click();
  await expect(dialog.locator('[data-connect-error]')).toContainText('Se connecter avec Comfy');
});

test('pasting a comfyui- key links at once, the key stays on this device', async ({ page }) => {
  let header = '';
  await page.route(/\/api\/user(\?|$)/, r => { header = r.request().headers()['x-api-key'] ?? ''; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }); });
  const dialog = await openSheet(page);
  await expect(dialog.locator('[data-connect-keys]')).toHaveAttribute('href', 'https://platform.comfy.org/profile/api-keys?onboarding=router');
  await expect(dialog).toContainText('nomme-la U*TTU');
  const input = dialog.locator('input[placeholder^="comfyui-"]');
  await input.focus();
  await page.evaluate(key => {
    const data = new DataTransfer(); data.setData('text/plain', `Ta clé : ${key}`);
    document.activeElement!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, KEY);
  await expect(page.locator('dialog.u-native-sheet[open]')).toHaveCount(0);
  expect(header).toBe(KEY);
  expect(await page.evaluate(() => localStorage.getItem('u-ttu-rendu'))).toContain(KEY);
});

test('Coller ma clé reads the clipboard; Enter submits; show/hide toggles', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route(/\/api\/user(\?|$)/, r => r.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  const dialog = await openSheet(page);
  const input = dialog.locator('input[placeholder^="comfyui-"]');
  await expect(input).toHaveAttribute('type', 'password');
  await dialog.getByRole('button', { name: 'Afficher la clé' }).click();
  await expect(input).toHaveAttribute('type', 'text');
  await page.evaluate(() => navigator.clipboard.writeText('rien à voir ici'));
  await dialog.locator('[data-connect-paste]').click();
  await expect(dialog.locator('[data-connect-error]')).toContainText('presse-papiers');
  await page.evaluate(key => navigator.clipboard.writeText(key), KEY);
  await dialog.locator('[data-connect-paste]').click();
  await expect(input).toHaveValue(KEY);
  await expect(dialog.locator('[data-connect-error]')).toHaveText('Cette clé n’est pas reconnue par Comfy. Vérifie-la et réessaie.');
  await input.fill('fake-test-key-1234567');
  await input.press('Enter');
  await expect(dialog.locator('[data-connect-error]')).toHaveAttribute('data-connect-code', 'keyRefused');
});

test('a key without an active subscription says so, with the pricing link', async ({ page }) => {
  await page.route(/\/api\/user(\?|$)/, r => r.fulfill({ status: 429, contentType: 'application/json', body: '{}' }));
  const dialog = await openSheet(page);
  const input = dialog.locator('input[placeholder^="comfyui-"]');
  await input.fill(KEY);
  await dialog.getByRole('button', { name: 'Relier', exact: true }).click();
  const error = dialog.locator('[data-connect-error]');
  await expect(error).toContainText('abonnement actif');
  await expect(error.getByRole('link')).toHaveAttribute('href', 'https://www.comfy.org/cloud/pricing');
});
