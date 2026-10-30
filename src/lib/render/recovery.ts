// Durable receipt for a paid submission. Never automatically submit again:
// an interrupted POST may already have been charged upstream.
import { RenderError, jobStage, type JobStage, type RenderClient } from './client.ts';
import type { InFlight } from './settings.ts';
import { ACTIVE_FILE } from '../coffre/project.ts';
import type { VaultStore } from '../coffre/store.ts';

export const PENDING_RENDER_KEY = 'u-ttu-operation';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface PendingRender {
  version: 1;
  kind: 'cast' | 'decor' | 'son' | 'take' | 'final' | 'video' | 'mesh' | 'image';
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
  /** Node that saves the final result in the graph sent (render/sortie.ts). */
  outputNode?: string;
}

export function readPending(storage: Pick<Storage, 'getItem'>): PendingRender | null {
  const raw = storage.getItem(PENDING_RENDER_KEY);
  if (!raw) return null;
  // Corrupt receipts are not treated as permission to submit a second job.
  const data = JSON.parse(raw) as PendingRender;
  if (data.version !== 1 || !['cast', 'decor', 'son', 'take', 'final', 'video', 'mesh', 'image'].includes(data.kind)
    || !/^[a-z0-9-]+$/.test(data.project) || !/^[a-z0-9-]+$/.test(data.id)
    || (data.jobId !== null && !/^[a-zA-Z0-9-]{8,64}$/.test(data.jobId))
    || (data.outputNode !== undefined && (typeof data.outputNode !== 'string' || !/^[A-Za-z0-9:_-]{1,64}$/.test(data.outputNode)))) throw new Error('Le reçu de rendu est illisible. Conserve les données du navigateur et vérifie ton compte de rendu.');
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
      // Explicit refusal before acceptance: safe to drop the blank receipt.
      // `invalid` is a Comfy validation/API refusal with no prompt_id — nothing was queued.
      // Network stays ambiguous: the POST may have been accepted upstream.
      if (error instanceof RenderError && ['auth', 'credits', 'subscription', 'invalid'].includes(error.code)) storage.removeItem(PENDING_RENDER_KEY);
      throw error;
    }
    try { storage.setItem(PENDING_RENDER_KEY, JSON.stringify({ ...receipt, jobId })); }
    catch { throw new Error(`Le rendu ${jobId} a été envoyé, mais son reçu n’a pas pu être sauvegardé. Conserve cet identifiant et vérifie ton espace disque. Ne relance pas la génération.`); }
    return jobId;
  } };
}


/** Drop a receipt whose Comfy job is already terminal (failed/cancelled). Nothing left to recover. */
export function clearTerminalPending(storage: StorageLike, jobId: string): void {
  clearPending(storage, jobId);
}

/**
 * If a stuck receipt points at a job that already failed or was cancelled in the cloud,
 * drop it so a new confirmed send can proceed. Returns:
 * - "cleared" when the receipt was removed
 * - "blocked" when a live or finished-success job still needs recovery
 * - "none" when there is no receipt
 */
/** What blocks a new paid send: nothing, a receipt the cloud ended without result (dropped), or a
 *  receipt still there, with the cloud stage when it could be read (status only, nothing sent). */
export async function pendingState(
  storage: StorageLike,
  client: Pick<RenderClient, 'status'>,
): Promise<{ result: 'none' | 'cleared' | 'blocked'; stage: JobStage | null; pending: PendingRender | null }> {
  const pending = readPending(storage);
  if (!pending) return { result: 'none', stage: null, pending: null };
  if (!pending.jobId) return { result: 'blocked', stage: null, pending };
  try {
    const stage = jobStage(await client.status(pending.jobId));
    if (stage === 'failed' || stage === 'cancelled') {
      clearPending(storage, pending.jobId);
      return { result: 'cleared', stage, pending: null };
    }
    return { result: 'blocked', stage, pending };
  } catch {
    return { result: 'blocked', stage: null, pending };
  }
}

export async function reconcilePendingReceipt(
  storage: StorageLike,
  client: Pick<RenderClient, 'status'>,
): Promise<'none' | 'cleared' | 'blocked'> {
  return (await pendingState(storage, client)).result;
}

/** The sentence shown when a second paid send is refused, true to what the cloud is doing. */
export function pendingRefusal(stage: JobStage | null, name: string): string {
  const label = name.trim() || 'sans nom';
  if (stage === 'queue' || stage === 'prepare' || stage === 'render') {
    return `Un rendu est encore en cours dans le cloud : ${label}. Attends qu’il finisse avant d’en lancer un autre. Rien n’est perdu, rien n’est renvoyé.`;
  }
  if (stage === 'done') {
    return `Le rendu précédent est terminé : ${label}. Range-le d’abord avec Récupérer le rendu (dans Crédits), sans nouvel envoi.`;
  }
  return "Un rendu précédent attend encore sa récupération. Ouvre Crédits, puis Récupérer le rendu — ou réessaie si le cloud l’a déjà terminé sans résultat.";
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
