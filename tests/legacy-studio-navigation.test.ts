import { test } from "node:test";
import assert from "node:assert/strict";
import { legacyStudioDestination } from "../src/lib/sections/navigation.ts";
import { legacyStudioHref } from "../src/lib/legacy-studio.ts";
import { studioTarget } from "../src/lib/coffre/target.ts";

test("bare historical steps and qualified tools open the remembered section", () => {
  assert.equal(legacyStudioDestination("anime", "", ""), null);
  assert.equal(legacyStudioDestination("anime", "#personnage", ""), "/studio/anime/cast");
  assert.equal(legacyStudioDestination("cinema", "#scene", ""), "/studio/cinema/set");
  assert.equal(legacyStudioDestination("anime", "", "?step=prise"), "/studio/anime/shoot?step=prise");
  assert.equal(legacyStudioDestination("anime", "#outils/ret-detourer", "", { "ret-detourer": "cast" }), "/studio/anime/cast/ret-detourer");
  assert.equal(legacyStudioDestination("cinema", "#outils/img-qwen", ""), "/studio/cinema/cast");
});

test("project, media and agent links keep every option in the historical adapter", () => {
  for (const query of [
    "?project=film-b&take=take-7", "?project=film-b&plan=plan-2", "?project=film-b&asset=asset-1",
    "?cast=alice&decor=port", "?sequence=sequence-3", "?geste=edit&step=scene", "?uttu=1",
    "?unknown=one&unknown=two", "?film2=0",
  ]) {
    assert.equal(legacyStudioDestination("anime", "#prise", query), `/studio/legacy${query}#prise`);
    assert.equal(legacyStudioDestination("anime", "#outils/ret-detourer", query, { "ret-detourer": "cast" }), `/studio/legacy${query}#outils/ret-detourer`);
  }
});

test("unqualified tools stay accessible without turning inherited names into routes", () => {
  for (const id of ["unavailable", "constructor", "__proto__", "toString", "tous"]) {
    assert.equal(legacyStudioDestination("cinema", `#outils/${id}`, ""), `/studio/legacy#outils/${id}`);
  }
  assert.equal(legacyStudioDestination("cinema", "#outils/%E0", ""), null);
  assert.equal(legacyStudioDestination("cinema", "#%E0", ""), null);
});

test("legacy agent navigation preserves its project and never rewrites modern or external URLs", () => {
  for (const suffix of ["", "#montage", "?project=film-b&plan=p2#prise", "#outils/ret-detourer"]) {
    assert.equal(legacyStudioHref(`/studio${suffix}`), `/studio/legacy${suffix}`);
  }
  for (const href of ["/studio/anime/cast", "/studio/legacy#prise", "/studio-agent/chat", "/mon-studio", "https://example.org/studio#prise"]) {
    assert.equal(legacyStudioHref(href), href);
  }
});

test("all library targets keep their exact project and selected resource", () => {
  const keys = { personnage: "cast", lieu: "decor", prise: "take", sequence: "sequence", plan: "plan", asset: "asset" } as const;
  for (const [kind, key] of Object.entries(keys)) {
    const url = new URL(studioTarget(kind as keyof typeof keys, "id avec & accents é", "film-b", true), "https://studio.test");
    assert.equal(url.pathname, "/studio/legacy");
    assert.equal(url.searchParams.get("demo"), "1");
    assert.equal(url.searchParams.get("project"), "film-b");
    assert.equal(url.searchParams.get(key), "id avec & accents é");
    assert.equal(url.hash, kind === "sequence" || kind === "asset" ? "#montage" : "#prise");
  }
});
