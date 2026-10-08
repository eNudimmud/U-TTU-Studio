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
  await page.goto("about:blank");
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
        const closed = await page.evaluate(() => {
          const head = document.querySelector(".u-montage-bar");
          const viewer = document.querySelector(".u-capcut-player .u-viewer");
          const play = document.querySelector(".u-play");
          const timeline = document.querySelector(".u-tl");
          if (document.querySelector(".u-chutier[data-open='true']")) return "feuille ouverte";
          if (!head || !viewer || !play || !timeline) return "montage incomplet";
          const h = head.getBoundingClientRect();
          const v = viewer.getBoundingClientRect();
          const p = play.getBoundingClientRect();
          const t = timeline.getBoundingClientRect();
          if (h.bottom > v.top + 1) return `titre sur l’image ${Math.round(h.bottom)}>${Math.round(v.top)}`;
          if (p.height < 44 || p.top < 0 || p.bottom > window.innerHeight) return "lecture hors cadre";
          if (t.top < p.bottom - 1) return "timeline sur la lecture";
          return "";
        });
        if (closed) throw new Error(`${name}-${label} ${closed}`);
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
          if (box.width < 600 || box.height < 320) return `lecteur trop petit ${Math.round(box.width)}×${Math.round(box.height)}`;
          const lead = document.querySelector(".u-capcut-player .u-lead, .u-capcut-player > .u-small");
          if (lead) return "texte sur le lecteur";
          const bar = document.querySelector(".u-floatbar");
          if (bar) {
            const b = bar.getBoundingClientRect();
            const overlap = !(b.bottom <= box.top + 1 || b.top >= box.bottom - 1);
            if (overlap) return "barre du plan sur l’image";
          }
          const bin = document.querySelector(".u-capcut .u-chutier");
          if (bin) {
            const edge = bin.getBoundingClientRect().right - 1;
            const floor = bin.getBoundingClientRect().bottom + 1;
            for (const card of bin.querySelectorAll(".u-chutier-row button")) {
              const cardBox = card.getBoundingClientRect();
              if (cardBox.right > edge) return "carte hors chutier";
              if (cardBox.bottom > floor) return "carte coupée en bas";
              const name = card.querySelector(".u-bin-name");
              if (name && (name.scrollWidth > name.clientWidth + 1 || name.scrollHeight > name.clientHeight + 2)) return `nom coupé ${name.textContent}`;
            }
          }
          for (const span of document.querySelectorAll(".u-clip.is-audio .u-clip-body > span")) {
            const label = span.getBoundingClientRect();
            const clip = span.closest(".u-clip")?.getBoundingClientRect();
            if (!clip) return "plan audio sans boîte";
            if (label.top < clip.top - 1 || label.bottom > clip.bottom + 1) return `nom de piste coupé ${span.textContent}`;
            if (span.scrollHeight > span.clientHeight + 2) return `nom de piste coupé ${span.textContent}`;
          }
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
      if (!why.includes("prix pas encore vérifié")) throw new Error(`${name}-${label} raison absente : ${why}`);
    }
    if (name === "r5-prise-raccord") {
      await page.waitForSelector("[data-geste='prise-raccord'][data-selected]", { timeout: 8000 });
      const roles = await page.$$eval(".u-refslot-add span", nodes => nodes.map(node => node.textContent?.trim()));
      if (!roles.includes("Début") || !roles.includes("Fin")) throw new Error(`${name}-${label} cases ${roles.join(",")}`);
    }
    if (kind !== "montage" && label === "1280") {
      const desk = await page.evaluate(() => {
        const field = document.querySelector(".u-desk-work textarea");
        const bar = document.querySelector(".u-desk-work .u-create-bar");
        const scroll = document.querySelector(".u-desk-scroll");
        if (field && bar && scroll) {
          const a = field.getBoundingClientRect();
          const b = bar.getBoundingClientRect();
          const s = scroll.getBoundingClientRect();
          const visible = Math.min(a.bottom, s.bottom) - Math.max(a.top, s.top);
          if (visible < a.height - 4) return `texte coupé ${Math.round(visible)}/${Math.round(a.height)}`;
          if (Math.min(a.bottom, s.bottom) > b.top + 1) return `texte sous Créer`;
        }
        const tiles = [...document.querySelectorAll(".u-desk-gestes .u-tile")];
        const column = document.querySelector(".u-desk-gestes");
        if (tiles[2] && column) {
          const tile = tiles[2].getBoundingClientRect();
          const box = column.getBoundingClientRect();
          if (tile.bottom > box.bottom + 2) return `tuile 3 coupée ${Math.round(tile.bottom)}>${Math.round(box.bottom)}`;
        }
        return "";
      });
      if (desk) throw new Error(`${name}-${label} ${desk}`);
    }
    await page.screenshot({ path: `${out}/${name}-${label}.png` });
    console.log(`${name}-${label}`);
    if (kind === "montage" && width === 390) {
      const toggle = await page.$(".u-bin-toggle");
      if (toggle) await toggle.click();
      await page.waitForSelector(".u-chutier[data-open='true'] .u-bin-label", { timeout: 8000 });
      const sheet = await page.evaluate(assertLabels);
      if (sheet) throw new Error(`${name}-chutier ${sheet}`);
      const fit = await page.evaluate(() => {
        const bin = document.querySelector(".u-chutier[data-open='true']");
        const play = document.querySelector(".u-play");
        const head = document.querySelector(".u-montage-bar");
        const viewer = document.querySelector(".u-capcut-player .u-viewer");
        const close = document.querySelector(".u-bin-close");
        if (!bin || !play || !head || !viewer || !close) return "feuille incomplète";
        const b = bin.getBoundingClientRect();
        const p = play.getBoundingClientRect();
        const h = head.getBoundingClientRect();
        const v = viewer.getBoundingClientRect();
        if (h.bottom > v.top + 1) return "titre sur l’image";
        if (p.bottom > b.top + 1) return `lecture sous la feuille ${Math.round(p.bottom)}>${Math.round(b.top)}`;
        if (p.height < 44) return "lecture trop petite";
        if (b.height > window.innerHeight * 0.56) return `feuille trop haute ${Math.round(b.height)}`;
        if (close.getBoundingClientRect().height < 44) return "Fermer trop petit";
        const quietNode = document.querySelector(".u-bin-quiet");
        const quiet = quietNode?.textContent ?? "";
        if (quiet !== "Bientôt · Agrandir, Fluidifier") return `ligne ${quiet}`;
        const q = quietNode.getBoundingClientRect();
        if (q.top < b.top - 1 || q.bottom > b.bottom + 1 || q.height < 12) return "ligne hors feuille";
        if (quietNode.scrollWidth > quietNode.clientWidth + 1) return "ligne coupée";
        const edge = b.right - 1;
        for (const card of bin.querySelectorAll(".u-chutier-row button")) {
          if (card.getBoundingClientRect().right > edge) return "carte coupée";
        }
        return "";
      });
      if (fit) throw new Error(`${name}-chutier ${fit}`);
      await page.screenshot({ path: `${out}/r5-montage-390-chutier.png` });
      console.log("r5-montage-390-chutier");
    }
  }
}

await size(360, 800);
await openStudio("/studio?barre=1#montage");
const closed360 = await page.evaluate(() => {
  const head = document.querySelector(".u-montage-bar");
  const viewer = document.querySelector(".u-capcut-player .u-viewer");
  const play = document.querySelector(".u-play");
  if (document.querySelector(".u-chutier[data-open='true']")) return "feuille ouverte";
  if (!head || !viewer || !play) return "montage incomplet";
  if (head.getBoundingClientRect().bottom > viewer.getBoundingClientRect().top + 1) return "titre sur l’image";
  const p = play.getBoundingClientRect();
  if (p.height < 44 || p.bottom > window.innerHeight) return "lecture hors cadre";
  return "";
});
if (closed360) throw new Error(`r5-montage-360 ${closed360}`);
await page.screenshot({ path: `${out}/r5-montage-360.png` });
console.log("r5-montage-360");

await browser.close();
