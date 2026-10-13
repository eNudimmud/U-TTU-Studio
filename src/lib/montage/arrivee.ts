// A kept plan becomes a clip on the cut. The example bed stays until the visitor replaces it.
// An essay take never enters. Finaliser is not involved.

import { appendVideo, type AudioClip, type Edit, type VideoClip } from "./edit.ts";
import { EXEMPLE_ID, exempleEdit } from "./exemple.ts";

export interface StoryboardPlan {
  id: string;
  label: string;
  seconds: number;
  source: string;
}

function imageSource(source: string): boolean {
  return /\.(png|jpe?g|webp|gif)$/i.test(source);
}

export function storyboardClip(plan: StoryboardPlan): VideoClip {
  const seconds = plan.seconds > 0 ? plan.seconds : 5;
  return {
    id: `plan-${plan.id}`,
    kind: imageSource(plan.source) ? "image" : "video",
    source: plan.source,
    label: plan.label.slice(0, 80) || plan.id,
    media: seconds,
    start: 0,
    end: seconds,
    takeId: plan.id,
  };
}

/**
 * Puts the plan on the video track.
 * A fresh cut keeps the example voice and music so the sound tracks are not born empty.
 * A cut the visitor already saved keeps the audio they left.
 */
export function placeStoryboard(edit: Edit, plan: StoryboardPlan, fresh: boolean): Edit {
  const clip = storyboardClip(plan);
  const video = appendVideo(edit, clip).video;
  const audio: AudioClip[] = edit.audio.length > 0 || !fresh ? edit.audio : exempleEdit().audio.map(item => ({ ...item }));
  return { ...edit, video, audio };
}

export function isExampleCut(edit: Edit): boolean {
  return edit.id === EXEMPLE_ID;
}
