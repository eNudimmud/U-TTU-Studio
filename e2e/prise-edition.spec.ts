import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { simulateComfy } from "./helpers/simulate-comfy";

test.use({ hasTouch: true });
const SIZES = [[390, 844], [844, 390], [1024, 600], [1280, 800]] as const;
const cards = (page: Page) => page.locator(".u-plan-card");
const saved = (page: Page) => expect(page.locator("[data-plan-save]")).toHaveAttribute("data-plan-save", "saved");

async function prepare(page: Page) {
  const nav = (name: string) => page.getByRole("navigation").getByRole("button", { name, exact: false });
  await page.goto("/studio#personnage");
  await page.getByLabel("Importer un personnage", { exact: true }).setInputFiles({ name: "Léa.webp", mimeType: "image/webp", buffer: readFileSync("public/exemples/cast-coursiere.webp") });
  await expect(nav("CAST")).toContainText("Prêt");
  await nav("DÉCOR").tap();
  await page.getByLabel("Importer un décor", { exact: true }).setInputFiles({ name: "Le laboratoire.webp", mimeType: "image/webp", buffer: readFileSync("public/exemples/decor-couloir.webp") });
  await expect(nav("DÉCOR")).toContainText("Prêt");
  await nav("PRISE").tap();
  await expect(page.locator('[data-prise-ready="true"]')).toBeVisible();
}

/** Mobile shows PRISE as 5 steps; wider screens show everything, so there is nothing to tap. */
async function step(page: Page, name: string) {
  const button = page.locator(`[data-prise-step=${name}]`);
  if (await button.isVisible()) await button.tap();
}

async function proof(page: Page, name: string) {
  if (!process.env.PRISE_SHOTS_DIR || page.viewportSize()?.width !== 390) return;
  mkdirSync(process.env.PRISE_SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: join(process.env.PRISE_SHOTS_DIR, `${name}.png`) });
}

test("PRISE tactile : trois plans, édition complète, suppression/annulation, ordre et actualisation", async ({ page }) => {
  await simulateComfy(page);
  await page.route(/\/api\/billing\/usage\/timeseries|customers\/balance/, route => route.fulfill({ json: { summary: { balance: { amount_micros: 500 } } } }));
  await prepare(page);
  await page.locator(".u-plan-add").tap();
  await page.locator(".u-plan-add").tap();
  await expect(cards(page)).toHaveCount(3);
  await cards(page).nth(1).tap();
  const editor = page.locator("[data-plan-editor]");
  // Mobile: the plan editor is step 2 of 5, « Plans ».
  await step(page, "plans");
  if (await editor.getAttribute("open") === null) await editor.locator("summary").tap();
  await expect(editor).toHaveAttribute("open", "");
  await page.getByRole("textbox", { name: "Titre du plan", exact: true }).fill("La porte dorée");
  const action = page.getByRole("textbox", { name: "Ce qui se passe", exact: true });
  // The action is written in step 1, « Préparer »; framing details go back to « Plans ».
  await step(page, "preparer");
  await action.fill("Léa ouvre la porte du laboratoire");
  await step(page, "plans");
  await page.getByLabel("Cadrage", { exact: true }).selectOption("rapproche");
  await page.getByLabel("Angle caméra", { exact: true }).selectOption("contre-plongee");
  await page.getByLabel("Mouvement caméra", { exact: true }).selectOption("dolly");
  await page.getByLabel("Position caméra", { exact: true }).fill("2 m à gauche");
  await page.getByLabel("Durée du plan", { exact: true }).selectOption("10");
  const reference = page.getByLabel("Référence de cadrage", { exact: true });
  const ref = await reference.locator("option").nth(1).getAttribute("value");
  await reference.selectOption(ref!);
  await saved(page);

  // Only the selected plan has an editor. Every control has a touch target and each viewport fits.
  await expect(editor).toHaveCount(1);
  const original = page.viewportSize()!;
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await step(page, "plans");
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll("body *")].filter(element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.right > innerWidth + 1; }).slice(0, 12).map(element => ({ tag: element.tagName, cls: element.className, right: element.getBoundingClientRect().right })) }));
    expect(layout.scrollWidth, JSON.stringify(layout)).toBeLessThanOrEqual(width + 1);
    for (const control of await editor.locator("input, select, summary").all()) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.setViewportSize(original);
  await editor.scrollIntoViewIfNeeded();
  await proof(page, "prise-p0-1-edition-390x844");
  await cards(page).nth(2).tap();
  await page.locator("[data-plan-delete]").tap();
  await expect(cards(page)).toHaveCount(2);
  await page.locator("[data-plan-undo] button").tap();
  await expect(cards(page)).toHaveCount(3);
  await page.locator('[data-plan="plan-02"]').tap();
  await page.locator("[data-plan-down]").tap();
  await saved(page);
  const order = await cards(page).evaluateAll(elements => elements.map(element => element.getAttribute("data-plan")));
  await page.reload();
  await expect(page.locator('[data-prise-ready="true"]')).toBeVisible();
  await expect(cards(page)).toHaveCount(3);
  expect(await cards(page).evaluateAll(elements => elements.map(element => element.getAttribute("data-plan")))).toEqual(order);
  await expect(page.locator('[data-plan="plan-02"]')).toHaveAttribute("aria-current", "true");
  await step(page, "plans");
  if (!await editor.getAttribute("open")) await editor.locator("summary").tap();
  await expect(page.getByLabel("Titre du plan", { exact: true })).toHaveValue("La porte dorée");
  await step(page, "preparer");
  await expect(action).toHaveValue("Léa ouvre la porte du laboratoire");
  await step(page, "plans");
  await expect(page.getByLabel("Cadrage", { exact: true })).toHaveValue("rapproche");
  await expect(page.getByLabel("Angle caméra", { exact: true })).toHaveValue("contre-plongee");
  await expect(page.getByLabel("Mouvement caméra", { exact: true })).toHaveValue("dolly");
  await expect(page.getByLabel("Position caméra", { exact: true })).toHaveValue("2 m à gauche");
  await expect(page.getByLabel("Durée du plan", { exact: true })).toHaveValue("10");
  await expect(reference).toHaveValue(ref!);
  await page.locator(".u-prise-strip").scrollIntoViewIfNeeded();
  await proof(page, "prise-p0-1-persistance-390x844");
  await page.locator("[data-plan-duplicate]").tap();
  await expect(cards(page)).toHaveCount(4);
  await page.locator("[data-plan-undo-action]").tap();
  await expect(cards(page)).toHaveCount(3);
  await saved(page);
});

test("PRISE : reprise sans renvoi, versions gardées et erreur persistante avec relance confirmée", async ({ page }) => {
  test.setTimeout(240_000);
  const comfy = await simulateComfy(page);
  let hold = true;
  let fail = false;
  await page.route(/\/api\/job\/[^/]+\/status$/, route => route.fulfill({ json: { status: fail ? "failed" : hold ? "in_progress" : "success" } }));
  await page.route(/\/api\/billing\/usage\/timeseries|customers\/balance/, route => route.fulfill({ json: { summary: { balance: { amount_micros: 500_000_000 - comfy.prompts.length * 10_000 } } } }));
  await prepare(page);
  await page.getByRole("textbox", { name: "Ce qui se passe", exact: true }).fill("Léa ouvre la porte du laboratoire");
  const generate = page.locator(".u-prise-actions .u-primary");
  await generate.tap();
  await page.locator("[data-confirm-gold]").tap();
  await expect.poll(() => comfy.prompts.length).toBe(1);
  await expect(cards(page).first()).toHaveAttribute("data-render-state", /queued|running/);
  await page.locator(".u-plan-add").tap();
  await saved(page);
  await expect(page.locator("[data-prise-progress]")).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-prise-ready="true"]')).toBeVisible();
  await expect(page.locator('[data-plan="plan-01"]')).toHaveAttribute("data-render-state", /queued|running/);
  await expect(page.locator('[data-plan="plan-02"]')).toHaveAttribute("data-render-state", "draft");
  expect(comfy.prompts).toHaveLength(1);
  hold = false;
  await expect(page.locator('[data-plan="plan-01"]')).toHaveAttribute("data-render-state", "done", { timeout: 60_000 });
  await page.locator('[data-plan="plan-01"]').tap();
  await expect(page.locator("[data-take-view] video")).toBeVisible();
  await page.locator("[data-garder]").tap();
  await page.locator("[data-autre-prise]").tap();
  await page.locator("[data-confirm-gold]").tap();
  await expect(page.locator("[data-take-view]")).toHaveAttribute("data-versions", "2", { timeout: 60_000 });
  await expect(page.locator("[data-version]").first()).toContainText("★");
  await saved(page);
  await page.reload();
  await expect(page.locator("[data-take-view]")).toHaveAttribute("data-versions", "2");
  await expect(page.locator("[data-version]").first()).toContainText("★");
  expect(comfy.prompts).toHaveLength(2);
  fail = true;
  await page.locator("[data-autre-prise]").tap();
  await page.locator("[data-confirm-gold]").tap();
  await expect(page.locator("[data-plan-error]")).toBeVisible();
  await expect(page.locator("[data-plan-retry]")).toBeEnabled();
  await saved(page);
  await page.reload();
  await expect(page.locator("[data-plan-error]")).toBeVisible();
  fail = false;
  await page.locator("[data-plan-retry]").tap();
  await expect(page.locator("[data-confirm-gold]")).toBeVisible();
  expect(comfy.prompts).toHaveLength(3);
  await page.locator("[data-confirm-gold]").tap();
  await expect(page.locator("[data-take-view]")).toHaveAttribute("data-versions", "3", { timeout: 60_000 });
  await expect(page.locator("[data-version]").first()).toContainText("★");
});

test("PRISE : Annuler reste disponible huit secondes, en pause au survol et au toucher", async ({ page }) => {
  await simulateComfy(page);
  await prepare(page);
  await page.clock.install({ time: new Date("2026-10-28T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-28T12:01:00Z"));
  await page.locator(".u-plan-add").dispatchEvent("click");
  const toast = page.locator("[data-plan-undo]");
  await expect(toast).toBeVisible();
  await toast.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
  const box = (await toast.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.clock.fastForward(9000);
  await expect(toast).toBeVisible();
  await page.mouse.move(0, 0);
  await toast.dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 2 });
  await page.clock.fastForward(9000);
  await expect(toast).toBeVisible();
  await toast.dispatchEvent("pointerup", { pointerType: "touch", pointerId: 2 });
  await page.clock.fastForward(7999);
  await expect(toast).toBeVisible();
  await page.clock.fastForward(1);
  await expect(toast).toHaveCount(0);
  // Dismissing a toast never drops the thirty-step history.
  await page.locator("[data-plan-undo-action]").dispatchEvent("click");
  await expect(cards(page)).toHaveCount(1);
});

test("PRISE : un ancien transfert attend le journal puis reste sauvegardé sans lancer de rendu", async ({ page }) => {
  const comfy = await simulateComfy(page);
  await prepare(page);
  const action = page.getByRole("textbox", { name: "Ce qui se passe", exact: true });
  await action.fill("Ancienne action du plan");
  await saved(page);
  await page.goto("/studio#outils");
  await page.evaluate(() => sessionStorage.setItem("u-ttu-barre-prise", JSON.stringify({
    action: "Le personnage traverse le laboratoire", castIds: [], castNames: [], decorId: null, decorName: "",
    settings: { rendu: "apercu", duree: 8, format: "9:16" },
  })));
  await page.goto("/studio#prise");
  await expect(page.locator('[data-prise-ready="true"]')).toBeVisible();
  await expect(action).toHaveValue("Le personnage traverse le laboratoire");
  await expect(page.locator("[data-rendu]")).toHaveAttribute("data-rendu", "apercu");
  await saved(page);
  await page.reload();
  await expect(page.locator('[data-prise-ready="true"]')).toBeVisible();
  await expect(action).toHaveValue("Le personnage traverse le laboratoire");
  await expect(page.locator("[data-rendu]")).toHaveAttribute("data-rendu", "apercu");
  expect(comfy.prompts).toHaveLength(0);
});
