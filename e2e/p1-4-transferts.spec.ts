import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { simulateComfy } from "./helpers/simulate-comfy";

// P1-4: DÉCOR viewpoints reach PRISE as framing references, and a kept take reaches MONTAGE by itself, once.
test.use({ hasTouch: true });

const nav = (page: Page, name: string) => page.getByRole("navigation").getByRole("button", { name, exact: false });

async function prepare(page: Page) {
  await page.goto("/studio#personnage");
  await page.getByLabel("Importer un personnage", { exact: true }).setInputFiles({ name: "Uttu.webp", mimeType: "image/webp", buffer: readFileSync("public/exemples/cast-coursiere.webp") });
  await expect(nav(page, "CAST")).toContainText("Prêt");
  await nav(page, "DÉCOR").tap();
  await page.getByLabel("Importer un décor", { exact: true }).setInputFiles({ name: "Le laboratoire.webp", mimeType: "image/webp", buffer: readFileSync("public/exemples/decor-couloir.webp") });
  await expect(nav(page, "DÉCOR")).toContainText("Prêt");
  await nav(page, "PRISE").tap();
  await expect(page.locator('[data-prise-ready="true"]')).toBeVisible();
}

test("DÉCOR → PRISE → MONTAGE : points de vue en référence, prise gardée montée une seule fois", async ({ page }) => {
  test.setTimeout(180_000);
  const comfy = await simulateComfy(page);
  await page.route(/\/api\/billing\/usage\/timeseries|customers\/balance/, route => route.fulfill({ json: { summary: { balance: { amount_micros: 500_000_000 - comfy.prompts.length * 10_000 } } } }));
  await prepare(page);

  // Framing reference: the set's viewpoints come first, in their own group, before the cast.
  const editor = page.locator("[data-plan-editor]");
  if (!(await editor.getAttribute("open") === "")) await editor.locator("summary").tap();
  const reference = page.getByLabel("Référence de cadrage", { exact: true });
  const groups = reference.locator("optgroup");
  await expect(groups.first()).toHaveAttribute("data-framing-group", "decor");
  await expect(groups.first()).toHaveAttribute("label", "DÉCOR · points de vue");
  expect(await groups.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-framing-group")))).toEqual(["decor", "cast"]);
  await expect(groups.first().locator("option").first()).toContainText("Le laboratoire");
  const viewpoint = await groups.first().locator("option").first().getAttribute("value");
  await reference.selectOption(viewpoint!);
  await expect(page.locator(".u-plan-ref")).toBeVisible();

  await page.getByRole("textbox", { name: "Ce qui se passe", exact: true }).fill("Uttu ouvre la porte du laboratoire");
  await page.locator(".u-prise-actions .u-primary").tap();
  await page.locator("[data-confirm-gold]").tap();
  await expect.poll(() => comfy.prompts.length).toBe(1);
  await expect(page.locator('[data-plan="plan-01"]')).toHaveAttribute("data-render-state", "done", { timeout: 60_000 });
  await page.locator('[data-plan="plan-01"]').tap();
  await expect(page.locator("[data-take-view] video")).toBeVisible();

  // Keep: the take goes to MONTAGE without leaving PRISE. Keeping again never doubles it.
  const before = page.url();
  await page.locator("[data-garder]").tap();
  await expect(page.getByText("Prise gardée : elle est dans le montage.")).toBeVisible();
  await page.locator("[data-garder]").tap();
  await expect(page.locator('[data-prise-ready="true"]')).toBeVisible();
  expect(page.url()).toBe(before);
  expect(comfy.prompts).toHaveLength(1);

  await nav(page, "MONTAGE").tap();
  await expect(page.locator(".u-clip.is-video[data-clip-take]")).toHaveCount(1);
});
