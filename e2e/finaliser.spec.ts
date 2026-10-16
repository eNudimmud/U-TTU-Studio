import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";

// R8 : Finaliser = une seule passe RTX sur tout le montage. Comfy est simulé : aucun crédit réel.
const SHOTS = process.env.R8_SHOTS ?? "";
const VIDEO = readFileSync("e2e/fixtures/final-1080p.mp4");

async function shot(page: Page, name: string, project: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${project}-${name}.png` });
}

test("MONTAGE : devis, confirmation, passe en cours, vidéo finale dans Mon studio", async ({ page }, info) => {
  const project = info.project.name;
  let balanceCents = 50_000;
  let release = false;
  let polls = 0;
  const graphs: Record<string, { class_type: string; inputs: Record<string, unknown> }>[] = [];
  let uploads = 0;
  let cancels = 0;

  await page.addInitScript(() => localStorage.setItem("u-ttu-rendu", JSON.stringify({ mode: "key", key: "test-key-0123456789abcdef" })));
  await page.route(/\/api\/billing\/usage\/timeseries/, route => route.fulfill({ json: { summary: { balance: { amount_micros: balanceCents } } } }));
  await page.route(/\/api\/user$/, route => route.fulfill({ json: { id: "e2e" } }));
  await page.route(/\/api\/upload\/image$/, route => { uploads += 1; return route.fulfill({ json: { name: "uttu-montage.mp4", subfolder: "" } }); });
  await page.route(/\/api\/prompt$/, route => {
    graphs.push(JSON.parse(route.request().postData() ?? "{}").prompt);
    return route.fulfill({ json: { prompt_id: "job-r8-audit", number: 1, node_errors: {} } });
  });
  await page.route(/\/api\/queue$/, route => { cancels += 1; return route.fulfill({ json: {} }); });
  await page.route(/\/api\/job\/job-r8-audit\/status$/, route => {
    polls += 1;
    if (release) {
      balanceCents -= 2; // ≈ 4 crédits
      return route.fulfill({ json: { status: "success" } });
    }
    return route.fulfill({ json: { status: polls < 2 ? "pending" : "in_progress" } });
  });
  await page.route(/\/api\/jobs\/job-r8-audit$/, route => route.fulfill({ json: {
    status: "success",
    execution_start_time: 1_760_000_000_000,
    execution_end_time: 1_760_000_016_000,
    outputs: { save: { images: [{ filename: "uttu-final-1080p_00001_.mp4", subfolder: "", type: "output" }] } },
  } }));
  await page.route(/\/api\/view\?/, route => route.fulfill({ status: 200, contentType: "video/mp4", body: VIDEO }));

  await page.goto("/studio");
  await page.getByRole("navigation").getByRole("button", { name: "MONTAGE" }).click();
  await page.locator("[data-partir-exemple=montage]").click();
  const open = page.locator("[data-finaliser-open]");
  await expect(open).toBeEnabled();
  const box = await open.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await open.click();

  const sheet = page.getByRole("dialog", { name: "Finaliser le montage" });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator("[data-final-quote='mesure']")).toContainText(/Environ 4,1 crédits ; réserve conseillée : 6,5/);
  const go = sheet.locator("[data-final-go]");
  await expect(go).toBeDisabled();
  await expect(sheet.locator("#u-why-final-go")).toHaveText("Coche la confirmation pour lancer.");

  await sheet.getByRole("button", { name: "4K" }).click();
  await expect(sheet.locator("[data-final-quote='estimation']")).toContainText("Estimation, pas encore mesurée.");
  await shot(page, "1-devis-4k", project);
  await sheet.getByRole("button", { name: "1080p" }).click();
  await sheet.getByRole("button", { name: "Bruit" }).click();
  await sheet.getByRole("button", { name: "Aucun" }).click();
  await expect(sheet.locator("[data-final-quote='mesure']")).toBeVisible();
  await shot(page, "2-devis-1080p", project);

  await sheet.locator("[data-final-confirm]").click();
  await expect(go).toBeEnabled();
  await shot(page, "3-confirme", project);
  await go.click();

  await expect(sheet.locator("[data-final-stage='calcul']")).toBeVisible({ timeout: 60_000 });
  await expect(sheet.getByRole("button", { name: "Fermer" })).toBeDisabled();
  await shot(page, "4-en-cours", project);
  release = true;

  await expect(sheet.getByRole("status")).toHaveText("Montage finalisé, enregistré dans Mon studio.", { timeout: 60_000 });
  await expect(sheet.locator("video.u-final-video")).toBeVisible();
  await page.waitForFunction(() => {
    const video = document.querySelector<HTMLVideoElement>("video.u-final-video");
    return Boolean(video && video.readyState >= 2);
  });
  await shot(page, "5-fini", project);

  expect(uploads).toBe(1);
  expect(cancels).toBe(0);
  expect(graphs).toHaveLength(1);
  const types = Object.values(graphs[0]).map(node => node.class_type);
  expect(types).toEqual(["LoadVideo", "GetVideoComponents", "RTXVideoSuperResolution", "CreateVideo", "SaveVideo"]);
  expect(graphs[0].load.inputs.file).toBe("uttu-montage.mp4");

  await sheet.getByRole("button", { name: "Fermer" }).click();
  const saved = await page.evaluate(() => new Promise<string[]>(resolve => {
    const open = indexedDB.open("uttu-coffre");
    open.onerror = () => resolve([]);
    open.onsuccess = () => {
      const db = open.result;
      const names = [...db.objectStoreNames];
      if (!names.length) return resolve([]);
      const request = db.transaction(names[0]).objectStore(names[0]).getAllKeys();
      request.onsuccess = () => resolve(request.result.map(String));
      request.onerror = () => resolve([]);
    };
  }));
  expect(saved.some(key => /\/Assets\/.*-final-1080p-\d+-[a-f0-9]+\.mp4$/.test(key))).toBe(true);
  await page.goto("/mon-studio");
  const card = page.getByText(/final 1080p/i).first();
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await expect(page.locator(".u-thumb video")).toHaveCount(1);
  await page.waitForFunction(() => (document.querySelector<HTMLVideoElement>(".u-thumb video")?.readyState ?? 0) >= 2);
  await shot(page, "6-mon-studio", project);
});
