// Shell modes. Hashes stay ASCII so the panels switch without a server route.
// Compte is last: Identité is the character canon, not the login. The account
// is not a vault room and does not sit in front of Créer.

export const STUDIO_MODES = [
  { id: "creer", label: "Créer" },
  { id: "sphere", label: "Sphère" },
  { id: "identite", label: "Identité" },
  { id: "bibliotheque", label: "Bibliothèque" },
  { id: "studio", label: "Studio" },
  { id: "compte", label: "Compte" },
] as const;

export type StudioMode = (typeof STUDIO_MODES)[number]["id"];

const HASH_ALIASES: Record<string, StudioMode> = {
  sphère: "sphere",
  identité: "identite",
  bibliothèque: "bibliotheque",
};

export function modeFromHash(hash: string): StudioMode {
  const raw = decodeURIComponent(hash.replace(/^#/, "").split(/[?&]/)[0]).trim().toLowerCase();
  const id = HASH_ALIASES[raw] ?? raw;
  return STUDIO_MODES.some(mode => mode.id === id) ? id as StudioMode : "creer";
}

export const SPHERE_PRESETS = [
  {
    id: "avant",
    title: "Avant",
    kicker: "La scène tient",
    line: "L’instant d’avant le geste.",
    detail: "Une image de départ. Le mouvement n’a pas commencé. Aucun rendu vidéo n’est appelé depuis cette page.",
  },
  {
    id: "apres",
    title: "Après",
    kicker: "La trace",
    line: "Ce que la scène garde, une fois le geste passé.",
    detail: "Une image d’arrivée. Pas de clip, pas de file. Le bouton reste éteint.",
  },
  {
    id: "entre",
    title: "Entre deux images",
    kicker: "Le passage",
    line: "Deux images. Le temps qui les relie.",
    detail: "De l’une vers l’autre. Aucun modèle vidéo, aucun compte, aucun envoi.",
  },
] as const;
