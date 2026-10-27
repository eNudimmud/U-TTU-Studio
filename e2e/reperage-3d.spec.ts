import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// Repérage 3D : tout le réseau est simulé (tuiles synthétiques, relief plat, géocodeur), rien ne sort du poste.
test.use({ launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] } });

const TILE = readFileSync("e2e/fixtures/reperage-tile.pbf");
const TERRAIN = readFileSync("e2e/fixtures/reperage-terrain.png");
const JPG = readFileSync("public/og.jpg");
// One real swissBUILDINGS3D tile of Lausanne (swisstopo, OGD, « © swisstopo »), 12 KB, Draco.
const SWISS = readFileSync("e2e/fixtures/swissbuildings-lausanne.b3dm");
const SWISS_ROOT = "https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/";
const ALL_CH = [0.10, 0.79, 0.19, 0.84, 0, 5000];
const TILE_REGION = [0.115794, 0.811893, 0.115833, 0.811911, 473, 504];

async function offline(page: Page) {
  const outside: string[] = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, route => { outside.push(route.request().url()); return route.abort("blockedbyclient"); });
  await page.route("https://tiles.openfreemap.org/planet", route => route.fulfill({ json: { tiles: ["https://tiles.openfreemap.org/planet/fixture/{z}/{x}/{y}.pbf"], maxzoom: 14 }, headers: { "access-control-allow-origin": "*" } }));
  await page.route("https://tiles.openfreemap.org/planet/fixture/**", route => route.fulfill({ body: TILE, contentType: "application/x-protobuf", headers: { "access-control-allow-origin": "*" } }));
  await page.route("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**", route => route.fulfill({ body: TERRAIN, contentType: "image/png", headers: { "access-control-allow-origin": "*" } }));
  await page.route("https://wmts.geo.admin.ch/**", route => route.fulfill({ body: JPG, contentType: "image/jpeg", headers: { "access-control-allow-origin": "*" } }));
  await page.route("**/photon.komoot.io/api/**", route => route.fulfill({ json: { features: [{ geometry: { coordinates: [6.6326, 46.5206] }, properties: { name: "Place d'essai", city: "Lausanne", country: "Suisse" } }] }, headers: { "access-control-allow-origin": "*" } }));
  await page.route("**/api.panoramax.xyz/api/**", route => route.fulfill({ json: { type: "FeatureCollection", features: [], instances: [] }, headers: { "access-control-allow-origin": "*" } }));
  const cors = { "access-control-allow-origin": "*" };
  await page.route("**/commons.wikimedia.org/w/api.php**", route => route.fulfill({ json: { batchcomplete: "", query: { geosearch: [], pages: [] } }, headers: cors }));
  await page.route("**/api.kartaview.org/**", route => route.fulfill({ json: { status: { apiCode: 600 }, result: { data: [] } }, headers: cors }));
  await page.route(`${SWISS_ROOT}tileset.json`, route => route.fulfill({ json: { asset: { version: "1.0" }, root: { boundingVolume: { region: ALL_CH }, children: [{ boundingVolume: { region: ALL_CH }, content: { uri: "fixture/tileset.json" } }] } }, headers: cors }));
  await page.route(`${SWISS_ROOT}fixture/tileset.json`, route => route.fulfill({ json: { asset: { version: "1.0" }, root: { boundingVolume: { region: ALL_CH }, children: [{ boundingVolume: { region: TILE_REGION }, geometricError: 0, content: { uri: "11/305/723.b3dm" } }] } }, headers: cors }));
  await page.route(`${SWISS_ROOT}fixture/11/305/723.b3dm`, route => route.fulfill({ body: SWISS, contentType: "application/octet-stream", headers: cors }));
  return outside;
}

const SHEET = "Un vrai lieu en décor";
const SEARCH = "Une adresse, une place, une ville";

async function openSheet(page: Page) {
  await page.goto("/studio#personnage");
  await page.getByRole("navigation").getByRole("button", { name: "DÉCOR" }).click();
  await page.locator("[data-rep3d-open]").click();
  const sheet = page.getByRole("dialog", { name: SHEET });
  await expect(sheet).toBeVisible();
  return sheet;
}

async function find(page: Page, text: string) {
  const search = page.getByRole("dialog", { name: SHEET }).getByRole("searchbox", { name: SEARCH });
  await search.fill(text);
  await search.press("Enter");
}

async function tall(page: Page, selectors: string[]) {
  for (const sel of selectors) {
    const box = await page.locator(sel).first().boundingBox();
    expect(box, sel).toBeTruthy();
    expect(box!.height, sel).toBeGreaterThanOrEqual(44);
    expect(box!.width, sel).toBeGreaterThanOrEqual(44);
  }
}

// Four reusable street photos spread over the place (Panoramax, CC BY-SA, ~45 m apart), and one 360° sphere at the spot.
const PNX = "https://panoramax.openstreetmap.fr/images/";
function pnx(n: number, dLon: number, fov = 70) {
  const id = `0f1e2d3c-4b5a-4968-8776-65544332211${n}`;
  const href = `${PNX}p${n}/sd.jpg`;
  return { type: "Feature", id, geometry: { type: "Point", coordinates: [6.6326 + dLon, 46.5206] }, links: [],
    properties: { license: "CC-BY-SA-4.0", "geovisio:producer": `Ada Rue ${n}`, "view:azimuth": 90, "pers:interior_orientation": { field_of_view: fov } },
    assets: { sd: { href }, thumb: { href } } };
}
async function streetPhotos(page: Page) {
  const jpg = readFileSync("public/og.jpg");
  await page.route("**/api.panoramax.xyz/api/search**", route => route.fulfill({ json: { type: "FeatureCollection", features: [pnx(1, 0.0006), pnx(2, 0.0012), pnx(3, 0.0018), pnx(4, 0.0030), pnx(5, 0.0001, 360)] }, headers: { "access-control-allow-origin": "*" } }));
  await page.route(`${PNX}**`, route => route.fulfill({ body: jpg, contentType: "image/jpeg", headers: { "access-control-allow-origin": "*" } }));
}

test("lieu réel → vue : une question par écran, une vue 3D, trois hauteurs, crédits derrière ©", async ({ page }) => {
  const outside = await offline(page);
  const sheet = await openSheet(page);
  await expect(sheet).toHaveAttribute("data-rep3d-state", "search");
  await expect(sheet).toHaveAttribute("data-rep3d-step", "1");
  // Screen 1: the equation (an illustration, said so), the question, one action.
  await expect(sheet.getByRole("heading", { level: 1 })).toHaveText("Transforme un vrai lieu en décor");
  await expect(page.locator("[data-rep3d-example-note]")).toContainText("faite hors Comfy");
  await expect(sheet.getByRole("searchbox", { name: SEARCH })).toBeFocused();
  await expect(sheet.locator("footer")).toHaveCount(0);
  await expect(sheet.getByText(/PRISE|DÉCOR|cr\./)).toHaveCount(0);
  await find(page, "Place d'essai");
  await expect(sheet).toHaveAttribute("data-rep3d-state", "ready", { timeout: 20_000 });
  await expect(sheet).toHaveAttribute("data-rep3d-step", "2");
  await expect(sheet.getByRole("heading", { level: 1 })).toHaveText("Choisis ta vue");
  await expect(page.locator("[data-rep3d-place]")).toContainText("Place d'essai");
  await expect(sheet).toHaveAttribute("data-rep3d-roofs", "ready", { timeout: 20_000 });

  // One base look, no style choice, no numbers on screen.
  await expect(sheet).toHaveAttribute("data-look", "volumes");
  await expect(sheet.locator("[data-look-pick], input[type=range], output, [data-sun]")).toHaveCount(0);
  await expect(sheet.getByText(/°|mm\b|bâtiments/)).toHaveCount(0);
  await expect(page.locator("[data-rep3d-hint]")).toBeVisible();
  await tall(page, ["[data-framing=large]", "[data-framing=moyen]", "[data-framing=sol]", "[data-rep3d-credits]", "[data-rep3d-capture]", "[data-rep3d-lead]"]);
  await expect(page.locator("[data-framing=moyen]")).toHaveAttribute("aria-pressed", "true");

  // Credits sit behind ©; Escape shuts the card first, then the sheet.
  await page.locator("[data-rep3d-credits]").click();
  const credit = page.locator("[data-rep3d-credit]");
  await expect(credit).toContainText("© contributeurs OpenStreetMap");
  await expect(credit).toContainText("OpenFreeMap");
  await expect(credit).toContainText("Terrain Tiles");
  await expect(credit).toContainText("swissBUILDINGS3D © swisstopo");
  await expect(credit).not.toContainText(/google/i);
  await page.keyboard.press("Escape");
  await expect(credit).toBeHidden();
  await expect(sheet).toBeVisible();

  // « Fais glisser pour tourner » is true: one plain drag turns the view.
  const canvas = page.locator(".u-rep3d-canvas");
  const angle = async (name: "heading" | "pitch") => Number(await sheet.getAttribute(`data-rep3d-${name}`));
  const box = await canvas.boundingBox();
  const cx = box!.x + box!.width / 2, cy = box!.y + box!.height / 2;
  const start = await angle("heading");
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => angle("heading")).not.toBe(start);
  await expect(page.locator("[data-rep3d-hint]")).toHaveCount(0);

  // Two fingers: a twist only turns, a vertical drag only tilts.
  const fingers = async (from: [number, number][], to: [number, number][]) => {
    await canvas.evaluate((el, { from, to }) => {
      const b = el.getBoundingClientRect();
      const fire = (type: string, id: number, x: number, y: number) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", isPrimary: id === 11, clientX: b.left + x, clientY: b.top + y, bubbles: true, cancelable: true }));
      const original = el.setPointerCapture.bind(el);
      el.setPointerCapture = (id: number) => { try { original(id); } catch { /* synthetic pointer */ } };
      const release = el.releasePointerCapture.bind(el);
      el.releasePointerCapture = (id: number) => { try { release(id); } catch { /* synthetic pointer */ } };
      from.forEach(([x, y], i) => fire("pointerdown", 11 + i, x, y));
      for (let step = 1; step <= 10; step += 1) to.forEach(([x, y], i) => fire("pointermove", 11 + i, from[i][0] + (x - from[i][0]) * step / 10, from[i][1] + (y - from[i][1]) * step / 10));
      to.forEach(([x, y], i) => fire("pointerup", 11 + i, x, y));
    }, { from, to });
  };
  const w = box!.width / 2, h = box!.height / 2;
  const before = { cap: await angle("heading"), tilt: await angle("pitch") };
  const r = 60, a = 30 * Math.PI / 180;
  await fingers([[w - r, h], [w + r, h]], [[w - r * Math.cos(a), h + r * Math.sin(a)], [w + r * Math.cos(a), h - r * Math.sin(a)]]);
  await expect.poll(() => angle("heading")).not.toBe(before.cap);
  const turned = { cap: await angle("heading"), tilt: await angle("pitch") };
  expect(Math.abs(turned.tilt - before.tilt)).toBeLessThanOrEqual(1);
  await fingers([[w - 50, h + 40], [w + 50, h + 40]], [[w - 50, h - 30], [w + 50, h - 30]]);
  await expect.poll(() => angle("pitch")).not.toBe(turned.tilt);
  expect(Math.abs((((await angle("heading")) - turned.cap + 540) % 360) - 180)).toBeLessThanOrEqual(1);

  // Three heights. « Au sol » stands above head height and looks almost level.
  await page.locator("[data-framing=sol]").click();
  await expect(sheet).toHaveAttribute("data-street", "1");
  await expect(page.locator("[data-framing=sol]")).toHaveAttribute("aria-pressed", "true");
  expect(await sheet.getAttribute("data-rep3d-height").then(Number)).toBeGreaterThan(3);
  expect(Math.abs(await angle("pitch"))).toBeLessThanOrEqual(12);
  await page.locator("[data-framing=large]").click();
  await expect(sheet).toHaveAttribute("data-street", "0");
  await page.locator("[data-framing=moyen]").click();

  await page.locator("[data-rep3d-capture]").click();
  // Screen 3: no street photo here, and none is needed: view + place go straight to the décor.
  await expect(sheet).toHaveAttribute("data-rep3d-step", "3", { timeout: 20_000 });
  await expect(sheet.getByRole("heading", { level: 1 })).toHaveText("Crée ton décor");
  await expect(page.locator("[data-capture-done] img")).toHaveCount(1);
  await expect(page.locator("[data-rep3d-refs]")).toHaveAttribute("data-rep3d-refs", "0");
  await expect(page.locator("[data-rep3d-direct]")).toHaveText("Ton décor suit ta vue et ce lieu.");
  await expect(page.locator("[data-rep3d-tags] li").first()).toHaveText("Lausanne");
  await expect(page.locator("[data-rep3d-create]")).toBeEnabled();
  await expect(page.locator("[data-rep3d-create]")).toHaveText("Créer le décor · ≈ 5 crédits estimés");
  // « Affiner » (facultatif): your words and photos of the place, side by side, usable together.
  await expect(page.locator("[data-rep3d-refine] h2")).toContainText("Affiner");
  await expect(page.locator("[data-rep3d-refine] h2")).toContainText("facultatif");
  await expect(page.getByLabel("Décris ce que tu veux")).toHaveValue("");
  await expect(page.locator("[data-rep3d-idea]")).toHaveText(["Coucher de soleil", "Sous la neige", "Brume du matin"]);
  await expect(page.locator("[data-rep3d-change-photos]")).toContainText("Ajouter des photos du lieu");
  // « Ajouter des photos du lieu »: import first, no old décor and no 3D capture in the list.
  await page.locator("[data-rep3d-change-photos]").click();
  const picker = page.locator("[data-rep3d-picker]");
  await expect(picker.locator("li").first().locator("[data-rep3d-pick=import]")).toHaveCount(1);
  await expect(picker.locator("[data-rep3d-pool]")).toHaveCount(0);
  await expect(picker.locator("[data-rep3d-rue=none]")).toBeVisible();
  await page.locator("[data-rep3d-pick-ok]").click();
  // Options stay shut; inside, the strict frame is « bientôt ».
  await expect(page.locator("[data-rep3d-name]")).toBeHidden();
  await page.locator("[data-rep3d-more] > summary").click();
  await expect(page.locator("[data-rep3d-name]")).toHaveValue("Place d'essai");
  await expect(page.locator("[data-strict=strict]")).toBeDisabled();
  await expect(page.locator("#u-rv-strict")).toHaveText("bientôt");
  await tall(page, ["[data-rep3d-change-photos]", "[data-ambiance=nuit]", "[data-rep3d-more] > summary", "[data-rep3d-lead]"]);
  // ← goes back one screen, × closes.
  await page.locator("[data-rep3d-lead=back]").click();
  await expect(sheet).toHaveAttribute("data-rep3d-step", "2");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // The view is a free capture, filed as a place: PRISE lists it, named as a 3D view.
  const name = "Place d'essai · Vue 3D";
  await page.getByRole("navigation").getByRole("button", { name: "PRISE" }).click();
  const where = page.locator("[data-ou-source=mes-decors]");
  await expect(where.getByRole("button", { name })).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: "DÉCOR" }).click();
  await expect(page.locator("[data-repere-2d], .maplibregl-canvas, [data-creer-decor]")).toHaveCount(0);
  await expect(page.locator("[data-rep3d-entry]")).toHaveCount(1);
  expect(outside).toEqual([]);
});

test("repérage 3D sans WebGL : un message clair, pas d'écran noir", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      if (kind.includes("webgl")) return null;
      return (original as (...a: unknown[]) => unknown).call(this, kind, ...args);
    } as typeof original;
  });
  await offline(page);
  const sheet = await openSheet(page);
  // Coordinates never reach the geocoder.
  await find(page, "46.5206, 6.6326");
  await expect(sheet).toHaveAttribute("data-rep3d-state", "nogl");
  await expect(sheet.getByRole("alert")).toContainText("n’affiche pas la 3D");
  await expect(page.locator("[data-rep3d-capture]")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("repérage 3D : géocodeur limité, réponse calme et nouvel essai", async ({ page }) => {
  await offline(page);
  await page.route("**/photon.komoot.io/api/**", route => route.fulfill({ status: 429, body: "", headers: { "access-control-allow-origin": "*" } }));
  const sheet = await openSheet(page);
  await find(page, "Tokyo");
  await expect(page.locator("[data-rep3d-search-note]")).toBeVisible();
  // Nothing found: the place-file import shows up next to the note, not before.
  await expect(page.locator("[data-rep3d-file]")).toBeVisible();
  await find(page, "40.758, -73.9855");
  await expect(sheet).toHaveAttribute("data-rep3d-state", "ready", { timeout: 20_000 });
});

// Step 3 with Comfy simulated: nothing leaves the machine and nothing is spent.
async function fakeComfy(page: Page) {
  const graphs: Record<string, { class_type: string; inputs: Record<string, unknown> }>[] = [];
  const uploads: string[] = [];
  await page.addInitScript(() => localStorage.setItem("u-ttu-rendu", JSON.stringify({ mode: "key", key: "audit-fake-key-0123456789" })));
  await page.route(/\/api\/user$/, route => route.fulfill({ json: { id: "reperage" } }));
  await page.route(/\/api\/billing\/usage\/timeseries|customers\/balance/, route => route.fulfill({ json: { summary: { balance: { amount_micros: 500_000_000 } } } }));
  await page.route(/\/api\/upload\/image$/, route => {
    const body = route.request().postDataBuffer()?.toString("latin1") ?? "";
    uploads.push(/filename="([^"]+)"/.exec(body)?.[1] ?? "?");
    return route.fulfill({ json: { name: `entree-${uploads.length}.png` } });
  });
  await page.route(/\/api\/prompt$/, route => {
    graphs.push(route.request().postDataJSON()?.prompt ?? {});
    return route.fulfill({ json: { prompt_id: `cadre-job-${graphs.length}`, node_errors: {} } });
  });
  await page.route(/\/api\/job\/[^/]+\/status$/, route => route.fulfill({ json: { status: "success" } }));
  await page.route(/\/api\/jobs\/[^/?]+$/, route => route.fulfill({ json: { status: "success", outputs: { save: { images: [{ filename: "cadre.webp", subfolder: "", type: "output" }] } } } }));
  await page.route(/\/api\/view\?/, route => route.fulfill({ contentType: "image/webp", body: readFileSync("public/exemples/reperage/sf-exemple.webp") }));
  return { graphs, uploads };
}

test("crée ton décor en direct : vue + lieu, sans photo, ≈ 5 crédits, un seul rendu InstantX avec le contexte", async ({ page }) => {
  const outside = await offline(page);
  const comfy = await fakeComfy(page);
  const sheet = await openSheet(page);
  await find(page, "Place d'essai");
  await expect(sheet).toHaveAttribute("data-rep3d-state", "ready", { timeout: 20_000 });
  await page.locator("[data-framing=sol]").click();
  await page.locator("[data-rep3d-capture]").click();
  await expect(sheet).toHaveAttribute("data-rep3d-step", "3", { timeout: 20_000 });
  const create = page.locator("[data-rep3d-create]");
  await expect(create).toHaveText("Créer le décor · ≈ 5 crédits estimés");
  await expect(page.locator("[data-rep3d-tags] li")).toHaveCount(await page.locator("[data-rep3d-tags] li").count());
  expect(await page.locator("[data-rep3d-tags] li").count()).toBeGreaterThanOrEqual(1);
  expect(await page.locator("[data-rep3d-tags] li").count()).toBeLessThanOrEqual(3);
  await page.locator("[data-rep3d-more] > summary").click();
  await expect(page.locator("[data-ambiance=photos]")).toHaveText("Lumière du jour");
  await tall(page, ["[data-rep3d-create]", "[data-rep3d-change-photos]", "[data-rep3d-idea=neige]", "[data-rep3d-wish]"]);
  // Your words, alone or with an idea: the quote does not move.
  await page.locator("[data-rep3d-wish]").fill("Fin d’après-midi d’automne");
  await page.locator("[data-rep3d-idea=neige]").click();
  await expect(page.locator("[data-rep3d-wish]")).toHaveValue("Fin d’après-midi d’automne, sous la neige");
  await expect(page.locator("[data-rep3d-idea=neige]")).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-rep3d-idea=brume]").click();
  await page.locator("[data-rep3d-idea=brume]").click();
  await expect(page.locator("[data-rep3d-wish]")).toHaveValue("Fin d’après-midi d’automne, sous la neige");
  await expect(create).toHaveText("Créer le décor · ≈ 5 crédits estimés");
  await create.click();
  await expect(page.locator("[data-rep3d-quote]")).toHaveText("≈ 5 crédits estimés, 8 crédits au plus. Environ 20 secondes.");
  await page.locator("[data-rep3d-yes]").click();
  await expect(sheet).toHaveAttribute("data-rep3d-step", "4", { timeout: 30_000 });
  expect(comfy.graphs).toHaveLength(1);
  const loads = Object.entries(comfy.graphs[0]).filter(([, node]) => node.class_type === "LoadImage");
  expect(loads).toHaveLength(1);
  expect(comfy.uploads).toEqual(["uttu-cadre-3d.png"]);
  // InstantX: positive prompt is CLIPTextEncode node 111:6 (inputs.text).
  const encode = comfy.graphs[0]["111:6"] ?? Object.values(comfy.graphs[0]).find(node => node.class_type === "CLIPTextEncode" && String(node.inputs.text ?? "").startsWith("Photorealistic"));
  const text = String(encode?.inputs.text ?? "");
  expect(text).toContain("same exact camera position and composition");
  expect(text).toContain("grey untextured 3D massing");
  expect(text).toContain("The place is real: Place d'essai, Lausanne, Suisse");
  expect(text).toMatch(/about \d+ m above the ground|at a person's eye height/);
  expect(text).toContain("never raise, lower or move the camera");
  expect(text).not.toContain("image 2");
  expect(text).toContain(`The visitor's wish, in their own words: "Fin d’après-midi d’automne, sous la neige".`);
  expect(text).not.toContain("Natural daylight");
  expect(text.split("\n").at(-1)).toMatch(/^Whatever the wish says, the structural guide's camera, framing and building layout stay exactly the same/);
  expect(outside.filter(url => !/\/api\//.test(url))).toEqual([]);
});

test("affiner avec des photos et un texte : auto-sélection 360° + rues, devis flat InstantX, puis un plan", async ({ page }) => {
  const outside = await offline(page);
  await streetPhotos(page);
  const comfy = await fakeComfy(page);
  const sheet = await openSheet(page);
  await find(page, "Place d'essai");
  await expect(sheet).toHaveAttribute("data-rep3d-state", "ready", { timeout: 20_000 });
  await page.locator("[data-rep3d-capture]").click();
  await expect(sheet).toHaveAttribute("data-rep3d-step", "3", { timeout: 20_000 });

  // Auto-pick: 360° of the spot + up to 2 diversified street photos (CADRE_PHOTOS_MAX = 3). InstantX quote stays flat ≈ 5.
  const refs = page.locator("[data-rep3d-refs]");
  await expect(refs).toHaveAttribute("data-rep3d-refs", "3", { timeout: 20_000 });
  const create = page.locator("[data-rep3d-create]");
  await expect(create).toHaveText("Créer le décor · ≈ 5 crédits estimés");

  // « Ajouter des photos du lieu »: pool shows the 360° and the open photos; three already pressed.
  await page.locator("[data-rep3d-change-photos]").click();
  const picker = page.locator("[data-rep3d-picker]");
  await expect(picker.locator("[data-rep3d-pool=rue]")).toHaveCount(4);
  await expect(picker.locator("[data-rep3d-pool][aria-pressed=true]")).toHaveCount(3);
  await expect(picker.locator("[data-rep3d-pool=pano][aria-pressed=true]")).toHaveCount(1);
  await expect(picker.locator(".u-rv-pk-dist").first()).toHaveText(/^\d+ m$/);
  await expect(picker.locator("[data-rep3d-pk-credit]").first()).toContainText("Ada Rue");
  await expect(picker.locator("[data-rep3d-pano]")).toBeVisible();
  await picker.locator("[data-rep3d-pano]").click();
  await expect(page.locator("[data-rep3d-pano-card]")).toBeVisible();
  await tall(page, ["[data-rep3d-pano-other]", "[data-rep3d-pano-keep]"]);
  await page.locator("[data-rep3d-pano-keep]").click();
  await expect(picker).toBeVisible();
  await expect(picker.locator("[data-rep3d-pool][aria-pressed=true]")).toHaveCount(3);
  await expect(create).toContainText("≈ 5 crédits estimés");
  // Swap one auto-picked street photo for an import to exercise the file pick path.
  await picker.locator("[data-rep3d-pool=rue][aria-pressed=true]").first().click();
  await expect(picker.locator("[data-rep3d-pool][aria-pressed=true]")).toHaveCount(2);
  await picker.locator("[data-rep3d-pick=import] input[type=file]").setInputFiles("public/exemples/reperage/sf-rue.webp");
  await expect(picker.locator("[data-rep3d-pool][aria-pressed=true]")).toHaveCount(3);
  await expect(picker.locator("[data-rep3d-pool=rue]").nth(3)).toBeDisabled();
  await expect(page.locator("[data-rep3d-pick-ok]")).toHaveText("Ajouter 3 photos");
  await tall(page, ["[data-rep3d-pool=rue]", "[data-rep3d-pick=import]", "[data-rep3d-pick-ok]", "[data-rep3d-pano]"]);
  await page.locator("[data-rep3d-pick-ok]").click();
  await expect(picker).toBeHidden();
  await expect(refs).toContainText("3 photos du lieu");
  await expect(create).toContainText("≈ 5 crédits estimés");

  // Street photo credits stay one tap away.
  await page.locator("[data-rv-screen='3'] .u-rv-copy").click();
  await expect(page.locator("[data-rep3d-rue-credit]")).toContainText("Ada Rue");
  await expect(page.locator("[data-rep3d-rue-credit]")).toContainText("CC-BY-SA-4.0");
  await page.keyboard.press("Escape");

  await page.locator("[data-rep3d-more] > summary").click();
  await page.locator("[data-ambiance=nuit]").click();
  await page.locator("[data-rep3d-name]").fill("Saint-François nuit");
  await page.locator("[data-rep3d-wish]").fill("Pavés mouillés");
  await expect(create).toContainText("≈ 5 crédits estimés");
  expect(comfy.graphs).toHaveLength(0);

  // Confirmation in plain words, then one InstantX + Lotus pass.
  await create.click();
  await expect(page.locator("[data-rep3d-quote]")).toHaveText("≈ 5 crédits estimés, 8 crédits au plus. Environ 20 secondes.");
  await page.locator("[data-rep3d-yes]").click();
  await expect(sheet).toHaveAttribute("data-rep3d-step", "4", { timeout: 30_000 });
  await expect(sheet.getByRole("heading", { level: 1 })).toHaveText("Ton décor est prêt");
  await expect(page.locator("[data-rep3d-saved]")).toHaveText("Il est enregistré dans tes décors.");
  await expect(page.locator("[data-rep3d-made] img")).toBeVisible();
  await expect(page.locator("[data-rep3d-to-prise]")).toHaveText("Utiliser dans un plan");
  await expect(page.locator("[data-rep3d-again]")).toHaveText("Refaire");
  await tall(page, ["[data-rep3d-to-prise]", "[data-rep3d-again]"]);

  expect(comfy.graphs).toHaveLength(1);
  const graph = comfy.graphs[0];
  const loads = Object.entries(graph).filter(([, node]) => node.class_type === "LoadImage");
  // InstantX + Lotus: colour frame only — street photos colour the prompt, not the graph.
  expect(loads).toHaveLength(1);
  expect(loads[0][1].inputs.image).toBe("entree-1.png");
  expect(comfy.uploads).toEqual(["uttu-cadre-3d.png"]);
  const encode = graph["111:6"] ?? Object.values(graph).find(node => node.class_type === "CLIPTextEncode" && String(node.inputs.text ?? "").startsWith("Photorealistic"));
  const text = String(encode?.inputs.text ?? "");
  expect(text).toContain("same exact camera position and composition");
  expect(text).toContain("Match materials, colours, weathering");
  expect(text).not.toContain("image 2");
  expect(text).toContain("Night");
  expect(text).toContain(`"Pavés mouillés"`);
  expect(text).toContain("structural guide's camera, framing and building layout stay exactly the same");

  // « Utiliser dans un plan » closes the sheet with the new décor already chosen.
  await page.locator("[data-rep3d-to-prise]").click();
  await expect(sheet).toBeHidden();
  const place = page.locator("[data-ou-source=mes-decors]").getByRole("button", { name: "Saint-François nuit" });
  await expect(place).toBeVisible();
  await expect(place).toHaveAttribute("aria-pressed", "true");
  expect(outside.filter(url => !/\/api\//.test(url))).toEqual([]);
});
