// How many tools the studio shows with the default settings: one card per tool in the catalogue,
// plus « Maquette 3D et cadrage » and « Repérer un lieu » (3D row, outside the catalogue).
// Kept as a tiny constant so the home page does not ship the catalogue;
// tests/outils-nombre.test.ts fails as soon as the catalogue and this number disagree.

/** Tools outside the catalogue that sit in the 3D row. */
export const OUTILS_HORS_CATALOGUE = 2;

/** Total shown by the studio rail and the home page (default settings). */
export const NOMBRE_OUTILS = 44;
