import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";

const out = "/opt/cursor/artifacts/screenshots";
await mkdir(out, { recursive: true });
const local = process.argv[2] ?? "http://127.0.0.1:3456";

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();

async function shot(name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  console.log(name);
}

async function size(width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
}

async function ready(selector) {
  await page.waitForSelector(selector, { timeout: 20000 });
  await new Promise(resolve => setTimeout(resolve, 400));
}

const sizes = [[1280, 800, "1280"], [390, 844, "390"]];

for (const [width, height, label] of sizes) {
  await size(width, height);

  await page.goto(`${local}/studio?galerie=32#personnage`, { waitUntil: "networkidle2", timeout: 60000 });
  await ready(".u-tile");
  await shot(`bureau-cast-${label}`);

  await page.goto(`${local}/studio?galerie=32#scene`, { waitUntil: "networkidle2", timeout: 60000 });
  await ready(".u-tile");
  await shot(`bureau-decor-${label}`);

  await page.goto(`${local}/studio?galerie=32#prise`, { waitUntil: "networkidle2", timeout: 60000 });
  await ready(".u-tile");
  await shot(`bureau-prise-${label}`);

  await page.goto(`${local}/studio#montage`, { waitUntil: "networkidle2", timeout: 60000 });
  await ready(".u-monitor");
  await shot(`bureau-montage-${label}`);

  await page.goto(`${local}/studio?galerie=32#personnage`, { waitUntil: "networkidle2", timeout: 60000 });
  await ready(".u-tile .u-link");
  await page.click(".u-tile .u-link");
  await page.waitForSelector(".u-slot[data-filled='true'] img", { timeout: 15000 });
  await shot(`bureau-slots-${label}`);

  if (width < 1024) {
    await page.click(".u-desk-switch button:last-child");
    await page.waitForSelector(".u-desk-gallery [data-asset-count]", { timeout: 15000 });
  }
  const tout = await page.$$(".u-filter button");
  if (tout[0]) await tout[0].click();
  await page.waitForFunction(() => {
    const node = document.querySelector("[data-asset-count]");
    return Number(node?.getAttribute("data-asset-count") ?? 0) >= 30;
  }, { timeout: 15000 });
  const count = await page.$eval("[data-asset-count]", node => node.getAttribute("data-asset-count"));
  console.log(`galerie ${label} ${count}`);
  await shot(`bureau-galerie-${label}`);

  if (width < 1024) {
    await page.click(".u-desk-switch button:first-child");
    await ready(".u-slot");
  }
  const dropped = await page.evaluate(() => {
    const card = document.querySelector(".u-desk-gallery article");
    const slot = document.querySelector(".u-slot:not([data-filled])") ?? document.querySelector(".u-slot");
    if (!card || !slot) return "missing";
    const transfer = new DataTransfer();
    card.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
    slot.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    slot.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    return slot.getAttribute("data-filled") ?? "empty";
  });
  console.log(`drag ${label} ${dropped}`);
  await new Promise(resolve => setTimeout(resolve, 300));
  await shot(`bureau-drag-${label}`);

  await page.goto(`${local}/studio?barre=1#montage`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector(".u-floatbar", { timeout: 15000 });
  await shot(`bureau-clip-${label}`);
}

const skip = await page.evaluate(() => {
  const link = document.querySelector(".skip-link");
  if (!link) return "absent";
  const box = link.getBoundingClientRect();
  return `${box.width}x${box.height}@${box.top}`;
});
console.log(`skip ${skip}`);

await browser.close();
