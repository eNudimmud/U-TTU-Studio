import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { simulateComfy } from "./helpers/simulate-comfy";

// P1-3 : sur mobile, PRISE se lit en cinq étapes. Une seule étape visible à la fois ; la bande des
// plans, l'aperçu et la barre d'action restent ; un seul éditeur de plan.
test.use({ hasTouch: true });
const STEPS = ["preparer", "plans", "previs", "generer", "reviser"] as const;
const LABELS = ["Préparer", "Plans", "Prévisualiser", "Générer", "Réviser"];

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
async function proof(page: Page, name: string) {
  if (!process.env.PRISE_SHOTS_DIR) return;
  mkdirSync(process.env.PRISE_SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: join(process.env.PRISE_SHOTS_DIR, `${name}.png`) });
}
async function fits(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
}

for (const [width, height] of [[390, 844], [844, 390]] as const) {
  test(`PRISE en 5 étapes à ${width}×${height}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "parcours mobile");
    await page.setViewportSize({ width, height });
    await simulateComfy(page);
    await prepare(page);
    const shell = page.locator("[data-prise-shell]");
    const steps = page.locator("[data-prise-steps] [data-prise-step]");
    await expect(steps).toHaveCount(5);
    for (const [i, id] of STEPS.entries()) {
      const step = page.locator(`[data-prise-step=${id}]`);
      await expect(step).toHaveAttribute("aria-label", `Étape ${i + 1} sur 5 · ${LABELS[i]}`);
      const box = (await step.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    const editor = page.locator("[data-plan-editor]");
    const action = page.getByRole("textbox", { name: "Ce qui se passe", exact: true });
    const next = page.locator("[data-prise-step-next]");
    const prev = page.locator("[data-prise-step-prev]");

    // 1 · Préparer : l'action se remplit ici ; pas d'éditeur de plan, pas d'outils de liste.
    await expect(shell).toHaveAttribute("data-prise-etape", "preparer");
    await expect(page.locator("[data-prise-step=preparer]")).toHaveAttribute("aria-current", "step");
    await expect(page.locator(".u-prise-strip")).toBeVisible();
    await expect(editor).toBeHidden();
    await expect(prev).toHaveCount(0);
    await action.fill("Léa ouvre la porte du laboratoire");
    await fits(page, width);
    await proof(page, `prise-etape-1-preparer-${width}x${height}`);

    // 2 · Plans : un seul éditeur, ouvert ; l'action n'est plus à l'écran.
    await expect(next).toHaveText("Suivant : Plans →");
    await next.tap();
    await expect(shell).toHaveAttribute("data-prise-etape", "plans");
    await expect(editor).toHaveCount(1);
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAttribute("open", "");
    await expect(action).toHaveCount(0);
    await expect(page.locator("[data-prise-step=preparer]")).toHaveAttribute("data-done", "");
    await fits(page, width);
    await proof(page, `prise-etape-2-plans-${width}x${height}`);

    // 3 · Prévisualiser : la maquette s'ouvre d'elle-même, avant tout crédit.
    await next.tap();
    await expect(shell).toHaveAttribute("data-prise-etape", "previs");
    await expect(editor).toBeHidden();
    await expect(page.locator("[data-maquette]")).toBeVisible();
    await fits(page, width);
    await proof(page, `prise-etape-3-previs-${width}x${height}`);

    // 4 · Générer : la carte du rendu (devis puis lancement confirmé) apparaît.
    await next.tap();
    await expect(shell).toHaveAttribute("data-prise-etape", "generer");
    await expect(page.locator(".u-prise-dock > .u-prise-card").first()).toBeVisible();
    await expect(page.locator("[data-maquette]")).toBeHidden();
    await fits(page, width);
    await proof(page, `prise-etape-4-generer-${width}x${height}`);

    // 5 · Réviser : dernière étape, pas de « Suivant ».
    await next.tap();
    await expect(shell).toHaveAttribute("data-prise-etape", "reviser");
    await expect(next).toHaveCount(0);
    await expect(prev).toHaveText("← Retour : Générer");
    await fits(page, width);
    await proof(page, `prise-etape-5-reviser-${width}x${height}`);

    // Retour direct par la barre des étapes, et l'action saisie est toujours là.
    await page.locator("[data-prise-step=preparer]").tap();
    await expect(shell).toHaveAttribute("data-prise-etape", "preparer");
    await expect(action).toHaveValue("Léa ouvre la porte du laboratoire");
  });
}

test("PRISE : pas d'étapes au-dessus de 1023 px", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "parcours mobile");
  for (const [width, height] of [[1024, 600], [1280, 800]] as const) {
    await page.setViewportSize({ width, height });
    if (width === 1024) await prepare(page);
    await expect(page.locator("[data-prise-steps]")).toBeHidden();
    await expect(page.locator("[data-prise-step-nav]")).toBeHidden();
    await expect(page.locator("[data-plan-editor]")).toHaveCount(1);
  }
});
