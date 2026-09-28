"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  BUDGET_EMPTY, BUDGET_EXPORT_FILE, BUDGET_LOCAL, EMPTY_JOURNAL,
  addBudgetLine, budgetStorageKey, journalIsEmpty, journalMarkdown, readJournal, removeBudgetLine, saveJournal, todayStamp,
  type BudgetJournal as BudgetJournalState,
} from "@/lib/budget";
import { CopyButton } from "../guide/copy-button";

export function BudgetJournal({ userId }: { userId: string }) {
  const key = budgetStorageKey(userId);
  const [journal, setJournal] = useState<BudgetJournalState>(EMPTY_JOURNAL);
  const [ready, setReady] = useState(false);
  const [label, setLabel] = useState("");
  const [estimate, setEstimate] = useState("");
  const [date, setDate] = useState("");
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    setReady(false);
    setArmed(false);
    setLabel("");
    setEstimate("");
    setJournal(key ? readJournal(window.localStorage, userId) : EMPTY_JOURNAL);
    setDate(todayStamp());
    setReady(true);
  }, [userId, key]);

  function write(next: BudgetJournalState) {
    setJournal(next);
    if (key) saveJournal(window.localStorage, userId, next);
    if (journalIsEmpty(next)) setArmed(false);
  }

  function note(event: FormEvent) {
    event.preventDefault();
    if (!key) return;
    const next = addBudgetLine(journal, label, estimate, date, crypto.randomUUID());
    if (next === journal) return;
    write(next);
    setLabel("");
    setEstimate("");
    setDate(todayStamp());
  }

  function download() {
    const blob = new Blob([journalMarkdown(journal)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = BUDGET_EXPORT_FILE;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <section className="budget-journal" aria-labelledby="account-budget">
    <p className="eyebrow">Budget</p>
    <h2 id="account-budget">Journal local.</h2>
    {!key ? <p role="status">Identifiant illisible. Rien n’est noté.</p> : !ready ? <p role="status">Ouverture du journal…</p> : <>
      <p>{BUDGET_LOCAL}</p>
      {journalIsEmpty(journal)
        ? <p role="status">{BUDGET_EMPTY}</p>
        : <ul className="budget-lines" aria-label="Lignes notées">
          {journal.lines.map(line => <li key={line.id}>
            {line.date ? <time dateTime={line.date}>{line.date}</time> : <span>—</span>}
            <strong>{line.label}</strong>
            <span>{line.estimate || "—"}</span>
            <button type="button" className="text-button" onClick={() => write(removeBudgetLine(journal, line.id))}>Retirer</button>
          </li>)}
        </ul>}
      <form className="budget-form" onSubmit={note}>
        <label htmlFor="budget-label">Libellé
          <input id="budget-label" value={label} onChange={event => setLabel(event.target.value)} placeholder="Tester un prompt" maxLength={80} autoComplete="off" required />
        </label>
        <label htmlFor="budget-estimate">Estimation
          <input id="budget-estimate" value={estimate} onChange={event => setEstimate(event.target.value)} placeholder="crédits, ou un coût" maxLength={80} autoComplete="off" />
        </label>
        <label htmlFor="budget-date">Date
          <input id="budget-date" type="date" value={date} onChange={event => setDate(event.target.value)} required />
        </label>
        <button type="submit" className="button button-outline" disabled={!label.trim() || !date}>Noter</button>
      </form>
      <div className="budget-actions">
        <CopyButton text={journalMarkdown(journal)} label="Copier pour jobs.md" />
        <button type="button" className="text-button" onClick={download}>Télécharger l’extrait</button>
        {armed
          ? <>
            <p role="status">Effacer les lignes de ce compte sur cet appareil ?</p>
            <button type="button" className="text-button" onClick={() => write(EMPTY_JOURNAL)}>Effacer</button>
            <button type="button" className="text-button" onClick={() => setArmed(false)}>Annuler</button>
          </>
          : <button type="button" className="text-button" onClick={() => setArmed(true)} disabled={journalIsEmpty(journal)}>Effacer</button>}
      </div>
    </>}
  </section>;
}
