import { expect, test } from "@playwright/test";

// Accueil du studio = Outils + conversation. CINEMA/ANIME s’ajoutent.
// Rien ici n’envoie un graphe : les routes payantes sont coupées.

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" || /^\/(cloud|api\/comfy|api\/prompt|studio-agent)/.test(url.pathname))
      return route.abort("blockedbyclient");
    return route.continue();
  });
});

test("Outils et la bulle sont sur /studio, pas sous /legacy", async ({ page }) => {
  const paid: string[] = [];
  page.on("request", request => {
    if (/\/api\/prompt|comfy\.org|studio-agent/.test(request.url())) paid.push(request.url());
  });
  await page.goto("/studio");
  await expect(page).not.toHaveURL(/\/studio\/legacy/);
  await expect(page.locator("[data-studio-entry] [data-barre]")).toBeVisible();
  await expect(page.locator("[data-outils-search]")).toBeVisible();
  await expect(page.locator("[data-section=cinema]")).toBeVisible();
  await expect(page.locator("[data-section=anime]")).toBeVisible();

  await page.locator("[data-barre-input]").fill("Un quai la nuit, sans rendu");
  await page.locator("[data-barre-send]").click();
  await expect(page.locator("[data-fil-user]")).toContainText("Un quai la nuit, sans rendu");
  await expect(page.locator("[data-fil-job=confirm]")).toBeVisible();
  await expect(page.locator("[data-fil-cancel]")).toBeVisible();
  expect(paid).toEqual([]);

  await page.goto("/studio#outils/img-qwen");
  await expect(page).toHaveURL(/\/studio#outils\/img-qwen$/);
  await expect(page.locator("[data-tool-panel=img-qwen]")).toBeVisible();
});

test("CINEMA et ANIME gardent la même bulle et un lien Outils distinct de la promptothèque", async ({ page }) => {
  for (const section of ["cinema", "anime"]) {
    await page.goto(`/studio/${section}/cast`);
    await expect(page).not.toHaveURL(/\/legacy/);
    await expect(page.locator(".ps-chain")).toBeVisible();
    const dock = page.locator("[data-conversation-dock]");
    await expect(dock.locator("[data-barre]")).toBeVisible();
    await expect(page.locator("[data-nav-outils]")).toHaveAttribute("href", "/studio");
    await expect(dock.locator("[data-dock-outils]")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Promptothèque/ })).toHaveAttribute("href", `/studio/${section}/prompts`);
    await dock.locator("[data-barre-input]").fill(`Phrase ${section}`);
    await dock.locator("[data-barre-send]").click();
    await expect(dock.locator("[data-fil-user]")).toContainText(`Phrase ${section}`);
    await expect(dock.locator("[data-fil-job]")).toBeVisible();
  }
});
