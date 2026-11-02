import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { simulateComfy } from "./helpers/film2-comfy";

// StoryWeave is the shell behind ?storyboard=sw. The agent is mocked. No paid POST leaves the test,
// and nothing calls a job-cancel route.

const OUT = "/opt/cursor/artifacts/storyweave";
const SIZES = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1024, height: 600 },
  { width: 1280, height: 800 },
] as const;
const FREE = /gratuit|\bfree\b|kostenlos|gratis/i;

function answerFor(prompt: string): string {
  const project = /"projectId":"([^"]+)"/.exec(prompt)?.[1] ?? "atelier";
  const board = /"storyboardId":"([^"]+)"/.exec(prompt)?.[1] ?? "board";
  const shotIds = [...prompt.matchAll(/"shotId":"([^"]+)"/g)].map(match => match[1]!);
  if (prompt.includes("Rewrite the spoken line") && shotIds[0]) {
    return JSON.stringify({
      creativeGoal: "Rewrite", expectedResult: "A new line.", rationale: "The visitor asked for a rewrite.",
      operations: [{ kind: "shot.patch", target: { projectId: project, storyboardId: board, shotId: shotIds[0], expectedRevision: 0 }, patch: { dialogue: { type: "voixoff", qui: null, texte: "A later hour." } } }],
      unresolved: [],
    });
  }
  const first = { titre: "Opening street", action: "Wide on the street at night.", duree: 8, cadrage: "large", camera: "approche", dialogue: { type: "voixoff", qui: null, texte: "Morning can wait." } };
  const second = { titre: "The gate", action: "Someone opens the gate.", duree: 5, cadrage: "moyen", camera: "fixe", dialogue: { type: "replique", qui: "Kai", texte: "This way." } };
  return JSON.stringify({
    creativeGoal: "Night walk", expectedResult: "Two shots, with a line to keep or rewrite.", rationale: "From the request.",
    operations: [{ kind: "storyboard.create", scope: { projectId: project, storyboardId: board }, shots: [first, second] }],
    unresolved: [],
  });
}

async function mockAgent(page: Page) {
  const answers = new Map<string, string>();
  const posts: string[] = [];
  const cancels: string[] = [];
  page.on("request", request => {
    const url = request.url();
    if (/cancel|interrupt/i.test(url)) cancels.push(`${request.method()} ${url}`);
    if (request.method() === "POST" && /fal\.ai|cloud\.comfy\.org/i.test(url)) posts.push(url);
  });
  await page.route(/\/api\/prompt$/, async route => {
    const graph = (route.request().postDataJSON()?.prompt ?? {}) as Record<string, { class_type?: string; inputs?: { prompt?: string } }>;
    const node = Object.values(graph).find(item => item?.class_type === "TextGenerate");
    if (!node) return route.fallback();
    const id = `sw-text-${answers.size + 1}`;
    answers.set(id, answerFor(String(node.inputs?.prompt ?? "")));
    return route.fulfill({ json: { prompt_id: id, node_errors: {} } });
  });
  await page.route(/\/api\/job\/([^/]+)\/status$/, async route => {
    const id = /job\/([^/]+)\/status/.exec(route.request().url())?.[1] ?? "";
    if (!answers.has(id)) return route.fallback();
    return route.fulfill({ json: { status: "success" } });
  });
  await page.route(/\/api\/jobs\/([^/?]+)$/, async route => {
    const id = route.request().url().split("/").pop()?.split("?")[0] ?? "";
    const text = answers.get(id);
    if (!text) return route.fallback();
    return route.fulfill({ json: { status: "success", outputs: { "3": { text: [text] } } } });
  });
  return { posts, cancels, answers };
}

async function shot(page: Page, name: string) {
  mkdirSync(OUT, { recursive: true });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => undefined);
  const size = page.viewportSize()!;
  const file = `${size.width}x${size.height}-${name}.png`;
  await page.screenshot({ path: join(OUT, file) });
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test("StoryWeave stays behind ?storyboard=sw and keeps four tracks", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one browser, viewports set here");
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.setItem("u-ttu-locale", "en"));
  await page.context().addCookies([{ name: "u-ttu-locale", value: "en", url: "http://127.0.0.1:3000" }]);
  await simulateComfy(page);
  const agent = await mockAgent(page);

  await page.goto("/storyboard");
  await expect(page.locator("[data-u11]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-storyweave]")).toHaveCount(0);

  await page.evaluate(async () => {
    const entries = [{ path: ".uttu/projet.json", text: "{\"actif\":\"atelier\"}\n" }, { path: "Projets/atelier/_MOC.md", text: "# Atelier\n" }];
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("uttu-coffre", 1);
      open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains("files")) open.result.createObjectStore("files", { keyPath: "path" }); };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("files", "readwrite");
        for (const entry of entries) tx.objectStore("files").put({ ...entry, updatedAt: Date.now() });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/storyboard?storyboard=sw");
  await expect(page.locator("[data-storyweave][data-ready='true']")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-sw-online='true']")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-u11]")).toHaveCount(0);
  await expect(page.locator("[data-sw-track]")).toHaveCount(4);
  await expect(page.locator("[data-storyweave]")).not.toContainText(FREE);
  await shot(page, "chat");

  const ask = page.locator("[data-sw-ask]");
  await ask.fill("A quiet walk at night, one line at the gate.");
  await page.locator("[data-sw-send]").click();
  await expect(page.locator("[data-sw-thinking]")).toBeVisible();
  await page.locator("[data-sw-stop]").click();
  await expect(page.locator("[data-sw-thinking]")).toHaveCount(0);
  expect(agent.answers.size, "stop before the quote does not post").toBe(0);
  expect(agent.cancels, "stop never cancels a job").toEqual([]);

  await ask.fill("A quiet walk at night, one line at the gate.");
  await page.locator("[data-sw-send]").click();
  await expect(page.locator("[data-sw-quote]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-sw-agent-cost]")).toContainText(/credits estimated|price shown before launch/i);
  await page.locator("[data-sw-quote-go]").click();
  await expect(page.locator("[data-sw-shot='1']")).toBeVisible({ timeout: 40_000 });
  await page.locator("[data-sw-open-panel]").click();
  await shot(page, "panel");

  for (const size of SIZES) {
    await page.setViewportSize(size);
    await expect(page.locator("[data-sw-track]")).toHaveCount(4);
    expect(await overflow(page), `overflow ${size.width}x${size.height}`).toBeLessThanOrEqual(1);
    const small = await page.locator("[data-storyweave] :is(button, a, input, textarea, summary):visible").evaluateAll(nodes => nodes
      .filter(node => !(node as HTMLElement).closest(".sw-sr, [aria-hidden='true']"))
      .map(node => {
        const box = node.getBoundingClientRect();
        const type = (node as HTMLInputElement).type;
        return { box, type, label: (node.getAttribute("aria-label") || node.textContent || "").trim().slice(0, 40) };
      })
      .filter(item => item.type !== "file" && item.box.width > 0 && Math.min(item.box.width, item.box.height) < 43)
      .map(item => `${item.label} ${Math.round(item.box.width)}x${Math.round(item.box.height)}`));
    expect(small, `targets ${size.width}x${size.height}`).toEqual([]);
    await shot(page, "board");
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator("[data-sw-script]").click();
  await expect(page.locator("[data-sw-scene='1']")).toContainText("Morning can wait.");
  await expect(page.locator("[data-sw-rewrite]").first()).toContainText(/credits estimated|price shown before launch/i);
  await shot(page, "script");
  await page.locator("[data-sw-back]").click();
  await page.locator("[data-sw-audio]").click();
  await expect(page.locator("[data-sw-record]")).toContainText(/price shown before launch|prix indiqué/i);
  await shot(page, "audio");
  await page.locator("[data-sw-back]").click();
  await page.locator("[data-sw-shot='2']").click();
  await expect(page.locator("[data-sw-film]")).toBeVisible();
  await shot(page, "shot");
  expect(agent.cancels).toEqual([]);
  expect(agent.posts).toEqual([]);
});
