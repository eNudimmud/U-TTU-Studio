// The seven visible steps of every paid operation:
// Préparer → Vérifier → Estimer → Confirmer → Exécuter → Contrôler → Archiver.
// Pure: the card asks this module which step is reached and why it stops.

export const ETAPES = ["preparer", "verifier", "estimer", "confirmer", "executer", "controler", "archiver"] as const;
export type Etape = (typeof ETAPES)[number];
export type EtapeEtat = "fait" | "encours" | "attente" | "bloque" | "echec";

export interface OperationState {
  /** Inputs present (who, where, what). */
  prepared: boolean;
  /** Checks passed (refs saved, format, engine, open-weights rule). */
  checked: boolean;
  /** One quote exists, labelled estimé or mesuré. */
  quoted: boolean;
  /** The single confirmation dialog is open. */
  confirming?: boolean;
  running?: boolean;
  failed?: boolean;
  /** A result came back and was verified (file present, readable). */
  landed?: boolean;
  /** The result is written in the project (Prises/, Mon studio). */
  archived?: boolean;
}

/** Each step's state. The first unmet step is the one the card explains. */
export function protocole(state: OperationState): Record<Etape, EtapeEtat> {
  const out = Object.fromEntries(ETAPES.map(step => [step, "attente"])) as Record<Etape, EtapeEtat>;
  if (state.landed || state.failed || state.running) {
    for (const step of ["preparer", "verifier", "estimer", "confirmer"] as const) out[step] = "fait";
    if (state.running) { out.executer = "encours"; return out; }
    out.executer = "fait";
    if (state.failed) { out.controler = "echec"; return out; }
    out.controler = "fait";
    out.archiver = state.archived ? "fait" : "encours";
    return out;
  }
  if (!state.prepared) { out.preparer = "encours"; return out; }
  out.preparer = "fait";
  if (!state.checked) { out.verifier = "bloque"; return out; }
  out.verifier = "fait";
  if (!state.quoted) { out.estimer = "bloque"; return out; }
  out.estimer = "fait";
  out.confirmer = state.confirming ? "encours" : "attente";
  return out;
}

/** The step that needs the user now, or null when all is done. */
export function etapeCourante(states: Record<Etape, EtapeEtat>): Etape | null {
  return ETAPES.find(step => states[step] !== "fait") ?? null;
}
