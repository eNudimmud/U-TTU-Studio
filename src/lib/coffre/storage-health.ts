export type StorageMode = 'persistent' | 'best-effort' | 'unsupported' | 'unknown';
export interface StorageHealth { mode: StorageMode; usage: number | null; quota: number | null }
export type StorageManagerLike = Partial<Pick<StorageManager, 'estimate' | 'persisted' | 'persist'>>;
export type ProtectionRequest = 'granted' | 'refused' | 'pending' | 'unavailable' | 'error';
export interface StorageProtection extends StorageHealth { request: ProtectionRequest }
const pendingRequests = new WeakMap<StorageManagerLike, Promise<boolean>>();

/** Permission prompts may remain open indefinitely. Never hold the UI hostage. */
async function bounded<T>(request: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([request, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Storage response pending')), timeoutMs);
    })]);
  } finally { clearTimeout(timer!); }
}

/** Inspection never prompts for permission or changes the vault. */
export async function storageHealth(storage?: StorageManagerLike, timeoutMs = 1000): Promise<StorageHealth> {
  let mode: StorageMode = storage?.persisted ? 'unknown' : 'unsupported';
  try { if (storage?.persisted) mode = await bounded(storage.persisted(), timeoutMs) ? 'persistent' : 'best-effort'; } catch { /* unknown, never claim protection */ }
  let estimate: StorageEstimate = {};
  try { estimate = storage?.estimate ? await bounded(storage.estimate(), timeoutMs) : {}; } catch { /* quota can be hidden */ }
  const finite = (n: unknown): number | null => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
  return { mode, usage: finite(estimate.usage), quota: finite(estimate.quota) };
}

/** A positive request result is required; a refusal is not a successful backup. */
export async function protectStorage(storage?: StorageManagerLike, timeoutMs = 5000): Promise<StorageProtection> {
  if (!storage?.persist) return { ...await storageHealth(storage), request: 'unavailable' };
  try {
    let request = pendingRequests.get(storage);
    if (!request) {
      request = storage.persist();
      pendingRequests.set(storage, request);
      // Do not request twice while the browser's native permission prompt is open.
      void request.then(() => pendingRequests.delete(storage), () => pendingRequests.delete(storage));
    }
    const accepted = await bounded(request, timeoutMs);
    const health = await storageHealth(storage);
    return { ...health, mode: accepted || health.mode === 'persistent' ? 'persistent' : 'best-effort', request: accepted ? 'granted' : 'refused' };
  } catch {
    const health = await storageHealth(storage);
    return pendingRequests.has(storage)
      ? { ...health, request: 'pending' }
      : { ...health, mode: health.mode === 'persistent' ? 'persistent' : 'unknown', request: 'error' };
  }
}
