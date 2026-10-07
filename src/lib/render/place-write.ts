// Writes a place into a Blender template that the caller already holds.
// The template bytes are not in this module.

import { PLACE_SLOTS } from "./place-slots.ts";
import { blenderPath, type BlenderPose, type PlaceCamera, type PrevizPlan } from "./place.ts";

function writeFloat(bytes: Uint8Array, id: string, value: number): void {
  const offsets = PLACE_SLOTS[id];
  if (!offsets?.length) throw new Error(`Le modèle Blender n’a pas d’emplacement ${id}.`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (const offset of offsets) {
    if (offset < 0 || offset + 4 > bytes.byteLength) throw new Error(`Emplacement ${id} hors du fichier.`);
    view.setFloat32(offset, value, true);
  }
}

function writeCamera(bytes: Uint8Array, which: "0" | "1", camera: BlenderPose["camera"]): void {
  const loc = which === "0" ? "a0" : "b0";
  const quat = which === "0" ? "q0" : "q1";
  writeFloat(bytes, `${loc}x`, camera.location[0]);
  writeFloat(bytes, `${loc}y`, camera.location[1]);
  writeFloat(bytes, `${loc}z`, camera.location[2]);
  writeFloat(bytes, `${quat}w`, camera.quaternion[0]);
  writeFloat(bytes, `${quat}x`, camera.quaternion[1]);
  writeFloat(bytes, `${quat}y`, camera.quaternion[2]);
  writeFloat(bytes, `${quat}z`, camera.quaternion[3]);
}

/** A .blend Blender 4.1.1 can open: the place, the camera path, Cycles, one PNG per frame. No person is in the file. */
export function applyPlaceBlend(template: Uint8Array, plan: PrevizPlan, camera: PlaceCamera): Uint8Array {
  const bytes = template.slice();
  const path = blenderPath(plan, camera);
  path.volumes.forEach((volume, index) => {
    writeFloat(bytes, `v${index}x`, volume.location[0]);
    writeFloat(bytes, `v${index}y`, volume.location[1]);
    writeFloat(bytes, `v${index}z`, volume.location[2]);
    writeFloat(bytes, `v${index}sx`, volume.scale[0]);
    writeFloat(bytes, `v${index}sy`, volume.scale[1]);
    writeFloat(bytes, `v${index}sz`, volume.scale[2]);
  });
  writeCamera(bytes, "0", path.start);
  writeCamera(bytes, "1", path.end);
  writeFloat(bytes, "lens", path.start.lens);
  return bytes;
}
