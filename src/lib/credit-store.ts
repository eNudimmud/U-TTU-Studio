// Browser memory for the credit meter. The balance comes from the frame and
// is never stored. Confirmed runs go to the device journal, nothing else.

import {
  USAGE_KEY, addUsage, readCreditsMessage, readRunMessage, readUsage, saveUsage, usageStamp,
  type CreditsReading, type UsageEngine, type UsageLine,
} from "./credits.ts";

export interface CreditSnapshot {
  balance: CreditsReading | null;
  usage: readonly UsageLine[];
}

const EMPTY: CreditSnapshot = { balance: null, usage: [] };
let snapshot: CreditSnapshot = EMPTY;
let started = false;
const listeners = new Set<() => void>();

function emit(next: CreditSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function lineId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function store(engine: UsageEngine, label: string, low: number, high: number) {
  const usage = addUsage(snapshot.usage, { id: lineId(), date: usageStamp(), engine, label, low, high });
  saveUsage(window.localStorage, usage);
  emit({ ...snapshot, usage });
}

function onMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin) return;
  const balance = readCreditsMessage(event.data);
  if (balance) {
    emit({ ...snapshot, balance });
    return;
  }
  const run = readRunMessage(event.data);
  if (run?.accepted) store("comfy", run.label, run.low ?? 0, run.high ?? 0);
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  snapshot = { ...snapshot, usage: readUsage(window.localStorage) };
  window.addEventListener("message", onMessage);
  window.addEventListener("storage", event => {
    if (event.key === USAGE_KEY) emit({ ...snapshot, usage: readUsage(window.localStorage) });
  });
}

export function subscribeCredits(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function creditSnapshot(): CreditSnapshot {
  return snapshot;
}

export function serverCreditSnapshot(): CreditSnapshot {
  return EMPTY;
}

/** A studio-paid job that actually started. Amounts in US dollars. */
export function recordStudioSpend(label: string, usd: number) {
  if (typeof window === "undefined" || !Number.isFinite(usd) || usd < 0) return;
  start();
  store("fal", label, usd, usd);
}

export function clearUsage() {
  if (typeof window === "undefined") return;
  saveUsage(window.localStorage, []);
  emit({ ...snapshot, usage: [] });
}
