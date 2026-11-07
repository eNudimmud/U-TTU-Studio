import { test, expect, devices, type Request } from "@playwright/test";
import { simulateComfy } from "./helpers/simulate-comfy";

// Uttu on an Android phone. Open-weights mode answers locally (Qwen3-VL is the engine, the
// candidate graph is not submitted). /studio-agent/chat is mocked and must stay silent.
const { defaultBrowserType: _browser, ...pixel } = devices["Pixel 7"];
test.use({ ...pixel });

test("Agent Uttu sur Android : réponse locale, plan, frappe conservée, aucun appel Comfy", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Android emulation, one run");
  await simulateComfy(page);
  const calls: Request[] = [];
  const outside: string[] = [];
  page.on("request", request => { if (/api\.comfy\.org/.test(request.url())) outside.push(request.url()); });
  await page.route(/\/studio-agent\/chat$/, route => {
    calls.push(route.request());
    return route.fulfill({ json: { reply: "Uttu est prêt et le quai aussi : passons à la PRISE.", action: { kind: "plan", tool: null, request: "Tourner Uttu sur le quai" }, credits: 0.04, measured: true } });
  });

  await page.goto("/studio/legacy");
  // The button is painted before React listens. A click in that gap does nothing, and the
  // panel stays out of the document. Same wait as e2e/uttu-comfy.spec.ts.
  await page.waitForFunction(() => [...document.querySelectorAll("[data-top-uttu], [data-chain-uttu]")].some(node => Object.keys(node).some(key => key.startsWith("__reactProps"))));
  await page.evaluate(() => document.querySelector<HTMLElement>("[data-top-uttu]")?.click());
  const panel = page.locator("[data-assistant-panel]");
  await expect(panel).toBeVisible();
  await expect(panel.locator("[data-uttu-engine]")).toHaveAttribute("data-uttu-engine", "native-qwen3vl");
  await expect(panel.locator("[data-uttu-price]")).toHaveText("Calculé par le studio, sans appel payant.");
  const more = panel.locator("[data-uttu-more] > summary");
  expect((await more.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await more.tap();
  const projectName = panel.getByLabel("Nom du projet", { exact: true });
  if (await projectName.isVisible()) {
    await projectName.fill("Quai mobile");
    await panel.getByRole("button", { name: "Créer le projet", exact: true }).tap();
  }
  await expect(panel.locator("[data-uttu-mode-pick]")).toHaveCount(0);

  const input = panel.locator("[data-uttu-input]");
  await input.tap();
  await input.fill("Prépare trois prises de la scène du quai");
  const send = panel.locator("[data-uttu-send]");
  expect((await send.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await send.tap();

  await expect(panel.locator("[data-uttu-gate]")).toHaveCount(0);
  const reply = panel.locator("[data-uttu-log] [data-role=assistant]").last();
  const plan = reply.locator("[data-uttu-act=plan]");
  await expect(plan).toBeVisible();
  const box = (await plan.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x >= 0 && box.x + box.width <= page.viewportSize()!.width).toBe(true);

  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>("[data-uttu-act=plan]");
    const chat = document.querySelector<HTMLTextAreaElement>("[data-uttu-input]");
    button?.click();
    chat?.focus();
    if (!chat) return;
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    set?.call(chat, "encore");
    chat.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }));
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("encore");
  await expect(panel.locator("[data-assistant-input]")).toHaveValue("Prépare trois prises de la scène du quai");
  expect(calls).toHaveLength(0);
  expect(outside).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("uttu-android.png") });
});
