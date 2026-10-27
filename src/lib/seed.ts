// Random seeds for Comfy nodes. Partner APIs (Ideogram, Seedream, …) reject
// values above signed int32 max; open-weight samplers accept the same range.

/** Inclusive max for a signed 32-bit seed (Comfy / partner default). */
export const SEED_MAX = 2147483647;

/** Clamp any seed into 0..max (default int32). Non-integers and negatives become 0. */
export function seedOf(seed: number, max = SEED_MAX): number {
  if (!Number.isFinite(seed) || seed < 0) return 0;
  const n = Math.trunc(seed);
  if (n <= max) return n;
  return n % (max + 1);
}

/** Fresh random seed in 0..max, safe for partner API nodes. */
export function randomSeed(max = SEED_MAX): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return seedOf(buf[0], max);
}
