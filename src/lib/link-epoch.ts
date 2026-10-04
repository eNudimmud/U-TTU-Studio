// A connect that just succeeded must survive an older read finishing late.
// The sheet must also ignore the tap that opened it, or that tap closes it.

export interface LinkEpoch {
  epoch: number;
  connected: boolean;
}

export type LinkEvent =
  | { type: "connect" }
  | { type: "read"; epoch: number; ok: boolean };

export function reduceConnect(state: LinkEpoch, event: LinkEvent): LinkEpoch & { ignored: boolean } {
  if (event.type === "connect") return { epoch: state.epoch + 1, connected: true, ignored: false };
  if (event.epoch !== state.epoch) return { ...state, ignored: true };
  return { epoch: state.epoch, connected: event.ok, ignored: false };
}

/** The overlay may dismiss the sheet only after the opening tap is gone. */
export function sheetDismissAllowed(openedAt: number, now: number): boolean {
  return now - openedAt >= 500;
}

/**
 * Reading Comfy's session must not create or delete its database.
 * An open that upgrades a missing database, then a delete, drops the login
 * the iframe just wrote. The next poll then finds nothing.
 */
export function authDatabasePlan(listed: readonly { name?: string; version?: number }[] | null, hasStore: boolean): "skip" | "read" {
  if (listed && !listed.some(row => row.name === "firebaseLocalStorageDb" && (row.version ?? 0) > 0)) return "skip";
  if (!hasStore) return "skip";
  return "read";
}
