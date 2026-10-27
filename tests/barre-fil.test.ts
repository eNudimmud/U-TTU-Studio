import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "../src/lib/barre/model.ts";
import { append, busyJob, clearFil, emptyFil, FIL_KEY, lastResult, loadFil, patchJob, planSend, prisePrompt, priseSettings, saveFil, wantsLast, type FilJob, type FilRef } from "../src/lib/barre/thread.ts";

function memory() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k), map };
}
const uttu: FilRef = { kind: "cast", id: "uttu", name: "Uttu", src: "blob:x", path: "Projets/p/Cast/uttu.webp", vault: true };
const quai: FilRef = { kind: "decor", id: "quai", name: "Quai de nuit", src: "blob:y", path: "Projets/p/Lieux/quai.webp", vault: true };
const demo: FilRef = { kind: "cast", id: "demo-dj", name: "DJ", src: "/exemples/cast-dj.webp" };
const image: FilJob = { id: "j1", role: "job", of: "u1", text: "un chat", route: { kind: "outil", id: "img-klein", images: [] }, sortie: "image", status: "done", quote: 1, url: "blob:r", path: "Projets/p/Assets/img.png", aspect: "horizontal" };
const base = { last: null, lastName: "Résultat", settings: DEFAULT_SETTINGS };

test("image mode picks Klein, Modifier or Références from the pictures attached", () => {
  const t = (refs: FilRef[]) => { const p = planSend({ ...base, mode: "image", text: "un chat", refs }); return p.kind === "run" && p.route.kind === "outil" ? p.route.id : p.kind; };
  assert.equal(t([]), "img-klein");
  assert.equal(t([demo]), "ret-modifier");
  assert.equal(t([demo, uttu]), "img-refs");
});

test("video mode goes to PRISE only when every reference is in the project", () => {
  const p = planSend({ ...base, mode: "video", text: "Uttu marche sur le quai", refs: [uttu, quai] });
  assert.equal(p.kind === "run" && p.route.kind, "prise");
  const q = planSend({ ...base, mode: "video", text: "le DJ danse", refs: [demo] });
  assert.ok(q.kind === "run" && q.route.kind === "outil" && q.route.id === "vid-wan");
  assert.deepEqual(planSend({ ...base, mode: "video", text: "un plan", refs: [] }), { kind: "run", route: { kind: "outil", id: "vid-texte", images: [] }, sortie: "video", refs: [] });
});

test("« anime-la » reuses the last image result", () => {
  const p = planSend({ ...base, last: image, mode: "video", text: "anime-la", refs: [] });
  assert.ok(p.kind === "run" && p.route.kind === "outil" && p.route.id === "vid-wan" && p.refs[0].kind === "result" && p.refs[0].path === image.path);
  const m = planSend({ ...base, last: image, mode: "image", text: "modifie-la : ciel rouge", refs: [] });
  assert.ok(m.kind === "run" && m.route.kind === "outil" && m.route.id === "ret-modifier");
  // A new description never points back by chance.
  const n = planSend({ ...base, last: image, mode: "image", text: "une villa au bord de la mer", refs: [] });
  assert.ok(n.kind === "run" && n.route.kind === "outil" && n.route.id === "img-klein");
});

test("follow-up words in the four languages", () => {
  for (const s of ["anime-la", "Animate it", "anímala", "animiere es", "modifie-le", "la même en noir et blanc"]) assert.ok(wantsLast(s), s);
  for (const s of ["une villa", "es un perro", "a cat in the rain", "le quai la nuit"]) assert.ok(!wantsLast(s), s);
});

test("agent mode never plans a run", () => {
  assert.deepEqual(planSend({ ...base, mode: "agent", text: "fais un film", refs: [uttu] }), { kind: "agent" });
});

test("PRISE settings and prompt come from decision.ts, Aperçu kept for LTX", () => {
  assert.equal(priseSettings({ rendu: "apercu", duree: 8, format: "9:16" }).rendu, "apercu");
  assert.equal(priseSettings({ rendu: "apercu", duree: 5, format: "16:9" }, "h3").rendu, undefined);
  assert.equal(priseSettings({ rendu: "finale", duree: 5, format: "9:16" }).aspect, "vertical");
  const text = prisePrompt("marche vers la caméra", { kind: "prise", cast: [uttu], decor: quai, settings: DEFAULT_SETTINGS });
  assert.match(text, /Uttu/);
  assert.match(text, /Quai de nuit/);
});

test("thread persists in sessionStorage without blob URLs and marks cut runs", () => {
  const store = memory();
  let fil = append(emptyFil(), { id: "u1", role: "user", mode: "image", text: "un chat", refs: [uttu], at: 1 }, { ...image, status: "running" });
  assert.equal(busyJob(fil)?.id, "j1");
  saveFil(store, fil);
  const back = loadFil(store);
  const job = back.messages[1] as FilJob;
  assert.equal(job.status, "interrupted");
  assert.equal(job.url, undefined);
  assert.equal(job.path, image.path);
  assert.equal((back.messages[0] as { refs: FilRef[] }).refs[0].src, "");
  fil = patchJob(fil, "j1", { status: "done" });
  assert.equal(lastResult(fil)?.id, "j1");
  assert.equal(clearFil(store).messages.length, 0);
  assert.equal(store.map.has(FIL_KEY), false);
});
