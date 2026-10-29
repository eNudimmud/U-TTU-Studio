import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const OUT = process.env.OUT ?? "mesures-decor3d"; // capture du Repérage 3D sur le serveur de prod local (port 3100)
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 }, locale: "fr-FR" });
const hosts = new Set();
p.on("request", r => { try { hosts.add(new URL(r.url()).host); } catch {} });
await p.goto("http://127.0.0.1:3100/studio#personnage");
await p.getByRole("navigation").getByRole("button", { name: "DÉCOR" }).click();
await p.locator("[data-rep3d-open]").click();
const sheet = p.getByRole("dialog", { name: "Un vrai lieu en décor" });
const s = sheet.getByRole("searchbox", { name: "Une adresse, une place, une ville" });
await s.fill(process.argv[2] || "Central Park, New York"); await s.press("Enter");
await p.waitForTimeout(4000);
await p.screenshot({ path: `${OUT}/1-apres-recherche.png` });
const st = await sheet.getAttribute("data-rep3d-state"); console.log("state", st);
if (st !== "ready") { const opt = sheet.locator("[data-rep3d-result], li button").first(); if (await opt.count()) await opt.click(); }
await p.waitForFunction(() => document.querySelector("[data-rep3d-state=ready]"), null, { timeout: 60000 });
await p.waitForTimeout(15000);
const fr = process.argv[3] || "moyen";
await p.locator(`[data-framing=${fr}]`).click(); await p.waitForTimeout(8000);
await p.locator(".u-rep3d-canvas").screenshot({ path: `${OUT}/vue-3d.png` });
await p.locator("[data-rep3d-capture]").click();
await p.waitForSelector("[data-capture-done] img", { timeout: 30000 });
const src = await p.locator("[data-capture-done] img").getAttribute("src");
console.log("src", src.slice(0, 40));
if (src.startsWith("data:")) writeFileSync(`${OUT}/capture.png`, Buffer.from(src.split(",")[1], "base64"));
else { const buf = await p.evaluate(async u => { const r = await fetch(u); const a = new Uint8Array(await r.arrayBuffer()); return Array.from(a); }, src); writeFileSync(`${OUT}/capture.png`, Buffer.from(buf)); }
await p.screenshot({ path: `${OUT}/2-capture.png` });
console.log("hosts", [...hosts].join(" "));
await b.close();
