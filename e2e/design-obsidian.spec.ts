import { expect, test, type Page } from "@playwright/test";

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
  { id: "barre", url: "/studio#outils", ready: "[data-barre]" },
  { id: "entree", url: "/studio#outils/tous", ready: "[data-tous]" },
  { id: "outil", url: "/studio#outils/img-klein", ready: "[data-tool-panel]" },
  { id: "film", url: "/studio#personnage", ready: "#u-title" },
  { id: "prise", url: "/studio#prise", ready: "#u-title" },
  { id: "montage", url: "/studio#montage", ready: "#u-title" },
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
        // Rail from 768 px, bottom bar below; both keep 44 px targets.
        const rail = page.locator("[data-rail]");
        const tabs = page.locator("[data-tabs]");
        if (size.width >= 768) {
          await expect(rail).toBeVisible();
          await expect(tabs).toBeHidden();
          for (const item of await rail.locator("a, button").all()) {
            if (!(await item.isVisible())) continue;
            const box = await item.boundingBox();
            expect(box!.height, `${target.id} rail`).toBeGreaterThanOrEqual(44);
            expect(box!.width, `${target.id} rail`).toBeGreaterThanOrEqual(44);
          }
          const names = rail.locator(".u-rail-name").first();
          // Film stages keep icons until 1440 px so the work surface has room.
          const film = ["film", "prise", "montage"].includes(target.id);
          if (size.width >= 1440 || (size.width >= 1280 && !film)) await expect(names).toBeVisible(); else await expect(names).toBeHidden();
        } else {
          await expect(rail).toBeHidden();
          await expect(tabs).toBeVisible();
          for (const item of await tabs.locator("a").all()) {
            const box = await item.boundingBox();
            expect(box!.height).toBeGreaterThanOrEqual(44);
          }
        }
      }
    });
  }
});

test("entrée : chaque carte a sa vignette, et « Maquette 3D et cadrage » ouvre la maquette de PRISE", async ({ page }) => {
  await page.goto("/studio#outils/tous");
  const entry = page.locator("[data-studio-entry]");
  await expect(entry.locator("[data-outils-count]")).toHaveText("36 outils");
  const cards = entry.locator(".u-outil-card");
  await expect(cards).toHaveCount(36);
  await expect(entry.locator(".u-outil-card .u-outil-glyph")).toHaveCount(0);
  const card = entry.locator('[data-outils-section="3d"] [data-outil-maquette]');
  await expect(card).toContainText("Maquette 3D et cadrage");
  await expect(card).not.toContainText(/gratuit|\bcr\./);
  await expect(card.locator(".u-outil-thumb img")).toHaveAttribute("src", /\/exemples\/vignettes\/maquette\.webp$/);
  expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await card.click();
  await expect(page).toHaveURL(/#prise\/maquette$/);
  await expect(page.locator('[data-avance-toggle="maquette"]')).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator('[data-avance-group="maquette"] canvas')).toBeVisible();
  await expect(page.locator('[data-avance-group="maquette"]')).toBeInViewport();
});

test("entrée : le portrait d'Uttu, la porte du film, une rangée par famille avec vignettes réelles", async ({ page }) => {
  await page.goto("/studio#outils/tous");
  const entry = page.locator("[data-studio-entry]");
  await expect(entry.locator("[data-entry-uttu] img")).toBeVisible();
  await expect(page.locator("#u-title em")).toHaveCount(1);
  await expect(page.locator("[data-entry-route]")).toContainText("≈ 3 crédits estimés");
  await expect(page.locator("[data-entry-film]")).toBeVisible();
  for (const fam of ["creer", "retoucher", "video", "3d", "son"]) await expect(entry.locator(`[data-outils-section="${fam}"]`)).toHaveCount(1);
  const thumbs = entry.locator('[data-outils-section="creer"] .u-outil-thumb img');
  await expect(thumbs.first()).toHaveAttribute("src", /\/exemples\/vignettes\/img-klein\.webp$/);
  await expect(entry.locator("[data-outil-reperage]")).toBeVisible();
  // One gold surface: « Continuer ».
  const gold = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("main *")].filter(el => {
    const style = getComputedStyle(el);
    return el.offsetParent && style.backgroundColor === "rgb(201, 167, 91)";
  }).length);
  expect(gold).toBe(1);
});
