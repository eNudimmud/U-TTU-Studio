// A sequence of takes becomes the video track. Sounds stay empty until someone drops them.

import { montageCues, type MontageCue } from "../coffre/montage.ts";
import type { Shot } from "../coffre/model.ts";
import { exempleEdit } from "./exemple.ts";
import { emptyEdit, type Edit, type VideoClip } from "./edit.ts";

type TakeCue = Parameters<typeof montageCues>[1][number];

function mediaKind(source: string | null): VideoClip["kind"] {
  if (!source) return "slate";
  if (/\.(png|jpe?g|webp|gif)$/i.test(source)) return "image";
  return "video";
}

function cueClip(cue: MontageCue): VideoClip {
  const id = cue.takeId ? `plan-${cue.takeId}` : `ardoise-${cue.shotId}-${cue.ordre}`;
  return {
    id,
    kind: mediaKind(cue.source),
    source: cue.source,
    label: cue.takeLine || cue.shotName || cue.shotId,
    media: cue.seconds,
    start: 0,
    end: cue.seconds,
    takeId: cue.takeId,
  };
}

export function editHasClips(edit: { video: readonly unknown[]; audio: readonly unknown[] }): boolean {
  return edit.video.length + edit.audio.length > 0;
}

export function editFromShots(
  sequence: { id: string; name: string },
  shots: readonly Shot[],
  takes: readonly TakeCue[],
): Edit {
  return {
    id: sequence.id,
    name: sequence.name,
    video: montageCues(shots, takes, sequence.id).map(cueClip),
    audio: [],
  };
}

/**
 * A saved cut wins. Otherwise the first sequence that already has a take.
 * With nothing filed, the cut stays empty. Examples require explicit demo mode.
 */
export function chooseEdit(input: {
  requestedId?: string | null;
  demo?: boolean;
  saved: readonly Edit[];
  sequences: readonly { id: string; name: string }[];
  shots: readonly Shot[];
  takes: readonly TakeCue[];
}): { edit: Edit; stored: boolean } {
  if (input.requestedId) {
    const saved = input.saved.find(edit => edit.id === input.requestedId);
    if (saved) return { edit: saved, stored: true };
    const sequence = input.sequences.find(item => item.id === input.requestedId);
    if (sequence) return { edit: editFromShots(sequence, input.shots, input.takes), stored: false };
    throw new Error('sequence-missing');
  }
  for (const sequence of input.sequences) {
    const cues = montageCues(input.shots, input.takes, sequence.id);
    if (!cues.some(cue => cue.takeId)) continue;
    const found = input.saved.find(edit => edit.id === sequence.id);
    if (found) return { edit: found, stored: true };
    return { edit: editFromShots(sequence, input.shots, input.takes), stored: false };
  }
  const filed = input.saved[0];
  if (filed) return { edit: filed, stored: true };
  return { edit: input.demo ? exempleEdit() : emptyEdit("suite", "Séquence"), stored: false };
}
