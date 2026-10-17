// The camera the user asked for, read from their own words (FR, EN, DE, ES).
// Rule: the user's words win over the tile. "Fixe" is never sent unless the user said it.
// Without camera words and without a moving tile, no camera line is sent and the card says so.

import type { CameraMove } from "./copy.ts";

const WORDS: readonly { move: CameraMove; patterns: readonly RegExp[] }[] = [
  { move: "epaule", patterns: [/(cam[ée]ra|film[ée]?) (à|a) l['’]?[ée]paule/i, /\bhandheld\b/i, /\bhand-held\b/i, /\bhandkamera\b/i, /c[áa]mara (en|al) mano/i, /c[áa]mara al hombro/i] },
  { move: "orbite", patterns: [/\borbite\b/i, /tourne autour/i, /\borbit(s|ing)?\b/i, /\bumkreis(t|en)\b/i, /\b[óo]rbita\b/i, /gira alrededor/i] },
  { move: "suivi", patterns: [/(cam[ée]ra|on) (le |la |les )?sui(t|vent)\b/i, /\bsuivi\b/i, /\btracking\b/i, /\bfollow(s|ing)? (him|her|them|the)/i, /\bverfolg/i, /\bseguimiento\b/i, /la c[áa]mara (le |la |lo )?sigue/i] },
  { move: "travelling-arriere", patterns: [/travelling arri[èe]re/i, /\bdolly (out|back)\b/i, /\bpull(s)? back\b/i, /\bzoom arri[èe]re\b/i, /\bzoom out\b/i, /\brückfahrt\b/i, /travelling hacia atr[áa]s/i, /\bse aleja\b/i] },
  { move: "travelling-avant", patterns: [/travelling avant/i, /\bdolly in\b/i, /\bpush(es)?[- ]in\b/i, /\bzoom avant\b/i, /\bzoom in\b/i, /\bs['’]approche de (nous|la cam[ée]ra)/i, /\bkamerafahrt\b/i, /\branfahrt\b/i, /travelling hacia delante/i, /\bacercamiento\b/i] },
  { move: "panoramique", patterns: [/\bpanoramique\b/i, /\bpan(s|ning)? (left|right|across)\b/i, /\bschwenk/i, /\bpaneo\b/i, /\bpanor[áa]mica\b/i] },
  { move: "fixe", patterns: [/(cam[ée]ra|plan) fixe/i, /\bstatic (camera|shot)\b/i, /\blocked[- ]off\b/i, /\bstatische kamera\b/i, /\bfeste kamera\b/i, /c[áa]mara (fija|est[áa]tica)/i, /plano fijo/i] },
];

/** The first camera move named in the text, with the exact words found. */
export function cameraFromWords(text: string): { move: CameraMove; words: string } | null {
  const source = text || "";
  let best: { move: CameraMove; words: string; at: number } | null = null;
  for (const entry of WORDS) {
    for (const pattern of entry.patterns) {
      const match = pattern.exec(source);
      if (match && (!best || match.index < best.at)) best = { move: entry.move, words: match[0], at: match.index };
    }
  }
  return best ? { move: best.move, words: best.words } : null;
}

export type CameraSource = "texte" | "tuile" | "libre";

export interface CameraChoice {
  /** The move sent to the engine, or null when no camera line leaves. */
  move: CameraMove | null;
  source: CameraSource;
  /** Words quoted from the user's text when source is "texte". */
  words: string;
  /** The tile asked for another move than the user's words. The card flags it. */
  overridden: CameraMove | null;
}

/** The user's words first; then a tile that really moves; otherwise nothing is imposed. */
export function cameraChoice(action: string, tileCamera: CameraMove): CameraChoice {
  const said = cameraFromWords(action);
  if (said) return { move: said.move, source: "texte", words: said.words, overridden: tileCamera !== "fixe" && tileCamera !== said.move ? tileCamera : null };
  if (tileCamera !== "fixe") return { move: tileCamera, source: "tuile", words: "", overridden: null };
  return { move: null, source: "libre", words: "", overridden: null };
}
