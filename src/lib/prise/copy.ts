// Words the visitor sees on PRISE. French is the source. No node names.

export const CADRAGES = [
  "large",
  "moyen",
  "americain",
  "gros",
  "tgp",
  "plongee",
  "contre",
  "epaule",
] as const;

export type Cadrage = (typeof CADRAGES)[number];

export const CADRAGE_LABEL: Record<Cadrage, string> = {
  large: "Plan large",
  moyen: "Plan moyen",
  americain: "Américain",
  gros: "Gros plan",
  tgp: "Très gros plan",
  plongee: "Plongée",
  contre: "Contre-plongée",
  epaule: "Par-dessus l'épaule",
};

export const CAMERAS = [
  "fixe",
  "travelling-avant",
  "travelling-arriere",
  "panoramique",
  "suivi",
  "orbite",
  "epaule",
] as const;

export type CameraMove = (typeof CAMERAS)[number];

export const CAMERA_LABEL: Record<CameraMove, string> = {
  fixe: "Fixe",
  "travelling-avant": "Travelling avant",
  "travelling-arriere": "Travelling arrière",
  panoramique: "Panoramique",
  suivi: "Suivi",
  orbite: "Orbite",
  epaule: "Caméra à l'épaule",
};

export const ACTION_EXAMPLES = [
  "marche vers la caméra",
  "se retourne",
  "regarde au loin",
  "s'arrête",
  "tend la main",
  "baisse les yeux",
] as const;

export const ACTION_STILL = "reste immobile, respire";
export const ACTION_MAX = 240;

export const ETAT_LABEL = {
  vide: "Vide",
  "image-cle": "Image clé",
  validee: "Validée",
  prise: "Prise",
  gardee: "Gardée",
  finalisee: "Finalisée",
} as const;

export type PlanEtat = keyof typeof ETAT_LABEL;

export const PAS_MESURE = "Pas encore mesuré : un rendu de mesure doit être validé";
export const DUREE_DIX = "Pas encore mesurée";
export const CHOISIS = "Choisis au moins un personnage ou un lieu.";
export const TROIS = "Trois personnages au plus.";
export const GARDE_CADRE = "Garde ce cadre avant de tourner.";
export const IMAGE_DEJA = "Une image clé est déjà là.";
export const TOURNE_DABORD = "Tourne d'abord une prise.";
export const ESSAI_DABORD = "Compose d'abord l'image, ou lance un essai rapide.";

export const FINAL_SENTENCE = "On garde ta prise telle quelle et on augmente sa résolution et sa netteté.";
export const FINAL_IMAGE_SENTENCE = "On garde ton image telle quelle et on augmente sa résolution et sa netteté.";
export const QUATRE_K = "Aucun graphe vérifié ne va au-delà du 1080p.";
