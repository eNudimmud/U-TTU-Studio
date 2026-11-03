import { test } from "node:test";
import assert from "node:assert/strict";
import { knowledge } from "../scripts/agent-knowledge.mjs";
import { searchFaq, type Knowledge } from "../src/lib/agent/uttu.ts";

const k = knowledge("abcdef0123456789", false) as Knowledge;
const top = (locale: "fr" | "en" | "de" | "es", q: string) => searchFaq(k, locale, q)[0];

test("the local FAQ answers in the four languages", () => {
  const cases: [Parameters<typeof top>[0], string, string][] = [
    ["fr", "comment commencer ?", "start"],
    ["fr", "où coller ma clé ?", "key"],
    ["en", "where do I paste my key?", "key"],
    ["de", "Wie fange ich an?", "start"],
    ["es", "¿dónde pego mi clave?", "key"],
    ["fr", "bonjour", "hello"],
    ["fr", "quelle version ?", "version"],
    ["fr", "Qui es-tu ?", "who"],
    ["en", "Who are you?", "who"],
  ];
  for (const [locale, q, id] of cases) {
    const hit = top(locale, q);
    assert.ok(hit, `${locale}: ${q}`);
    assert.equal(hit.kind, "faq", `${locale}: ${q}`);
    assert.equal(hit.id, id, `${locale}: ${q}`);
  }
});

test("each language finds every FAQ entry from its own question", () => {
  for (const locale of ["fr", "en", "de", "es"] as const) {
    for (const f of k.locales[locale].faq) {
      const hits = searchFaq(k, locale, f.q);
      assert.ok(hits.some(h => h.kind === "faq" && h.id === f.id), `${locale}/${f.id}: ${f.q}`);
    }
  }
});

test("the version answer carries the short commit", () => {
  assert.match(top("fr", "quelle version ?")!.text, /abcdef0/);
});

test("nonsense and off-topic questions get nothing, so Uttu says it does not know", () => {
  assert.deepEqual(searchFaq(k, "fr", "xqzv brmpf"), []);
  assert.deepEqual(searchFaq(k, "en", "what is the weather in Paris"), []);
  assert.deepEqual(searchFaq(k, "fr", "   "), []);
});

test("the answers are written with tu, du and tú", () => {
  const fr = k.locales.fr.faq.map(f => f.a).join(" ");
  assert.doesNotMatch(fr, /\b(vous|votre|vos)\b/i);
  const de = k.locales.de.faq.map(f => f.a).join(" ");
  assert.doesNotMatch(de, /\b(Ihnen|Ihrem|Ihren|Ihrer)\b|\bSie (können|müssen|haben|sollten)\b/);
  const es = k.locales.es.faq.map(f => f.a).join(" ");
  assert.doesNotMatch(es, /\busted(es)?\b/i);
});
