// @Name mentions in the creation bubble: each one is bound to an attached reference chip.
// Picking a reference writes « @Name »; typing « @ » at the start of a word opens the picker;
// a typed « @Name » of a saved reference attaches it. Names are the user's own, matched whole.

const word = (c: string | undefined) => Boolean(c && /[\p{L}\p{N}_]/u.test(c));
const fold = (s: string) => s.toLocaleLowerCase();

/** Index of every whole « @Name » in `text` (case-insensitive). */
export function mentionsOf(text: string, name: string): number[] {
  const n = name.trim(); if (!n) return [];
  const hay = fold(text), needle = fold(`@${n}`), out: number[] = [];
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    if (!word(text[i - 1]) && !word(text[i + needle.length])) out.push(i);
  }
  return out;
}
/** Adds « @Name » once, at the caret or at the end. */
export function insertMention(text: string, name: string, at = text.length): { text: string; caret: number } {
  const n = name.trim();
  if (!n || mentionsOf(text, n).length) return { text, caret: at };
  let before = text.slice(0, at), after = text.slice(at);
  // A lone « @ » typed to open the picker becomes the mention.
  if (before.endsWith('@') && !word(before[before.length - 2])) before = before.slice(0, -1);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  const insert = `${lead}@${n}${after.startsWith(' ') ? '' : ' '}`;
  return { text: `${before}${insert}${after}`, caret: before.length + insert.length };
}
/** Removing a chip keeps the sentence: « @Name » becomes « Name ». */
export function removeMention(text: string, name: string): string {
  const starts = mentionsOf(text, name);
  return starts.reverse().reduce((t, i) => t.slice(0, i) + t.slice(i + 1), text);
}
/** True when the user just typed « @ » at the start of a word: open the reference picker. */
export function opensPicker(previous: string, next: string, caret: number): boolean {
  return next.length === previous.length + 1 && next[caret - 1] === '@' && !word(next[caret - 2]);
}
/** Saved references the text mentions with « @Name » (longest names first, so « @Ana Maria » beats « @Ana »). */
export function mentionedReferences<T extends { name: string }>(text: string, library: readonly T[]): T[] {
  const taken: [number, number][] = [];
  return [...library].sort((a, b) => b.name.trim().length - a.name.trim().length).filter(ref => {
    const hit = mentionsOf(text, ref.name).find(i => !taken.some(([s, e]) => i >= s && i < e));
    if (hit === undefined) return false;
    taken.push([hit, hit + ref.name.trim().length + 1]); return true;
  });
}
