// The take's text. Picture tags follow connection order: the look's photos
// first, then the place's stills. The graph names them `<Picture N>`.
// The older file endpoint named them "Image N".

export const TAKE_PROMPT_MAX = 1600;

export interface TakePromptInput {
  traits: readonly string[];
  lookPictures: number;
  place: { name: string; note: string; pictures: number } | null;
  line: string;
  tags?: "picture" | "image";
  /** A LoRA's trigger phrase: the word that calls the trained person. */
  subject?: string;
  /**
   * Several CAST characters, in picture order. Each one's pictures follow the
   * previous one's; `lookPictures` is ignored when two or more are given.
   */
  cast?: readonly { name: string; pictures: number; description?: string }[];
}

/** True when a character's sheet text says it wears clothes. */
export const CLOTHING = /\b(wear(s|ing)?|dress(ed)?|clothe[sd]|clothing|outfit|costume|uniform|jacket|coat|shirt|t-shirt|hoodie|sweater|robe|cape|cloak|armou?r|trousers|pants|jeans|skirt|boots|hat|helmet|scarf|gloves|v[êe]tue?s?|habill[ée]e?s?|tenue|veste|manteau|chemise|pantalon|jupe|bottes|chapeau|casque|[ée]charpe|gants)\b/i;

function castLines(cast: NonNullable<TakePromptInput["cast"]>, style: "picture" | "image"): { lines: string[]; pictures: number } {
  const lines: string[] = [];
  let next = 1;
  for (const member of cast) {
    const name = clip(member.name, 60) || `Character ${lines.length + 1}`;
    const count = Math.max(0, Math.floor(member.pictures));
    const description = clip(member.description ?? "", 120);
    const who = description ? `${name} (${description})` : name;
    lines.push(count > 0 ? `${tags(next, count, style)} ${count > 1 ? "show" : "shows"} only ${who}.` : `${who}.`);
    const keep = CLOTHING.test(description) ? "face, species, body, colours and outfit" : "face, species, body and colours";
    lines.push(`Keep ${name}'s own ${keep}.`);
    next += count;
  }
  lines.push(`These are ${cast.length} different characters: never blend, swap or copy features between them. Keep each one for the whole shot.`);
  return { lines, pictures: next - 1 };
}

function clip(value: string, max: number): string {
  return value.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().replace(/[.!?…]+$/, "").slice(0, max);
}

function tags(from: number, count: number, style: "picture" | "image"): string {
  const list = Array.from({ length: count }, (_, index) => (style === "image" ? `Image ${from + index}` : `<Picture ${from + index}>`));
  return list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

export function takePrompt(input: TakePromptInput): string {
  const style = input.tags ?? "picture";
  const several = input.cast && input.cast.length > 1 ? castLines(input.cast, style) : null;
  const look = several ? several.pictures : Math.max(0, Math.floor(input.lookPictures));
  const subject = input.subject ? clip(input.subject, 60) : "";
  const person = look > 0
    ? `${tags(1, look, style)} ${look > 1 ? "show" : "shows"} ${subject ? `${subject}, ` : ""}the same person. Keep this person for the whole shot.`
    : `${subject ? `${subject} is the person. ` : ""}Keep the same person for the whole shot.`;
  const lines = several ? [...several.lines] : [person];
  const traits = input.traits.map(trait => clip(trait, 60)).filter(Boolean).slice(0, 8);
  if (traits.length) lines.push(`What does not change: ${traits.join(", ")}.`);
  if (input.place) {
    const name = clip(input.place.name, 80);
    const count = Math.max(0, Math.floor(input.place.pictures));
    if (count > 0) lines.push(`${tags(look + 1, count, style)} ${count > 1 ? "show" : "shows"} the place${name ? `, ${name}` : ""}.`);
    else if (name) lines.push(`The place: ${name}.`);
    const note = clip(input.place.note, 280);
    if (note) lines.push(`The place holds: ${note}.`);
  }
  const shot = clip(input.line, 240);
  if (shot) lines.push(`The shot: ${shot}.`);
  return lines.join(" ").slice(0, TAKE_PROMPT_MAX);
}
