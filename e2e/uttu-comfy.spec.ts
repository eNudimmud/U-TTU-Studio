import { test, expect, type Page, type Request } from "@playwright/test";
import { simulateComfy } from "./helpers/simulate-comfy";
import { showPlan } from "./helpers/top-bar";

// U*TTU, Agent Comfy mode: paid by the visitor's own Comfy account, opt-in, accepted once per
// session. The route /studio-agent/chat is mocked: no Router call, no credit spent by the tests.
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1024, height: 600 },
  { width: 1280, height: 800 },
];
const FAKE_KEY = "audit-fake-key-0123456789";

type Reply = { status?: number; json: object };
async function mockChat(page: Page, replies: Reply[]) {
  const calls: Request[] = [];
  await page.route(/\/studio-agent\/chat$/, route => {
    calls.push(route.request());
    const next = replies.shift() ?? { status: 500, json: { error: "failed" } };
    return route.fulfill({ status: next.status ?? 200, json: next.json });
  });
  // Belt and braces: nothing may reach Comfy Router from the browser.
  await page.route(/api\.comfy\.org\/v2\/models/, route => { calls.push(route.request()); return route.abort(); });
  return calls;
}
async function openPanel(page: Page) {
  await page.goto("/studio");
  await page.locator("[data-top-uttu]").click();
  const panel = page.locator("[data-assistant-panel]");
  await expect(panel).toBeVisible();
  return panel;
}
const lastReply = (panel: ReturnType<Page["locator"]>) => panel.locator("[data-uttu-log] [data-role=assistant]").last();

for (const viewport of VIEWPORTS) {
  test(`Agent Comfy à ${viewport.width}×${viewport.height} : accord, réponse, plan de production, outil`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Viewports are set by the test");
    await page.setViewportSize(viewport);
    await simulateComfy(page);
    const calls = await mockChat(page, [
      { json: { reply: "Je te prépare trois prises dans le plan de production. Tu verras le devis avant de lancer.", action: { kind: "plan", tool: null, request: "Prépare trois prises de la scène du quai" }, credits: 0.05, measured: true } },
      { json: { reply: "L’outil d’image Qwen convient pour ça.", action: { kind: "open_tool", tool: "img-qwen", request: null }, credits: 0.04, measured: true } },
    ]);
    const panel = await openPanel(page);

    // One agent: no free/paid switch, the price per message is always shown.
    await expect(panel.locator("[data-uttu-mode-pick]")).toHaveCount(0);
    await expect(panel.locator("[data-uttu-price]")).toHaveText("≈ 0,2 crédit estimé par message");
    // Minimal panel: the explanations wait behind « Plus d’options ».
    await expect(panel.locator("[data-uttu-paid-note]")).toBeHidden();
    await expect(panel.locator("[data-uttu-suggest]")).toHaveCount(3);
    await showPlan(page);
    await expect(panel.locator("[data-uttu-paid-note]")).toBeVisible();
    await expect(panel.locator("[data-uttu-paid-note]")).toContainText("ne garde pas ta clé");

    const input = panel.locator("[data-uttu-input]");
    await input.fill("Je veux trois prises de la scène du quai");
    await panel.locator("[data-uttu-send]").click();
    const gate = panel.locator("[data-uttu-gate]");
    await expect(gate).toBeVisible();
    await expect(gate).toContainText("≈ 0,2 crédits estimés");
    expect(calls.length).toBe(0);
    const accept = gate.locator("[data-uttu-accept]");
    expect((await accept.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await accept.click();

    await expect(lastReply(panel)).toContainText("trois prises dans le plan");
    await expect(lastReply(panel).locator("[data-uttu-spent]")).toHaveText("≈ 0,05 crédits estimés pour ce message");
    expect(calls.length).toBe(1);
    expect(calls[0].headers()["x-api-key"]).toBe(FAKE_KEY);
    const body = calls[0].postDataJSON();
    expect(body.message).toBe("Je veux trois prises de la scène du quai");
    expect(body.locale).toBe("fr");

    await lastReply(panel).locator("[data-uttu-act=plan]").click();
    await expect(panel.locator("[data-assistant-input]")).toHaveValue("Prépare trois prises de la scène du quai");
    await expect(panel.locator("[data-assistant-input]")).toBeVisible();
    expect(calls.length).toBe(1);

    // Accepted once for the session: the next message goes without asking again.
    await input.fill("Quel outil pour une image de quai ?");
    await input.press("Enter");
    await expect(lastReply(panel)).toContainText("Qwen");
    await expect(gate).toHaveCount(0);
    expect(calls.length).toBe(2);
    expect(calls[1].postDataJSON().history.length).toBeGreaterThan(0);
    const tool = lastReply(panel).locator("[data-uttu-tool=img-qwen]");
    await expect(tool).toHaveAttribute("href", /\/studio#outils\/img-qwen$/);
    await expect(lastReply(panel).locator("[data-uttu-tool-cost]")).toContainText("crédits estimés par lancement");
    // Nothing was launched: no Comfy prompt left the studio.
    expect(calls.every(call => /\/studio-agent\/chat$/.test(call.url()))).toBe(true);
  });
}

test("Agent Uttu : sans accord, aucun appel payant ; un devis est calculé par le studio", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only");
  await simulateComfy(page);
  const calls = await mockChat(page, []);
  const panel = await openPanel(page);
  await panel.locator("[data-uttu-input]").fill("Bonjour");
  await panel.locator("[data-uttu-send]").click();
  await expect(panel.locator("[data-uttu-gate]")).toBeVisible();
  await panel.locator("[data-uttu-decline]").click();
  await expect(panel.locator("[data-uttu-gate]")).toHaveCount(0);
  // A cost question is answered by the studio itself, without a paid call, even before consent.
  await panel.locator("[data-uttu-input]").fill("Combien coûtent 3 portraits + 2 prises LTX ?");
  await panel.locator("[data-uttu-send]").click();
  await expect(lastReply(panel).locator("[data-uttu-total]")).toContainText("48–72");
  expect(calls.length).toBe(0);
});

test("Agent Uttu : sans compte relié, invitation à relier, aucun guide local", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only");
  const calls = await mockChat(page, []);
  const panel = await openPanel(page);
  await expect(panel.locator("[data-uttu-mode]")).toHaveCount(0);
  await expect(panel.locator("[data-uttu-guide], [data-uttu-simulator]")).toHaveCount(0);
  const invite = panel.locator("[data-uttu-invite]");
  await expect(invite).toContainText("≈ 0,2 crédit estimé par message");
  await invite.locator("[data-uttu-invite-connect]").click();
  await expect(page.locator("dialog[open]").last()).toBeVisible();
  expect(calls.length).toBe(0);
});

test("Agent Comfy : crédits insuffisants, message clair et aucune relance", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only");
  await simulateComfy(page);
  const calls = await mockChat(page, [{ status: 402, json: { error: "credits" } }]);
  await page.addInitScript(() => window.sessionStorage.setItem("u-ttu-uttu-comfy-ok", "1"));
  const panel = await openPanel(page);
  await panel.locator("[data-uttu-input]").fill("Bonjour");
  await panel.locator("[data-uttu-send]").click();
  await expect(lastReply(panel)).toContainText("Crédits insuffisants sur ton compte Comfy");
  await expect(lastReply(panel).locator("[data-uttu-error=credits] [data-uttu-act=guide]")).toBeVisible();
  expect(calls.length).toBe(1);
});

test("Agent Comfy parle allemand avec du", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only");
  await page.context().addCookies([{ name: "u-ttu-locale", value: "de", url: "http://127.0.0.1:3000" }]);
  await page.addInitScript(() => window.localStorage.setItem("u-ttu-locale", "de"));
  await simulateComfy(page);
  const calls = await mockChat(page, [{ json: { reply: "Verbinde zuerst dein Comfy-Konto, dann wähle einen Tab.", action: { kind: "none", tool: null, request: null }, credits: 0.16, measured: false } }]);
  const panel = await openPanel(page);
  await expect(panel.locator("[data-uttu-price]")).toHaveText("≈ 0,2 Credits geschätzt pro Nachricht");
  await panel.locator("[data-uttu-input]").fill("Wie fange ich an?");
  await panel.locator("[data-uttu-send]").click();
  await expect(panel.locator("[data-uttu-gate]")).toContainText("Deine Zustimmung gilt für diese Sitzung");
  expect(calls.length).toBe(0);
  await panel.locator("[data-uttu-accept]").click();
  await expect(lastReply(panel)).toContainText("Verbinde zuerst");
  await expect(lastReply(panel).locator("[data-uttu-spent]")).toHaveText("höchstens ≈ 0,16 Credits geschätzt für diese Nachricht");
  expect(calls[0].postDataJSON().locale).toBe("de");
});

test("Agent Comfy relié par la connexion Comfy (sans clé) : la note ne parle pas de clé, l'appel part en Bearer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only");
  await simulateComfy(page);
  // Linked through « Se connecter avec Comfy »: Comfy's Firebase user sits in this origin's localStorage.
  await page.addInitScript(() => {
    localStorage.setItem("u-ttu-rendu", JSON.stringify({ mode: "session" }));
    localStorage.setItem("firebase:authUser:AIzaTest_key-1:[DEFAULT]", JSON.stringify({ uid: "u1", apiKey: "AIzaTest_key-1", stsTokenManager: { refreshToken: "r1", accessToken: "jwt.test", expirationTime: Date.now() + 3_600_000 } }));
    window.sessionStorage.setItem("u-ttu-uttu-comfy-ok", "1");
  });
  const calls = await mockChat(page, [{ json: { reply: "Bienvenue sur le studio.", action: { kind: "none", tool: null, request: null }, credits: 0.03, measured: true } }]);
  const panel = await openPanel(page);
  await showPlan(page);
  const note = panel.locator("[data-uttu-paid-note]");
  await expect(note).toContainText("ta connexion Comfy");
  await expect(note).not.toContainText("clé");
  await panel.locator("[data-uttu-input]").fill("Bonjour");
  await panel.locator("[data-uttu-send]").click();
  await expect(lastReply(panel)).toContainText("Bienvenue");
  expect(calls.length).toBe(1);
  expect(calls[0].headers()["authorization"]).toBe("Bearer jwt.test");
  expect(calls[0].headers()["x-api-key"]).toBeUndefined();
});
