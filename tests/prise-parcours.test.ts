import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import puppeteer, { type Page } from "puppeteer-core";
import { canonMarkdown, sceneMarkdown } from "../src/lib/coffre/model.ts";
import { memoryMarkdown } from "../src/lib/coffre/memory.ts";

const exec = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const video = readFileSync(join(root, "tests/fixtures/prise-test.mp4"));
const chrome = ["/usr/bin/google-chrome-stable", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]
  .find(path => existsSync(path));

const look = {
  name: "Quai",
  traits: ["manteau noir", "regard fixe"],
  photos: ["Projets/atelier/Refs/a.jpg", "Projets/atelier/Refs/b.jpg"],
  note: "",
};
const scene = {
  id: "quai",
  name: "Quai de nuit",
  note: "Lampes jaunes, eau noire, personne sur le quai.",
  stills: [],
  previz: null,
  previzFile: null,
  camera: null,
  frames: [],
  render: null,
  shot: null,
  views: [],
};
const line = "Elle avance de quatre pas vers la lampe, s’arrête, tourne la tête vers le fleuve, et le manteau noir reste fermé malgré le vent du quai.";
const studioFiles = [
  { path: ".uttu/projet.json", text: JSON.stringify({ actif: "atelier" }) },
  { path: "Projets/atelier/_MOC.md", text: "# Atelier\n" },
  { path: "Projets/atelier/Cast/canon.md", text: canonMarkdown(look, "atelier") },
  { path: "Projets/atelier/Lieux/quai.md", text: sceneMarkdown(scene, "atelier") },
  { path: "Projets/atelier/Bible.md", text: memoryMarkdown("atelier", "bible", "Le manteau noir ne s’ouvre pas. Le regard reste fixe.") },
  { path: "Projets/atelier/Style.md", text: memoryMarkdown("atelier", "style", "Nuit, lampes jaunes, eau noire, cadre vertical.") },
  { path: "Projets/atelier/Lexique.md", text: memoryMarkdown("atelier", "lexique", "Quai : le bord du fleuve sous les lampes.") },
  { path: "Projets/atelier/Prompts/index.md", text: memoryMarkdown("atelier", "prompts", "Quatre pas, arrêt, tête vers le fleuve.") },
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
      const response = await fetch(`http://127.0.0.1:${port}/studio?step=prise`);
      if (response.ok) return;
      detail = `HTTP ${response.status}`;
    } catch (error) {
      detail = error instanceof Error ? error.message : String(error);
    }
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw new Error(`Le studio ne répond pas. ${detail}`);
}

async function seed(page: Page, filled: boolean, link: boolean, longLine: boolean) {
  await page.evaluate(async (payload) => {
    localStorage.clear();
    if (payload.line) localStorage.setItem("u-ttu-plan", payload.line);
    if (payload.link) localStorage.setItem("u-ttu-rendu", JSON.stringify({ mode: "key", key: "comfyui-0123456789abcdef" }));
    await new Promise<void>((resolve, reject) => {
      const del = indexedDB.deleteDatabase("uttu-coffre");
      del.onsuccess = () => resolve();
      del.onerror = () => reject(del.error);
      del.onblocked = () => resolve();
    });
    if (!payload.files) return;
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("uttu-coffre", 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains("files")) open.result.createObjectStore("files", { keyPath: "path" });
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("files", "readwrite");
        for (const file of payload.files!) {
          const entry: { path: string; updatedAt: number; text?: string; blob?: Blob } = { path: file.path, updatedAt: Date.now() };
          if (file.text != null) entry.text = file.text;
          if (file.bytes) entry.blob = new Blob([new Uint8Array(file.bytes)], { type: file.type || "application/octet-stream" });
          tx.objectStore("files").put(entry);
        }
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, {
    files: filled ? studioFiles : null,
    line: filled && longLine ? line : filled ? "Elle avance." : "",
    link,
  });
}

interface Band {
  label: string;
  buttonVisible: boolean;
  costVisible: boolean;
  outgoingVisible: boolean;
  whyVisible: boolean | null;
  overflow: number;
  buttonHeight: number;
  costText: string;
  profile: string | null;
  buttonBottom: number;
  limit: number;
}

async function readBand(page: Page): Promise<Band> {
  return page.evaluate(() => {
    const button = document.querySelector("[data-prise-gold]");
    const chain = document.querySelector(".u-chain")?.getBoundingClientRect();
    const cost = document.querySelector(".u-prise-confirm .u-cost");
    const outgoing = document.querySelector(".u-prise-confirm .u-outgoing");
    const why = document.querySelector(".u-prise-confirm .u-why");
    const top = document.querySelector(".u-top")?.getBoundingClientRect();
    const side = Boolean(chain && chain.left < 40 && chain.width < 320);
    const limit = side ? window.innerHeight : Math.round(chain?.top ?? window.innerHeight);
    const floor = Math.round(top?.bottom ?? 0);
    const vis = (el: Element | null) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.height > 0 && rect.top >= floor - 1 && rect.bottom <= limit + 1;
    };
    const buttonRect = button?.getBoundingClientRect();
    return {
      label: (button?.textContent ?? "").replace(/\s+/g, " ").trim(),
      buttonVisible: vis(button),
      costVisible: vis(cost),
      outgoingVisible: vis(outgoing),
      whyVisible: why ? vis(why) : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      buttonHeight: buttonRect ? Math.round(buttonRect.height) : 0,
      costText: (cost?.textContent ?? "").replace(/\s+/g, " ").trim(),
      profile: document.querySelector(".u-prise-profile")?.textContent?.trim() ?? null,
      buttonBottom: buttonRect ? Math.round(buttonRect.bottom) : 0,
      limit,
    };
  });
}

function assertOnScreen(band: Band, blocked: boolean) {
  assert.equal(band.overflow, 0, band.label);
  assert.ok(band.buttonHeight >= 44, `${band.label} ${band.buttonHeight}`);
  assert.equal(band.buttonVisible, true, `${band.label} bouton ${band.buttonBottom} / ${band.limit}`);
  assert.equal(band.costVisible, true, band.label);
  assert.equal(band.outgoingVisible, true, band.label);
  assert.match(band.costText, /4/);
  assert.match(band.costText, /6/);
  assert.match(band.profile ?? "", /h3-4pas-5s-vertical/);
  if (blocked) assert.equal(band.whyVisible, true, band.label);
}

describe("F30 prise, geste or et parcours", () => {
  it("tient le geste dans le premier écran, puis Tourner, Poser, Lire, Exporter", { timeout: 180_000 }, async () => {
    assert.ok(chrome, "Chrome est absent. Le test ne saute pas : la CI doit l’installer.");
    assert.ok(video.byteLength > 1000, "La vidéo de test est vide.");
    const port = await freePort();
    const child = spawn("npx", ["next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: root,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    let log = "";
    child.stdout?.on("data", (chunk: Buffer) => { log += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer) => { log += chunk.toString(); });
      const leaked: string[] = [];
      const apiLog: string[] = [];
    const browser = await puppeteer.launch({
      executablePath: chrome,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
    });
    try {
      await waitForStudio(port, child);
      const page = await browser.newPage();
      await page.setCacheEnabled(false);
      let beforeCents = 10000;
      let afterPrompt = false;
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        const url = request.url();
        if (url.includes("/api/")) apiLog.push(`${request.method()} ${url.slice(0, 140)}`);
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
          const cents = afterPrompt ? 9998 : beforeCents;
          request.respond({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ summary: { balance: { amount_micros: cents } } }),
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
      async function open(width: number, height: number, filled: boolean, link: boolean, longLine: boolean, cents = 10000) {
        beforeCents = cents;
        afterPrompt = false;
        await page.setViewport({ width, height, deviceScaleFactor: 2 });
        await page.goto(`${origin}/studio?step=prise`, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await seed(page, filled, link, longLine);
        await page.reload({ waitUntil: "networkidle0", timeout: 60_000 });
        await page.waitForSelector("[data-prise-gold]", { timeout: 20_000 });
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      await open(390, 844, false, false, false);
      const empty = await readBand(page);
      assert.match(empty.label, /Relier/);
      assertOnScreen(empty, false);

      await open(390, 844, true, true, true);
      await page.setViewport({ width: 390, height: 500, deviceScaleFactor: 2 });
      await page.focus(".u-prise-confirm textarea");
      await new Promise(resolve => setTimeout(resolve, 80));
      const field = await page.evaluate(() => {
        const area = document.querySelector(".u-prise-confirm textarea");
        const chain = document.querySelector(".u-chain")?.getBoundingClientRect();
        const rect = area?.getBoundingClientRect();
        return {
          bottom: rect ? Math.round(rect.bottom) : 0,
          chain: chain ? Math.round(chain.top) : 0,
        };
      });
      assert.ok(field.bottom > 0 && field.bottom <= field.chain, `champ ${field.bottom} chaîne ${field.chain}`);

      await open(390, 844, true, true, true);
      const tourner = await readBand(page);
      assert.match(tourner.label, /Tourner/);
      assertOnScreen(tourner, false);

      await open(390, 844, true, true, true, 1);
      for (const locale of ["fr", "en", "de", "es"]) {
        await page.select(".u-top .u-lang select", locale);
        await new Promise(resolve => setTimeout(resolve, 200));
        const band = await readBand(page);
        assert.equal(band.buttonVisible, true, locale);
        assert.equal(band.costVisible, true, locale);
        assert.equal(band.outgoingVisible, true, locale);
        assert.equal(band.whyVisible, true, `${locale} ${band.label}`);
        assert.equal(band.overflow, 0, locale);
      }
      await page.select(".u-top .u-lang select", "fr");

      async function clickLabel(label: string) {
        const handle = await page.evaluateHandle((text) => {
          return [...document.querySelectorAll("button")].find(button => button.textContent?.includes(text) && !(button as HTMLButtonElement).disabled) ?? null;
        }, label);
        const element = handle.asElement();
        if (!element) throw new Error(`Bouton absent : ${label}`);
        await element.evaluate((node) => {
          if (node instanceof HTMLElement) node.click();
        });
        await handle.dispose();
      }

      for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }] as const) {
        await open(viewport.width, viewport.height, true, true, true);
        const band = await readBand(page);
        assert.match(band.label, /Tourner/);
        assertOnScreen(band, false);
        const disabled = await page.$eval("[data-prise-gold]", (element) => (element as HTMLButtonElement).disabled);
        await page.click("[data-prise-gold]");
        try {
          await page.waitForFunction(() => [...document.querySelectorAll("button")].some(button => button.textContent?.includes("débit sur mon compte")), { timeout: 10_000 });
        } catch (error) {
          const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 900));
          throw new Error(`disabled=${disabled} apis=${apiLog.slice(-8).join(" | ")}\n${text}\n${error instanceof Error ? error.message : ""}`);
        }
        await clickLabel("débit sur mon compte");
        await page.waitForFunction(() => [...document.querySelectorAll("button")].some(button => button.textContent?.includes("Poser le plan")), { timeout: 20_000 });
        await clickLabel("Poser le plan");
        await page.waitForFunction(() => [...document.querySelectorAll("button")].some(button => button.textContent?.includes("Lire la séquence") && !(button as HTMLButtonElement).disabled), { timeout: 10_000 });
        await clickLabel("Lire la séquence");
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
        await clickLabel("Exporter mon studio");
        let zip = "";
        for (let attempt = 0; attempt < 40 && !zip; attempt++) {
          const names = await readdir(dir);
          zip = names.find(name => name.endsWith(".zip") && !name.endsWith(".crdownload")) ?? "";
          if (!zip) await new Promise(resolve => setTimeout(resolve, 200));
        }
        assert.ok(zip, "Le ZIP n’est pas arrivé.");
        const { stdout } = await exec("unzip", ["-t", join(dir, zip)]);
        assert.match(stdout, /OK/);
        const listed = await exec("unzip", ["-l", join(dir, zip)]);
        assert.match(listed.stdout, /Prises|\.mp4/);
        await rm(dir, { recursive: true, force: true });
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
