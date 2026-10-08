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
  await ready(".u-tile .u-link");
  await page.click(".u-tile .u-link");
  await page.waitForSelector(".u-refslot[data-filled='true'] img", { timeout: 15000 });
  await shot(`bureau-cast-${label}`);
  if (width < 1024) {
    await page.evaluate(() => {
      const bar = document.querySelector(".u-create-bar");
      if (!bar) return;
      const top = bar.getBoundingClientRect().top + window.scrollY - (window.innerHeight - bar.getBoundingClientRect().height - 72);
      window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
    });
    await new Promise(resolve => setTimeout(resolve, 300));
    await shot(`bureau-cast-bas-${label}`);
  }

  await page.goto(`${local}/studio?galerie=32#scene`, { waitUntil: "networkidle2", timeout: 60000 });
  await ready(".u-tile");
  await shot(`bureau-decor-${label}`);

  await page.goto(`${local}/studio?galerie=32#prise`, { waitUntil: "networkidle2", timeout: 60000 });
  await ready(".u-tile");
  await shot(`bureau-prise-${label}`);

  await page.goto(`${local}/studio?barre=1#montage`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector(".u-floatbar", { timeout: 15000 });
  await shot(`bureau-montage-${label}`);

  await page.goto(`${local}/studio?galerie=32#personnage`, { waitUntil: "networkidle2", timeout: 60000 });
  await ready(".u-tile .u-link");
  await page.click(".u-tile .u-link");
  await page.waitForSelector(".u-refslot[data-filled='true'] img", { timeout: 15000 });
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
    await ready(".u-refslot");
  }
  const dropped = await page.evaluate(async () => {
    const card = document.querySelector(".u-desk-gallery article");
    const slot = document.querySelector(".u-refslot:not([data-filled])") ?? document.querySelector(".u-refslot");
    if (!card || !slot) return "missing";
    const transfer = new DataTransfer();
    card.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    slot.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    slot.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    await new Promise(resolve => setTimeout(resolve, 400));
    return String(document.querySelectorAll(".u-refslot[data-filled='true']").length);
  });
  console.log(`drag ${label} filled ${dropped}`);
  if (width < 1024) await page.click(".u-desk-switch button:first-child");
  await shot(`bureau-drag-${label}`);

  await page.goto(`${local}/studio?barre=1#montage`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector(".u-floatbar", { timeout: 15000 });
  await shot(`bureau-clip-${label}`);
}

for (const width of [360, 390]) {
  await size(width, 844);
  for (const hash of ["#personnage", "#scene", "#prise", "#montage"]) {
    await page.goto(`${local}/studio${hash}`, { waitUntil: "networkidle2", timeout: 60000 });
    await ready("main, .u-stage");
    const report = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll("body *")].filter(el => {
        const style = getComputedStyle(el);
        if (style.position !== "fixed" && style.position !== "sticky") return false;
        if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
        const box = el.getBoundingClientRect();
        return box.width > 8 && box.height > 8;
      });
      const boxes = nodes.map(el => {
        const box = el.getBoundingClientRect();
        return { name: String(el.className).slice(0, 60), top: Math.round(box.top), bottom: Math.round(box.bottom), left: Math.round(box.left), right: Math.round(box.right) };
      });
      const hits = [];
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (width > 8 && height > 8) hits.push(`${a.name} × ${b.name}`);
        }
      }
      const bar = document.querySelector(".u-create-bar")?.getBoundingClientRect();
      const slot = document.querySelector(".u-refslot, .u-prise-board .u-slot")?.getBoundingClientRect();
      const covered = bar && slot ? bar.top < slot.bottom - 4 && bar.bottom > slot.top + 4 : false;
      return { hits, covered, scroll: document.documentElement.scrollHeight };
    });
    console.log(`overlap ${width} ${hash} ${report.hits.join(" | ") || "ok"} covered=${report.covered} scroll=${report.scroll}`);
  }
}

const skip = await page.evaluate(() => {
  const link = document.querySelector(".skip-link");
  if (!link) return "absent";
  const box = link.getBoundingClientRect();
  return `${box.width}x${box.height}@${box.top}`;
});
console.log(`skip ${skip}`);

await browser.close();
