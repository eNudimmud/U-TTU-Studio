import { initialMaquette, MAX_FIGURES, type MaquetteState } from './state.ts';
import { TUILES } from '../cinema/tuiles.ts';

export function maquetteJson(state: MaquetteState): string {
  return JSON.stringify({ ...state, past: [] });
}
export function readMaquette(raw: string | undefined): MaquetteState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as MaquetteState;
    if (!Array.isArray(data.figures) || data.figures.length > MAX_FIGURES || !TUILES.some(tile => tile.id === data.tuile)) return null;
    if (!data.orbit || ![data.orbit.theta, data.orbit.phi, data.orbit.radius].every(Number.isFinite)) return null;
    if (data.figures.some(f => typeof f.id !== 'string' || typeof f.name !== 'string' || !/^#[0-9a-f]{6}$/i.test(f.color) || ![f.x, f.z, f.yaw, f.pose].every(Number.isFinite))) return null;
    return { ...initialMaquette(), ...data, lockPose: data.lockPose === true, lockCam: data.lockCam === true, past: [] };
  } catch { return null; }
}
