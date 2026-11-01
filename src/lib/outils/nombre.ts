// How many tools the studio shows with the default settings: one card per tool in the catalogue,
// plus « Maquette 3D et cadrage » and « Repérer un lieu » (3D row, outside the catalogue).
// Kept as tiny constants so the home page does not ship the catalogue;
// tests/outils-nombre.test.ts fails as soon as the catalogue and these numbers disagree.

import { OPEN_WEIGHTS_MODE } from "../open-weights.ts";

/** Tools outside the catalogue that sit in the 3D row. */
export const OUTILS_HORS_CATALOGUE = 2;

/** Every tool, partner models included (build with NEXT_PUBLIC_OPEN_WEIGHTS_MODE=off). */
export const NOMBRE_OUTILS_TOUS = 44;

/** Open-weights mode (default build): partner-node tools are hidden. */
export const NOMBRE_OUTILS_OPEN_WEIGHTS = 33;

/** Total shown by the studio rail and the home page for this build. */
export const NOMBRE_OUTILS = OPEN_WEIGHTS_MODE ? NOMBRE_OUTILS_OPEN_WEIGHTS : NOMBRE_OUTILS_TOUS;
