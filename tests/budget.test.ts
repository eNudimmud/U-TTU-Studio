import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUDGET_EXPORT_EMPTY, BUDGET_EXPORT_FILE, BUDGET_LEGACY_KEY, BUDGET_LINE_MAX, EMPTY_JOURNAL,
  addBudgetLine, budgetStorageKey, clipDate, journalIsEmpty, journalMarkdown, parseJournal, readJournal, removeBudgetLine, saveJournal, serializeJournal, todayStamp,
} from "../src/lib/budget.ts";

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    keys: () => [...data.keys()],
  };
}

describe("journal par compte", () => {
  it("stays empty, ignores a balance, and refuses a line without a date", () => {
    assert.equal(journalIsEmpty(parseJournal(JSON.stringify({ balance: 500, credits: 12 }))), true);
    assert.equal(journalIsEmpty(parseJournal(JSON.stringify({ lines: [{ id: "x", label: "Lot", estimate: "9" }] }))), false);
    const undated = parseJournal(JSON.stringify({ lines: [{ id: "x", gesture: "Lot", estimate: "9" }] }));
    assert.equal(undated.lines[0]?.date, "");
    assert.equal(addBudgetLine(EMPTY_JOURNAL, "Lot", "9", "", "line-2"), EMPTY_JOURNAL);
    assert.equal(addBudgetLine(EMPTY_JOURNAL, "Lot", "9", "2026-02-31", "line-2"), EMPTY_JOURNAL);
    assert.equal(addBudgetLine(EMPTY_JOURNAL, "Lot", "9", "28.09.2026", "line-2"), EMPTY_JOURNAL);
    assert.equal(clipDate("2026-09-28"), "2026-09-28");
    assert.equal(todayStamp(new Date(2026, 8, 28, 23, 30)), "2026-09-28");
  });

  it("keeps one bucket per Clerk id and never reads the old global key", () => {
    assert.equal(budgetStorageKey(""), null);
    assert.equal(budgetStorageKey("  "), null);
    assert.equal(budgetStorageKey("../user"), null);
    assert.equal(budgetStorageKey("user a"), null);
    assert.equal(budgetStorageKey("user_a"), "u-ttu-budget:user_a");
    const noted = addBudgetLine(EMPTY_JOURNAL, "Tester un prompt", "à ta main", "2026-09-28", "line-1");
    const store = memory();
    store.setItem(BUDGET_LEGACY_KEY, serializeJournal(noted));
    assert.equal(journalIsEmpty(readJournal(store, "user_a")), true);
    assert.equal(saveJournal(store, "", noted), false);
    assert.equal(saveJournal(store, "../user", noted), false);
    assert.equal(saveJournal(null, "user_a", noted), false);
    assert.equal(saveJournal(store, "user_a", noted), true);
    assert.equal(saveJournal(store, "user_b", addBudgetLine(EMPTY_JOURNAL, "Autre", "1 crédit", "2026-09-27", "line-b")), true);
    assert.deepEqual(readJournal(store, "user_a").lines.map(line => line.label), ["Tester un prompt"]);
    assert.deepEqual(readJournal(store, "user_b").lines.map(line => line.label), ["Autre"]);
    assert.equal(store.keys().includes(BUDGET_LEGACY_KEY), true);
    assert.equal(store.keys().filter(key => key.startsWith("u-ttu-budget:")).length, 2);
    assert.equal(journalIsEmpty(readJournal(store, "user_a")), false);
    assert.equal(journalIsEmpty(removeBudgetLine(readJournal(store, "user_a"), "line-1")), true);
  });

  it("drops a planted balance and exports a jobs.md snippet, not a cloud total", () => {
    const raw = JSON.stringify({
      balance: 80,
      lines: [{ id: "a", label: "Lot | rangé", estimate: "2 crédits", date: "2026-09-28", credits: 40, balance: 9 }],
    });
    const parsed = parseJournal(raw);
    assert.deepEqual(parsed.lines, [{ id: "a", label: "Lot | rangé", estimate: "2 crédits", date: "2026-09-28" }]);
    assert.doesNotMatch(serializeJournal(parsed), /credits|balance/);
    const markdown = journalMarkdown(parsed);
    assert.match(markdown, /\| Date \| Geste \| Dossier \| Note \|/);
    assert.match(markdown, /\| 2026-09-28 \| Lot \\| rangé \|  \| 2 crédits \|/);
    assert.match(markdown, /jobs\.md/);
    assert.doesNotMatch(markdown, /balance|stripe|fal\.ai/i);
    assert.match(journalMarkdown(EMPTY_JOURNAL), new RegExp(BUDGET_EXPORT_EMPTY));
    assert.doesNotMatch(journalMarkdown(EMPTY_JOURNAL), /\| 2026/);
    assert.equal(BUDGET_EXPORT_FILE, "jobs-extrait.md");
    let journal = EMPTY_JOURNAL;
    for (let i = 0; i < BUDGET_LINE_MAX + 1; i += 1) {
      journal = addBudgetLine(journal, `Ligne ${i}`, "", "2026-09-28", `id-${i}`);
    }
    assert.equal(journal.lines.length, BUDGET_LINE_MAX);
    assert.equal(journal.lines[0]?.label, "Ligne 1");
    assert.equal(journal.lines.at(-1)?.label, `Ligne ${BUDGET_LINE_MAX}`);
  });
});
