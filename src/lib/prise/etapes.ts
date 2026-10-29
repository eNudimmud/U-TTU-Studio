// PRISE on a phone: one simple path in five steps (plan P1-3). The same page as on a large
// screen; the step only chooses which existing block is shown, so PRISE never becomes a second
// DÉCOR or a second MONTAGE and there is still only one plan editor.

export const ETAPES = ["preparer", "plans", "previs", "generer", "reviser"] as const;
export type Etape = (typeof ETAPES)[number];

/** What the page knows about the selected plan's renders. */
export type EtapeSignal = { running: boolean; failed: boolean; versions: number };

export function isEtape(value: unknown): value is Etape {
  return typeof value === "string" && (ETAPES as readonly string[]).includes(value);
}

/** Where a plan opens: on its takes when it has some (or one is on its way), otherwise at the start. */
export function etapeInitiale(signal: EtapeSignal): Etape {
  return signal.running || signal.failed || signal.versions > 0 ? "reviser" : "preparer";
}

/** A render that starts, lands or fails moves the visitor to « Réviser »; nothing else moves them. */
export function etapeApres(current: Etape, before: EtapeSignal, now: EtapeSignal): Etape {
  if (now.running && !before.running) return "reviser";
  if (now.versions > before.versions) return "reviser";
  if (now.failed && !before.failed) return "reviser";
  return current;
}

export function etapeSuivante(current: Etape): Etape | null {
  const at = ETAPES.indexOf(current);
  return at < ETAPES.length - 1 ? ETAPES[at + 1] : null;
}

export function etapePrecedente(current: Etape): Etape | null {
  const at = ETAPES.indexOf(current);
  return at > 0 ? ETAPES[at - 1] : null;
}
