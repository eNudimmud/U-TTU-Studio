import { test, expect, type Page, type Request } from "@playwright/test";
import { simulateComfy } from "./helpers/simulate-comfy";
import { showPlan } from "./helpers/top-bar";

// Open-weights mode (the public build): the panel uses agentEngine → Qwen3-VL and does not POST
// /studio-agent/chat. That route is mocked only to prove it stays silent. No Router call, no credit.
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1024, height: 600 },
  { width: 1280, height: 800 },
];

type Reply = { status?: number; json: object };
async function mockChat(page: Page, replies: Reply[]) {
  const calls: Request[] = [];
  await page.route(/\/studio-agent\/chat$/, route => {
    calls.push(route.request());
    const next = replies.shift() ?? { status: 500, json: { error: "failed" } };
    return route.fulfill({ status: next.status ?? 200, json: next.json });
  });
  await page.route(/api\.comfy\.org\/v2\/models/, route => { calls.push(route.request()); return route.abort(); });
  return calls;
}
async function openPanel(page: Page) {
  await page.goto("/studio");
  // The button is painted before React listens. A click in that gap does nothing, so the
  // panel stays out of the document. Wait for React, then click the node itself.
  await page.waitForFunction(() => [...document.querySelectorAll("[data-top-uttu], [data-chain-uttu]")].some(node => Object.keys(node).some(key => key.startsWith("__reactProps"))));
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>("[data-top-uttu], [data-chain-uttu]")];
    const visible = nodes.find(node => node.offsetParent !== null) ?? nodes[0];
    visible?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  const panel = page.locator("[data-assistant-panel]");
  await expect(panel).toBeVisible();
  return panel;
}
const lastReply = (panel: ReturnType<Page["locator"]>) => panel.locator("[data-uttu-log] [data-role=assistant]").last();

for (const viewport of VIEWPORTS) {
  test(`Agent natif à ${viewport.width}×${viewport.height} : plan, puis la frappe reste dans la conversation`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Viewports are set by the test");
    await page.setViewportSize(viewport);
    await simulateComfy(page);
    const calls = await mockChat(page, []);
    const panel = await openPanel(page);

    await expect(panel.locator("[data-uttu-engine]")).toHaveAttribute("data-uttu-engine", "native-qwen3vl");
    await expect(panel.locator("[data-uttu-mode-pick]")).toHaveCount(0);
    await expect(panel.locator("[data-uttu-price]")).toHaveText("Calculé par le studio, sans appel payant.");
    await showPlan(page);
    await expect(panel.locator("[data-uttu-paid-note]")).toContainText("Qwen3-VL 8B");
    await expect(panel.locator("[data-uttu-paid-note]")).toContainText("n’envoie aucun job");

    const input = panel.locator("[data-uttu-input]");
    await input.fill("Prépare trois prises de la scène du quai");
    await panel.locator("[data-uttu-send]").click();
    await expect(panel.locator("[data-uttu-gate]")).toHaveCount(0);
    const planButton = lastReply(panel).locator("[data-uttu-act=plan]");
    await expect(planButton).toBeVisible();
    expect(calls.length).toBe(0);

    // Click, then type in the conversation before the deferred focus frame runs.
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
    await page.keyboard.type("!");
    await expect(input).toHaveValue("encore!");
    await expect(panel.locator("[data-assistant-input]")).toHaveValue("Prépare trois prises de la scène du quai");
    expect(calls.length).toBe(0);
  });
}

test("Agent Uttu : une question de coût reste locale, et un 402 du routeur n’est jamais affiché", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only");
  await simulateComfy(page);
  const calls = await mockChat(page, [{ status: 402, json: { error: "credits" } }]);
  const panel = await openPanel(page);
  await panel.locator("[data-uttu-input]").fill("Bonjour");
  await panel.locator("[data-uttu-send]").click();
  await expect(panel.locator("[data-uttu-gate]")).toHaveCount(0);
  await expect(lastReply(panel)).not.toContainText("Crédits insuffisants");
  await panel.locator("[data-uttu-input]").fill("Combien coûtent 3 portraits + 2 prises LTX ?");
  await panel.locator("[data-uttu-send]").click();
  await expect(lastReply(panel).locator("[data-uttu-total]")).toContainText("48–72");
  await expect(lastReply(panel).locator(".u-small").last()).toContainText("sans appel payant");
  expect(calls.length).toBe(0);
});

test("Agent Uttu : sans compte relié, le guide natif répond et le lien de connexion reste", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only");
  const calls = await mockChat(page, []);
  const panel = await openPanel(page);
  await expect(panel.locator("[data-uttu-engine]")).toHaveAttribute("data-uttu-engine", "native-qwen3vl");
  await expect(panel.locator("[data-uttu-mode]")).toHaveCount(0);
  await expect(panel.locator("[data-uttu-guide], [data-uttu-simulator]")).toHaveCount(0);
  const invite = panel.locator("[data-uttu-invite]");
  await expect(invite).toContainText("sans appel payant");
  await invite.locator("[data-uttu-invite-connect]").click();
  await expect(page.locator("dialog[open]").last()).toBeVisible();
  expect(calls.length).toBe(0);
});

test("Agent natif en allemand : pas de porte d’accord, aucun appel au routeur", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only");
  await page.context().addCookies([{ name: "u-ttu-locale", value: "de", url: "http://127.0.0.1:3000" }]);
  await page.addInitScript(() => window.localStorage.setItem("u-ttu-locale", "de"));
  await simulateComfy(page);
  const calls = await mockChat(page, [{ json: { reply: "Verbinde zuerst dein Comfy-Konto.", action: { kind: "none", tool: null, request: null }, credits: 0.16, measured: false } }]);
  const panel = await openPanel(page);
  await expect(panel.locator("[data-uttu-price]")).toHaveText("Vom Studio berechnet, ohne kostenpflichtigen Aufruf.");
  await panel.locator("[data-uttu-input]").fill("Wie fange ich an?");
  await panel.locator("[data-uttu-send]").click();
  await expect(panel.locator("[data-uttu-gate]")).toHaveCount(0);
  await expect(lastReply(panel)).not.toContainText("Verbinde zuerst");
  expect(calls.length).toBe(0);
});

test("Agent natif relié par la session Comfy : la note ne promet aucun envoi", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only");
  await simulateComfy(page);
  await page.addInitScript(() => {
    localStorage.setItem("u-ttu-rendu", JSON.stringify({ mode: "session" }));
    localStorage.setItem("firebase:authUser:AIzaTest_key-1:[DEFAULT]", JSON.stringify({ uid: "u1", apiKey: "AIzaTest_key-1", stsTokenManager: { refreshToken: "r1", accessToken: "jwt.test", expirationTime: Date.now() + 3_600_000 } }));
  });
  const calls = await mockChat(page, []);
  const panel = await openPanel(page);
  await showPlan(page);
  const note = panel.locator("[data-uttu-paid-note]");
  await expect(note).toContainText("Qwen3-VL 8B");
  await expect(note).not.toContainText("GPT-5 Nano via");
  await panel.locator("[data-uttu-input]").fill("Bonjour");
  await panel.locator("[data-uttu-send]").click();
  await expect(lastReply(panel)).toContainText("sans appel payant");
  expect(calls.length).toBe(0);
});
