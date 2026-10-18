// « Exemple — refais-le » : one real house result per step, and the gesture it refills.
// Only house files already in public/. Nothing here spends or calls Comfy.

export type Etape = "cast" | "decor" | "prise" | "montage";

export interface Depart {
  etape: Etape;
  /** House still shown as the result. */
  image: string;
  /** Gesture the fill selects (CAST / DÉCOR); empty for PRISE / MONTAGE. */
  geste: string;
  /** Short French title of the example. */
  titre: string;
}

export const DEPARTS: Record<Etape, Depart> = {
  cast: { etape: "cast", image: "/exemples/cast-dj.webp", geste: "cast-photos", titre: "DJ" },
  decor: { etape: "decor", image: "/exemples/apres-decor-photo.webp", geste: "decor-photo", titre: "Le quai, la nuit" },
  prise: { etape: "prise", image: "/exemples/decor-quai-nuit.webp", geste: "", titre: "La coursière sur le quai" },
  montage: { etape: "montage", image: "/exemples/decor-quai-nuit.webp", geste: "", titre: "Le clip d’exemple" },
};

/** Shown only while the step is empty and the visitor has no asset of their own for it. */
export function montrerDepart(input: { mesAssets: number; rempli: boolean }): boolean {
  return input.mesAssets === 0 && !input.rempli;
}
