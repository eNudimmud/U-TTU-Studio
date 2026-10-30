import { test, expect, devices, type Request } from "@playwright/test";
import { simulateComfy } from "./helpers/simulate-comfy";

// The paid agent Uttu on an Android phone (touch, mobile Chrome). Replaces the specs removed in
// #152/#153 (uttu-gratuit, studio-agent-mobile). /studio-agent/chat is mocked: no Router call,
// no credit spent. Nothing paid leaves before the visitor taps « accept » after the quote.
const FAKE_KEY = "audit-fake-key-0123456789";
const { defaultBrowserType: _browser, ...pixel } = devices["Pixel 7"];
test.use({ ...pixel });

test("Agent Uttu payant sur Android : devis, accord au toucher, contexte du projet, aucun appel direct à Comfy", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Android emulation, one run");
  await simulateComfy(page);
  const calls: Request[] = [];
  const outside: string[] = [];
  page.on("request", request => { if (/api\.comfy\.org/.test(request.url())) outside.push(request.url()); });
  await page.route(/\/studio-agent\/chat$/, route => {
    calls.push(route.request());
    return route.fulfill({ json: { reply: "Uttu est prêt et le quai aussi : passons à la PRISE.", action: { kind: "plan", tool: null, request: "Tourner Uttu sur le quai" }, credits: 0.04, measured: true } });
  });

  await page.goto("/studio");
  await page.locator("[data-top-uttu]").tap();
  const panel = page.locator("[data-assistant-panel]");
  await expect(panel).toBeVisible();
  await expect(panel.locator("[data-uttu-price]")).toHaveText("≈ 0,2 crédit estimé par message");
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
  await input.fill("On en est où dans mon film ?");
  const send = panel.locator("[data-uttu-send]");
  expect((await send.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await send.tap();

  const gate = panel.locator("[data-uttu-gate]");
  await expect(gate).toContainText("≈ 0,2 crédits estimés");
  expect(calls).toHaveLength(0);
  const accept = gate.locator("[data-uttu-accept]");
  const box = (await accept.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x >= 0 && box.x + box.width <= page.viewportSize()!.width).toBe(true);
  await accept.tap();

  const reply = panel.locator("[data-uttu-log] [data-role=assistant]").last();
  await expect(reply).toContainText("passons à la PRISE");
  await expect(reply.locator("[data-uttu-spent]")).toHaveText("≈ 0,04 crédits estimés pour ce message");
  expect(calls).toHaveLength(1);
  expect(calls[0].headers()["x-api-key"]).toBe(FAKE_KEY);
  const body = calls[0].postDataJSON();
  expect(body.message).toBe("On en est où dans mon film ?");
  expect(body.locale).toBe("fr");
  // The project travels as names only, from the studio storage.
  expect(body.project).toEqual(expect.objectContaining({ name: "Quai mobile", items: expect.any(Array) }));
  expect(JSON.stringify(body.project)).not.toMatch(/Projets\//);

  // The agent proposes, the visitor taps: the plan is prepared, nothing is launched.
  await reply.locator("[data-uttu-act=plan]").tap();
  await expect(panel.locator("[data-assistant-input]")).toHaveValue("Tourner Uttu sur le quai");
  expect(calls).toHaveLength(1);
  expect(outside).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("uttu-android.png") });
});
