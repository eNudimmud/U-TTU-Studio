// The chain is Personnage → Scène → Prise. The photo sheet is not a step.
// Old links still land: #creer and #look open the photos, #lora and #rôle
// open Personnage, #plateau the scene, #take the take.

export type Tab = "look" | "lora" | "scene" | "prise" | "montage" | "sphere" | "fiches";

const ALIASES: Record<string, Tab> = {
  look: "look", photos: "look", creer: "look", créer: "look", style: "look", identite: "look", identité: "look",
  lora: "lora", former: "lora", entrainer: "lora", entraîner: "lora", double: "lora", role: "lora", rôle: "lora", personnage: "lora",
  scene: "scene", scène: "scene", plateau: "scene", monde: "scene",
  prise: "prise", take: "prise", studio: "prise",
  montage: "montage", monter: "montage", edit: "montage",
  sphere: "sphere", sphère: "sphere", bibliotheque: "sphere", bibliothèque: "sphere",
  fiches: "fiches", fiche: "fiches",
};

/** Hash written when the adherent opens a place from the chain. */
export const TAB_HASH: Record<Tab, string> = {
  look: "photos",
  lora: "personnage",
  scene: "scene",
  prise: "prise",
  montage: "montage",
  sphere: "sphere",
  fiches: "fiches",
};

/** The place a link asks for, or null when it asks for none. */
export function tabFromLocation(hash: string, search: string): Tab | "compte" | null {
  const raw = decodeURIComponent(hash.replace(/^#/, "").split(/[?&]/)[0] ?? "").trim().toLowerCase();
  if (raw === "compte") return "compte";
  if (raw && ALIASES[raw]) return ALIASES[raw];
  const step = new URLSearchParams(search).get("step")?.trim().toLowerCase() ?? "";
  return ALIASES[step] ?? null;
}

/** Without a link, the studio opens on the next step: Personnage, then Scène, then Prise. */
export function resumeTab(state: { lookReady: boolean; hasScene: boolean }): Tab {
  if (!state.lookReady) return "lora";
  return state.hasScene ? "prise" : "scene";
}
