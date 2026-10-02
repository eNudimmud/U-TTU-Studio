// Look, Plateau, Take — the studio shell. Hashes stay ASCII.
// The shoot is a short take inside a world brought to Plateau.
// Engine names stay in the help strings, not in the primary labels.

import { STUDIO_MODES, type StudioMode } from "./studio-modes.ts";

export const CINEMA_STEPS = [
  {
    id: "look",
    name: "Look",
    plain: "Ton style",
    line: "Le visage et la lumière, pour tenir d’un plan à l’autre.",
  },
  {
    id: "plateau",
    name: "Plateau",
    plain: "Ta scène",
    line: "Le monde : le lieu, la préviz, les angles.",
  },
  {
    id: "take",
    name: "Take",
    plain: "La prise",
    line: "Un plan court, tourné dans ce monde.",
  },
] as const;

export type CinemaStep = (typeof CINEMA_STEPS)[number]["id"];

export const CINEMA_PATH = "Le monde, le look tenu, puis une prise courte.";

export const STEP_QUERY = "step";

export const TAKE_CHAIN = [
  {
    id: "monde",
    title: "Le monde",
    line: "Le lieu est posé, avec une préviz ou une note.",
  },
  {
    id: "look",
    title: "Le look tenu",
    line: "Le visage et la lumière ne changent pas.",
  },
  {
    id: "prise",
    title: "La prise courte",
    line: "Un plan tourné dans ce monde. Pas encore.",
  },
] as const;

export type TakeChainId = (typeof TAKE_CHAIN)[number]["id"];

export const LOOK_HELD_TITLE = "Look tenu";
export const LOOK_OPEN_TITLE = "Pas encore tenu";
export const LOOK_HELD_LINE = "Le visage et la lumière sont notés. Une prise dans le monde pourra s’y tenir.";
export const LOOK_OPEN_LINE = "Dépose tes photos et note ce qui ne change pas. Sans ça, la prise reste fermée.";

export const PLATEAU_EMPTY_TITLE = "Le monde n’est pas encore là.";
export const PLATEAU_EMPTY_LINE = "Tu le construis à ton bureau, puis tu le poses ici. Le prochain clic lui donne un nom.";
export const PLATEAU_NEXT_PREVIZ = "Prochain clic : une image, une suite d’images, ou une note. C’est la préviz de ce monde.";
export const PLATEAU_READY_LINE = "Ce monde est posé. La prise pourra s’y tourner.";

export const TAKE_LEAD = "Une prise courte, tournée dans le monde que tu as posé. Elle part des images de préviz et du look tenu. Pas d’un texte seul.";
export const TAKE_WAIT = "Le bouton s’ouvre quand le monde est posé et que le look est tenu.";
export const TAKE_NOTE = "Tu notes le plan dans ce lieu. Aucune image n’est produite. Rien n’est envoyé.";
export const TAKE_SOON_TITLE = "Tourner dans ce monde";
export const TAKE_SOON_LINE = "La prise courte partira de la préviz et du look tenu. Le tournage n’est pas ouvert. Rien n’est envoyé.";
export const TAKE_CLOSED = "Le plan reste noté. La prise reste fermée tant que le monde ou le look manque.";

/** Secondary help. Engine names live here, not on the step labels. */
export const PLATEAU_HELP = "La préviz se prépare dans Blender, sur ton bureau : images fixes, une suite d’images, des notes de caméra. Tu les déposes ici. Le studio ne lance pas Blender et n’ouvre pas un fichier .blend.";
export const TAKE_HELP = "Plus tard, la prise courte sera tournée dans le cloud, à partir de ces images et du look tenu. MiniMax H3 en référence (R2V, références nommées, LoRA turbo 4 pas), un LoRA d’échange de personnage, ou Seedance. Ce n’est pas branché. Rien n’est facturé.";

const STEP_ALIASES: Record<string, CinemaStep> = {
  look: "look",
  creer: "look",
  créer: "look",
  plateau: "plateau",
  scene: "plateau",
  scène: "plateau",
  monde: "plateau",
  take: "take",
  prise: "take",
};

const ATELIER_ALIASES: Record<string, StudioMode> = {
  sphere: "sphere",
  sphère: "sphere",
  identite: "identite",
  identité: "identite",
  bibliotheque: "bibliotheque",
  bibliothèque: "bibliotheque",
  studio: "studio",
  compte: "compte",
};

export type ShellPlace =
  | { kind: "cinema"; step: CinemaStep }
  | { kind: "atelier"; mode: StudioMode };

export function atelierModes() {
  return STUDIO_MODES.filter(mode => mode.id !== "creer");
}

function token(hash: string): string {
  return decodeURIComponent(hash.replace(/^#/, "").split(/[?&]/)[0] ?? "").trim().toLowerCase();
}

function stepFromQuery(search: string): CinemaStep | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const value = (new URLSearchParams(raw).get(STEP_QUERY) ?? "").trim().toLowerCase();
  return STEP_ALIASES[value] ?? null;
}

/** Hash wins over ?step=, so a Clerk return to #compte still opens Compte. */
export function placeFromLocation(hash: string, search = ""): ShellPlace {
  const raw = token(hash);
  if (raw) {
    const step = STEP_ALIASES[raw];
    if (step) return { kind: "cinema", step };
    const atelier = ATELIER_ALIASES[raw];
    if (atelier) return { kind: "atelier", mode: atelier };
    return { kind: "cinema", step: "look" };
  }
  return { kind: "cinema", step: stepFromQuery(search) ?? "look" };
}

export function takeReady(input: { lookHeld: boolean; worldReady: boolean }): boolean {
  return input.lookHeld && input.worldReady;
}
