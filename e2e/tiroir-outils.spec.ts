import { expect, test } from "@playwright/test";

// The burger drawer (below 1024 px), on the left: the tool list scrolls on its own, the footer
// (tasks, U*TTU, language) stays pinned at the bottom and never covers a tool,
// and a family is one list with no empty heading gap.

const SIZES = [[390, 844], [844, 390], [880, 1024]] as const;

for (const [width, height] of SIZES) {
  test(`tiroir ${width}×${height} : pied fixe, liste qui défile, aucun chevauchement`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/studio");
    await page.locator("[data-top-burger]").click();
    const drawer = page.locator("[data-drawer]");
    await drawer.locator("[data-top-menu=creer]").click();
    await expect(drawer.locator("[data-mega-outil]").first()).toBeVisible();
    await expect(drawer.locator(".u-mega h2").filter({ hasText: /^\s*$/ })).toHaveCount(0);
    for (const pos of ["top", "middle", "bottom"] as const) {
      const result = await drawer.evaluate((root, pos) => {
        const nav = root.querySelector<HTMLElement>(".u-drawer-nav")!;
        const max = nav.scrollHeight - nav.clientHeight;
        nav.scrollTop = pos === "top" ? 0 : pos === "middle" ? max / 2 : max;
        const box = nav.getBoundingClientRect();
        const foot = root.querySelector(".u-drawer-foot")!.getBoundingClientRect();
        const drawerBox = root.getBoundingClientRect();
        const items = [...nav.querySelectorAll("a, button")].map(item => item.getBoundingClientRect());
        return {
          scrolls: max > 0 && getComputedStyle(nav).overflowY === "auto",
          navEndsAtFoot: Math.abs(box.bottom - foot.top) <= 1,
          footAtBottom: Math.abs(foot.bottom - drawerBox.bottom) <= 1 && foot.bottom <= innerHeight + 1,
          lastClear: items.at(-1)!.bottom <= foot.top,
          targets: [...root.querySelectorAll("a, button, select")].map(item => item.getBoundingClientRect()).filter(r => r.width && r.height).every(r => r.height >= 44 && r.width >= 44),
          overflow: document.documentElement.scrollWidth > innerWidth,
          onLeft: Math.abs(drawerBox.left) <= 1 && drawerBox.right < innerWidth - 1,
        };
      }, pos);
      expect(result.scrolls).toBe(true);
      expect(result.navEndsAtFoot).toBe(true);
      expect(result.footAtBottom).toBe(true);
      if (pos === "bottom") expect(result.lastClear).toBe(true);
      expect(result.targets).toBe(true);
      expect(result.overflow).toBe(false);
      expect(result.onLeft).toBe(true);
    }
    for (const sel of ["[data-top-tasks]", "[data-drawer-assistant]", ".u-drawer-foot select"]) await expect(drawer.locator(sel)).toBeInViewport({ ratio: 1 });
  });
}

