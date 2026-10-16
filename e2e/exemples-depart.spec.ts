import { expect, test } from "@playwright/test";

test("Partir de cet exemple remplit CAST, DÉCOR, PRISE et MONTAGE sans rien dépenser", async ({ page }) => {
  const spent: string[] = [];
  page.on("request", request => {
    if (/fal\.ai|comfy\.cloud|api\.comfy|partner_generate|run_template/i.test(request.url())) spent.push(request.url());
  });
  await page.route(/overpass-api\.de|nominatim|photon\.komoot\.io|panoramax|mapillary|tiles\.openfreemap/i, route => route.abort());

  await page.goto("/studio#personnage");
  await expect(page.getByRole("heading", { name: "CAST" })).toBeVisible();
  const castCard = page.locator("[data-depart=cast]");
  await expect(castCard).toBeVisible();
  await expect(castCard).toContainText("Exemple — refais-le");
  const narrow = (page.viewportSize()?.width ?? 1280) < 800;
  const start = page.locator("[data-partir-exemple='cast-photos']");
  await expect(start).toHaveText("Partir de cet exemple");
  const box = await start.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await castCard.locator("[data-partir-exemple=cast]").click();
  await expect(page.getByLabel("Nom")).toHaveValue("Uttu");
  await expect(castCard).toHaveCount(0);
  await expect(page.locator(".u-desk-scroll textarea")).not.toHaveValue("");

  // Tile button fills a different gesture in one tap.
  if (narrow) await page.getByRole("button", { name: "Que veux-tu faire ?" }).click().catch(() => undefined);
  await page.locator("[data-partir-exemple='cast-texte']").click();
  await expect(page.getByLabel("Nom")).toHaveValue("Le vieil homme");

  await page.getByRole("navigation").getByRole("button", { name: "DÉCOR" }).click();
  const decorCard = page.locator("[data-depart=decor]");
  await expect(decorCard).toBeVisible();
  await decorCard.locator("[data-partir-exemple=decor]").click();
  await expect(page.getByLabel("Nom")).toHaveValue("Le quai, la nuit");
  await expect(decorCard).toHaveCount(0);

  await page.getByRole("navigation").getByRole("button", { name: "PRISE" }).click();
  const priseCard = page.locator("[data-depart=prise]");
  await expect(priseCard).toBeVisible();
  await priseCard.locator("[data-partir-exemple=prise]").click();
  await expect(page.locator("[data-prise-seed=compose]")).toBeVisible();
  await expect(priseCard).toHaveCount(0);

  await page.getByRole("navigation").getByRole("button", { name: "MONTAGE" }).click();
  await expect(page.locator("[data-depart=montage]")).toBeVisible();
  await page.locator("[data-partir-exemple=montage]").click();
  await expect(page.locator("[data-montage=exemple]")).toBeVisible();
  expect(spent).toEqual([]);
});
