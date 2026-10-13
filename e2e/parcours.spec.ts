import { expect, test } from "@playwright/test";

test("CAST, décor, prise et montage avec les pistes son", async ({ page }) => {
  const spent: string[] = [];
  page.on("request", request => {
    const url = request.url();
    if (/fal\.ai|comfy\.cloud|api\.comfy|partner_generate|run_template/i.test(url)) spent.push(url);
  });

  await page.goto("/studio?demo=1#personnage");
  await expect(page.getByRole("heading", { name: "CAST" })).toBeVisible();
  const gallery = page.getByRole("button", { name: "Galerie", exact: true });
  if (await gallery.isVisible()) await gallery.click();
  await expect(page.getByText("Uttu").first()).toBeVisible();

  await page.getByRole("navigation").getByRole("button", { name: "DÉCOR" }).click();
  await expect(page.getByText("© contributeurs OpenStreetMap, ODbL")).toBeVisible();
  await page.getByRole("button", { name: "Montmartre", exact: true }).click();
  await expect(page.getByText("Enregistré dans Mon studio.")).toBeVisible();

  await page.getByRole("navigation").getByRole("button", { name: "PRISE" }).click();
  const stage = page.locator("[data-maquette]");
  await expect(stage).toBeVisible();
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
  await expect(page.locator("[data-rendre]")).toBeDisabled();
  await expect(page.locator(".u-prise-preview").getByText("estimation à mesurer")).toHaveCount(1);

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
});
