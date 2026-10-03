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
    line: "Un plan tourné dans ce monde.",
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
export const TAKE_STATUS_READY = "Look tenu. Monde posé. Charge la prise.";
export const TAKE_STATUS_NEED_LOOK = "Le look n’est pas encore tenu. La prise reste fermée.";
export const TAKE_STATUS_NEED_WORLD = "Le monde n’est pas encore posé. La prise reste fermée.";
export const TAKE_GO_LOOK = "Tenir le look";
export const TAKE_GO_WORLD = "Poser le monde";
export const TAKE_LOAD = "Charger la prise ici";
export const TAKE_TAB = "Ouvrir en plein onglet";
export const TAKE_FRAME_LEAD = "Ton compte, tes crédits. Rien n’est chargé avant le clic.";
export const TAKE_FRAME_LINE = "La page du tournage se charge ici. Le texte du plan y est écrit à l’arrivée. Tes images remplacent les exemples seulement si le compte les accepte. Le plein onglet ne reçoit ni ce texte ni ces images. Le tournage payant ne part pas tout seul.";
export const TAKE_FRAME_CONSENT = "Rien n’est chargé avant ton clic. Le bouton affiche la page du tournage dans cette page, via le studio, et y prépare le texte du plan. Tes images partent seulement si le compte les accepte. Le tournage payant ne part pas tout seul. Cette page peut alors charger ses propres traceurs tiers.";
export const TAKE_FRAME_STORED = "Le texte du plan est prêt pour le cadre. Les images partent si le compte les accepte. Sinon les exemples restent.";
export const TAKE_FRAME_TEXT_ONLY = "Le texte du plan est prêt. Aucune photo n’est jointe : les images d’exemple restent.";
export const TAKE_FRAME_STORE_FAIL = "Le plan n’a pas pu être gardé pour le cadre. La page s’ouvre quand même, avec les exemples.";
export const TAKE_FRAME_HTTP = "Page en HTTP : la prise ne s’affiche dans un cadre que depuis une page HTTPS. Utilise « Ouvrir en plein onglet ».";
export const TAKE_FRAME_LOGIN = "Connexion à refaire dans le cadre, même si le compte est ouvert dans un autre onglet. Si elle échoue, « Ouvrir en plein onglet » ouvre la même page.";

export const SHELF_LEAD = "Tes images et tes prises. Revois-les, puis publie la meilleure.";
export const SHELF_TITLE = "L’étagère";
export const SHELF_NOTE = "Ce que tu as généré reste dans ton compte de rendu : onglets « Générés » et « Sorties », dans le cadre. Rien n’est chargé avant le clic.";

/** Secondary help. Engine names live here, not on the step labels. */
export const PLATEAU_HELP = "La préviz se prépare dans Blender, sur ton bureau : images fixes, une suite d’images, des notes de caméra. Tu les déposes ici. Le studio ne lance pas Blender et n’ouvre pas un fichier .blend.";
export const TAKE_HELP = "Quand le monde est posé et le look tenu, « Charger la prise ici » ouvre le template officiel MiniMax H3 en référence (R2V, video_minimax_h3_r2v, modèle ref2va). L’adresse du template n’accepte que l’identifiant : pas les octets des photos, pas le texte du plan. Le plein onglet n’a donc pas le brief. Dans le cadre, le texte est écrit dans le nœud 138 quand le graphe arrive. La photo d’identité va au nœud 137 (Picture 1) et l’image du lieu au nœud 139 (Picture 2), seulement si l’envoi du fichier renvoie un nom sûr. Sans image de lieu, la seconde photo du look prend le nœud 139. S’il n’y a qu’une photo, le nœud 139 garde l’exemple. Si le compte n’accepte pas le fichier, les exemples restent et le texte est quand même écrit. Ouvrir la page ne lance pas le tournage : le run payant n’est pas branché. Le modèle accepte 9 images, 3 vidéos et 3 audios, nommés par balise dans l’ordre de connexion ; ce graphe n’en a que deux. Le LoRA turbo 4 pas minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16 est déjà nommé sur le nœud 145, champ lora_name. L’interrupteur nœud 146 est éteint : il ne s’applique pas tant qu’on ne l’allume pas. Les 4 pas sont le nœud 144, les 20 pas le nœud 143. Le LoRA d’échange de personnage (toyxyz, MiniMax-H3-Character-Swap-LoRA) se met à la main dans ce même champ, à la place du fichier turbo, après un look entraîné. Le look Flux de Former mon look n’entre pas dans ce champ. Seedance n’est pas ce bouton.";

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
