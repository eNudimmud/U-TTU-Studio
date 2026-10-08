import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";

const out = "/opt/cursor/artifacts/screenshots";
await mkdir(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function shot(page, name, { fullPage = false } = {}) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage });
  console.log(name);
}

async function size(page, width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
}

const prod = "https://u-ttu-studio.vercel.app";
const avant = [
  ["cast", "/studio#personnage"],
  ["decor", "/studio#scene"],
  ["prise", "/studio#prise"],
  ["montage", "/studio#montage"],
  ["galerie", "/studio#personnage"],
  ["mon-studio", "/mon-studio"],
];

const page = await browser.newPage();
if (process.env.SKIP_AVANT !== "1") for (const [name, path] of avant) {
  for (const [width, height, label] of [[1280, 800, "1280"], [390, 844, "390"]]) {
    await size(page, width, height);
    await page.goto(prod + path, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 600));
    const full = name === "galerie" || name === "mon-studio";
    await shot(page, `avant-${name}-${label}`, { fullPage: full });
  }
}

const local = process.argv[2];
if (local) {
  const tabs = [
    ["cast", "/studio#personnage", true],
    ["decor", "/studio#scene", true],
    ["prise", "/studio#prise", false],
    ["montage", "/studio?barre=1#montage", false],
  ];
  for (const [name, path, fill] of tabs) {
    for (const [width, height, label] of [[1280, 800, "1280"], [390, 844, "390"]]) {
      await size(page, width, height);
      await page.goto(local + path, { waitUntil: "networkidle2", timeout: 60000 });
      await page.waitForSelector(".u-gestes", { timeout: 15000 });
      if (fill) {
        await page.click(".u-examples button");
        await page.waitForSelector(".u-refs-list img", { timeout: 15000 });
      }
      if (name === "montage") await page.waitForSelector(".u-chutier", { timeout: 15000 });
      await shot(page, `apres-${name}-${label}`, { fullPage: true });
    }
  }
  for (const width of [360, 390, 768, 1280, 1440]) {
    await size(page, width, width < 500 ? 844 : 900);
    await page.goto(`${local}/studio?galerie=1#personnage`, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector("[data-asset-count]", { timeout: 15000 });
    const count = await page.$eval("[data-asset-count]", node => node.getAttribute("data-asset-count"));
    console.log(`assets ${width} ${count}`);
    if (Number(count) < 32) throw new Error(`galerie ${width} n’a que ${count} assets`);
    await shot(page, `apres-galerie-${width}`, { fullPage: true });
  }
  for (const [width, height, label] of [[1280, 800, "1280"], [390, 844, "390"]]) {
    await size(page, width, height);
    await page.goto(`${local}/studio?galerie=1&detail=1#personnage`, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector(".u-asset-detail", { timeout: 15000 });
    await shot(page, `apres-detail-${label}`, { fullPage: false });
    await page.goto(`${local}/mon-studio?galerie=1`, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector("[data-asset-count]", { timeout: 15000 });
    await shot(page, `apres-mon-studio-${label}`, { fullPage: true });
  }
}

await browser.close();
