import { test, expect } from '@playwright/test';

// F4 · The /studio entry picture is its LCP: preloaded with the HTML at high priority, loaded eagerly,
// and fetched in the width the screen needs (no 1600 px file on a phone, no @2x thumbnails at 1–2×).
test('/studio preloads its entry picture and serves sized images', async ({ page, request }, info) => {
  const html = await (await request.get('/studio')).text();
  const link = (html.match(/<link[^>]*decor-quai-nuit[^>]*>/) ?? [''])[0];
  expect(link, 'preload link in the server HTML').toContain('rel="preload"');
  expect(link).toMatch(/fetchPriority="high"|fetchpriority="high"/i);
  expect(link).toMatch(/imageSrcSet="[^"]*640w[^"]*960w/i);
  // A ?step for another stage does not preload it.
  expect(await (await request.get('/studio?step=prise')).text()).not.toMatch(/<link[^>]*decor-quai-nuit/);

  await page.goto('/studio');
  const hero = page.locator('[data-entry-hero]');
  await expect(hero).toBeVisible({ timeout: 20_000 });
  await expect(hero).toHaveAttribute('loading', 'eager');
  await expect(hero).toHaveAttribute('fetchpriority', 'high');
  await expect.poll(() => hero.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
  const { src, css, dpr } = await hero.evaluate((img: HTMLImageElement) => ({ src: img.currentSrc, css: img.getBoundingClientRect().width, dpr: devicePixelRatio }));
  const file = Number(/-(\d+)\.webp$/.exec(src)?.[1] ?? 1600);
  // Big enough to stay sharp, never the 1600 px master when a smaller file covers the screen.
  expect(file).toBeGreaterThanOrEqual(Math.min(1600, Math.round(css * dpr * 0.6)));
  if (css * dpr <= 960) expect(src, `${info.project.name}: ${css}px × ${dpr}`).not.toMatch(/decor-quai-nuit\.webp$/);

  const thumbs = page.locator('.u-outil-thumb img');
  await expect(thumbs.first()).toBeVisible();
  await thumbs.first().scrollIntoViewIfNeeded();
  await expect.poll(() => thumbs.first().evaluate((img: HTMLImageElement) => img.currentSrc)).not.toBe('');
  const heavy = await thumbs.evaluateAll(list => list.filter(img => (img as HTMLImageElement).currentSrc && (img as HTMLImageElement).getBoundingClientRect().width * devicePixelRatio <= 640 && /@2x/.test((img as HTMLImageElement).currentSrc)).length);
  expect(heavy).toBe(0);
});

test("accueil: only the first hero slide is in the HTML and at high priority; the others come after the load", async ({ page, request }) => {
  const html = await (await request.get("/")).text();
  const slides = html.match(/<div class="hv-slide s\d">(<img[^>]*>)?/g) ?? [];
  expect(slides.length).toBe(5);
  expect(slides.filter(slide => slide.includes("<img")).length).toBe(1);
  expect(slides[0]).toMatch(/fetchPriority="high"/i);
  await page.goto("/");
  await expect(page.locator(".hv-slide img")).toHaveCount(5, { timeout: 15_000 });
  await expect(page.locator(".hv-slide.s2 img")).toHaveAttribute("fetchpriority", "low");
});

test("perf/lcp: the storyboard paints from the server HTML, and the studio's card pictures wait for the load", async ({ page, request }) => {
  const board = await (await request.get("/storyboard")).text();
  expect(board).toMatch(/data-u11/);
  expect(board).toMatch(/class="u11-lede"/);
  expect(board).toMatch(/name="theme-color" content="#0f0f11"/);
  const studio = await (await request.get("/studio")).text();
  expect(studio).not.toMatch(/<img[^>]*src="[^"]*\/exemples\/vignettes\//);
  await page.goto("/studio");
  await expect(page.locator(".u-outil-thumb img").first()).toHaveAttribute("src", /\/exemples\/vignettes\/[a-z0-9-]+\.webp$/, { timeout: 20_000 });
});
