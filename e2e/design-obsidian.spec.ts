import { expect, test, type Page } from "@playwright/test";
import { NOMBRE_OUTILS, OUTILS_HORS_CATALOGUE } from "../src/lib/outils/nombre";

// DA Obsidian : the layout holds on every device (no sideways scroll), the rail and the bottom
// bar switch at the right widths and the entry keeps one gold action.

const SIZES: { name: string; width: number; height: number }[] = [
  { name: "phone-320", width: 320, height: 640 },
  { name: "phone-360", width: 360, height: 780 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "phone-landscape", width: 844, height: 390 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "tablet-1024-portrait", width: 1024, height: 1366 },
  { name: "tablet-1024-landscape", width: 1024, height: 768 },
  { name: "tablet-1366-landscape", width: 1366, height: 1024 },
  { name: "laptop-1280", width: 1280, height: 800 },
  { name: "laptop-1440", width: 1440, height: 900 },
  { name: "screen-1920", width: 1920, height: 1080 },
  { name: "screen-2560", width: 2560, height: 1440 },
];

const PAGES = [
  { id: "barre", url: "/studio/legacy#outils", ready: "[data-barre]" },
  { id: "entree", url: "/studio/legacy#outils/tous", ready: "[data-tous]" },
  { id: "outil", url: "/studio/legacy#outils/img-klein", ready: "[data-tool-panel]" },
  { id: "film", url: "/studio/legacy#personnage", ready: "#u-title" },
  { id: "prise", url: "/studio/legacy#prise", ready: "#u-title" },
  { id: "montage", url: "/studio/legacy#montage", ready: "#u-title" },
  { id: "creations", url: "/mon-studio", ready: "#u-title" },
  { id: "accueil", url: "/", ready: "h1" },
];

async function overflow(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll<HTMLElement>("body *")].filter(el => {
      const box = el.getBoundingClientRect();
      if (!box.width || getComputedStyle(el).position === "fixed") return false;
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) return false;
        parent = parent.parentElement;
      }
      return box.right > width + 1 || box.left < -1;
    }).slice(0, 3).map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`);
    return { scroll: document.documentElement.scrollWidth - width, wide };
  });
}

test.describe("toutes les tailles d'écran", () => {
  for (const size of SIZES) {
    test(`aucun défilement de côté à ${size.name} (${size.width}×${size.height})`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "one run sets each viewport itself");
      await page.setViewportSize({ width: size.width, height: size.height });
      for (const target of PAGES) {
        await page.goto(target.url);
        await expect(page.locator(target.ready).first()).toBeVisible();
        await page.waitForTimeout(150);
        const result = await overflow(page);
        expect(result.scroll, `${target.id} déborde de ${result.scroll} px (${result.wide.join(", ")})`).toBeLessThanOrEqual(0);
        if (target.id === "accueil" || target.id === "compte") continue;
        const tabs = page.locator("[data-tabs]");
        const chain = page.locator("[data-film-nav-to]");
        const portraitPhone = size.width < 768 && size.height >= size.width;
        const shortLandscape = size.height <= 500 && size.width > size.height;
        if (["film", "prise", "montage", "barre", "entree", "outil", "creations"].includes(target.id)) {
          await expect(chain).toHaveCount(5);
        }
        const filmStage = ["film", "prise", "montage"].includes(target.id);
        if (portraitPhone && filmStage) {
          // The chain is the film navigation; the bottom tabs would exceed 12 actions on the plan.
          await expect(tabs).toBeHidden();
        } else if (portraitPhone) {
          await expect(tabs).toBeVisible();
          for (const item of await tabs.locator("a").all()) {
            const box = await item.boundingBox();
            expect(box!.height).toBeGreaterThanOrEqual(44);
          }
        } else if (!shortLandscape) {
          await expect(tabs).toBeHidden();
          // PRISE keeps the chain and the plan on the first screen (≤ 12 actions); the global links return on the other steps.
          if (target.id === "prise") continue;
          const studio = page.locator("[data-top-studio]");
          await expect(studio).toBeVisible();
          const box = await studio.boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(44);
        }
      }
    });
  }
});

test("entrée : chaque carte a sa vignette, et « Maquette 3D et cadrage » ouvre PRISE", async ({ page }) => {
  await page.goto("/studio/legacy#outils/tous");
  const entry = page.locator("[data-studio-entry]");
  await expect(entry.locator("[data-outils-count]")).toHaveText(`${NOMBRE_OUTILS} outils`);
  const cards = entry.locator(".u-outil-card");
  await expect(cards).toHaveCount(NOMBRE_OUTILS);
  await expect(entry.locator(".u-outil-card .u-outil-glyph")).toHaveCount(0);
  const card = entry.locator('[data-outils-section="3d"] [data-outil-maquette]');
  await expect(card).toContainText("Maquette 3D et cadrage");
  await expect(card).not.toContainText(/gratuit|\bcr\./);
  await expect(card.locator(".u-outil-thumb img")).toHaveAttribute("src", /\/exemples\/vignettes\/maquette\.webp$/);
  expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await card.click();
  await expect(page).toHaveURL(/#prise\/maquette$/);
  await expect(page.locator("[data-film-plans]")).toBeVisible();
});

test("page de création unique : la barre, la porte du film, une rangée par famille avec vignettes réelles", async ({ page }) => {
  await page.goto("/studio/legacy#outils/tous");
  const entry = page.locator("[data-studio-entry]");
  await expect(entry.locator("[data-entry-uttu], [data-entry-prompt]")).toHaveCount(0);
  await expect(page.locator("#u-title em")).toHaveCount(1);
  await expect(page.locator("[data-entry-film]")).toBeVisible();
  for (const fam of ["creer", "retoucher", "video", "3d", "son"]) await expect(entry.locator(`[data-outils-section="${fam}"]`)).toHaveCount(1);
  const thumbs = entry.locator('[data-outils-section="creer"] .u-outil-thumb img');
  await expect(thumbs.first()).toHaveAttribute("src", /\/exemples\/vignettes\/img-klein\.webp$/);
  await expect(entry.locator("[data-outil-reperage]")).toBeVisible();
  // At most one gold surface on the creation page.
  const gold = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("main *")].filter(el => {
    const style = getComputedStyle(el);
    return el.offsetParent && style.backgroundColor === "rgb(201, 167, 91)";
  }).length);
  expect(gold).toBeLessThanOrEqual(1);
});
