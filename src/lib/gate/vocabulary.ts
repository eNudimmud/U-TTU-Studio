export const ANGLES = [
  { id: "face", label: "Face", caption: "front view" },
  { id: "trois-quarts", label: "3/4", caption: "three-quarter view" },
  { id: "profil", label: "Profil", caption: "side profile view" },
  { id: "dos", label: "Dos", caption: "back view" },
] as const;
export type Angle = (typeof ANGLES)[number]["id"];

export const FRAMINGS = [
  { id: "gros-plan", label: "Gros plan", caption: "close-up portrait" },
  { id: "buste", label: "Buste", caption: "upper body shot" },
  { id: "pied", label: "Plein pied", caption: "full body shot" },
] as const;
export type Framing = (typeof FRAMINGS)[number]["id"];

export const FACE_ANGLES: readonly Angle[] = ["face", "trois-quarts", "profil"];
export const WIDE_FRAMINGS: readonly Framing[] = ["buste", "pied"];

// Words that carry no identity on their own: ignored when looking for traits repeated across captions.
export const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "with", "without", "in", "on", "at", "of", "to", "from", "by", "for", "into", "over", "under",
  "near", "is", "are", "her", "his", "their", "its", "she", "he", "they", "very", "slightly", "wearing", "holding", "looking",
  "standing", "sitting", "background", "light", "lighting", "lit", "shot", "view", "photo", "portrait", "close", "body", "upper",
  "full", "side", "front", "back", "camera", "scene", "outdoors", "indoors", "day", "night",
  "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou", "avec", "sans", "dans", "sur", "en", "au", "aux", "par", "pour",
  "son", "sa", "ses", "fond", "lumiere", "eclairage", "portant", "porte", "regard", "plan",
]);

// A trigger that is just one of these words (digits and underscores removed) collides with what Flux already knows.
export const COMMON_WORDS = new Set([
  "woman", "women", "man", "men", "girl", "boy", "person", "people", "lady", "guy", "character", "portrait", "photo", "style",
  "model", "face", "human", "anime", "cartoon", "art", "artist", "hero", "queen", "king", "goddess", "god", "warrior", "robot",
  "femme", "homme", "fille", "garcon", "personnage", "visage", "modele", "deesse", "reine", "roi", "lora", "trigger", "token", "sks",
]);
