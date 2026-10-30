import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ajouterPlan, ajouterPrise, ajouterRef, auMontage, garderPrise, lireRegistre, nouveauPlan, refsDuClip,
  registreJson, registreVide, relier, REFS_MAX, type Registre,
} from "../src/lib/film/registre.ts";
import { memoEnvois, memoMemoire, ENVOI_TTL_MS } from "../src/lib/film/envois.ts";
import { film2Actif, FILM2_KEY } from "../src/lib/film/drapeau.ts";
import { createRenderClient } from "../src/lib/render/client.ts";

const ref = (sha: string) => ({ sha256: sha, path: `${sha}.png` });

function withVault(): Registre {
  return relier(registreVide(), {
    cast: [{ id: "uttu", name: "Uttu", sheet: "cast/uttu/fiche.png", photos: ["cast/uttu/1.png", "cast/uttu/1-copie.png"] }],
    scenes: [{ id: "quai", name: "Le quai", stills: ["decor/quai.png"], render: null }],
  }, path => path === "cast/uttu/1-copie.png" ? "sha-1" : `sha-${path}`.replace("sha-cast/uttu/1.png", "sha-1"));
}

test("two identical imports give one entry, and a character holds three pictures at most", () => {
  let refs = ajouterRef([], ref("a")).refs;
  const again = ajouterRef(refs, { sha256: "a", path: "autre-nom.png" });
  assert.equal(again.refs.length, 1);
  assert.equal(again.doublon?.path, "a.png");
  refs = ajouterRef(ajouterRef(refs, ref("b")).refs, ref("c")).refs;
  const full = ajouterRef(refs, ref("d"));
  assert.equal(full.plein, true);
  assert.equal(full.refs.length, REFS_MAX);
  // The vault's duplicate photo (same bytes) is one reference.
  assert.equal(withVault().personnages[0].refs.length, 2);
});

test("plan 2 inherits who and where from plan 1", () => {
  let reg = withVault();
  const un = { ...nouveauPlan(reg, "p1", "Uttu marche sur le quai"), quiIds: ["uttu"], ouId: "quai" };
  reg = ajouterPlan(reg, un);
  const deux = nouveauPlan(reg, "p2");
  assert.deepEqual(deux.quiIds, ["uttu"]);
  assert.equal(deux.ouId, "quai");
  assert.equal(deux.reglages.duree, 5);
});

test("a cut clip finds its references, and follows the kept take", () => {
  let reg = withVault();
  reg = ajouterPlan(reg, { ...nouveauPlan(reg, "p1"), quiIds: ["uttu"], ouId: "quai" });
  reg = ajouterPrise(reg, "p1", { id: "t1", fichier: "prises/t1.mp4" });
  reg = ajouterPrise(reg, "p1", { id: "t2", fichier: "prises/t2.mp4" });
  reg = auMontage(reg, "p1", 5);
  assert.equal(auMontage(reg, "p1", 5), reg, "added once");
  assert.equal(reg.montage.clips[0].priseId, "t1", "first take kept");
  reg = garderPrise(reg, "p1", "t2");
  const found = refsDuClip(reg, reg.montage.clips[0]);
  assert.equal(found?.prise?.fichier, "prises/t2.mp4");
  assert.equal(found?.personnages[0].nom, "Uttu");
  assert.equal(found?.lieu?.nom, "Le quai");
  assert.equal(found?.refs.length, 3);
  // Stored and read back unchanged.
  assert.deepEqual(lireRegistre(registreJson(reg)), reg);
  assert.deepEqual(lireRegistre("{pas du json"), registreVide());
});

function fakeComfy() {
  const calls: string[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (url.endsWith("/api/upload/image")) return Response.json({ name: `envoi-${calls.length}.png` });
    if (url.endsWith("/api/prompt")) {
      const body = JSON.parse(String(init?.body));
      const missing = JSON.stringify(body.prompt).includes("perdu.png");
      return missing ? Response.json({ error: { message: "Invalid image file: perdu.png" } }, { status: 400 }) : Response.json({ prompt_id: "job-1" });
    }
    return new Response("{}", { status: 404 });
  }) as typeof globalThis.fetch;
  return { calls, fetch };
}

test("0 /api/upload/image for a picture already sent to the same account", async () => {
  const memo = memoMemoire();
  const comfy = fakeComfy();
  const client = createRenderClient({ auth: { kind: "key", key: "audit-fake-key-0123456789" }, fetch: comfy.fetch, uploadMemo: memo });
  const photo = () => new Blob(["mêmes octets"], { type: "image/png" });
  const first = await client.upload(photo(), "uttu.png");
  const second = await client.upload(photo(), "uttu.png");
  assert.equal(second, first);
  assert.equal(comfy.calls.filter(call => call.endsWith("/api/upload/image")).length, 1);
  // Another account sends it again.
  const other = createRenderClient({ auth: { kind: "key", key: "autre-fake-key-9876543210" }, fetch: comfy.fetch, uploadMemo: memo });
  await other.upload(photo(), "uttu.png");
  assert.equal(comfy.calls.filter(call => call.endsWith("/api/upload/image")).length, 2);
  // Without the memo (film2 off), nothing changes: every take uploads.
  const plain = createRenderClient({ auth: { kind: "key", key: "audit-fake-key-0123456789" }, fetch: comfy.fetch });
  await plain.upload(photo(), "uttu.png");
  assert.equal(comfy.calls.filter(call => call.endsWith("/api/upload/image")).length, 3);
});

test("a name the cloud refuses is sent again on the next take", async () => {
  const memo = memoMemoire();
  const comfy = fakeComfy();
  const client = createRenderClient({ auth: { kind: "key", key: "audit-fake-key-0123456789" }, fetch: comfy.fetch, uploadMemo: memo });
  const photo = () => new Blob(["vieux"], { type: "image/png" });
  await client.upload(photo(), "v.png");
  // Pretend the stored name is gone on the cloud.
  const upload = comfy.calls.length;
  const name = await client.upload(photo(), "v.png");
  assert.equal(comfy.calls.length, upload, "reused");
  await assert.rejects(client.submit({ "1": { class_type: "LoadImage", inputs: { image: name.replace(/.*/, "perdu.png") } } } as never, "c"));
  await client.upload(photo(), "v.png");
  assert.equal(comfy.calls.filter(call => call.endsWith("/api/upload/image")).length, 2);
});

test("the stored memo expires after a week", () => {
  const rows = new Map<string, string>();
  const storage = { getItem: (k: string) => rows.get(k) ?? null, setItem: (k: string, v: string) => { rows.set(k, v); } };
  let now = 1_000;
  const memo = memoEnvois(storage, () => now);
  memo.set("k", "nom.png");
  assert.equal(memo.get("k"), "nom.png");
  now += ENVOI_TTL_MS + 1;
  assert.equal(memo.get("k"), null);
});

test("film2 is off by default, on with ?film2=1 and kept, off with ?film2=0", () => {
  const rows = new Map<string, string>();
  const storage = { getItem: (k: string) => rows.get(k) ?? null, setItem: (k: string, v: string) => { rows.set(k, v); }, removeItem: (k: string) => { rows.delete(k); } };
  assert.equal(film2Actif("", storage), false);
  assert.equal(film2Actif("?demo=1&film2=1", storage), true);
  assert.equal(rows.get(FILM2_KEY), "1");
  assert.equal(film2Actif("", storage), true);
  assert.equal(film2Actif("?film2=0", storage), false);
  assert.equal(film2Actif("", storage), false);
  assert.equal(film2Actif("?film2=1", null), true);
});
