import type { RoleRef } from "./registre.ts";

/** House still used as the tile picture. Not an “after” render. */
const FICHIER: Record<string, string> = {
  "cast-photos": "/exemples/cast-mira.webp",
  "cast-planche": "/exemples/cast-coursiere.webp",
  "cast-texte": "/exemples/cast-vieil-homme.webp",
  "cast-tenue": "/exemples/cast-dj.webp",
  "cast-angle": "/exemples/cast-coursiere.webp",
  "cast-expressions": "/exemples/cast-mira.webp",
  "cast-eclair": "/exemples/cast-dj.webp",
  "cast-agrandir": "/exemples/cast-vieil-homme.webp",
  "cast-volume": "/exemples/cast-coursiere.webp",
  "decor-texte": "/exemples/decor-quai-nuit.webp",
  "decor-photo": "/exemples/decor-rue-pluie.webp",
  "decor-heure": "/exemples/decor-toit-aube.webp",
  "decor-angles": "/exemples/decor-gare.webp",
  "decor-elargir": "/exemples/decor-couloir.webp",
  "decor-objet": "/exemples/decor-piece.webp",
  "decor-volume": "/exemples/decor-quai-nuit.webp",
  "prise-plan": "/exemples/decor-quai-nuit.webp",
  "prise-image": "/exemples/decor-piece.webp",
  "prise-raccord": "/exemples/decor-gare.webp",
  "prise-prolonger": "/exemples/decor-couloir.webp",
  "prise-camera": "/exemples/decor-toit-aube.webp",
  "prise-mouvement": "/exemples/cast-coursiere.webp",
  "prise-levres": "/exemples/cast-mira.webp",
  "prise-vidu": "/exemples/decor-rue-pluie.webp",
};

export function illustrationGeste(id: string): string {
  return FICHIER[id] ?? "";
}

/** “Voir un exemple” loads this house still into the first slot and selects the gesture. */
export const EXEMPLE_PAR_GESTE: Record<string, { id: string; role: RoleRef }> = {
  "cast-photos": { id: "cast-mira", role: "visage" },
  "cast-planche": { id: "cast-coursiere", role: "visage" },
  "decor-photo": { id: "decor-quai-nuit", role: "lieu" },
  "decor-heure": { id: "decor-rue-pluie", role: "lieu" },
  "decor-texte": { id: "decor-quai-nuit", role: "lieu" },
};
