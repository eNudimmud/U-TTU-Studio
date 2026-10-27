import { expect, test, type Page } from "@playwright/test";

/** True when the center of `sel` is covered by the sticky header or the tab bar. */
async function coveredByChrome(page: Page, sel: string) {
  return page.evaluate(selector => {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el || el.offsetParent === null) return { covered: true, reason: "missing" };
    const r = el.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    const hit = document.elementFromPoint(x, y);
    if (!hit) return { covered: true, reason: "no-hit", x, y };
    if (el === hit || el.contains(hit) || hit.contains(el)) return { covered: false, reason: "ok", x, y };
    const chrome = hit.closest(".u-top, .u-tabs, .u-chain");
    return { covered: Boolean(chrome), reason: chrome ? "chrome" : "other", tag: (hit as HTMLElement).className?.toString().slice(0, 40), x, y };
  }, sel);
}

async function lastMainVisible(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main") ?? document.querySelector(".u-main");
    if (!main) return null;
    const nodes = [...main.querySelectorAll<HTMLElement>("a, button, h2, [data-barre-all-link]")].filter(n => n.offsetParent !== null);
    const last = nodes.at(-1);
    if (!last) return null;
    last.scrollIntoView({ block: "end" });
    const r = last.getBoundingClientRect();
    const x = Math.round(Math.min(window.innerWidth - 4, Math.max(4, r.left + r.width / 2)));
    const y = Math.round(Math.min(window.innerHeight - 4, Math.max(4, r.top + r.height / 2)));
    const hit = document.elementFromPoint(x, y);
    const tabs = document.querySelector(".u-tabs");
    const underTabs = Boolean(tabs && hit && (tabs === hit || tabs.contains(hit)));
    return { underTabs, y, tabsTop: tabs?.getBoundingClientRect().top ?? null, label: (last.getAttribute("aria-label") || last.textContent || "").trim().slice(0, 40) };
  });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }] as const) {
  test(`chrome mobile ${viewport.width}×${viewport.height} : menu + et bas de page hors header/tabs`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/studio");
    await expect(page.locator("[data-barre]")).toBeVisible();
    await page.locator("[data-barre-plus]").click();
    const menu = page.locator("[data-barre-menu]");
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("data-place", /above|below|sheet/);

    const items = menu.locator("[data-barre-attach]");
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i++) {
      const sel = `[data-barre-menu] [data-barre-attach]:nth-child(${i + 1})`;
      // nth-child on buttons — use evaluate index instead
      const hit = await page.evaluate(index => {
        const btn = document.querySelectorAll<HTMLElement>("[data-barre-menu] [data-barre-attach]")[index];
        if (!btn) return { covered: true, reason: "missing" };
        const r = btn.getBoundingClientRect();
        const x = Math.round(r.left + Math.min(r.width / 2, 40));
        const y = Math.round(r.top + r.height / 2);
        const topEl = document.querySelector<HTMLElement>(".u-top");
        const tabsEl = document.querySelector<HTMLElement>(".u-tabs");
        const top = topEl && getComputedStyle(topEl).display !== "none" ? topEl.getBoundingClientRect() : null;
        const tabs = tabsEl && getComputedStyle(tabsEl).display !== "none" && getComputedStyle(tabsEl).position !== "static"
          ? tabsEl.getBoundingClientRect() : null;
        const inBand = (!top || r.top >= top.bottom - 1) && (!tabs || r.bottom <= tabs.top + 1);
        const at = document.elementFromPoint(x, y);
        const coveredByChrome = Boolean(at?.closest(".u-top, .u-tabs"));
        return { covered: !inBand || coveredByChrome, reason: !inBand ? "oob" : coveredByChrome ? "chrome" : "ok", y, topBottom: top?.bottom, tabsTop: tabs?.top ?? null, place: document.querySelector("[data-barre-menu]")?.getAttribute("data-place") };
      }, i);
      expect(hit, `item ${i}`).toMatchObject({ covered: false });
    }

    await page.keyboard.press("Escape");
    const foot = await lastMainVisible(page);
    expect(foot?.underTabs).toBeFalsy();
  });
}
