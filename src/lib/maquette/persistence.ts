import { initialMaquette, MAX_FIGURES, type MaquetteState } from './state.ts';
import { TUILES } from '../cinema/tuiles.ts';
import { MAX_KEYS, MAX_PROPS, PATH_SECONDS, PROP_KINDS } from './scene.ts';

export function maquetteJson(state: MaquetteState): string {
  return JSON.stringify({ ...state, props: state.props?.map(({ url: _temporary, ...prop }) => prop), past: [] });
}
export function readMaquette(raw: string | undefined): MaquetteState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as MaquetteState;
    if (!Array.isArray(data.figures) || data.figures.length > MAX_FIGURES || !TUILES.some(tile => tile.id === data.tuile)) return null;
    if (!data.orbit || ![data.orbit.theta, data.orbit.phi, data.orbit.radius].every(Number.isFinite)) return null;
    if (data.flat && (![data.flat.x, data.flat.y, data.flat.zoom].every(Number.isFinite) || Math.abs(data.flat.x) > 1 || Math.abs(data.flat.y) > 1 || data.flat.zoom < .5 || data.flat.zoom > 3)) return null;
    if (data.figures.some(f => typeof f.id !== 'string' || typeof f.name !== 'string' || !/^#[0-9a-f]{6}$/i.test(f.color) || ![f.x, f.z, f.yaw, f.pose].every(Number.isFinite))) return null;
    if (data.props && (!Array.isArray(data.props) || data.props.length > MAX_PROPS || data.props.some(p => !PROP_KINDS.includes(p.kind) || typeof p.id !== 'string' || typeof p.name !== 'string' || ![p.x, p.z, p.yaw].every(Number.isFinite) || (p.source !== undefined && !/^Projets\/[a-z0-9-]+\/Assets\/[a-z0-9-]+\.(glb|gltf)$/.test(p.source))))) return null;
    if (data.path && (!Array.isArray(data.path) || data.path.length > MAX_KEYS || data.path.some(k => !Number.isFinite(k.t) || k.t < 0 || k.t > PATH_SECONDS || !k.orbit || ![k.orbit.theta, k.orbit.phi, k.orbit.radius].every(Number.isFinite)))) return null;
    return { ...initialMaquette(), ...data, props: data.props?.map(({ url: _temporary, ...prop }) => prop), path: data.path?.slice().sort((a, b) => a.t - b.t), lockPose: data.lockPose === true, lockCam: data.lockCam === true, past: [] };
  } catch { return null; }
}
