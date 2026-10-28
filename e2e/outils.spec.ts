import { expect, test, type Page } from "@playwright/test";
import { simulateComfy } from "./helpers/simulate-comfy";
import { openToolsHub } from "./helpers/top-bar";

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

test("hub : un clic depuis la barre du haut, une carte par intention, recherche, bientôt absent", async ({ page }) => {
  await page.goto("/studio#outils/tous");
  const hub = page.locator("[data-studio-entry]");
  await expect(hub.getByRole("heading", { name: "Que veux-tu créer ?" })).toBeVisible();
  await expect(hub.locator("[data-outil]")).toHaveCount(34);
  await expect(hub.locator("article[data-outil][data-etat=bientot]")).toHaveCount(0);
  await expect(hub.locator("[data-outil=ret-gommer]")).toHaveCount(0);
  await expect(hub.locator("[data-outil=vid-kling]")).toHaveCount(0);
  await expect(hub.locator("[data-outil=vid-wan]")).toContainText("Animer une image");
  for (const card of (await hub.locator("button[data-outil]").all()).slice(0, 6)) expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await hub.locator("[data-outils-search]").fill("detourer");
  await expect(hub.locator("[data-outil]")).toHaveCount(2);

  await page.goto("/studio#personnage");
  await openToolsHub(page);
  await expect(page).toHaveURL(/#outils\/tous$/);
  const burger = page.locator("[data-top-burger]");
  if (await burger.isVisible()) await burger.click();
  await page.locator("[data-top-menu=film]").filter({ visible: true }).first().click();
  await page.locator("[data-film=decor]").filter({ visible: true }).first().click();
  const strip = page.locator("[data-outils-onglet=decor]");
  await expect(strip).toHaveCount(1);
  await expect(strip.locator("> button")).toHaveAttribute("aria-expanded", "false");
});

test("panneau unique : entrée, exemple, bouton nommé d'après l'action, le résultat du jour en grand avec « Et ensuite ? » ouvert", async ({ page }) => {
  await simulateComfy(page);
  const seen = await watch(page);
  await page.goto("/studio#outils/ret-detourer");
  const panel = page.locator("[data-tool-panel=ret-detourer]");
  await expect(panel).toBeVisible();
  const steps = await panel.locator("[data-tool-step]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-tool-step")));
  expect(steps[0]).toBe("modele");
  expect(steps).toContain("entree");
  expect(steps).not.toContain("protocole");
  const go = panel.locator("[data-tool-go]");
  await expect(go).toContainText("Détourer");
  await expect(go).toContainText("≈ 1 crédit");
  await expect(go).toBeEnabled();
  await panel.locator("[data-outil-sample=image]").click();
  await expect(panel.locator("[data-outil-input=image] img")).toBeVisible();
  expect((await go.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await go.click();
  await expect(panel.locator("[data-tool-ask]")).toBeVisible();
  await panel.locator("[data-tool-confirm]").click();
  await expect(panel.locator("[data-tool-done]")).toBeVisible({ timeout: 60_000 });
  // Only the run just made shows here, big, with « Et ensuite ? » open. Past runs live in Mes créations.
  await expect(page.locator("[data-tool-results]")).toHaveCount(0);
  const result = page.locator("[data-tool-result=image]");
  await expect(result.locator("img")).toBeVisible();
  expect((await result.locator("img").boundingBox())!.width).toBeGreaterThan(200);
  await expect(result.locator("[data-suite-toggle]")).toHaveAttribute("aria-expanded", "true");
  await expect(result.locator("[data-suite-item]").first()).toBeVisible();
  await expect(result.locator("[data-tool-result-lib]")).toHaveAttribute("href", /\/mon-studio$/);
  expect(Object.values(seen.graphs.at(-1) ?? {}).map(node => node.class_type)).toEqual(expect.arrayContaining(["RemoveBackground", "SaveImage"]));
  expect(seen.cancels()).toBe(0);
});

test("outil ouvert depuis un texte : le template officiel entier part, le résultat arrive dans Mes créations", async ({ page }) => {
  await simulateComfy(page);
  const seen = await watch(page);
  await page.goto("/studio#outils/img-qwen");
  const panel = page.locator("[data-tool-panel=img-qwen]");
  await panel.getByLabel("Consigne", { exact: true }).fill("Une gare la nuit, néons dorés, pluie fine.");
  await panel.locator("[data-tool-step=reglages] > button").click();
  await panel.locator("[data-tool-aspect=vertical]").click();
  await panel.locator("[data-tool-go]").click();
  await panel.locator("[data-tool-confirm]").click();
  await expect(panel.locator("[data-tool-done]")).toBeVisible({ timeout: 60_000 });
  const graph = seen.graphs.at(-1) ?? {};
  expect(Object.values(graph).map(node => node.class_type).some(type => /^SaveImage/.test(type))).toBe(true);
  expect(JSON.stringify(graph)).toContain("Une gare la nuit");
  expect(JSON.stringify(graph)).toContain("9:16");
  expect(seen.cancels()).toBe(0);
  // Mes créations: one library, the Images tab keeps it; its sheet reuses « Et ensuite ? » under Convertir / Retoucher.
  await page.goto("/mon-studio?type=images");
  await expect(page.locator("[data-creations-tab=images]")).toHaveAttribute("aria-pressed", "true");
  const card = page.locator(".u-asset-grid article").first();
  await expect(card).toBeVisible();
  await card.locator(".u-pick").click();
  const sheet = page.locator(".u-asset-detail");
  await expect(sheet.locator("[data-item-use]")).toBeVisible();
  await expect(sheet.locator("[data-suite-group=convert] [data-suite-item]").first()).toBeVisible();
  await expect(sheet.locator("[data-suite-group=retouch] [data-suite-item]").first()).toBeVisible();
  await page.locator("[data-creations-tab=videos]").click();
  await expect(page).toHaveURL(/type=videos/);
  await expect(page.locator(".u-asset-grid article")).toHaveCount(0);
});

test("sans compte relié : la raison et le lien « Relier mon compte » sont à côté du bouton éteint", async ({ page }) => {
  await page.goto("/studio#outils/img-klein");
  const panel = page.locator("[data-tool-panel=img-klein]");
  await panel.getByLabel("Consigne", { exact: true }).fill("Un toit au lever du jour.");
  await expect(page.locator("[data-entry-link]")).toBeVisible();
  await panel.locator("[data-tool-go]").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("entrée : une phrase part vers le bon outil, le film ouvre CAST", async ({ page }) => {
  await page.goto("/studio#outils/tous");
  await page.locator("[data-entry-chip=anim]").click();
  await expect(page).toHaveURL(/#outils\/vid-wan$/);
  await expect(page.locator("[data-tool-panel=vid-wan] [data-tool-step=consigne] textarea")).toHaveValue(/Animer/);
  await page.goto("/studio#outils/tous");
  await page.locator("[data-entry-film]").click();
  await expect(page).toHaveURL(/#personnage$/);
  await expect(page.locator(".u-chain")).toBeVisible();
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

test('passer d’un outil à l’autre : un seul panneau à la fois, plus de liste des anciens résultats', async ({ page }) => {
  await page.goto('/studio#outils/img-klein');
  await expect(page.locator('[data-tool-panel]')).toHaveCount(1);
  await page.evaluate(() => { location.hash = 'outils/vid-parler'; });
  await expect(page.locator('[data-tool-panel="vid-parler"]')).toBeVisible();
  await page.evaluate(() => { location.hash = 'outils/img-klein'; });
  await expect(page.locator('[data-tool-panel]')).toHaveCount(1);
  await expect(page.locator('[data-tool-panel="img-klein"] [data-tool-step=consigne] textarea')).toHaveCount(1);
  await expect(page.locator('[data-tool-results], [data-results-filter]')).toHaveCount(0);
});

test("brouillon : le texte et l’image d’un outil sont toujours là quand on y revient", async ({ page }) => {
  await page.goto("/studio#outils/img-klein");
  const panel = page.locator('[data-tool-panel="img-klein"]');
  await panel.locator("[data-tool-step=consigne] textarea").fill("un chat roux sur un toit");
  await page.evaluate(() => { location.hash = "outils/vid-parler"; });
  await expect(page.locator('[data-tool-panel="vid-parler"]')).toBeVisible();
  await page.evaluate(() => { location.hash = "outils/img-klein"; });
  await expect(panel.locator("[data-tool-step=consigne] textarea")).toHaveValue("un chat roux sur un toit");
  await page.reload();
  await expect(page.locator('[data-tool-panel="img-klein"] [data-tool-step=consigne] textarea')).toHaveValue("un chat roux sur un toit");
});

test("raccord : deux cases visibles, image de départ et image d’arrivée", async ({ page }) => {
  await page.goto("/studio#outils/vid-raccord");
  const panel = page.locator("[data-tool-panel]").first();
  await expect(panel.locator("[data-outil-input=image]")).toBeVisible();
  await expect(panel.locator("[data-outil-input=image2]")).toBeVisible();
  await expect(panel.locator("[data-outil-input=image] .u-label")).toHaveText("Image de départ");
  await expect(panel.locator("[data-outil-input=image2] .u-label")).toHaveText("Image d’arrivée");
});

test("compteur : l’annonce compte toutes les cartes affichées", async ({ page }) => {
  await page.goto("/studio#outils/tous");
  const hub = page.locator("[data-studio-entry]");
  await expect(hub.locator("[data-outil]")).toHaveCount(34);
  const cards = await hub.locator(".u-outils-row > .u-outil-card").count();
  expect(cards).toBe(36);
  await expect(hub.locator(".u-entry-ask .eyebrow")).toContainText(`${cards} outils`);
});
