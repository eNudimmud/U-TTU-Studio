import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";

const out = "/opt/cursor/artifacts/screenshots";
await mkdir(out, { recursive: true });
const local = process.argv[2];
if (!local) throw new Error("Passe l’origine locale, par exemple http://127.0.0.1:3000");

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const shots = [
  ["cast", "/studio#personnage", "r5-cast"],
  ["cast", "/studio?geste=cast-tenue#personnage", "r5-cast-tenue"],
  ["decor", "/studio#scene", "r5-decor"],
  ["decor", "/studio?geste=decor-elargir#scene", "r5-decor-elargir"],
  ["prise", "/studio#prise", "r5-prise"],
  ["prise", "/studio?geste=prise-raccord#prise", "r5-prise-raccord"],
  ["montage", "/studio?barre=1#montage", "r5-montage"],
];

const page = await browser.newPage();

async function size(width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
}

async function openStudio(path) {
  await page.goto(local + path, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector(".u-app", { timeout: 20000 });
  await new Promise(resolve => setTimeout(resolve, 400));
}

function assertLabels() {
  const nodes = [...document.querySelectorAll(".u-bin-label")];
  if (nodes.length !== 4) return `onglets ${nodes.length}`;
  for (const node of nodes) {
    const text = node.textContent ?? "";
    if (node.scrollWidth > node.clientWidth + 1) return `coupé ${text} ${node.scrollWidth}>${node.clientWidth}`;
  }
  return "";
}

for (const [kind, path, name] of shots) {
  for (const [width, height, label] of [[1280, 800, "1280"], [390, 844, "390"]]) {
    await size(width, height);
    await openStudio(path);
    if (kind === "montage") {
      if (width < 1024) {
        const toggle = await page.$(".u-bin-toggle");
        if (toggle) await toggle.click();
        await page.waitForSelector(".u-chutier[data-open='true'] .u-bin-label", { timeout: 8000 });
      } else {
        await page.waitForSelector(".u-capcut .u-bin-label", { timeout: 8000 });
        const fit = await page.evaluate(() => {
          const timeline = document.querySelector(".u-tl");
          const viewer = document.querySelector(".u-capcut-player .u-viewer");
          const frame = document.querySelector(".u-capcut-player .u-stage-frame");
          if (!timeline || !viewer || !frame) return "manque lecteur ou timeline";
          const bottom = timeline.getBoundingClientRect().bottom;
          if (bottom > window.innerHeight + 2) return `timeline sous la fenêtre ${Math.round(bottom)}>${window.innerHeight}`;
          const box = viewer.getBoundingClientRect();
          const stage = frame.getBoundingClientRect();
          if (box.height < 240) return `lecteur trop petit ${Math.round(box.height)}`;
          if (box.height < stage.height * 0.7) return `lecteur trop petit ${Math.round(box.height)}/${Math.round(stage.height)}`;
          return "";
        });
        if (fit) throw new Error(`${name}-${label} ${fit}`);
      }
      const cut = await page.evaluate(assertLabels);
      if (cut) throw new Error(`${name}-${label} ${cut}`);
    }
    if (name === "r5-cast-tenue") {
      await page.waitForSelector("[data-geste='cast-tenue'][data-selected]", { timeout: 8000 });
      const roles = await page.$$eval(".u-refslot-add span", nodes => nodes.map(node => node.textContent?.trim()));
      if (!roles.includes("Visage") || !roles.includes("Tenue")) throw new Error(`${name}-${label} cases ${roles.join(",")}`);
    }
    if (name === "r5-decor-elargir") {
      await page.waitForSelector("[data-geste='decor-elargir'][data-selected]", { timeout: 8000 });
      const why = await page.$eval("#u-why-decor", node => node.textContent ?? "");
      if (!why.includes("haute définition") && !why.includes("pas mesuré")) throw new Error(`${name}-${label} raison absente : ${why}`);
    }
    if (name === "r5-prise-raccord") {
      await page.waitForSelector("[data-geste='prise-raccord'][data-selected]", { timeout: 8000 });
      const roles = await page.$$eval(".u-refslot-add span", nodes => nodes.map(node => node.textContent?.trim()));
      if (!roles.includes("Début") || !roles.includes("Fin")) throw new Error(`${name}-${label} cases ${roles.join(",")}`);
    }
    await page.screenshot({ path: `${out}/${name}-${label}.png` });
    console.log(`${name}-${label}`);
  }
}

await size(360, 800);
await openStudio("/studio?barre=1#montage");
const toggle = await page.$(".u-bin-toggle");
if (toggle) await toggle.click();
await page.waitForSelector(".u-chutier[data-open='true'] .u-bin-label", { timeout: 8000 });
const cut = await page.evaluate(assertLabels);
if (cut) throw new Error(`r5-montage-360 ${cut}`);
await page.screenshot({ path: `${out}/r5-montage-360.png` });
console.log("r5-montage-360");

await browser.close();
