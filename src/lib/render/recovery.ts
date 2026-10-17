// Durable receipt for a paid submission. Never automatically submit again:
// an interrupted POST may already have been charged upstream.
import { RenderError, type RenderClient } from './client.ts';
import type { InFlight } from './settings.ts';
import { ACTIVE_FILE } from '../coffre/project.ts';
import type { VaultStore } from '../coffre/store.ts';

export const PENDING_RENDER_KEY = 'u-ttu-operation';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface PendingRender {
  version: 1;
  kind: 'cast' | 'decor' | 'son' | 'take' | 'final' | 'video' | 'mesh' | 'still';
  geste?: string;
  project: string;
  id: string;
  name: string;
  prompt: string;
  at: string;
  account: string;
  refs: string[];
  template: string;
  quote: number;
  balanceBefore: number;
  jobId: string | null;
  flight?: Omit<InFlight, 'jobId'>;
}

export function readPending(storage: Pick<Storage, 'getItem'>): PendingRender | null {
  const raw = storage.getItem(PENDING_RENDER_KEY);
  if (!raw) return null;
  // Corrupt receipts are not treated as permission to submit a second job.
  const data = JSON.parse(raw) as PendingRender;
  if (data.version !== 1 || !['cast', 'decor', 'son', 'take', 'final', 'video', 'mesh', 'still'].includes(data.kind)
    || !/^[a-z0-9-]+$/.test(data.project) || !/^[a-z0-9-]+$/.test(data.id)
    || (data.jobId !== null && !/^[a-zA-Z0-9-]{8,64}$/.test(data.jobId))) throw new Error('Le reçu de rendu est illisible. Conservez les données du navigateur et vérifiez votre compte de rendu.');
  return data;
}

export function clearPending(storage: StorageLike, jobId: string): void {
  if (readPending(storage)?.jobId === jobId) storage.removeItem(PENDING_RENDER_KEY);
}

/** Manual reconciliation only follows an existing job; it can never submit one. */
export async function bindPendingJob(storage: StorageLike, client: Pick<RenderClient, 'status'>, account: string, rawId: string, confirmed: boolean): Promise<PendingRender> {
  const jobId = rawId.trim();
  if (!confirmed || !/^[a-zA-Z0-9-]{8,64}$/.test(jobId)) throw new Error('recovery.invalid');
  const snapshot = storage.getItem(PENDING_RENDER_KEY);
  const pending = readPending(storage);
  if (!pending || pending.jobId) throw new Error('recovery.changed');
  if (pending.account !== account) throw new Error('recovery.account');
  await client.status(jobId); // Existing job on the linked account; GET only.
  if (storage.getItem(PENDING_RENDER_KEY) !== snapshot) throw new Error('recovery.changed');
  const updated: PendingRender = { ...pending, jobId, ...(pending.flight ? { flight: { ...pending.flight, manualRecovery: true } } : {}) };
  storage.setItem(PENDING_RENDER_KEY, JSON.stringify(updated));
  return updated;
}

export function recoverableClient(client: RenderClient, storage: StorageLike, receipt: PendingRender): RenderClient {
  return { ...client, async submit(graph, clientId) {
    if (readPending(storage)) throw new Error('Une opération attend déjà sa récupération. Aucun nouvel envoi.');
    // A storage error here must prevent the paid POST.
    storage.setItem(PENDING_RENDER_KEY, JSON.stringify({ ...receipt, jobId: null }));
    let jobId: string;
    try {
      jobId = await client.submit(graph, clientId);
    } catch (error) {
      // Explicit authentication/credit refusal precedes acceptance. Other failures are ambiguous.
      if (error instanceof RenderError && ['auth', 'credits', 'subscription'].includes(error.code)) storage.removeItem(PENDING_RENDER_KEY);
      // Do not clear on network/server errors: acceptance may be ambiguous.
      throw error;
    }
    try { storage.setItem(PENDING_RENDER_KEY, JSON.stringify({ ...receipt, jobId })); }
    catch { throw new Error(`Le rendu ${jobId} a été envoyé, mais son reçu n’a pas pu être sauvegardé. Conservez cet identifiant et vérifiez votre espace disque. Ne relancez pas la génération.`); }
    return jobId;
  } };
}

/** A background result always returns to its original project. */
export function projectVault(store: VaultStore, slug: string): VaultStore {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Projet invalide.');
  return { ...store,
    get: path => path === ACTIVE_FILE
      ? Promise.resolve({ path, text: JSON.stringify({ actif: slug }), updatedAt: 0 })
      : store.get(path),
    put: entry => entry.path === ACTIVE_FILE ? Promise.resolve() : store.put(entry),
  };
}

export async function accountFingerprint(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
