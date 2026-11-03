import { expect, test } from "@playwright/test";
import { simulateComfy } from "./helpers/simulate-comfy";
import { OPEN_WEIGHTS_MODE } from "../src/lib/open-weights";
import { NOMBRE_OUTILS_OPEN_WEIGHTS } from "../src/lib/outils/nombre";

// Contest build (open weights only, the default): no partner engine anywhere, one tool count.
test.skip(!OPEN_WEIGHTS_MODE, "open-weights mode is off for this build");

test("open weights : aucun outil partenaire, un seul compte, pas d’interrupteur partenaires", async ({ page }) => {
  await simulateComfy(page);
  // Even a device that once turned partner services on stays on open weights.
  await page.addInitScript(() => localStorage.setItem("u-ttu-moteurs", JSON.stringify({ partenaires: true, nanoBanana: true, openWeightsOnly: false, engine: "ltx", engineManual: false })));
  await page.goto("/studio#outils/tous");
  const rail = page.locator("[data-rail] .u-rail-head");
  if (await rail.isVisible()) await expect(rail).toContainText(String(NOMBRE_OUTILS_OPEN_WEIGHTS));
  for (const word of ["kling", "seedance", "vidu", "ideogram", "seedream", "genjutsu", "tripo", "meshy", "nano"]) {
    await page.locator("[data-outils-search]").fill(word);
    for (const id of ["vid-kling", "vid-seedance", "vid-vidu", "vid-h3max", "img-ideogram", "img-seedream", "img-gpt", "img-flux3", "img-nano", "vid-genjutsu", "3d-tripo", "3d-hunyuan", "3d-meshy"]) {
      await expect(page.locator(`[data-outil="${id}"]`)).toHaveCount(0);
    }
  }
  await page.locator("[data-outils-search]").fill("");
  await page.locator("button.u-credit").first().click();
  await expect(page.locator("[data-compte-partenaires]")).toHaveCount(0);
});

test("open weights : « Image en volume » reste, sans l’option Personnage (Hunyuan3D 2.1, licence hors UE/UK/Corée du Sud)", async ({ page }) => {
  await simulateComfy(page);
  await page.goto("/studio#outils/3d-ouvert");
  const panel = page.locator("[data-tool-panel=\"3d-ouvert\"]");
  await expect(panel).toBeVisible({ timeout: 20_000 });
  await expect(panel.locator("[data-tool-mesh]")).toHaveCount(0);
  await expect(panel.locator("[data-tool-step=reglages]")).toHaveCount(0);
});
