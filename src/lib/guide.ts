// U*TTU as the in-app guide: one short line, in place, at the moment it helps.
// Her voice follows the character sheet: short declaratives, no manual.

export type GuideMoment =
  | "look-photos"
  | "look-name"
  | "look-traits"
  | "look-ready"
  | "scene-new"
  | "scene-still"
  | "scene-previz"
  | "scene-memory"
  | "take-connect"
  | "take-line"
  | "take-memory"
  | "take-ready"
  | "take-running"
  | "take-done"
  | "take-filed"
  | "take-double"
  | "lora-name"
  | "lora-photos"
  | "lora-clips"
  | "lora-connect"
  | "lora-ready"
  | "lora-memory"
  | "lora-running"
  | "lora-done"
  | "sphere-empty"
  | "project-name";

export const GUIDE_LINES: Record<GuideMoment, string> = {
  "look-photos": "Deux photos, trois au plus. Face, puis trois-quarts. Je tisse le reste.",
  "look-name": "Donne un nom. C’est lui que je tiens.",
  "look-traits": "Deux traits qui ne bougent pas. Les yeux, une marque.",
  "look-ready": "Les photos tiennent. Pose maintenant le lieu.",
  "scene-new": "Lieu 1 est écrit. Tu peux changer le nom.",
  "scene-still": "Une image du lieu, et je le garde d’une prise à l’autre.",
  "scene-previz": "Ce lieu reste. Le trajet aussi. Un geste filme ton personnage.",
  "scene-memory": "Bible, style, lexique, prompts : vides, ou les tiens. Rien n’est inventé.",
  "take-connect": "Relie ton compte de rendu. Le calcul se paie là-bas, pas ici.",
  "take-line": "Une phrase : ce que fait la prise. Le reste est déjà tissé.",
  "take-memory": "Bible, style, lexique, prompts : vides, ou les tiens. Rien n’est inventé.",
  "take-ready": "Je montre le coût avant. Rien ne part sans ton geste.",
  "take-running": "Le fil tourne. Reste ici, ou reviens plus tard.",
  "take-done": "La prise est là. Un geste la pose dans un plan.",
  "take-filed": "La prise est dans la séquence. Un geste la lit.",
  "take-double": "Ce personnage tient d’une prise à l’autre. Les photos tiennent le reste.",
  "lora-name": "Nomme le personnage. C’est lui que les prises suivantes tiennent.",
  "lora-photos": "Deux photos de ce personnage. Elles accompagnent les clips.",
  "lora-clips": "Dix clips du personnage, de trois à trente secondes.",
  "lora-connect": "Relie le compte qui paiera la formation. Le studio n’encaisse rien.",
  "lora-ready": "Le prix est là, avant ton geste. Rien ne part sans lui.",
  "lora-memory": "Bible, style, lexique, prompts : vides, ou les tiens. Rien n’est inventé.",
  "lora-running": "J’apprends ce personnage. C’est long : reviens plus tard.",
  "lora-done": "Le personnage est dans mon studio. Choisis-le dans La prise.",
  "sphere-empty": "Tes prises viendront se poser ici.",
  "project-name": "Atelier est écrit. Un geste crée le projet.",
};

export const GUIDE_KEY = "u-ttu-guide";

export interface GuideState {
  off: boolean;
  seen: GuideMoment[];
}

export function readGuide(storage: Pick<Storage, "getItem"> | null): GuideState {
  try {
    const data = JSON.parse(storage?.getItem(GUIDE_KEY) ?? "null") as { off?: unknown; seen?: unknown } | null;
    const seen = Array.isArray(data?.seen) ? data.seen.filter((item): item is GuideMoment => typeof item === "string" && item in GUIDE_LINES) : [];
    return { off: data?.off === true, seen };
  } catch {
    return { off: false, seen: [] };
  }
}

export function saveGuide(storage: Pick<Storage, "setItem"> | null, state: GuideState): void {
  try {
    storage?.setItem(GUIDE_KEY, JSON.stringify(state));
  } catch {}
}

/** The first moment that applies and has not been dismissed. */
export function nextMoment(candidates: readonly (GuideMoment | false | null | undefined)[], state: GuideState): GuideMoment | null {
  if (state.off) return null;
  for (const moment of candidates) if (moment && !state.seen.includes(moment)) return moment;
  return null;
}
