import { defineConfig } from "@playwright/test";

const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: ci ? 2 : 1,
  retries: ci ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
    locale: "fr-FR",
    actionTimeout: 20_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // The studio opens in English for a new visitor. Most specs read the French copy, so they run as a
    // visitor who saved « Français » (cookie + localStorage). english-default.spec.ts and the language
    // specs start from an empty state instead.
    storageState: {
      cookies: [{ name: "u-ttu-locale", value: "fr", domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }],
      origins: [{ origin: "http://127.0.0.1:3000", localStorage: [{ name: "u-ttu-locale", value: "fr" }] }],
    },
  },
  webServer: {
    command: ci ? "npm start -- --port 3000" : "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/studio?demo=1",
    reuseExistingServer: !ci,
    timeout: 180_000,
  },
  projects: [
    { name: "desktop", use: { channel: process.env.PLAYWRIGHT_CHANNEL || "chromium", viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { channel: process.env.PLAYWRIGHT_CHANNEL || "chromium", viewport: { width: 390, height: 844 } } },
    ...(["firefox", "webkit"] as const).flatMap(browserName => [
      { name: `${browserName}-desktop`, testMatch: /reliability-ux\.spec\.ts/, use: { browserName, viewport: { width: 1280, height: 800 } } },
      { name: `${browserName}-mobile`, testMatch: /reliability-ux\.spec\.ts/, use: { browserName, viewport: { width: 390, height: 844 } } },
    ]),
  ],
});
