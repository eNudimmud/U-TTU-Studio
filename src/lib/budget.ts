// Local estimate journal. Empty until the person writes a line.
// No cloud balance, no invented job.

export const BUDGET_STORAGE_KEY = "u-ttu-budget";
export const BUDGET_LINE_MAX = 24;
export const BUDGET_TEXT_MAX = 80;

export const BUDGET_ANON = "Le budget apparaît une fois le compte ouvert. Il reste sur cet appareil. Créer n’attend pas.";
export const BUDGET_EMPTY = "Aucun run noté. Le cloud n’est pas ouvert. Rien n’est inventé.";
export const BUDGET_LOCAL = "Estimation que tu notes. Pas un solde. Le journal du coffre reste jobs.md.";

export interface BudgetLine {
  id: string;
  gesture: string;
  estimate: string;
}

export interface BudgetJournal {
  lines: readonly BudgetLine[];
}

export const EMPTY_JOURNAL: BudgetJournal = { lines: [] };

function clip(value: string): string {
  return value.trim().slice(0, BUDGET_TEXT_MAX);
}

export function parseJournal(raw: string | null | undefined): BudgetJournal {
  if (!raw) return EMPTY_JOURNAL;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_JOURNAL;
  }
  if (!data || typeof data !== "object" || !("lines" in data) || !Array.isArray((data as { lines: unknown }).lines)) {
    return EMPTY_JOURNAL;
  }
  const lines: BudgetLine[] = [];
  for (const item of (data as { lines: unknown[] }).lines) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.gesture !== "string") continue;
    const gesture = clip(row.gesture);
    if (!gesture) continue;
    const estimate = typeof row.estimate === "string" ? clip(row.estimate) : "";
    lines.push({ id: row.id.slice(0, 40), gesture, estimate });
    if (lines.length >= BUDGET_LINE_MAX) break;
  }
  return { lines };
}

export function addBudgetLine(journal: BudgetJournal, gesture: string, estimate: string, id: string): BudgetJournal {
  const cleanGesture = clip(gesture);
  const cleanId = id.trim().slice(0, 40);
  if (!cleanGesture || !cleanId) return journal;
  const lines = [...journal.lines, { id: cleanId, gesture: cleanGesture, estimate: clip(estimate) }];
  return { lines: lines.slice(-BUDGET_LINE_MAX) };
}

export function removeBudgetLine(journal: BudgetJournal, id: string): BudgetJournal {
  return { lines: journal.lines.filter(line => line.id !== id) };
}

export function serializeJournal(journal: BudgetJournal): string {
  return JSON.stringify({ lines: journal.lines });
}

export function readJournal(storage: { getItem(key: string): string | null } | null): BudgetJournal {
  if (!storage) return EMPTY_JOURNAL;
  try {
    return parseJournal(storage.getItem(BUDGET_STORAGE_KEY));
  } catch {
    return EMPTY_JOURNAL;
  }
}

export function journalIsEmpty(journal: BudgetJournal): boolean {
  return journal.lines.length === 0;
}
