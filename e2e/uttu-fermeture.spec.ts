import { test, expect, type Page } from "@playwright/test";
import { simulateComfy } from "./helpers/simulate-comfy";

// F10 · Uttu is never stuck open: Escape closes it and gives the keyboard back to the U*TTU button,
// and on a phone, tablet or laptop (panel floating over the studio) a press outside closes it while
// that press still does its job, e.g. a tap on the chain changes the stage. Nothing is sent, 0 credit.
const panel = (page: Page) => page.locator("[data-assistant-panel]");
const open = async (page: Page) => {
  await page.locator("[data-top-uttu]").click();
  await expect(panel(page)).toBeVisible();
};

test("Escape closes Uttu and returns focus to the U*TTU button", async ({ page }) => {
  await simulateComfy(page);
  await page.goto("/studio#personnage");
  await open(page);
  await panel(page).locator("h2").click();
  await expect(panel(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator("[data-top-uttu]")).toBeFocused();
  await expect(page.locator("[data-top-uttu]")).toHaveAttribute("aria-expanded", "false");
});

test("a tap on the chain while Uttu is open closes it and still changes the stage", async ({ page }) => {
  await simulateComfy(page);
  await page.goto("/studio#personnage");
  await expect(page.locator(".u-app")).toHaveAttribute("data-studio", "lora");
  await open(page);
  // No step of the chain sits under the panel: each one can be tapped.
  const p = (await panel(page).boundingBox())!;
  for (const step of await page.locator(".u-chain button").all()) {
    const b = (await step.boundingBox())!;
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    expect(cx < p.x || cy < p.y || cy > p.y + p.height, `step at ${Math.round(cx)},${Math.round(cy)} is under the panel`).toBe(true);
  }
  const decor = page.locator(".u-chain button").nth(1);
  await decor.click();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator(".u-app")).toHaveAttribute("data-studio", "scene");
});

test("docked on a wide screen, Uttu stays open on a press outside and still closes on Escape", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one wide run");
  await page.setViewportSize({ width: 1700, height: 900 });
  await simulateComfy(page);
  await page.goto("/studio#personnage");
  await open(page);
  await page.locator(".u-chain button").nth(1).click();
  await expect(page.locator(".u-app")).toHaveAttribute("data-studio", "scene");
  await expect(panel(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
});
