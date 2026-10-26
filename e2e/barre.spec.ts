import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { simulateComfy } from "./helpers/simulate-comfy";

// The « barre unique »: one sentence, a mode, references on demand, settings when asked.
// Send lands in the thread: an estimate and a confirm, then the tool's own run. Comfy is simulated:
// nothing leaves, nothing is spent.

const uttu = readFileSync("public/images/uttu-portrait.webp");
const quai = readFileSync("public/exemples/decor-quai-nuit.webp");

async function noComfy(page: Page) {
  const calls: string[] = [];
  await page.route(/\/api\/(prompt|comfy)/, route => { calls.push(route.request().url()); return route.abort(); });
  return calls;
}

async function smallTargets(page: Page, root: string) {
  return page.evaluate(sel => [...document.querySelectorAll<HTMLElement>(`${sel} button, ${sel} textarea, ${sel} a`)]
    .filter(el => el.offsetParent !== null)
    .map(el => ({ name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30), ...el.getBoundingClientRect().toJSON() }))
    .filter(r => r.width < 44 || r.height < 44), root);
}

test("barre : vide au départ, Image par défaut, réglages cachés, devis en crédits, 44 px", async ({ page }) => {
  await page.goto("/studio");
  const bar = page.locator("[data-barre]");
  await expect(bar).toBeVisible();
  await expect(page.locator("#u-title")).toContainText("Qu’est-ce qu’on tourne");
  await expect(bar).toHaveAttribute("data-mode", "image");
  await expect(bar.locator("[data-barre-chips]")).toHaveCount(0);
  await expect(bar.locator("[data-barre-settings]")).toHaveCount(0);
  await expect(bar.locator("[data-barre-send]")).toHaveAttribute("aria-label", /≈ \d+ crédits estimés/);
  await expect(page.locator("main")).not.toContainText(/\bcr\.|gratuit/);
  await expect(page.locator("[data-barre-all-link]")).toBeVisible();
  expect(await smallTargets(page, "[data-barre]")).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

async function importUttuEtQuai(page: Page) {
  await page.goto("/studio#personnage");
  await page.getByLabel("Importer un personnage", { exact: true }).setInputFiles({ name: "Uttu.webp", mimeType: "image/webp", buffer: uttu });
  await page.goto("/studio#scene");
  await page.getByLabel("Importer un décor", { exact: true }).setInputFiles({ name: "Quai de nuit.webp", mimeType: "image/webp", buffer: quai });
  await page.waitForTimeout(800);
}

test("fil : Vidéo avec Uttu et un décor tourne la prise dans le fil, après la confirmation de PRISE", async ({ page }) => {
  test.setTimeout(180_000);
  const comfy = await simulateComfy(page);
  await importUttuEtQuai(page);

  await page.goto("/studio#outils");
  const bar = page.locator("[data-barre]");
  await bar.locator("[data-barre-mode=video]").click();
  await expect(bar).toHaveAttribute("data-mode", "video");
  await bar.locator("[data-barre-input]").fill("Uttu marche sur le quai, la nuit. La caméra la suit.");

  await bar.locator("[data-barre-plus]").click();
  await expect(bar.locator("[data-barre-attach]")).toHaveCount(3);
  await bar.locator("[data-barre-attach=reference]").click();
  const sheet = page.locator("[data-refs-sheet]");
  await expect(sheet).toBeVisible();
  await sheet.locator("[data-refs-filter=cast]").click();
  await expect(sheet.locator("[data-ref-kind=decor]")).toHaveCount(0);
  await sheet.locator("[data-ref-kind=cast]").filter({ hasText: "Uttu" }).click();
  await sheet.locator("[data-refs-filter=decor]").click();
  await sheet.locator("[data-ref-kind=decor]").filter({ hasText: "Quai de nuit" }).click();
  await expect(sheet.locator("[data-refs-join]")).toHaveText("Joindre 2 références");
  expect(await smallTargets(page, "[data-refs-sheet]")).toEqual([]);
  await sheet.locator("[data-refs-join]").click();
  await expect(sheet).toHaveCount(0);
  await expect(bar.locator("[data-barre-chip]")).toHaveCount(2);
  await expect(page.locator("[data-barre-route]")).toHaveAttribute("data-barre-route", "prise");

  await bar.locator("[data-barre-settings]").click();
  await bar.locator("[data-barre-rendu=apercu]").click();
  await bar.locator("[data-barre-duree='8']").click();
  await bar.locator("[data-barre-format='9:16']").click();
  expect(await smallTargets(page, "[data-barre]")).toEqual([]);
  await bar.locator("[data-barre-send]").click();

  // The bubble, then PRISE's own confirm with its estimate. Nothing has left yet.
  const fil = page.locator("[data-fil]");
  await expect(fil.locator("[data-fil-user=video] [data-fil-ref]")).toHaveCount(2);
  const confirm = page.locator("[data-confirm-gold]");
  await expect(confirm).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#u-confirm-cost")).toContainText("crédits estimés");
  expect(comfy.prompts).toEqual([]);
  await confirm.click();

  const job = fil.locator("[data-fil-tool=prise]");
  await expect(job).toHaveAttribute("data-fil-job", "done", { timeout: 60_000 });
  await expect(job.locator("[data-fil-result=video] video")).toBeVisible();
  await expect(job.locator("[data-et-ensuite=video]")).toBeVisible();
  await expect(job.locator("[data-fil-montage]")).toBeVisible();
  expect(comfy.prompts.map(item => item.kind)).toEqual(["video"]);
  await expect(page).toHaveURL(/\/studio#outils$/);
  expect(await smallTargets(page, "[data-fil]")).toEqual([]);

  // Fine control: the same take, already filled in PRISE.
  await job.locator("[data-fil-open]").click();
  await expect(page).toHaveURL(/#prise/);
  await expect(page.locator("[data-prise-ready]")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("textbox", { name: "Ce qui se passe", exact: true })).toHaveValue("Uttu marche sur le quai, la nuit. La caméra la suit.");
  await expect(page.locator("[data-rendu]")).toHaveAttribute("data-rendu", "apercu");
});

test("fil : Image avec une référence, devis puis accord, résultat et Et ensuite, puis « anime-la »", async ({ page }) => {
  test.setTimeout(150_000);
  const comfy = await simulateComfy(page);
  await page.goto("/studio");
  const bar = page.locator("[data-barre]");
  await bar.locator("[data-barre-input]").fill("Même visage, imperméable jaune");
  await bar.locator("[data-barre-plus]").click();
  await bar.locator("[data-barre-attach=reference]").click();
  await page.locator("[data-refs-sheet] [data-ref-kind=cast]").first().click();
  await page.locator("[data-refs-join]").click();
  await expect(page.locator("[data-barre-route]")).toHaveAttribute("data-barre-route", "ret-modifier");
  await expect(page.locator("[data-barre-route]")).toContainText("Se crée ici avec Modifier");
  await bar.locator("[data-barre-input]").press("Enter");

  const fil = page.locator("[data-fil]");
  await expect(fil.locator("[data-fil-user=image]")).toContainText("Même visage, imperméable jaune");
  await expect(fil.locator("[data-fil-user=image] [data-fil-ref=cast]")).toHaveCount(1);
  const job = fil.locator("[data-fil-job]").first();
  await expect(job).toHaveAttribute("data-fil-job", "confirm");
  await expect(job).toContainText("≈ 4 crédits estimés");
  await expect(job.locator("[data-fil-confirm]")).toHaveText("Lancer · ≈ 4 crédits estimés");
  expect(comfy.prompts).toEqual([]);
  await job.locator("[data-fil-confirm]").click();
  await expect(job).toHaveAttribute("data-fil-job", "done", { timeout: 40_000 });
  await expect(job.locator("[data-fil-result=image] img")).toBeVisible();
  await expect(job.locator("[data-fil-saved]")).toContainText("Enregistré dans Mes créations");
  await expect(job.locator("[data-et-ensuite=image] [data-suite-item=suite-finaliser-image]")).toBeVisible();
  await expect(job.locator("[data-et-ensuite=image] [data-suite-item=suite-animer]")).toBeVisible();
  await expect(job.locator("[data-fil-open]")).toHaveText("Ouvrir dans l'outil");
  await expect(page).toHaveURL(/\/studio$/);
  expect(comfy.prompts).toHaveLength(1);
  await expect(page.locator("main")).not.toContainText(/\bcr\.|gratuit/);

  // Follow-up: « anime-la » takes the last result as its picture.
  await job.locator("[data-fil-animate]").click();
  await expect(bar).toHaveAttribute("data-mode", "video");
  await expect(bar.locator("[data-barre-input]")).toHaveValue("Anime-la : ");
  await bar.locator("[data-barre-input]").fill("Anime-la : la pluie tombe");
  await expect(page.locator("[data-barre-route]")).toHaveAttribute("data-barre-route", "vid-wan");
  await bar.locator("[data-barre-send]").click();
  await expect(fil.locator("[data-fil-user=video] [data-fil-ref=result]")).toHaveCount(1);
  const anime = fil.locator("[data-fil-tool=vid-wan]");
  await expect(anime).toHaveAttribute("data-fil-job", "confirm");
  expect(comfy.prompts).toHaveLength(1);
  await anime.locator("[data-fil-confirm]").click();
  await expect(anime).toHaveAttribute("data-fil-job", "done", { timeout: 40_000 });
  await expect(anime.locator("[data-fil-result=video] video")).toBeVisible();
  expect(comfy.prompts).toHaveLength(2);

  // Cancel sends nothing.
  await bar.locator("[data-barre-mode=image]").click();
  await bar.locator("[data-barre-input]").fill("un phare sous l'orage");
  await bar.locator("[data-barre-send]").click();
  const third = fil.locator("[data-fil-job]").last();
  await third.locator("[data-fil-cancel]").click();
  await expect(third).toHaveAttribute("data-fil-job", "cancelled");
  await expect(third).toContainText("Rien n'est parti");
  expect(comfy.prompts).toHaveLength(2);
  expect(await smallTargets(page, "[data-fil]")).toEqual([]);

  // The thread survives a reload (sessionStorage), and « Nouvelle conversation » clears it.
  await page.reload();
  await expect(fil.locator("[data-fil-job]")).toHaveCount(3);
  await expect(fil.locator("[data-fil-result=image] img")).toBeVisible({ timeout: 15_000 });
  await fil.locator("[data-fil-new]").click();
  await expect(fil).toHaveCount(0);
  await expect(page.locator(".u-barre-ideas")).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-fil]")).toHaveCount(0);
});

test("fil : Agent répond dans le fil, sans rien lancer", async ({ page }) => {
  const calls = await noComfy(page);
  await page.goto("/studio");
  const bar = page.locator("[data-barre]");
  await bar.locator("[data-barre-mode=agent]").click();
  await expect(bar.locator("[data-barre-plus]")).toHaveCount(0);
  await bar.locator("[data-barre-input]").fill("Prépare un plan de 8 secondes avec mon personnage");
  await bar.locator("[data-barre-send]").click();
  const reply = page.locator("[data-fil-agent]");
  await expect(reply).toBeVisible();
  await expect(reply).toContainText("aucune génération payante");
  await expect(reply).toContainText("Rien ne se lance d'ici");
  await expect(page.locator("[data-assistant-panel]")).toHaveCount(0);
  expect(calls).toEqual([]);
  await reply.locator("[data-fil-assistant]").click();
  await expect(page.locator("[data-assistant-input]")).toHaveValue("Prépare un plan de 8 secondes avec mon personnage");
});

test("barre : « Tous les outils » garde l'ancien accueil, à un geste", async ({ page }) => {
  await page.goto("/studio");
  await page.locator("[data-barre-all-link]").click();
  await expect(page).toHaveURL(/#outils\/tous$/);
  await expect(page.locator("[data-tous] [data-outil]").first()).toBeVisible();
  await page.locator("[data-barre-back]").click();
  await expect(page.locator("[data-barre]")).toBeVisible();
});
