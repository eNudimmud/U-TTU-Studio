// A finished take lands in the current project. The note sits in Prises/.
// Sequences and plans that already exist receive it, and the note links back.

import {
  normalizeLinks, normalizeTakeIds, writeSequence, writeShot, writeTake,
  type Lora, type Sequence, type Shot, type Take, type TakeNoteLinks,
} from "../coffre/model.ts";
import type { VaultStore } from "../coffre/store.ts";

export function placeLandedTake(
  takeId: string,
  sequences: readonly Sequence[],
  shots: readonly Shot[],
): { sequences: Sequence[]; shots: Shot[] } {
  return {
    sequences: sequences.map(sequence => (
      sequence.links.some(link => link.takeId === takeId)
        ? sequence
        : { ...sequence, links: normalizeLinks([...sequence.links, { takeId, raccord: "" }]) }
    )),
    shots: shots.map(shot => (
      shot.takeIds.includes(takeId)
        ? shot
        : { ...shot, takeIds: normalizeTakeIds([...shot.takeIds, takeId]) }
    )),
  };
}

/** Wikilinks only for the sequence or the plan that actually holds the take. */
export function landedLinks(takeId: string, sequences: readonly Sequence[], shots: readonly Shot[]): TakeNoteLinks {
  return {
    sequences: sequences
      .filter(sequence => sequence.links.some(link => link.takeId === takeId))
      .map(sequence => ({ id: sequence.id, name: sequence.name })),
    shots: shots
      .filter(shot => shot.takeIds.includes(takeId))
      .map(shot => ({ id: shot.id, name: shot.name })),
  };
}

function sameSequence(left: Sequence, right: Sequence): boolean {
  return left.links.length === right.links.length
    && left.links.every((link, index) => link.takeId === right.links[index]?.takeId && link.raccord === right.links[index]?.raccord);
}

function sameShot(left: Shot, right: Shot): boolean {
  return left.takeIds.join("\n") === right.takeIds.join("\n");
}

/** Writes the note, and the sequence or plan notes that gained this take. */
export async function settleLandedTake(
  store: VaultStore,
  take: Take,
  sequences: readonly Sequence[],
  shots: readonly Shot[],
  takes: readonly Take[],
  loras: readonly Lora[] = [],
): Promise<{ sequences: Sequence[]; shots: Shot[] }> {
  const placed = placeLandedTake(take.id, sequences, shots);
  for (const sequence of placed.sequences) {
    const previous = sequences.find(item => item.id === sequence.id);
    if (previous && sameSequence(previous, sequence)) continue;
    await writeSequence(store, sequence, takes);
  }
  for (const shot of placed.shots) {
    const previous = shots.find(item => item.id === shot.id);
    if (previous && sameShot(previous, shot)) continue;
    const sequenceName = placed.sequences.find(item => item.id === shot.sequenceId)?.name ?? "";
    await writeShot(store, shot, takes, sequenceName);
  }
  await writeTake(store, take, takes, loras, landedLinks(take.id, placed.sequences, placed.shots));
  return placed;
}
