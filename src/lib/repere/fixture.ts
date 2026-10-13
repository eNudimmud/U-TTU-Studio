// A real-shaped block used when the studio is in demo, and by the tests.
// The live app still asks Overpass and Terrarium for any other place.

import type { Quartier } from "./quartier.ts";
import type { LieuTrouve } from "./lieu.ts";

const RELIEF = [
  1.2, 1.1, 0.8, 0.6, 0.4, 0.2, 0, -0.2, -0.4,
  1, 0.8, 0.6, 0.4, 0.2, 0, -0.1, -0.3, -0.4,
  0.6, 0.5, 0.3, 0.2, 0, 0, 0, -0.2, -0.3,
  0.3, 0.2, 0.1, 0, 0, 0, 0, -0.1, -0.2,
  0.1, 0, 0, 0, 0, 0, 0, 0, -0.1,
  0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.2,
  -0.2, -0.1, 0, 0, 0.1, 0.2, 0.3, 0.4, 0.4,
  -0.4, -0.3, -0.1, 0, 0.2, 0.4, 0.6, 0.7, 0.8,
  -0.6, -0.4, -0.2, 0, 0.3, 0.6, 0.8, 1, 1.1,
];

export function fixtureQuartier(place: LieuTrouve, heading = 0, tilt = 0): Quartier {
  return {
    name: place.name,
    lat: place.lat,
    lon: place.lon,
    heading,
    tilt,
    stand: { x: 0, z: 0 },
    buildings: [
      { ring: [[-22, 4], [-8, 4], [-8, 16], [-22, 16]], height: 14 },
      { ring: [[-6, 4], [8, 4], [8, 18], [-6, 18]], height: 24 },
      { ring: [[10, 4], [22, 4], [22, 14], [10, 14]], height: 11 },
      { ring: [[-20, -16], [-4, -16], [-4, -5], [-20, -5]], height: 16 },
      { ring: [[-2, -18], [12, -18], [12, -5], [-2, -5]], height: 30 },
      { ring: [[14, -14], [24, -14], [24, -5], [14, -5]], height: 12 },
    ],
    streets: [
      { points: [[-28, 0], [28, 0]], width: 8 },
      { points: [[0, -22], [0, 22]], width: 6 },
    ],
    relief: { n: 9, span: 56, samples: RELIEF },
    source: "osm",
  };
}
