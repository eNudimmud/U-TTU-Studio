// The take's text. Picture tags follow connection order: the look's photos
// first, then the place's stills.

export const TAKE_PROMPT_MAX = 1600;

export interface TakePromptInput {
  traits: readonly string[];
  lookPictures: number;
  place: { name: string; note: string; pictures: number } | null;
  line: string;
}

function clip(value: string, max: number): string {
  return value.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().replace(/[.!?…]+$/, "").slice(0, max);
}

function tags(from: number, count: number): string {
  const list = Array.from({ length: count }, (_, index) => `<Picture ${from + index}>`);
  return list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

export function takePrompt(input: TakePromptInput): string {
  const look = Math.max(1, Math.floor(input.lookPictures));
  const lines = [`${tags(1, look)} ${look > 1 ? "show" : "shows"} the same person. Keep this person for the whole shot.`];
  const traits = input.traits.map(trait => clip(trait, 60)).filter(Boolean).slice(0, 8);
  if (traits.length) lines.push(`What does not change: ${traits.join(", ")}.`);
  if (input.place) {
    const name = clip(input.place.name, 80);
    const count = Math.max(0, Math.floor(input.place.pictures));
    if (count > 0) lines.push(`${tags(look + 1, count)} ${count > 1 ? "show" : "shows"} the place${name ? `, ${name}` : ""}.`);
    else if (name) lines.push(`The place: ${name}.`);
    const note = clip(input.place.note, 280);
    if (note) lines.push(`The place holds: ${note}.`);
  }
  const shot = clip(input.line, 240);
  if (shot) lines.push(`The shot: ${shot}.`);
  return lines.join(" ").slice(0, TAKE_PROMPT_MAX);
}
