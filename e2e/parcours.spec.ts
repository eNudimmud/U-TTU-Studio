import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.use({ launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] } });
const TILE = readFileSync("e2e/fixtures/reperage-tile.pbf");
const TERRAIN = readFileSync("e2e/fixtures/reperage-terrain.png");

test("CAST, décor, prise et montage avec les pistes son", async ({ page }) => {
  const spent: string[] = [];
  const upstream: string[] = [];
  page.on("request", request => {
    const url = request.url();
    if (/fal\.ai|comfy\.cloud|api\.comfy|partner_generate|run_template/i.test(url)) spent.push(url);
    if (/overpass-api\.de|nominatim\.openstreetmap\.org|photon\.komoot\.io|earth\.google\.com|maps\.google\.|google\.com\/maps|goo\.gl|maps\.app|mapillary\.com|fbcdn\.net|panoramax|overturemaps/i.test(url)) upstream.push(url);
  });
  await page.route(/overpass-api\.de|nominatim\.openstreetmap\.org|photon\.komoot\.io|elevation-tiles-prod|earth\.google\.com|maps\.google\.|google\.com\/maps|goo\.gl|maps\.app|mapillary\.com|fbcdn\.net|panoramax|overturemaps/i, route => route.abort());

  // The 3D repérage reads local fixtures; Swiss roofs and aerial photos are refused (OSM volumes then).
  await page.route(/geo\.admin\.ch/, route => route.abort("blockedbyclient"));
  await page.route("https://tiles.openfreemap.org/planet", route => route.fulfill({ json: { tiles: ["https://tiles.openfreemap.org/planet/fixture/{z}/{x}/{y}.pbf"], maxzoom: 14 }, headers: { "access-control-allow-origin": "*" } }));
  await page.route("https://tiles.openfreemap.org/planet/fixture/**", route => route.fulfill({ body: TILE, contentType: "application/x-protobuf", headers: { "access-control-allow-origin": "*" } }));
  await page.route("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**", route => route.fulfill({ body: TERRAIN, contentType: "image/png", headers: { "access-control-allow-origin": "*" } }));

  await page.goto("/studio?demo=1#personnage");
  await expect(page.getByRole("heading", { name: "CAST" })).toBeVisible();
  const gallery = page.getByRole("button", { name: "Galerie", exact: true });
  if (await gallery.isVisible()) await gallery.click();
  await expect(page.getByText("La coursière").first()).toBeVisible();

  // DÉCOR has one location tool: the 3D repérage. Tiles and relief are local fixtures here.
  await page.getByRole("navigation").getByRole("button", { name: "DÉCOR" }).click();
  await expect(page.locator("[data-rep3d-entry]")).toHaveCount(1);
  await expect(page.locator("[data-repere-2d], .maplibregl-canvas")).toHaveCount(0);
  await page.locator("[data-rep3d-open]").click();
  const sheet = page.getByRole("dialog", { name: "Un vrai lieu en décor" });
  // Coordinates skip the geocoder: nothing leaves the machine.
  const search = sheet.getByRole("searchbox", { name: "Une adresse, une place, une ville" });
  await search.fill("46.5206, 6.6326");
  await search.press("Enter");
  await expect(sheet).toHaveAttribute("data-rep3d-state", "ready", { timeout: 30_000 });
  await page.locator("[data-rep3d-credits]").click();
  await expect(page.locator("[data-rep3d-credit]")).toContainText("© contributeurs OpenStreetMap");
  await expect(page.locator("[data-rep3d-credit]")).toContainText("OpenFreeMap");
  await page.keyboard.press("Escape");
  await page.locator("[data-rep3d-capture]").click();
  await expect(page.locator("[data-capture-done]")).toBeVisible({ timeout: 20_000 });
  // The block around the view goes with the capture, for PRISE's maquette.
  expect(Number(await page.locator("[data-capture-done]").getAttribute("data-rep3d-block"))).toBeGreaterThan(0);
  // The direct path needs no photo: the frame alone makes the décor, ≈ 6 crédits.
  await expect(page.locator("[data-rep3d-direct]")).toBeVisible();
  await expect(page.locator("[data-rep3d-refs]")).toHaveAttribute("data-rep3d-refs", "0");
  await expect(page.locator("[data-rep3d-create]")).toBeEnabled();
  await expect(page.locator("[data-rep3d-create]")).toContainText("≈ 6 crédits estimés");
  await expect(page.getByText(/≈ 13 crédits/)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  await page.getByRole("navigation").getByRole("button", { name: "PRISE" }).click();
  // The 3D maquette (P2) lives in « Avancé », closed by default.
  await expect(page.locator("[data-avance-prise]")).not.toHaveAttribute("open", "");
  await expect(page.locator("[data-prise-still]")).toBeVisible();
  await page.locator("[data-avance-prise] > summary").click();
  await page.locator("[data-avance-toggle=maquette]").click();
  const stage = page.locator("[data-maquette]");
  await expect(stage).toBeVisible();
  await expect(stage).toHaveAttribute("data-quartier", "1");
  await expect(stage).toHaveAttribute("data-figures", "1");
  const names = page.locator(".u-maquette-names");
  await expect(names).toHaveText("La coursière");
  await expect(page.locator("[data-tuile=contre]")).toBeDisabled();
  await expect(page.locator("#u-why-paire")).toContainText("deux personnages");
  await page.locator("[data-add-person]").click();
  await page.locator("[data-pick=neutre]").click();
  await expect(stage).toHaveAttribute("data-figures", "2");
  await expect(names).toContainText("Personnage");
  await expect(page.locator("[data-tuile=contre]")).toBeEnabled();
  await page.locator("[data-add-person]").click();
  await page.locator("[data-pick=demo-vieil-homme]").click();
  await expect(stage).toHaveAttribute("data-figures", "3");
  await expect(names).toContainText("Le vieil homme");
  const spread = await stage.getAttribute("data-layout");
  const xs = [...String(spread).matchAll(/@(-?\d+\.\d+),(-?\d+\.\d+)/g)].map(match => [Number(match[1]), Number(match[2])]);
  expect(xs).toHaveLength(3);
  const ordered = xs.map(point => point[0]).sort((a, b) => a - b);
  expect(ordered[1] - ordered[0]).toBeGreaterThan(1.2);
  expect(ordered[2] - ordered[1]).toBeGreaterThan(1.2);
  for (const point of xs) expect(Math.abs(point[1])).toBeLessThan(0.05);
  const brief = page.locator("[data-lire-maquette]");
  await expect(brief).toContainText("Le vieil homme");
  await expect(brief).toContainText("Personnage");
  await expect(brief).toContainText("La coursière");
  // Coordinates name the place « Lieu »; the décor name carries the 3D view.
  await expect(brief).toContainText("Lieu · Vue 3D");
  await expect(brief).toContainText("Regard caméra");
  await expect(page.locator(".u-who")).toContainText("La coursière");
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
    await row.evaluate(node => node.scrollIntoView({ block: "nearest", inline: "nearest" }));
    const box = await row.boundingBox();
    expect(box, track).toBeTruthy();
    expect(box!.height).toBeGreaterThan(40);
    expect(box!.y).toBeGreaterThanOrEqual(-2);
    // On phone the montage timeline can sit under the sticky tabs; the row must stay in the open band.
    const bandBottom = await page.evaluate(() => {
      const tabs = document.querySelector<HTMLElement>(".u-tabs");
      const visible = tabs && getComputedStyle(tabs).display !== "none" ? tabs.getBoundingClientRect().top : window.innerHeight;
      return visible + 2;
    });
    expect(box!.y + box!.height, track).toBeLessThanOrEqual(Math.max(viewport.height + 2, bandBottom));
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
