import { expect, test, type Page } from "@playwright/test";
import { simulateComfy } from "./helpers/simulate-comfy";

// « Outils » : the hub, one panel for every tool, results with « Et ensuite ? » open.
// Comfy is simulated: nothing leaves, nothing is spent, nothing is cancelled.

type Graph = Record<string, { class_type: string }>;

async function watch(page: Page) {
  const graphs: Graph[] = [];
  let cancels = 0;
  await page.route(/\/api\/prompt$/, route => { graphs.push(route.request().postDataJSON()?.prompt ?? {}); return route.fallback(); });
  await page.route(/\/api\/(queue|interrupt)$/, route => { cancels += 1; return route.fulfill({ json: {} }); });
  return { graphs, cancels: () => cancels };
}

test("hub : un clic depuis la barre du haut, 57 outils par famille, recherche et filtres, « bientôt » sans bouton", async ({ page }) => {
  await page.goto("/studio#personnage");
  await expect(page.locator("[data-outils-entry]")).toBeVisible();
  await page.locator("[data-top-outils]").click();
  await expect(page).toHaveURL(/#outils$/);
  const hub = page.locator("[data-outils-hub]");
  await expect(hub.getByRole("heading", { name: "Que veux-tu créer ?" })).toBeVisible();
  await expect(hub.locator("[data-outil]")).toHaveCount(57);
  // Every tool shows on an empty studio; a tool that is not wired is an article with its reason, never a button.
  await expect(hub.locator("button[data-outil]")).toHaveCount(46);
  await expect(hub.locator("article[data-outil][data-etat=bientot]")).toHaveCount(10);
  await expect(hub.locator("[data-outil=ret-gommer]")).toContainText("Bientôt");
  for (const card of (await hub.locator("button[data-outil]").all()).slice(0, 6)) expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(hub.locator("[data-outil=img-klein]")).toContainText("estimé");
  await expect(hub.locator("[data-outil=vid-kling]")).toContainText("Partenaire");

  await hub.locator("[data-outils-famille=retoucher]").click();
  await expect(hub.locator("[data-outils-section]")).toHaveCount(1);
  await expect(hub.locator("[data-outil=ret-detourer]")).toBeVisible();
  await expect(hub.locator("[data-outil=img-klein]")).toHaveCount(0);
  await hub.locator("[data-outils-famille=tout]").click();
  await hub.locator("[data-outils-search]").fill("detourer");
  await expect(hub.locator("[data-outil]")).toHaveCount(2);

  // Each tab lists its own tools from the same data, folded.
  await page.getByRole("navigation").getByRole("button", { name: "DÉCOR" }).click();
  await expect(page.locator("[data-outils-onglet=decor]")).toHaveCount(1);
  await expect(page.locator("[data-outils-onglet=decor]")).not.toHaveAttribute("open", "");
});

test("panneau unique : entrée, exemple gratuit, bouton nommé d'après l'action, résultat avec « Et ensuite ? » ouvert", async ({ page }) => {
  await simulateComfy(page);
  const seen = await watch(page);
  await page.goto("/studio#outils/ret-detourer");
  const panel = page.locator("[data-tool-panel=ret-detourer]");
  await expect(panel).toBeVisible();
  const steps = await panel.locator("[data-tool-step]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-tool-step")));
  expect(steps).toEqual(["entree"]);
  const go = panel.locator("[data-tool-go]");
  await expect(go).toContainText("Détourer");
  await expect(go).toContainText("≈ 2 cr.");
  await expect(go).toBeDisabled();
  await expect(panel.locator("[data-tool-why]")).toHaveText("Ajoute une image pour lancer.");
  await panel.locator("[data-outil-sample=image]").click();
  await expect(panel.locator("[data-outil-input=image] img")).toBeVisible();
  await expect(panel.locator("[data-tool-why]")).toHaveText("Coche la confirmation pour lancer.");
  await panel.locator("[data-tool-confirm]").click();
  await expect(go).toBeEnabled();
  expect((await go.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await go.click();
  await expect(panel.locator("[data-tool-done]")).toBeVisible({ timeout: 60_000 });
  const results = page.locator("[data-tool-results]");
  await expect(results.locator("[data-result]").first()).toBeVisible();
  await expect(results.locator("[data-suite-toggle]").first()).toHaveAttribute("aria-expanded", "true");
  await expect(results.locator("[data-suite-item]").first()).toBeVisible();
  expect(Object.values(seen.graphs.at(-1) ?? {}).map(node => node.class_type)).toEqual(expect.arrayContaining(["RemoveBackground", "SaveImage"]));
  expect(seen.cancels()).toBe(0);
});

test("outil ouvert depuis un texte : le template officiel entier part, le résultat arrive dans Mon studio", async ({ page }) => {
  await simulateComfy(page);
  const seen = await watch(page);
  await page.goto("/studio#outils/img-qwen");
  const panel = page.locator("[data-tool-panel=img-qwen]");
  await panel.getByLabel("Consigne", { exact: true }).fill("Une gare la nuit, néons dorés, pluie fine.");
  await panel.locator("[data-tool-step=reglages] > summary").click();
  await panel.locator("[data-tool-aspect=vertical]").click();
  await panel.locator("[data-tool-confirm]").click();
  await panel.locator("[data-tool-go]").click();
  await expect(panel.locator("[data-tool-done]")).toBeVisible({ timeout: 60_000 });
  const graph = seen.graphs.at(-1) ?? {};
  expect(Object.values(graph).map(node => node.class_type).some(type => /^SaveImage/.test(type))).toBe(true);
  expect(JSON.stringify(graph)).toContain("Une gare la nuit");
  expect(JSON.stringify(graph)).toContain("9:16");
  expect(seen.cancels()).toBe(0);
  await page.goto("/mon-studio");
  await expect(page.locator(".u-tool-results [data-result]").first()).toBeVisible();
});

test("sans compte relié : la raison et le lien « Relier mon compte » sont à côté du bouton éteint", async ({ page }) => {
  await page.goto("/studio#outils/img-klein");
  const panel = page.locator("[data-tool-panel=img-klein]");
  await panel.getByLabel("Consigne", { exact: true }).fill("Un toit au lever du jour.");
  await panel.locator("[data-tool-confirm]").click();
  await expect(panel.locator("[data-tool-go]")).toBeDisabled();
  await expect(panel.locator("[data-tool-why]")).toContainText("Relie ton compte");
  await panel.locator("[data-tool-link]").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("MONTAGE : le menu Plus se ferme avec Échap et ne bloque plus les onglets", async ({ page }) => {
  await page.goto("/studio#montage");
  const more = page.getByRole("button", { name: "Plus", exact: true }).first();
  await more.click();
  const menu = page.locator(".u-popover");
  await expect(menu).toBeVisible();
  await expect(menu.locator("[data-more-outils]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await more.click();
  await expect(menu).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: "DÉCOR" }).click();
  await expect(page.getByRole("heading", { name: "DÉCOR" })).toBeVisible();
});
