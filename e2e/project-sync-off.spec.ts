import { expect, test } from "@playwright/test";

// Without DATABASE_URL and the Clerk keys, the studio stays exactly local.
test("sync off: no route, no section, no Clerk request on Mon studio", async ({ page, request }) => {
  const off = await request.get("/studio-sync/projects");
  expect(off.status()).toBe(404);
  expect(await off.json()).toEqual({ error: "disabled" });
  const clerk: string[] = [];
  page.on("request", r => { if (/clerk/i.test(r.url())) clerk.push(r.url()); });
  await page.goto("/mon-studio");
  await expect(page.locator("#mediatheque")).toBeVisible();
  await expect(page.locator("[data-project-sync]")).toHaveCount(0);
  expect(clerk).toEqual([]);
});
