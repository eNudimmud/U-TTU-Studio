import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ACTION_LIMIT, DEFAULT_SETTINGS, MAX_CAST, PRISE_HANDOFF_KEY, REFS_HANDOFF_KEY,
  attachFor, barreTarget, isPriseHandoff, isRefsHandoff, priseHandoff, settingsFor, takeHandoff, toggleRef, writeHandoff,
  type BarreRef,
} from "../src/lib/barre/model.ts";

const cast = (id: string): BarreRef => ({ kind: "cast", id, name: id, src: `/${id}.webp` });
const decor = (id: string): BarreRef => ({ kind: "decor", id, name: id, src: `/${id}.webp` });

function memory() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k), map };
}

describe("barre unique", () => {
  it("sends each mode to the tool that already exists", () => {
    assert.deepEqual(barreTarget("video", "Uttu marche", [], []), { kind: "prise" });
    assert.deepEqual(barreTarget("agent", "monte mon film", [], []), { kind: "agent" });
    assert.deepEqual(barreTarget("image", "un chat sur un toit", [], []), { kind: "outil", id: "img-klein", images: [] });
    assert.deepEqual(barreTarget("image", "un court métrage sur le quai", [], []), { kind: "film" });
  });

  it("uses one reference to modify and two to compose, never more than two", () => {
    const one = barreTarget("image", "même tenue", [cast("a")], []);
    assert.equal(one.kind === "outil" && one.id, "ret-modifier");
    const photo = { id: "p", name: "photo.jpg", url: "blob:x" };
    const two = barreTarget("image", "ensemble", [cast("a"), decor("d")], [photo]);
    assert.ok(two.kind === "outil");
    assert.equal(two.id, "img-refs");
    assert.deepEqual(two.images.map(image => image.name), ["photo.jpg", "a"]);
  });

  it("keeps three characters and one place at most", () => {
    let list: BarreRef[] = [];
    for (const id of ["a", "b", "c", "d"]) list = toggleRef(list, cast(id));
    assert.equal(list.length, MAX_CAST);
    list = toggleRef(list, decor("quai"));
    list = toggleRef(list, decor("gare"));
    assert.deepEqual(list.filter(ref => ref.kind === "decor").map(ref => ref.id), ["gare"]);
    list = toggleRef(list, cast("a"));
    assert.deepEqual(list.map(ref => ref.id), ["b", "c", "gare"]);
  });

  it("hands PRISE the sentence, the cast, the place and the settings", () => {
    const handoff = priseHandoff(`  ${"x".repeat(300)} `, [cast("uttu"), decor("quai")], { rendu: "apercu", duree: 8, format: "9:16" });
    assert.equal(handoff.action.length, ACTION_LIMIT);
    assert.deepEqual(handoff.castIds, ["uttu"]);
    assert.equal(handoff.decorId, "quai");
    assert.ok(isPriseHandoff(handoff));
    assert.equal(isPriseHandoff({ ...handoff, settings: { ...DEFAULT_SETTINGS, duree: 6 } }), false);
  });

  it("reads a handoff once, so a reload never refills the tool", () => {
    const store = memory();
    writeHandoff(store, PRISE_HANDOFF_KEY, priseHandoff("Uttu", [], DEFAULT_SETTINGS));
    assert.equal(takeHandoff(store, PRISE_HANDOFF_KEY, isPriseHandoff)?.action, "Uttu");
    assert.equal(takeHandoff(store, PRISE_HANDOFF_KEY, isPriseHandoff), null);
    store.setItem(REFS_HANDOFF_KEY, "{broken");
    assert.equal(takeHandoff(store, REFS_HANDOFF_KEY, isRefsHandoff), null);
    assert.equal(store.map.size, 0);
  });

  it("shows settings and attachments only where they mean something", () => {
    assert.deepEqual(settingsFor("video"), ["rendu", "duree", "format"]);
    assert.deepEqual(settingsFor("image"), []);
    assert.deepEqual(attachFor("image"), ["photo", "reference", "lieu"]);
    assert.deepEqual(attachFor("video"), ["reference", "lieu", "son"]);
    assert.deepEqual(attachFor("agent"), []);
  });

  it("writes the estimate in credits, in every language, with no free promise", () => {
    for (const lang of ["fr", "en", "de", "es"]) {
      const barre = JSON.parse(readFileSync(`messages/${lang}.json`, "utf8")).barre;
      assert.match(barre.cost, /other \{≈ \{credits\} \S+ /);
      assert.doesNotMatch(barre.cost, /\bcr\./);
      assert.doesNotMatch(JSON.stringify(barre), /gratuit|free|kostenlos|gratis/i);
    }
  });

  it("keeps the old home one tap away, behind « Tous les outils »", () => {
    const hub = readFileSync("src/components/app/outils-hub.tsx", "utf8");
    assert.match(hub, /ALL_TOOLS_ID/);
    assert.match(hub, /<BarreHome \/>/);
    assert.match(hub, /<StudioHome \/>/);
  });
});
