// One durable record of consumed spend approvals, shared by every paid kind (agent text, takes).
// It lives inside the common spend ledger (`u-ttu-spend-ledger`, CE2); this module only owns the
// key and the `consumedApprovals` list, so the intent job and the spend ledger share one record
// without importing each other (no intent-job ↔ spend-ledger cycle). Other fields are preserved.
//
// An approval id written here is never usable again: not after a terminal state, not after the
// receipt is forgotten, not after a reload. A new job needs a new approval.
import { CinemaError, type StorageLike } from "./types.ts";

export const SPEND_LEDGER_KEY = "u-ttu-spend-ledger";

type LedgerShape = { schemaVersion: 1; consumedApprovals: string[]; reservations: unknown[] } & Record<string, unknown>;

function readShape(storage: Pick<Storage, "getItem">): LedgerShape {
  let raw: string | null;
  try { raw = storage.getItem(SPEND_LEDGER_KEY); } catch { throw new CinemaError("STORAGE_UNAVAILABLE", "Spend ledger unreadable."); }
  if (!raw) return { schemaVersion: 1, consumedApprovals: [], reservations: [] };
  try {
    const data = JSON.parse(raw) as LedgerShape;
    if (data.schemaVersion !== 1 || !Array.isArray(data.reservations) || !Array.isArray(data.consumedApprovals)) throw new Error("shape");
    return data;
  } catch {
    // Unreadable is never read as « nothing consumed ».
    throw new CinemaError("STORAGE_UNAVAILABLE", "Spend ledger unreadable: nothing is sent.");
  }
}

export function isApprovalConsumed(storage: Pick<Storage, "getItem">, approvalId: string): boolean {
  return readShape(storage).consumedApprovals.includes(approvalId);
}

/** Records the approval as consumed (read back). Throws when it already was or cannot be written. */
export function consumeApproval(storage: StorageLike, approvalId: string): void {
  const ledger = readShape(storage);
  if (ledger.consumedApprovals.includes(approvalId)) throw new CinemaError("APPROVAL_REQUIRED", "This approval was already used: a new one is required.");
  const text = JSON.stringify({ ...ledger, consumedApprovals: [...ledger.consumedApprovals, approvalId] });
  try {
    storage.setItem(SPEND_LEDGER_KEY, text);
    if (storage.getItem(SPEND_LEDGER_KEY) !== text) throw new Error("readback");
  } catch { throw new CinemaError("STORAGE_UNAVAILABLE", "The approval could not be recorded: nothing was sent."); }
}
