export type StorageMode = 'persistent' | 'best-effort' | 'unsupported' | 'unknown';
export interface StorageHealth { mode: StorageMode; usage: number | null; quota: number | null }
export type StorageManagerLike = Partial<Pick<StorageManager, 'estimate' | 'persisted' | 'persist'>>;

/** Inspection never prompts for permission or changes the vault. */
export async function storageHealth(storage?: StorageManagerLike): Promise<StorageHealth> {
  let mode: StorageMode = storage?.persisted ? 'unknown' : 'unsupported';
  try { if (storage?.persisted) mode = await storage.persisted() ? 'persistent' : 'best-effort'; } catch { /* unknown, never claim protection */ }
  let estimate: StorageEstimate = {};
  try { estimate = await storage?.estimate?.() ?? {}; } catch { /* quota can be hidden */ }
  const finite = (n: unknown): number | null => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
  return { mode, usage: finite(estimate.usage), quota: finite(estimate.quota) };
}

/** A positive request result is required; a refusal is not a successful backup. */
export async function protectStorage(storage?: StorageManagerLike): Promise<StorageHealth> {
  if (!storage?.persist) return storageHealth(storage);
  try {
    const accepted = await storage.persist();
    const health = await storageHealth(storage);
    return { ...health, mode: accepted ? 'persistent' : health.mode === 'persistent' ? 'persistent' : 'best-effort' };
  } catch { return { ...await storageHealth(storage), mode: 'unknown' }; }
}
