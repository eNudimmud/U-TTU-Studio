// Maps a render failure to a clear visitor-facing outcome: session vs cloud vs
// network vs a stuck receipt. Keeps French source strings for phrase.ts / say().

import { RenderError, type RenderErrorCode } from "./client.ts";

export type FailKind = "auth" | "credits" | "subscription" | "network" | "cloud" | "pending" | "invalid" | "empty" | "other";

export interface FailView {
  kind: FailKind;
  /** French source line; phrase.ts / messages map it per locale. */
  message: string;
  /** Show « L'original reste intact » only when a source media could have been overwritten. */
  intact: boolean;
  /** Offer « Reconnecter » (opens the Comfy connect sheet). */
  reconnect: boolean;
  /** Offer « Réessayer » for transient errors. */
  retry: boolean;
}

const AUTH_MSG = "Ta session Comfy a expiré (connexion ouverte ailleurs ?). Reconnecte-toi.";
const NETWORK_MSG = "Le compte de rendu ne répond pas. Vérifie ta connexion, puis réessaie.";
const CLOUD_MSG = "Le rendu a échoué dans le cloud. Vérifie ton historique Comfy pour tout coût éventuel.";
const PENDING_MSG = "Un rendu précédent attend encore sa récupération. Ouvre Crédits, puis Récupérer le rendu — ou réessaie si le cloud l’a déjà terminé sans résultat.";
const INVALID_MSG = "Le compte de rendu a refusé la prise. Rien n’a été envoyé.";
const CREDITS_MSG = "Crédits insuffisants sur ton compte de rendu.";
const SUB_MSG = "Ton abonnement de rendu est inactif, ou la file est pleine.";


/** Drop raw engine / ffmpeg lines visitors should never see. */
function sanitizeDetail(detail: string): string {
  const line = detail.trim();
  if (!line) return "";
  if (/ffmpeg|VHS failed|failed to extract audio|ffprobe|libx264|stderr/i.test(line)) {
    return "";
  }
  return line;
}

export function failKind(error: unknown): FailKind {
  if (error instanceof RenderError) {
    if (error.code === "auth") return "auth";
    if (error.code === "credits") return "credits";
    if (error.code === "subscription") return "subscription";
    if (error.code === "network" || error.code === "timeout") return "network";
    if (error.code === "failed") return "cloud";
    if (error.code === "invalid") return "invalid";
    if (error.code === "empty") return "empty";
  }
  if (error instanceof Error) {
    if (/attend (déjà )?sa récupération|Récupération impossible|recovery\.failed/i.test(error.message)) return "pending";
  }
  return "other";
}

/** Build the UI view for a caught render error. Includes cloud detail when present. */
export function failView(error: unknown): FailView {
  const kind = failKind(error);
  if (kind === "auth") return { kind, message: AUTH_MSG, intact: false, reconnect: true, retry: false };
  if (kind === "credits") return { kind, message: CREDITS_MSG, intact: false, reconnect: false, retry: false };
  if (kind === "subscription") return { kind, message: SUB_MSG, intact: false, reconnect: false, retry: true };
  if (kind === "network") return { kind, message: NETWORK_MSG, intact: false, reconnect: false, retry: true };
  if (kind === "pending") return { kind, message: PENDING_MSG, intact: false, reconnect: false, retry: true };
  // The render finished but carried no picture: the caller's own (translated) sentence says so.
  if (kind === "empty") return { kind, message: error instanceof Error && error.message ? error.message : CLOUD_MSG, intact: true, reconnect: false, retry: true };
  if (kind === "invalid") {
    const raw = error instanceof RenderError && error.detail[0] ? sanitizeDetail(String(error.detail[0])) : "";
    const detail = raw ? ` ${raw}` : "";
    return { kind, message: `${INVALID_MSG}${detail}`, intact: false, reconnect: false, retry: true };
  }
  if (kind === "cloud") {
    const raw = error instanceof RenderError && error.detail[0] ? sanitizeDetail(String(error.detail[0])) : "";
    const detail = raw ? ` ${raw}` : "";
    return { kind, message: `${CLOUD_MSG}${detail}`, intact: true, reconnect: false, retry: true };
  }
  const raw = error instanceof Error && error.message ? error.message : "";
  const cleaned = sanitizeDetail(raw);
  const message = cleaned || "Le rendu n’a pas abouti. Rien n’a été rangé.";
  return { kind: "other", message, intact: true, reconnect: false, retry: true };
}

export function isAuthCode(code: RenderErrorCode | undefined): boolean {
  return code === "auth";
}
