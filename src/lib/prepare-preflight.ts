import { FAL_ACCESS_MIN, FAL_VARY } from "./fal-stack.ts";
import { checkTrigger, parseInvariants } from "./gate/captions.ts";
import { GATE } from "./gate/rules.ts";

// Client gate before any fal bootstrap. G02 asks for two invariants; without
// them a paid lot comes back refused. Incomplete attempts must not launch.

export interface PrepareAttempt {
  proxyOn: boolean;
  refCount: number;
  trigger: string;
  invariants: string;
  token: string;
  busy: boolean;
}

export type PrepareDecision = { launch: true } | { launch: false; reason: string };

export function invariantFieldError(raw: string): string | null {
  if (!raw.trim()) return null;
  const count = parseInvariants(raw).length;
  if (count >= GATE.minInvariants) return null;
  if (count === 0) return "Chaque trait fait au moins 3 lettres. Il en faut 2, séparés par une virgule.";
  return "Encore un trait. Le gate en demande 2 avant tout envoi.";
}

export function prepareLaunch(attempt: PrepareAttempt): PrepareDecision {
  if (attempt.busy) return { launch: false, reason: "Une préparation est déjà en cours." };
  if (!attempt.proxyOn) return { launch: false, reason: "Proxy fal absent. Aucun lot automatique n’est lancé." };
  const triggerError = checkTrigger(attempt.trigger);
  if (triggerError) return { launch: false, reason: triggerError };
  if (attempt.refCount < FAL_VARY.minRefs || attempt.refCount > FAL_VARY.maxRefs) {
    return { launch: false, reason: `Il faut ${FAL_VARY.minRefs} ou ${FAL_VARY.maxRefs} photos.` };
  }
  if (parseInvariants(attempt.invariants).length < GATE.minInvariants) {
    return { launch: false, reason: `Il faut ${GATE.minInvariants} traits constants avant l’envoi. Le lot ne part pas.` };
  }
  if (attempt.token.trim().length < FAL_ACCESS_MIN) {
    return { launch: false, reason: "Le code d’accès du studio manque. Rien n’est envoyé." };
  }
  return { launch: true };
}

// The fal call is `start`. It is not invoked when the attempt is incomplete.
export function runIfPrepareAllowed<T>(attempt: PrepareAttempt, start: () => T): T | null {
  if (!prepareLaunch(attempt).launch) return null;
  return start();
}
