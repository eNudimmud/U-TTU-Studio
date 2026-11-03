import { test } from "node:test";
import assert from "node:assert/strict";
import { knowledge } from "../scripts/agent-knowledge.mjs";
import { REGISTRE } from "../src/lib/workflows/registre.ts";
import { formatCr, simItems, simulate, simulateText, type Knowledge } from "../src/lib/agent/uttu.ts";

const k = knowledge("local", false) as Knowledge;
const reg = (id: string) => REGISTRE.find(g => g.id === id)!;

test("3 portraits + 2 LTX takes uses the studio cost table, in every language", () => {
  const low = 3 * reg("cast-texte").credits! + 2 * reg("prise-plan").credits!;
  const high = 3 * reg("cast-texte").high! + 2 * reg("prise-plan").high!;
  const cases = [
    ["fr", "Combien coûtent 3 portraits + 2 prises LTX ?"],
    ["en", "How much for 3 portraits + 2 LTX takes?"],
    ["de", "Was kosten 3 Porträts + 2 LTX-Takes?"],
    ["es", "¿Cuánto cuestan 3 retratos + 2 tomas LTX?"],
  ] as const;
  for (const [locale, q] of cases) {
    const sim = simulateText(k, locale, q);
    assert.ok(sim, `${locale}: ${q}`);
    assert.deepEqual(sim.lines.map(l => [l.item.id, l.qty]), [["cast-texte", 3], ["prise-plan", 2]], locale);
    assert.equal(sim.low, low, locale);
    assert.equal(sim.high, high, locale);
  }
});

test("number words and several separators are understood", () => {
  const sim = simulateText(k, "fr", "trois portraits, deux prises ltx et une musique : combien ?");
  assert.ok(sim);
  assert.deepEqual(sim.lines.map(l => [l.item.id, l.qty]), [["cast-texte", 3], ["prise-plan", 2], ["mont-musique", 1]]);
});

test("actions and plain questions are not mistaken for a quote", () => {
  assert.equal(simulateText(k, "fr", "Prépare trois prises avec ce personnage"), null);
  assert.equal(simulateText(k, "fr", "détourer une image"), null);
  assert.equal(simulateText(k, "en", "what is the weather in Paris"), null);
  assert.equal(simulateText(k, "fr", "comment commencer ?"), null);
});

test("unknown items with a count are reported, never priced", () => {
  const sim = simulateText(k, "fr", "2 zèbres + 1 portrait");
  assert.ok(sim);
  assert.deepEqual(sim.lines.map(l => l.item.id), ["cast-texte"]);
  assert.equal(sim.unknown.length, 1);
});

test("only priced items of the studio can be picked", () => {
  for (const locale of ["fr", "en", "de", "es"] as const) {
    const items = simItems(k, locale);
    assert.ok(items.length > 10, locale);
    for (const item of items) assert.ok(item.cost[0] > 0 && item.cost[1] >= item.cost[0], `${locale}/${item.id}`);
  }
});

test("picks merge, and totals are bounded to one decimal", () => {
  const item = simItems(k, "fr").find(i => i.id === "cast-texte")!;
  const sim = simulate([{ item, qty: 2 }, { item, qty: 1 }]);
  assert.equal(sim.lines.length, 1);
  assert.equal(sim.lines[0].qty, 3);
  assert.equal(sim.low, 3 * item.cost[0]);
  assert.deepEqual(simulate([]).lines, []);
});

test("credits are written the local way", () => {
  assert.equal(formatCr("fr", 12.5), "12,5");
  assert.equal(formatCr("en", 12.5), "12.5");
  assert.equal(formatCr("de", 36), "36");
});
