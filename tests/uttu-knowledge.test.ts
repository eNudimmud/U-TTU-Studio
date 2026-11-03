import { test } from "node:test";
import assert from "node:assert/strict";
import { knowledge } from "../scripts/agent-knowledge.mjs";
import { REGISTRE, gesteOuvert } from "../src/lib/workflows/registre.ts";
import { UTTU_LOCALES, type Knowledge } from "../src/lib/agent/uttu.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";

test("the knowledge pack is deterministic for one commit", () => {
  assert.equal(JSON.stringify(knowledge(SHA, false)), JSON.stringify(knowledge(SHA, false)));
});

test("the knowledge pack carries the commit and stays small", () => {
  const k = knowledge(SHA, false) as Knowledge;
  assert.equal(k.schema, 1);
  assert.equal(k.version.sha, SHA);
  assert.equal(k.version.short, SHA.slice(0, 7));
  const bytes = Buffer.byteLength(JSON.stringify(k));
  assert.ok(bytes < 120_000, `knowledge.json is ${bytes} bytes`);
});

test("the knowledge pack covers the four languages with the same entries", () => {
  const k = knowledge(SHA, false) as Knowledge;
  const faq = (l: (typeof UTTU_LOCALES)[number]) => k.locales[l].faq.map(f => f.id).join();
  for (const l of UTTU_LOCALES) {
    assert.ok(k.locales[l], l);
    assert.equal(faq(l), faq("fr"), `${l} FAQ ids`);
    assert.ok(k.locales[l].faq.length >= 15, `${l} FAQ size`);
  }
  assert.deepEqual(k.tabs.map(t => t.id), ["cast", "decor", "prise", "montage", "outils", "projets"]);
  assert.ok(k.docs.length >= 3);
});

test("only open gestures are described, with the registry prices", () => {
  const k = knowledge(SHA, false) as Knowledge;
  for (const g of k.gestures) {
    const source = REGISTRE.find(r => r.id === g.id);
    assert.ok(source, g.id);
    assert.ok(gesteOuvert(source!), `${g.id} is open`);
    if (g.cost) assert.deepEqual(g.cost, [source!.credits, source!.high]);
  }
});

test("the pack names no third-party render service", () => {
  const raw = JSON.stringify(knowledge(SHA, false));
  assert.doesNotMatch(raw, /\bfal\.ai\b|\bfal\.run\b/i);
});
