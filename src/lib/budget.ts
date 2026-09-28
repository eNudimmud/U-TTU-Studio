// Local estimate journal. One bucket per Clerk user, on this device.
// Empty until that person writes a line. No cloud balance, no invented job.
// The old unscoped key is never read: it is not a person.

export const BUDGET_STORAGE_PREFIX = "u-ttu-budget:";
export const BUDGET_LEGACY_KEY = "u-ttu-budget";
export const BUDGET_LINE_MAX = 24;
export const BUDGET_TEXT_MAX = 80;
export const BUDGET_EXPORT_FILE = "jobs-extrait.md";

export const BUDGET_ANON = "Le budget apparaît une fois le compte ouvert. Il reste sur cet appareil. Créer n’attend pas.";
export const BUDGET_EMPTY = "Aucun run noté. Le cloud n’est pas ouvert. Rien n’est inventé.";
export const BUDGET_LOCAL = "Estimation que tu notes, pour ce compte, sur cet appareil. Pas un solde. Rien n’est envoyé. L’extrait se colle dans jobs.md, si tu le veux.";
export const BUDGET_EXPORT_TITLE = "## Journal";
export const BUDGET_EXPORT_NOTE = "Noté sur cet appareil, pour ce compte. Pas un solde. Le cloud n’a rien envoyé. À coller dans `jobs.md` si tu le veux.";
export const BUDGET_EXPORT_EMPTY = "Aucun run noté. Rien à coller.";

export interface BudgetLine {
  id: string;
  label: string;
  estimate: string;
  date: string;
}

export interface BudgetJournal {
  lines: readonly BudgetLine[];
}

export const EMPTY_JOURNAL: BudgetJournal = { lines: [] };

function clip(value: string): string {
  return value.trim().slice(0, BUDGET_TEXT_MAX);
}

export function clipDate(value: string): string {
  const text = value.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return text;
}

export function todayStamp(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function budgetStorageKey(userId: string): string | null {
  const id = userId.trim();
  if (!id || id.length > 80 || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  return `${BUDGET_STORAGE_PREFIX}${id}`;
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
    const rawLabel = typeof row.label === "string" ? row.label : typeof row.gesture === "string" ? row.gesture : "";
    const label = clip(rawLabel);
    if (typeof row.id !== "string" || !label) continue;
    const estimate = typeof row.estimate === "string" ? clip(row.estimate) : "";
    const date = typeof row.date === "string" ? clipDate(row.date) : "";
    lines.push({ id: row.id.slice(0, 40), label, estimate, date });
    if (lines.length >= BUDGET_LINE_MAX) break;
  }
  return { lines };
}

export function addBudgetLine(journal: BudgetJournal, label: string, estimate: string, date: string, id: string): BudgetJournal {
  const cleanLabel = clip(label);
  const cleanDate = clipDate(date);
  const cleanId = (id ?? "").trim().slice(0, 40);
  if (!cleanLabel || !cleanDate || !cleanId) return journal;
  const lines = [...journal.lines, { id: cleanId, label: cleanLabel, estimate: clip(estimate), date: cleanDate }];
  return { lines: lines.slice(-BUDGET_LINE_MAX) };
}

export function removeBudgetLine(journal: BudgetJournal, id: string): BudgetJournal {
  return { lines: journal.lines.filter(line => line.id !== id) };
}

export function serializeJournal(journal: BudgetJournal): string {
  return JSON.stringify({
    lines: journal.lines.map(line => ({ id: line.id, label: line.label, estimate: line.estimate, date: line.date })),
  });
}

export function readJournal(storage: { getItem(key: string): string | null } | null, userId: string): BudgetJournal {
  const key = budgetStorageKey(userId);
  if (!storage || !key) return EMPTY_JOURNAL;
  try {
    return parseJournal(storage.getItem(key));
  } catch {
    return EMPTY_JOURNAL;
  }
}

export function saveJournal(
  storage: { setItem(key: string, value: string): void } | null,
  userId: string,
  journal: BudgetJournal,
): boolean {
  const key = budgetStorageKey(userId);
  if (!storage || !key) return false;
  try {
    storage.setItem(key, serializeJournal(journal));
    return true;
  } catch {
    return false;
  }
}

export function journalIsEmpty(journal: BudgetJournal): boolean {
  return journal.lines.length === 0;
}

function cell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function journalMarkdown(journal: BudgetJournal): string {
  if (journalIsEmpty(journal)) return `${BUDGET_EXPORT_TITLE}\n\n${BUDGET_EXPORT_EMPTY}\n`;
  const rows = journal.lines.map(line => `| ${line.date} | ${cell(line.label)} |  | ${cell(line.estimate)} |`);
  return [
    BUDGET_EXPORT_TITLE,
    "",
    BUDGET_EXPORT_NOTE,
    "",
    "| Date | Geste | Dossier | Note |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}
