import type { RoleRef } from "./registre.ts";

/** House still used as the tile picture. Not an “after” render. */
const FICHIER: Record<string, string> = {
  "cast-photos": "/exemples/cast-uttu.webp",
  "cast-planche": "/exemples/cast-coursiere.webp",
  "cast-texte": "/exemples/cast-vieil-homme.webp",
  "cast-tenue": "/exemples/cast-dj.webp",
  "cast-angle": "/exemples/cast-coursiere.webp",
  "cast-expressions": "/exemples/cast-uttu.webp",
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
  "prise-levres": "/exemples/cast-uttu.webp",
  "prise-vidu": "/exemples/decor-rue-pluie.webp",
};

export function illustrationGeste(id: string): string {
  return FICHIER[id] ?? "";
}

/** “Voir un exemple” loads this house still into the first slot and selects the gesture. */
export const EXEMPLE_PAR_GESTE: Record<string, { id: string; role: RoleRef }> = {
  "cast-photos": { id: "cast-uttu", role: "visage" },
  "cast-planche": { id: "cast-coursiere", role: "visage" },
  "cast-texte": { id: "cast-vieil-homme", role: "visage" },
  "decor-photo": { id: "decor-quai-nuit", role: "lieu" },
  "decor-heure": { id: "decor-rue-pluie", role: "lieu" },
  "decor-texte": { id: "decor-quai-nuit", role: "lieu" },
};

/** After still for “Voir un exemple”. Missing file → UI shows « Exemple à venir ». */
export const APRES_PAR_GESTE: Record<string, string> = {
  "cast-photos": "/exemples/apres-cast-photos.webp",
  "cast-planche": "/exemples/apres-cast-planche.webp",
  "cast-texte": "/exemples/apres-cast-texte.webp",
  "decor-photo": "/exemples/apres-decor-photo.webp",
  "decor-heure": "/exemples/apres-decor-heure.webp",
  "decor-texte": "/exemples/apres-decor-texte.webp",
};
