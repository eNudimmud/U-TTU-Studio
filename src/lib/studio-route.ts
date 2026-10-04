// The studio's places, read from the hash. Old links still land:
// #creer and #identite open the look, #plateau the scene, #take the take.

export type Tab = "look" | "lora" | "scene" | "prise" | "sphere";

const ALIASES: Record<string, Tab> = {
  look: "look", creer: "look", créer: "look", style: "look", identite: "look", identité: "look",
  lora: "lora", former: "lora", entrainer: "lora", entraîner: "lora", double: "lora", role: "lora", rôle: "lora", personnage: "lora",
  scene: "scene", scène: "scene", plateau: "scene", monde: "scene",
  prise: "prise", take: "prise", studio: "prise",
  sphere: "sphere", sphère: "sphere", bibliotheque: "sphere", bibliothèque: "sphere",
};

/** The place a link asks for, or null when it asks for none. */
export function tabFromLocation(hash: string, search: string): Tab | "compte" | null {
  const raw = decodeURIComponent(hash.replace(/^#/, "").split(/[?&]/)[0] ?? "").trim().toLowerCase();
  if (raw === "compte") return "compte";
  if (raw && ALIASES[raw]) return ALIASES[raw];
  const step = new URLSearchParams(search).get("step")?.trim().toLowerCase() ?? "";
  return ALIASES[step] ?? null;
}

/** Without a link, the studio opens on the next gesture. */
export function resumeTab(state: { lookReady: boolean; hasScene: boolean }): Tab {
  if (!state.lookReady) return "look";
  return state.hasScene ? "prise" : "scene";
}
