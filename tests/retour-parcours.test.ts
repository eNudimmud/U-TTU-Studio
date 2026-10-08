import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import puppeteer, { type Page } from "puppeteer-core";
import { canonMarkdown, sceneMarkdown, sequenceMarkdown, shotMarkdown, takeMarkdown, type Scene, type Sequence, type Shot, type Take } from "../src/lib/coffre/model.ts";
import { GESTES_RETOUR } from "../src/lib/ergonomie.ts";

const exec = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const video = readFileSync(join(root, "tests/fixtures/prise-test.mp4"));
const chrome = ["/usr/bin/google-chrome-stable", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]
  .find(path => existsSync(path));
const line = "Elle traverse le quai sous la pluie, sans se retourner.";

const look = {
  name: "Mira",
  traits: ["yeux verts", "taches de rousseur"],
  photos: ["Projets/atelier/Refs/a.jpg", "Projets/atelier/Refs/b.jpg"],
  note: "",
};
const scene: Scene = {
  id: "lieu-1",
  name: "Lieu 1",
  note: "",
  stills: [],
  previz: null,
  previzFile: null,
  camera: null,
  frames: [],
  render: null,
  shot: null,
  views: [],
};
const take: Take = {
  id: "prise-1",
  at: "2026-10-07T12:00:00.000Z",
  sceneId: "lieu-1",
  sceneName: "Lieu 1",
  line,
  settings: { seconds: 5, quality: "rapide", aspect: "vertical" },
  profile: "h3-4pas-5s-vertical",
  jobId: "job-avant",
  video: "Projets/atelier/Prises/prise-1.mp4",
  poster: null,
  prompt: line,
  gpuSeconds: 15,
  costCredits: 4,
  balanceBefore: 100,
  balanceAfter: 96,
  engine: "comfy",
  loraId: null,
  resolution: null,
  costUsd: null,
  costSource: null,
  announcedCredits: 4,
  announcedHigh: 6,
};
const sequence: Sequence = { id: "sequence-1", name: "Séquence 1", links: [{ takeId: "prise-1", raccord: "" }] };
const shot: Shot = { id: "plan-1", name: "Plan 1", sequenceId: "sequence-1", takeIds: ["prise-1"], note: "", ordre: 0 };
const studioFiles = [
  { path: ".uttu/projet.json", text: JSON.stringify({ actif: "atelier" }) },
  { path: "Projets/atelier/_MOC.md", text: "# Atelier\n" },
  { path: "Projets/atelier/Cast/canon.md", text: canonMarkdown(look, "atelier") },
  { path: "Projets/atelier/Lieux/lieu-1.md", text: sceneMarkdown(scene, "atelier") },
  { path: "Projets/atelier/.uttu/etat.json", text: JSON.stringify({ lieu: "lieu-1" }) },
  { path: "Projets/atelier/Prises/prise-1.md", text: takeMarkdown(take, "atelier", { sequences: [{ id: "sequence-1", name: "Séquence 1" }], shots: [{ id: "plan-1", name: "Plan 1" }] }) },
  { path: "Projets/atelier/Prises/prise-1.mp4", bytes: [...video], type: "video/mp4" },
  { path: "Projets/atelier/Sequences/sequence-1.md", text: sequenceMarkdown(sequence, "atelier", [{ id: "prise-1", line }]) },
  { path: "Projets/atelier/Shots/plan-1.md", text: shotMarkdown(shot, "atelier", [{ id: "prise-1", line }], "Séquence 1") },
  { path: "Projets/atelier/Refs/a.jpg", bytes: [0xff, 0xd8, 0xff, 0xd9], type: "image/jpeg" },
  { path: "Projets/atelier/Refs/b.jpg", bytes: [0xff, 0xd8, 0xff, 0xd9], type: "image/jpeg" },
];

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function waitForStudio(port: number, child: ChildProcess): Promise<void> {
  const started = Date.now();
  let detail = "";
  while (Date.now() - started < 120_000) {
    if (child.exitCode !== null) throw new Error(`next dev s’est arrêté (${child.exitCode}). ${detail.slice(-500)}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/studio`);
      if (response.ok) return;
      detail = `HTTP ${response.status}`;
    } catch (error) {
      detail = error instanceof Error ? error.message : String(error);
    }
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw new Error(`Le studio ne répond pas. ${detail}`);
}

interface OpenBand {
  title: string;
  reprise: string;
  character: string;
  place: string;
  gold: string;
  goldTop: number;
  goldBottom: number;
  goldHeight: number;
  repriseBottom: number;
  limit: number;
  overflow: number;
  aucun: boolean;
  line: string;
}

async function readOpen(page: Page): Promise<OpenBand> {
  return page.evaluate(() => {
    const gold = document.querySelector("[data-prise-gold]");
    const reprise = document.querySelector("[data-reprise]");
    const chain = document.querySelector(".u-chain")?.getBoundingClientRect();
    const goldRect = gold?.getBoundingClientRect();
    const repriseRect = reprise?.getBoundingClientRect();
    const side = Boolean(chain && chain.left < 40 && chain.width < 320);
    const place = document.querySelector("[data-lieu-repris]");
    return {
      title: document.querySelector("h1")?.textContent?.trim() ?? "",
      reprise: (reprise?.textContent ?? "").replace(/\s+/g, " ").trim(),
      character: (document.querySelector("[data-personnage-repris]")?.textContent ?? "").replace(/\s+/g, " ").trim(),
      place: place instanceof HTMLSelectElement ? place.selectedOptions[0]?.textContent?.trim() ?? "" : "",
      gold: (gold?.textContent ?? "").replace(/\s+/g, " ").trim(),
      goldTop: goldRect ? Math.round(goldRect.top) : 0,
      goldBottom: goldRect ? Math.round(goldRect.bottom) : 0,
      goldHeight: goldRect ? Math.round(goldRect.height) : 0,
      repriseBottom: repriseRect ? Math.round(repriseRect.bottom) : 0,
      limit: side ? window.innerHeight : Math.round(chain?.top ?? window.innerHeight),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      aucun: document.body.innerText.includes("Aucun personnage"),
      line: document.querySelector(".u-prise-confirm textarea") instanceof HTMLTextAreaElement
        ? (document.querySelector(".u-prise-confirm textarea") as HTMLTextAreaElement).value
        : "",
    };
  });
}

describe("F33 parcours de retour", () => {
  it("reprend le projet, le personnage et le lieu, puis lit et exporte en quatre gestes", { timeout: 180_000 }, async () => {
    assert.equal(GESTES_RETOUR, 4);
    assert.ok(chrome, "Chrome est absent. Le test ne saute pas : la CI doit l’installer.");
    const port = await freePort();
    const child = spawn("npx", ["next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: root,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_DIST_DIR: ".next-retour" },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    let log = "";
    child.stdout?.on("data", (chunk: Buffer) => { log += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer) => { log += chunk.toString(); });
    const leaked: string[] = [];
    const browser = await puppeteer.launch({
      executablePath: chrome,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
    });
    try {
      await waitForStudio(port, child);
      const page = await browser.newPage();
      await page.setCacheEnabled(false);
      let afterPrompt = false;
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        const url = request.url();
        if (url.includes("cloud.comfy.org") || url.includes("api.comfy.org") || url.includes("fal.ai")) {
          leaked.push(url);
          request.abort().catch(() => {});
          return;
        }
        if (url.includes("/api/upload/image")) {
          request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ name: "in.jpg" }) }).catch(() => {});
          return;
        }
        if (url.includes("/api/prompt")) {
          afterPrompt = true;
          request.respond({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ prompt_id: "job-0123456789", number: 1, node_errors: {} }),
          }).catch(() => {});
          return;
        }
        if (url.includes("/api/job/job-0123456789/status")) {
          request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success" }) }).catch(() => {});
          return;
        }
        if (url.includes("/api/jobs/job-0123456789")) {
          request.respond({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              status: "completed",
              outputs: { save: { images: [{ filename: "uttu/prise_00001_.mp4", subfolder: "", type: "output" }] } },
              execution_start_time: 1_759_500_000_000,
              execution_end_time: 1_759_500_140_000,
            }),
          }).catch(() => {});
          return;
        }
        if (url.includes("/api/view?")) {
          request.respond({ status: 200, contentType: "video/mp4", body: video }).catch(() => {});
          return;
        }
        if (url.includes("/api/billing/usage/timeseries")) {
          request.respond({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ summary: { balance: { amount_micros: afterPrompt ? 9998 : 10000 } } }),
          }).catch(() => {});
          return;
        }
        if (url.includes("/api/")) {
          request.abort().catch(() => {});
          return;
        }
        request.continue().catch(() => {});
      });

      const origin = `http://127.0.0.1:${port}`;
      async function open(width: number, height: number) {
        afterPrompt = false;
        await page.setViewport({ width, height, deviceScaleFactor: 2 });
        await page.goto(`${origin}/studio`, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.evaluate(async (payload) => {
          localStorage.clear();
          localStorage.setItem("u-ttu-plan", payload.line);
          localStorage.setItem("u-ttu-rendu", JSON.stringify({ mode: "key", key: "comfyui-0123456789abcdef" }));
          await new Promise<void>((resolve, reject) => {
            const del = indexedDB.deleteDatabase("uttu-coffre");
            del.onsuccess = () => resolve();
            del.onerror = () => reject(del.error);
            del.onblocked = () => resolve();
          });
          await new Promise<void>((resolve, reject) => {
            const openDb = indexedDB.open("uttu-coffre", 1);
            openDb.onupgradeneeded = () => {
              if (!openDb.result.objectStoreNames.contains("files")) openDb.result.createObjectStore("files", { keyPath: "path" });
            };
            openDb.onerror = () => reject(openDb.error);
            openDb.onsuccess = () => {
              const db = openDb.result;
              const tx = db.transaction("files", "readwrite");
              for (const file of payload.files) {
                const entry: { path: string; updatedAt: number; text?: string; blob?: Blob } = { path: file.path, updatedAt: Date.now() };
                if (file.text != null) entry.text = file.text;
                if (file.bytes) entry.blob = new Blob([new Uint8Array(file.bytes)], { type: file.type || "application/octet-stream" });
                tx.objectStore("files").put(entry);
              }
              tx.oncomplete = () => { db.close(); resolve(); };
              tx.onerror = () => reject(tx.error);
            };
          });
        }, { files: studioFiles, line });
        await page.reload({ waitUntil: "networkidle0", timeout: 60_000 });
        await page.waitForSelector("[data-reprise]", { timeout: 20_000 });
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      const shots = "/opt/cursor/artifacts/screenshots";
      if (existsSync("/opt/cursor/artifacts")) mkdirSync(shots, { recursive: true });

      for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }] as const) {
        await open(viewport.width, viewport.height);
        const band = await readOpen(page);
        console.log(`F33 ${viewport.width}`, JSON.stringify(band));
        assert.equal(band.title, "La prise.");
        assert.match(band.reprise, /Atelier/);
        assert.match(band.reprise, /Mira/);
        assert.match(band.reprise, /Lieu 1/);
        assert.match(band.reprise, /Repris/);
        assert.match(band.character, /Mira/);
        assert.equal(band.place, "Lieu 1");
        assert.equal(band.aucun, false);
        assert.equal(band.line, line);
        assert.match(band.gold, /Tourner/);
        assert.equal(band.overflow, 0);
        assert.ok(band.goldHeight >= 44, `${band.goldHeight}`);
        assert.ok(band.repriseBottom > 0 && band.repriseBottom <= band.goldTop, `reprise ${band.repriseBottom} or ${band.goldTop}`);
        assert.ok(band.goldBottom <= band.limit, `or ${band.goldBottom} / ${band.limit}`);
        if (existsSync(shots)) await page.screenshot({ path: join(shots, `f33-retour-${viewport.width}.png`) });

        const taps: string[] = [];
        await page.click("[data-prise-gold]");
        taps.push("tourner");
        await page.waitForFunction(() => [...document.querySelectorAll("button")].some(button => button.textContent?.includes("débit sur mon compte")), { timeout: 10_000 });
        await page.evaluate(() => {
          const button = [...document.querySelectorAll("button")].find(item => item.textContent?.includes("débit sur mon compte"));
          if (button instanceof HTMLElement) button.click();
        });
        taps.push("confirmation");
        await page.waitForSelector("[data-lire-sequence]", { timeout: 20_000 });
        await new Promise(resolve => setTimeout(resolve, 300));
        const suite = await page.evaluate(() => {
          const root = document.querySelector("[data-retour-suite]");
          const lire = root?.querySelector(".u-primary");
          const poser = [...(root?.querySelectorAll("button") ?? [])].find(button => button.textContent?.includes("Poser le plan"));
          const why = root?.querySelector(".u-why");
          const rect = lire?.getBoundingClientRect();
          const chain = document.querySelector(".u-chain")?.getBoundingClientRect();
          const side = Boolean(chain && chain.left < 40 && chain.width < 320);
          return {
            lire: (lire?.textContent ?? "").replace(/\s+/g, " ").trim(),
            lireBottom: rect ? Math.round(rect.bottom) : 0,
            lireHeight: rect ? Math.round(rect.height) : 0,
            limit: side ? window.innerHeight : Math.round(chain?.top ?? window.innerHeight),
            poserDisabled: poser instanceof HTMLButtonElement ? poser.disabled : null,
            why: (why?.textContent ?? "").replace(/\s+/g, " ").trim(),
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        });
        console.log(`F33 suite ${viewport.width}`, JSON.stringify(suite));
        assert.match(suite.lire, /Lire la séquence/);
        assert.equal(suite.poserDisabled, true);
        assert.match(suite.why, /Séquence 1/);
        assert.equal(suite.overflow, 0);
        assert.ok(suite.lireHeight >= 44);
        assert.ok(suite.lireBottom > 0 && suite.lireBottom <= suite.limit, `lire ${suite.lireBottom} / ${suite.limit}`);
        if (viewport.width === 390 && existsSync(shots)) await page.screenshot({ path: join(shots, "f33-retour-lire-390.png") });
        await page.evaluate(() => {
          const button = document.querySelector("[data-lire-sequence] .u-primary");
          if (button instanceof HTMLElement) button.click();
        });
        taps.push("lire");
        await page.waitForSelector("[data-montage-kind='video']", { timeout: 8_000 });
        await page.evaluate(() => {
          const clip = document.querySelector("[data-montage-kind='video'] video");
          if (clip instanceof HTMLVideoElement && clip.paused) {
            const played = clip.play();
            if (played) played.catch(() => clip.dispatchEvent(new Event("error")));
          }
        });
        await page.waitForSelector("[data-montage-done='true']", { timeout: 8_000 });
        const dir = await mkdtemp(join(tmpdir(), "uttu-zip-"));
        const client = await page.createCDPSession();
        await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: dir });
        await page.evaluate(() => {
          const button = [...document.querySelectorAll("button")].find(item => item.textContent?.includes("Exporter mon studio") && !(item as HTMLButtonElement).disabled);
          if (button instanceof HTMLElement) button.click();
        });
        taps.push("export");
        let zip = "";
        for (let attempt = 0; attempt < 40 && !zip; attempt++) {
          const names = await readdir(dir);
          zip = names.find(name => name.endsWith(".zip") && !name.endsWith(".crdownload")) ?? "";
          if (!zip) await new Promise(resolve => setTimeout(resolve, 200));
        }
        assert.ok(zip, "Le ZIP n’est pas arrivé.");
        const { stdout } = await exec("unzip", ["-t", join(dir, zip)]);
        assert.match(stdout, /OK/);
        await rm(dir, { recursive: true, force: true });
        assert.equal(taps.length, GESTES_RETOUR);
        assert.deepEqual(taps, ["tourner", "confirmation", "lire", "export"]);
      }
      assert.deepEqual(leaked, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${message}\n${log.slice(-1500)}`);
    } finally {
      await browser.close().catch(() => {});
      if (child.pid) {
        try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
      }
    }
  });
});
