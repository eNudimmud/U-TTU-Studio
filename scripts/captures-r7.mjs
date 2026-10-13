import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const local = process.argv[2] ?? "http://127.0.0.1:3000";
const dirs = ["/workspace/artifacts/screenshots", "/opt/cursor/artifacts/screenshots"];
for (const dir of dirs) await mkdir(dir, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const sizes = [
  [1280, 800, "1280"],
  [390, 844, "390"],
];

function layout() {
  const problems = [];
  const frame = document.querySelector(".u-maquette-stage");
  const hint = document.querySelector(".u-maquette-hint");
  if (frame && hint) {
    const box = frame.getBoundingClientRect();
    const band = hint.getBoundingClientRect();
    if (band.left < box.left - 1 || band.right > box.right + 1 || band.bottom > box.bottom + 1 || band.top < box.top) problems.push("hint hors cadre");
    if (hint.scrollHeight > hint.clientHeight + 2) problems.push("hint coupé");
  }
  const bar = document.querySelector(".u-prise-actions");
  if (bar && frame) {
    const a = bar.getBoundingClientRect();
    const b = frame.getBoundingClientRect();
    const overlap = !(a.bottom < b.top || a.top > b.bottom || a.right < b.left || a.left > b.right);
    if (overlap && a.height > 0 && b.height > 0) problems.push("barre sur la maquette");
  }
  for (const track of ["voix", "effets", "musique"]) {
    const row = document.querySelector(`[data-track="${track}"]`);
    if (!row) continue;
    const box = row.getBoundingClientRect();
    if (box.height < 40) problems.push(`${track} trop bas`);
    if (box.bottom > window.innerHeight + 2 || box.top < 0) problems.push(`${track} hors écran`);
  }
  const clipped = [];
  for (const node of document.querySelectorAll(".u-tuile, .u-maquette-hint, .u-repere-credit, .u-track-word, .u-maquette-badge, h1")) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.getClientRects().length === 0) continue;
    const style = getComputedStyle(node);
    if (style.overflow === "hidden" && node.scrollHeight > node.clientHeight + 2) clipped.push((node.textContent ?? "").trim().slice(0, 40));
  }
  if (clipped.length) problems.push(`texte coupé ${clipped.join(" | ")}`);
  return problems.join("; ");
}

const notes = [];

for (const [width, height, label] of sizes) {
  const context = await browser.newContext({ viewport: { width, height }, locale: "fr-FR" });
  const page = await context.newPage();
  await page.goto(`${local}/studio?demo=1#personnage`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".u-app", { timeout: 20000 });
  const gallery = page.getByRole("button", { name: "Galerie", exact: true });
  if (await gallery.isVisible()) await gallery.click();
  await page.waitForTimeout(400);
  for (const dir of dirs) await page.screenshot({ path: `${dir}/r7-cast-${label}.png` });

  await page.getByRole("navigation").getByRole("button", { name: "DÉCOR" }).click();
  await page.getByText("© contributeurs OpenStreetMap, ODbL").waitFor();
  await page.locator(".maplibregl-canvas").waitFor();
  await page.locator(".maplibregl-canvas").click({ position: { x: 220, y: 140 } });
  await page.locator("[data-quartier='1']").waitFor();
  for (const dir of dirs) await page.screenshot({ path: `${dir}/r7-pas-1-${label}.png` });
  await page.getByRole("button", { name: "Montmartre", exact: true }).click();
  await page.locator("[data-quartier='1']").waitFor();
  await page.locator("[data-photos=fixture]").waitFor();
  await page.locator("[data-photo=fixture-ada]").click();
  await page.locator("[data-photo-ajoute]").waitFor();
  await page.locator("[data-pas='2']").scrollIntoViewIfNeeded();
  for (const dir of dirs) await page.screenshot({ path: `${dir}/r7-pas-2-${label}.png` });
  await page.locator("[data-pas='3']").scrollIntoViewIfNeeded();
  for (const dir of dirs) await page.screenshot({ path: `${dir}/r7-pas-3-${label}.png` });
  await page.locator("[data-photos=fixture]").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Garder ce lieu" }).click();
  await page.getByText("Enregistré dans Mon studio.").waitFor();
  await page.waitForTimeout(1200);
  for (const dir of dirs) await page.screenshot({ path: `${dir}/r7-decor-${label}.png` });
  notes.push(`decor ${label}: ${await page.evaluate(layout)}`);

  await page.getByRole("navigation").getByRole("button", { name: "PRISE" }).click();
  await page.locator("[data-maquette][data-quartier='1']").waitFor();
  await page.locator("[data-figures='1']").waitFor();
  await page.waitForTimeout(1200);
  for (const dir of dirs) {
    await page.screenshot({ path: `${dir}/r7-prise-${label}.png` });
    await page.screenshot({ path: `${dir}/r7-prise-1-${label}.png` });
  }
  notes.push(`prise-1 ${label}: ${await page.evaluate(layout)}`);

  await page.locator("[data-add-person]").click();
  await page.locator("[data-pick=neutre]").click();
  await page.locator("[data-add-person]").click();
  await page.locator("[data-pick=demo-coursiere]").click();
  await page.locator("[data-figures='3']").waitFor();
  await page.waitForTimeout(800);
  for (const dir of dirs) await page.screenshot({ path: `${dir}/r7-prise-3-${label}.png` });
  notes.push(`prise-3 ${label}: ${await page.evaluate(layout)}`);

  await page.getByRole("navigation").getByRole("button", { name: "MONTAGE" }).click();
  await page.locator("[data-track=musique]").waitFor();
  await page.waitForTimeout(400);
  for (const dir of dirs) await page.screenshot({ path: `${dir}/r7-montage-${label}.png` });
  notes.push(`montage ${label}: ${await page.evaluate(layout)}`);
  await context.close();
}

await browser.close();
console.log(notes.join("\n"));
