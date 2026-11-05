import { test, expect } from "@playwright/test";
import path from "node:path";

// All network outside the local app is blocked. This suite never submits a Comfy job.
test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" || /^\/(cloud|api\/comfy|studio-agent)/.test(url.pathname))
      return route.abort("blockedbyclient");
    return route.continue();
  });
});

for (const section of ["cinema", "anime"] as const) {
  test(`${section}: import → prise gardée → montage persistant → export local`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(`/studio/${section}/shoot`);
    await expect(page.getByRole("button", { name: /Importer une prise/ })).toBeEnabled();
    await page.locator('input[type="file"][multiple]').setInputFiles(path.resolve("public/exemples/decor-quai-nuit-640.webp"));
    const take = page.locator(".ps-asset").filter({ has: page.getByRole("heading", { name: "decor-quai-nuit-640", exact: true }) });
    await expect(take).toContainText("PRISE 01 · ESSAI");
    await take.getByRole("button", { name: /Ouvrir/ }).click();
    await page.getByRole("button", { name: "Garder cette prise", exact: true }).click();
    await expect(take).toContainText("GARDÉE");

    await page.locator(".ps-chain").getByRole("link", { name: /Edit/ }).click();
    await page.getByRole("button", { name: "+ decor-quai-nuit-640", exact: true }).click();
    await page.getByLabel("Nom du montage").fill(`Séquence ${section}`);
    await page.getByRole("button", { name: "Enregistrer le montage", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Montage enregistré." })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Nom du montage")).toHaveValue(`Séquence ${section}`);
    await expect(page.locator(".ps-cut-row")).toHaveCount(1);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Exporter · gratuit/ }).click();
    await expect(page.locator(".ps-asset").filter({ hasText: `Séquence ${section}` })).toBeVisible({ timeout: 90_000 });
    expect((await download).suggestedFilename()).toMatch(/^uttu-(cinema|anime)-.*\.(mp4|webm)$/);
    await page.reload();
    await expect(page.locator(".ps-asset").filter({ hasText: `Séquence ${section}` })).toBeVisible();

    await page.locator(".ps-chain").getByRole("link", { name: /Finish/ }).click();
    await expect(page.locator(".ps-asset")).toHaveCount(1);
    await expect(page.locator(".ps-asset")).toContainText("GARDÉE");
    await page.getByRole("button", { name: /Ouvrir/ }).click();
    await expect(page.getByRole("button", { name: "Améliorer la prise gardée", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer une variante", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Animer ce cadre", exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test(`${section}: six pages utilisables aux quatre tailles`, async ({ page }, info) => {
    for (const [width, height] of [[390, 844], [844, 390], [1024, 600], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      for (const step of ["cast", "set", "shoot", "edit", "finish", "prompts"]) {
        await page.goto(`/studio/${section}/${step}`);
        await expect(page.locator(".ps-project")).toBeEnabled();
        await expect(page.locator("h1")).toBeVisible();
        if (step === "prompts") await expect(page.getByRole("searchbox")).toBeVisible();
        const dimensions = await page.evaluate(() => {
          const controls = [...document.querySelectorAll<HTMLElement>(".production-studio a, .production-studio button, .production-studio select, .production-studio input:not([type=checkbox]), .production-studio summary")];
          return {
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            small: controls.filter(el => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && (r.width < 43.9 || r.height < 43.9);
            }).map(el => ({ label: el.textContent?.trim().slice(0, 50), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })),
          };
        });
        expect(dimensions, `${section}/${step} ${width}×${height}`).toEqual({ overflow: false, small: [] });
        if (step === "cast") await page.screenshot({ path: info.outputPath(`${section}-${width}x${height}.png`) });
      }
    }
  });
}

test("les anciennes routes gardent leurs paramètres et aboutissent au bon univers", async ({ page }) => {
  for (const [from, to] of [["/studio/cgi", "/studio/cinema/cast"], ["/anime", "/studio/anime/cast"], ["/look", "/studio/anime/cast"], ["/anime/bible", "/studio/anime/bible"], ["/look/bible", "/studio/anime/bible"]]) {
    await page.goto(`${from}?source=shared`);
    await expect(page).toHaveURL(new RegExp(`${to}\\?source=shared$`));
    await expect(page.locator(".ps-project")).toBeEnabled();
  }
});

test("l’entrée légère ouvre les sections et garde le contexte des anciens liens", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: "Choisis ton univers." })).toBeVisible();
  await expect(page.locator(".u-app")).toHaveCount(0);
  await page.getByRole("link", { name: /ANIME Dessin/ }).click();
  await expect(page).toHaveURL(/\/studio\/anime\/cast$/);
  await expect(page.locator(".ps-project")).toBeEnabled();

  await page.goto("/studio#outils/ret-detourer");
  await expect(page).toHaveURL(/\/studio\/anime\/cast\/ret-detourer$/);
  await expect(page.getByRole("heading", { name: "Détourer", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/studio\/anime\/cast$/);

  await page.goto("/studio?project=atelier&plan=shared-plan#prise");
  await expect(page).toHaveURL(/\/studio\/legacy\?project=atelier&plan=shared-plan#prise$/);
  await expect(page.locator(".u-app")).toHaveAttribute("data-studio", "prise");
  await expect(page.locator("[data-film-plans]")).toBeVisible();
});
