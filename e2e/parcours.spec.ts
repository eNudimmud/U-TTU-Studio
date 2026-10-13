import { expect, test } from "@playwright/test";

test("CAST, décor, prise et montage avec les pistes son", async ({ page }) => {
  const spent: string[] = [];
  const upstream: string[] = [];
  page.on("request", request => {
    const url = request.url();
    if (/fal\.ai|comfy\.cloud|api\.comfy|partner_generate|run_template/i.test(url)) spent.push(url);
    if (/overpass-api\.de|nominatim\.openstreetmap\.org|photon\.komoot\.io|elevation-tiles-prod|earth\.google\.com|maps\.google\.|google\.com\/maps|goo\.gl|maps\.app|mapillary\.com|fbcdn\.net|panoramax|overturemaps/i.test(url)) upstream.push(url);
  });
  await page.route(/overpass-api\.de|nominatim\.openstreetmap\.org|photon\.komoot\.io|elevation-tiles-prod|earth\.google\.com|maps\.google\.|google\.com\/maps|goo\.gl|maps\.app|mapillary\.com|fbcdn\.net|panoramax|overturemaps/i, route => route.abort());

  await page.goto("/studio?demo=1#personnage");
  await expect(page.getByRole("heading", { name: "CAST" })).toBeVisible();
  const gallery = page.getByRole("button", { name: "Galerie", exact: true });
  if (await gallery.isVisible()) await gallery.click();
  await expect(page.getByText("Uttu").first()).toBeVisible();

  await page.getByRole("navigation").getByRole("button", { name: "DÉCOR" }).click();
  await expect(page.getByText("© contributeurs OpenStreetMap, ODbL")).toBeVisible();
  await expect(page.getByText("OpenFreeMap")).toBeVisible();
  await expect(page.getByText("1. Touche un point sur la carte.")).toBeVisible();
  await page.locator(".maplibregl-canvas").click({ position: { x: 220, y: 140 } });
  await expect(page.locator("[data-pas='1']")).toBeVisible();
  await expect(page.locator("[data-rue-vue]")).toBeVisible();
  const narrow = (page.viewportSize()?.width ?? 1280) < 800;
  if (narrow) await page.getByRole("button", { name: "Quitter la vue" }).click();
  await page.getByRole("button", { name: "Montmartre", exact: true }).click();
  await expect(page.getByText("2. Dans la rue")).toBeVisible();
  const view = page.locator("[data-rue-vue]");
  const canvas = page.locator(".u-rue-canvas");
  await canvas.waitFor();
  await view.scrollIntoViewIfNeeded();
  const angleBefore = await view.getAttribute("data-cap");
  const viewBox = await canvas.boundingBox();
  expect(viewBox).toBeTruthy();
  await page.mouse.move(viewBox!.x + 40, viewBox!.y + 50);
  await page.mouse.down();
  await page.mouse.move(viewBox!.x + 180, viewBox!.y + 50, { steps: 10 });
  await page.mouse.up();
  await expect(view).not.toHaveAttribute("data-cap", angleBefore ?? "");
  await expect(page.locator("[data-photos=fixture]")).toBeVisible();
  await expect(view).toHaveAttribute("data-photo", "fixture-ada");
  const credit = page.locator("[data-rue-credit]");
  await expect(credit).toContainText("Panoramax");
  await expect(credit).toContainText("CC BY-SA");
  await expect(credit).toContainText("Ada Rue");
  await page.locator("[data-prendre-vue]").click();
  const added = page.locator("[data-photo-ajoute]");
  await expect(added).toContainText("Photo ajoutée aux références.");
  await expect(added).toContainText("CC BY-SA");
  const creer = page.locator("[data-creer-decor]");
  await expect(creer).toBeDisabled();
  await expect(page.locator("#u-why-creer")).toContainText("démo");
  await expect(page.locator("[data-pas='3']")).toContainText("13");
  await expect(page.locator("[data-pas='3']")).toHaveAttribute("data-choisies", "1");
  await page.getByRole("button", { name: "Garder ce lieu" }).click();
  await expect(page.getByText("Enregistré dans Mon studio.")).toBeVisible();

  await page.getByRole("navigation").getByRole("button", { name: "PRISE" }).click();
  const stage = page.locator("[data-maquette]");
  await expect(stage).toBeVisible();
  await expect(stage).toHaveAttribute("data-quartier", "1");
  await expect(stage).toHaveAttribute("data-figures", "1");
  const names = page.locator(".u-maquette-names");
  await expect(names).toHaveText("Uttu");
  await expect(page.locator("[data-tuile=contre]")).toBeDisabled();
  await expect(page.locator("#u-why-paire")).toContainText("deux personnages");
  await page.locator("[data-add-person]").click();
  await page.locator("[data-pick=neutre]").click();
  await expect(stage).toHaveAttribute("data-figures", "2");
  await expect(names).toContainText("Personnage");
  await expect(page.locator("[data-tuile=contre]")).toBeEnabled();
  await page.locator("[data-add-person]").click();
  await page.locator("[data-pick=demo-coursiere]").click();
  await expect(stage).toHaveAttribute("data-figures", "3");
  await expect(names).toContainText("La coursière");
  const spread = await stage.getAttribute("data-layout");
  const xs = [...String(spread).matchAll(/@(-?\d+\.\d+),(-?\d+\.\d+)/g)].map(match => [Number(match[1]), Number(match[2])]);
  expect(xs).toHaveLength(3);
  const ordered = xs.map(point => point[0]).sort((a, b) => a - b);
  expect(ordered[1] - ordered[0]).toBeGreaterThan(1.2);
  expect(ordered[2] - ordered[1]).toBeGreaterThan(1.2);
  for (const point of xs) expect(Math.abs(point[1])).toBeLessThan(0.05);
  const brief = page.locator("[data-lire-maquette]");
  await expect(brief).toContainText("Uttu");
  await expect(brief).toContainText("Personnage");
  await expect(brief).toContainText("La coursière");
  await expect(brief).toContainText("Montmartre");
  await expect(brief).toContainText("Regard caméra");
  await expect(page.locator(".u-who")).toContainText("Uttu");
  await expect(page.locator(".u-who")).toContainText("Personnage");
  await expect(page.locator(".u-prise-head .u-plan-etat")).toHaveText("En place");
  await expect(page.locator(".u-plan-card[aria-current='true'] .u-plan-etat")).toHaveText("En place");
  await expect(page.locator(".u-prise").getByText("Ce qui se passe", { exact: true })).toHaveCount(1);
  await page.locator("[data-tourner]").first().click();
  await page.locator("[data-retirer=neutre-1]").click();
  await expect(stage).toHaveAttribute("data-figures", "2");
  await expect(names).not.toContainText("Personnage");
  const hintFit = await page.evaluate(() => {
    const frame = document.querySelector(".u-maquette-stage");
    const hint = document.querySelector(".u-maquette-hint");
    if (!(frame instanceof HTMLElement) || !(hint instanceof HTMLElement)) return "manque";
    const box = frame.getBoundingClientRect();
    const band = hint.getBoundingClientRect();
    if (band.left < box.left - 1 || band.right > box.right + 1 || band.top < box.top || band.bottom > box.bottom + 1) return "debord";
    if (hint.scrollHeight > hint.clientHeight + 2) return "coupe";
    return "";
  });
  expect(hintFit).toBe("");

  await page.locator("[data-tuile=large]").click();
  await expect(stage).toHaveAttribute("data-tuile", "large");
  await expect(page.locator(".u-maquette-badge")).toHaveText("Plan large");
  await page.locator("[data-autre-essai]").click();
  const pose = page.getByRole("button", { name: "Garder la pose" });
  await pose.click();
  await expect(pose).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.locator("[data-rendre]")).toHaveCount(0);
  await expect(page.locator(".u-prise .u-primary")).toHaveCount(1);
  await expect(page.locator(".u-prise").getByText("estimation à mesurer")).toHaveCount(0);
  await expect(page.locator(".u-prise").getByText("Devis : inconnu")).toHaveCount(0);
  await expect(page.locator(".u-prise").getByText("Choisis au moins un personnage ou un lieu.")).toHaveCount(0);
  await expect(page.locator(".u-prise-quote:visible")).toHaveCount(1);
  await expect(page.locator(".u-prise-quote:visible")).toContainText("12,5");

  await page.getByRole("navigation").getByRole("button", { name: "MONTAGE" }).click();
  await expect(page.getByRole("navigation").getByRole("button", { name: "MONTAGE" })).toContainText("Prêt");
  for (const word of ["Voix", "Effets", "Musique"]) {
    const label = page.locator(".u-track-word", { hasText: word });
    await expect(label).toHaveText(word);
    const clipped = await label.evaluate(node => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1);
    expect(clipped, word).toBe(false);
  }
  const viewport = page.viewportSize() ?? { width: 1280, height: 800 };
  for (const track of ["voix", "effets", "musique"]) {
    const row = page.locator(`[data-track=${track}]`);
    await expect(row).toBeVisible();
    const box = await row.boundingBox();
    expect(box, track).toBeTruthy();
    expect(box!.height).toBeGreaterThan(40);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 2);
  }

  const clip = page.locator("[data-track=voix] .u-clip").first();
  const before = await clip.boundingBox();
  expect(before).toBeTruthy();
  await page.mouse.move(before!.x + 24, before!.y + before!.height / 2);
  await page.mouse.down();
  await page.mouse.move(before!.x + 120, before!.y + before!.height / 2, { steps: 8 });
  await page.mouse.up();
  const after = await clip.boundingBox();
  expect(after!.x).toBeGreaterThan(before!.x + 8);

  const play = page.locator(".u-play");
  const label = await play.getAttribute("aria-label");
  await play.click();
  await expect(play).not.toHaveAttribute("aria-label", label ?? "");

  await page.getByRole("navigation").getByRole("button", { name: "PRISE" }).click();
  await page.locator("[data-envoyer-montage]").click();
  await expect(page.locator("[data-track=voix]")).toBeVisible();
  await expect(page.locator(".u-track .u-clip").first()).toBeVisible();
  expect(spent).toEqual([]);
  expect(upstream).toEqual([]);
});
