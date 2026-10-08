// Picture choices for DÉCOR. The three studio spaces stay piece / quai / rue.
// The other three are pictures only: they do not invent a new stored plan.
// A scene keeps its id, so a renamed place still shows the same picture.

import type { PrevizPlan } from "./render/place.ts";

export const DECOR_PRESETS = [
  { id: "quai", plan: "quai" },
  { id: "rue", plan: "rue" },
  { id: "piece", plan: "piece" },
  { id: "toit", plan: null },
  { id: "gare", plan: null },
  { id: "couloir", plan: null },
] as const;

export type DecorPresetId = (typeof DECOR_PRESETS)[number]["id"];

export function decorStorageId(id: DecorPresetId): string {
  return `decor-${id}`;
}

export function decorPresetOf(scene: { id: string; previz: PrevizPlan | null }): DecorPresetId | null {
  for (const preset of DECOR_PRESETS) {
    const stored = decorStorageId(preset.id);
    if (scene.id === stored || scene.id.startsWith(`${stored}-`)) return preset.id;
  }
  if (scene.previz === "quai" || scene.previz === "rue" || scene.previz === "piece") return scene.previz;
  return null;
}

export function presetPlan(id: DecorPresetId): PrevizPlan | null {
  return DECOR_PRESETS.find(preset => preset.id === id)?.plan ?? null;
}
