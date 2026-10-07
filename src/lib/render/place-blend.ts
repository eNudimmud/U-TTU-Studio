// The Blender 4.1.1 template, decoded for tests and for a sync build.
// The studio page does not import this module. The browser fetches
// public/studio/place.blend when a path is filmed.

import { PLACE_BLEND_B64 } from "./place-template.ts";
import { applyPlaceBlend } from "./place-write.ts";
import type { PlaceCamera, PrevizPlan } from "./place.ts";

let template: Uint8Array | null = null;

function templateBytes(): Uint8Array {
  if (!template) {
    const binary = atob(PLACE_BLEND_B64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    template = bytes;
  }
  return template;
}

/** A .blend Blender 4.1.1 can open: the place, the camera path, Cycles, one PNG per frame. No person is in the file. */
export function buildPlaceBlend(plan: PrevizPlan, camera: PlaceCamera): Uint8Array {
  return applyPlaceBlend(templateBytes(), plan, camera);
}
