"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BUDGET_EMPTY, BUDGET_LOCAL, BUDGET_STORAGE_KEY, EMPTY_JOURNAL, addBudgetLine, journalIsEmpty, readJournal, removeBudgetLine, serializeJournal, type BudgetJournal } from "@/lib/budget";

export function BudgetJournal() {
  const [journal, setJournal] = useState<BudgetJournal>(EMPTY_JOURNAL);
  const [gesture, setGesture] = useState("");
  const [estimate, setEstimate] = useState("");

  useEffect(() => {
    setJournal(readJournal(window.localStorage));
  }, []);

  function write(next: BudgetJournal) {
    setJournal(next);
    window.localStorage.setItem(BUDGET_STORAGE_KEY, serializeJournal(next));
  }

  function note(event: FormEvent) {
    event.preventDefault();
    const next = addBudgetLine(journal, gesture, estimate, crypto.randomUUID());
    if (next === journal) return;
    write(next);
    setGesture("");
    setEstimate("");
  }

  return <section className="budget-journal" aria-labelledby="account-budget">
    <p className="eyebrow">Budget</p>
    <h2 id="account-budget">Journal local.</h2>
    <p>{BUDGET_LOCAL}</p>
    {journalIsEmpty(journal)
      ? <p role="status">{BUDGET_EMPTY}</p>
      : <ul className="budget-lines">
        {journal.lines.map(line => <li key={line.id}>
          <strong>{line.gesture}</strong>
          <span>{line.estimate || "—"}</span>
          <button type="button" className="text-button" onClick={() => write(removeBudgetLine(journal, line.id))}>Retirer</button>
        </li>)}
      </ul>}
    <form className="budget-form" onSubmit={note}>
      <label htmlFor="budget-gesture">Geste
        <input id="budget-gesture" value={gesture} onChange={event => setGesture(event.target.value)} placeholder="Tester un prompt" maxLength={80} autoComplete="off" />
      </label>
      <label htmlFor="budget-estimate">Estimation
        <input id="budget-estimate" value={estimate} onChange={event => setEstimate(event.target.value)} placeholder="à ta main" maxLength={80} autoComplete="off" />
      </label>
      <button type="submit" className="button button-outline" disabled={!gesture.trim()}>Noter</button>
    </form>
  </section>;
}
