// Shared word handling for the intention resolver and the production memory.
// Names are compared without case, accents, stars or the ⥀ sign: "L*ÉA", "Léa" and "LEA" are one name.

export function fold(text: string): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[*⥀]/g, "")
    .replace(/\b(l|d|qu|j|s|n|m|t|c)['’]/g, "$1 ")
    .replace(/[^a-z0-9ß]+/g, " ")
    .trim();
}

/** " word word " with padding, so a phrase can be found on word boundaries. */
export function padded(text: string): string {
  return ` ${fold(text)} `;
}

export function containsPhrase(haystackPadded: string, phrase: string): boolean {
  const needle = fold(phrase);
  return needle.length > 0 && haystackPadded.includes(` ${needle} `);
}

/** Words that never name a person or a place on their own (articles, prepositions, common sentence starters). */
export const STOP = new Set([
  // fr
  "le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "et", "a", "au", "aux", "dans", "vers", "avec", "sur", "sous", "en", "par", "pour", "puis", "qui", "se", "s", "son", "sa", "ses", "il", "elle", "ils", "elles", "on", "plan", "camera", "ambiance", "style", "lentement", "doucement", "vite", "rapidement", "soudain", "ensuite", "alors", "format", "duree",
  // en
  "the", "an", "and", "in", "into", "with", "on", "at", "to", "towards", "toward", "of", "his", "her", "their", "he", "she", "they", "then", "slowly", "quickly", "fast", "suddenly", "shot", "mood", "look",
  // de
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "und", "im", "mit", "durch", "zum", "zur", "auf", "langsam", "schnell", "kamera", "dann", "plotzlich", "stimmung",
  // es
  "el", "los", "las", "y", "con", "hacia", "por", "del", "al", "lentamente", "rapido", "rapidamente", "camara", "luego", "ambiente", "estilo",
]);
