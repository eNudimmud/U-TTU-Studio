// FastH3 OmniRef reads a structured prompt (template note and FastVideo/FastH3-OmniRef-Comfy card):
// subject_definitions → summary [reference generation] → retention_analysis → detailed_description
// → overall_soundscape → non_diegetic_music. Audit n° 8 (29.10.2026): with a short prompt it lost
// the place; with this shape and two references it kept rope, bollards and fog (job ddd54cb2).
// The visitor writes one request; this builds the rest. Pure: nothing here opens a network.

export type FastH3Role = "personnage" | "lieu";
export interface FastH3Ref {
  role: FastH3Role;
  /** A cast or set name, when the studio knows it. */
  name?: string;
}

/** The studio panel gives two named slots: the character, then the place. */
export const FASTH3_REFS: readonly FastH3Ref[] = [{ role: "personnage" }, { role: "lieu" }];

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

function definition(ref: FastH3Ref, index: number): string {
  const tag = `<Subject ${index + 1}> is the ${ref.role === "personnage" ? "character" : "setting"} in <Picture ${index + 1}>`;
  const name = ref.name ? clean(ref.name) : "";
  return name ? `${tag}: ${name}.` : `${tag}.`;
}

function retention(ref: FastH3Ref, index: number): string {
  const kept = ref.role === "personnage"
    ? `the face, skin, hair, outfit and colours of <Picture ${index + 1}> are retained`
    : `the place, its objects, its light and its weather from <Picture ${index + 1}> are retained`;
  return `<Subject ${index + 1}> (appears in [Shot 1]): fully_preserved - ${kept}.`;
}

export function fastH3Prompt(request: string, refs: readonly FastH3Ref[] = FASTH3_REFS): string {
  const ask = clean(request);
  if (!ask) throw new Error("Consigne manquante.");
  if (refs.length === 0 || refs.length > 9) throw new Error("FastH3 prend de 1 à 9 références.");
  const people = refs.map((ref, index) => ({ ref, index })).filter(item => item.ref.role === "personnage").map(item => `<Subject ${item.index + 1}>`);
  const places = refs.map((ref, index) => ({ ref, index })).filter(item => item.ref.role === "lieu").map(item => `<Subject ${item.index + 1}>`);
  const where = places.length ? ` in ${places.join(" and ")}` : "";
  const who = people.length ? people.join(" and ") : "The scene";
  return [
    "subject_definitions:",
    ...refs.map(definition),
    "",
    "summary:",
    `[reference generation] The target video is a 5-second cinematic shot. ${ask}`,
    "",
    "retention_analysis:",
    ...refs.map(retention),
    "",
    "detailed_description:",
    "The target video keeps every reference exactly as shown, with natural motion and a steady cinematic camera.",
    `[Shot 1] ${who}${where}: ${ask}`,
    "",
    "overall_soundscape:",
    "Natural ambient sound of the place, matching the action.",
    "",
    "non_diegetic_music:",
    "None.",
  ].join("\n");
}
