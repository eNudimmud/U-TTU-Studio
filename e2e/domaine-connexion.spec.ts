import { expect, test } from "@playwright/test";

// uttu-studio.app is the public address, but Comfy's login only accepts *.vercel.app (docs/DECISIONS.md, 2026-10-30).
// Chrome forces HTTPS on .app (HSTS preload), so the browser checks use another unauthorized host,
// resolved to the local server: the page really runs on a host Comfy does not allow.
const PUBLIC = "uttu-studio.test";
test.use({ launchOptions: { args: [`--host-resolver-rules=MAP ${PUBLIC} 127.0.0.1`] } });

const AUTHORIZED = "https://u-ttu-studio.vercel.app";
const port = (baseURL: string | undefined) => new URL(baseURL ?? "http://127.0.0.1:3000").port || "80";
const alias = { host: "uttu-studio.app", "x-forwarded-host": "uttu-studio.app", accept: "text/html", "sec-fetch-dest": "document" };

test("public domain: the landing stays, the studio doors open the login-authorized origin", async ({ page, baseURL }) => {
  await page.goto(`http://${PUBLIC}:${port(baseURL)}/`);
  await expect(page).toHaveURL(/^http:\/\/uttu-studio\.test:\d+\/$/);
  const enter = page.locator("[data-enter-studio]");
  await expect(enter).toHaveAttribute("href", `${AUTHORIZED}/studio?uttu_hop=1&uttu_lang=en`);
  await expect(page.locator("[data-try-free]")).toHaveAttribute("href", `${AUTHORIZED}/studio?uttu=1&uttu_hop=1&uttu_lang=en`);
  const box = await enter.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test("authorized host: the studio doors stay relative", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-enter-studio]")).toHaveAttribute("href", "/studio");
});

test("public domain: /studio and Comfy's login redirect once to the authorized origin", async ({ request }) => {
  for (const path of ["/studio?step=prise", "/cloud/login", "/mon-studio"]) {
    const response = await request.get(path, { headers: alias, maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    const location = new URL(response.headers().location);
    expect(location.origin).toBe(AUTHORIZED);
    expect(location.pathname).toBe(path.split("?")[0]);
    expect(location.searchParams.get("uttu_hop")).toBe("1");
    if (path.includes("step=")) expect(location.searchParams.get("step")).toBe("prise");
  }
  const landing = await request.get("/", { headers: alias, maxRedirects: 0 });
  expect(landing.status()).toBe(200);
});

test("public domain: login pages redirect even without browser headers (curl, link checkers)", async ({ request }) => {
  const bare = { host: "uttu-studio.app", "x-forwarded-host": "uttu-studio.app", accept: "*/*" };
  for (const path of ["/cloud/login", "/cloud", "/oauth/callback", "/login", "/user-select", "/mon-studio", "/studio"]) {
    const response = await request.get(path, { headers: bare, maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    const location = new URL(response.headers().location);
    expect(location.origin, path).toBe(AUTHORIZED);
    expect(location.pathname, path).toBe(path);
  }
  const landing = await request.get("/", { headers: bare, maxRedirects: 0 });
  expect(landing.status()).toBe(200);
});

test("a hop that comes straight back shows an explicit error, never a redirect loop", async ({ request, page, baseURL }) => {
  const back = await request.get("/studio?uttu_hop=1", { headers: alias, maxRedirects: 0 });
  expect(back.status()).toBe(508);
  expect(back.headers().location).toBeUndefined();
  expect(await back.text()).toContain("data-loop-retry");

  await page.goto(`http://${PUBLIC}:${port(baseURL)}/studio?uttu_hop=1`);
  await expect(page.getByRole("heading", { name: "The studio couldn't open" })).toBeVisible();
  for (const selector of ["[data-loop-retry]", "[data-loop-home]"]) {
    const box = await page.locator(selector).boundingBox();
    expect(box?.height ?? 0, selector).toBeGreaterThanOrEqual(44);
  }
  await expect(page.locator("[data-loop-retry]")).toHaveAttribute("href", `${AUTHORIZED}/studio?uttu_hop=1`);
});

test("authorized origin reached through a hop: markers dropped, language kept", async ({ request, baseURL }) => {
  const land = await request.get("/studio?uttu=1&uttu_hop=1&uttu_lang=de", { maxRedirects: 0 });
  expect(land.status()).toBe(307);
  const back = new URL(land.headers().location, baseURL);
  expect(`${back.pathname}${back.search}`).toBe("/studio?uttu=1");
  expect(land.headers()["set-cookie"]).toContain("u-ttu-locale=de");
  const studio = await request.get("/studio?demo=1", { maxRedirects: 0 });
  expect(studio.status()).toBe(200);
});
