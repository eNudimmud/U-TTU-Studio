import assert from "node:assert/strict";
import test from "node:test";
import { keyframeGraph, KEYFRAME_QUOTE } from "../src/lib/creation/keyframe.ts";
import { coverageCredits, coverageLayers } from "../src/lib/repere/couverture.ts";
import { mapillaryTileUrl, nearestImageIds, tilesAround } from "../src/lib/repere/mapillary.ts";
import { cameraTravel } from "../src/lib/prise/camera-travel.ts";

test("coverage names Panoramax, and Mapillary only with a token, never the token itself", () => {
  assert.deepEqual(coverageLayers("").map(layer => layer.id), ["panoramax"]);
  const withToken = coverageLayers("public-token");
  assert.deepEqual(withToken.map(layer => layer.id), ["panoramax", "mapillary"]);
  assert.match(coverageCredits("public-token"), /Panoramax/);
  assert.match(coverageCredits("public-token"), /Mapillary/);
  assert.equal(coverageCredits("public-token").includes("public-token"), false);
});

test("Mapillary tiles stay inside the radius and keep the nearest image ids", () => {
  const tileOf = (lat: number, lon: number) => ({ x: Math.round(lon), y: Math.round(lat) });
  const tiles = tilesAround(46.5, 6.6, 200, tileOf);
  assert.ok(tiles.length >= 1 && tiles.length <= 4);
  assert.equal(tiles.every(tile => tile.z === 14), true);
  assert.match(mapillaryTileUrl(14, 1, 2, "abc"), /access_token=abc/);
  assert.deepEqual(nearestImageIds([
    { id: "12", lat: 46.52, lon: 6.63 },
    { id: "99", lat: 0, lon: 0 },
    { id: "bad", lat: 46.52, lon: 6.63 },
  ], 46.52, 6.63, 500), ["12"]);
});

test("a key frame names the cast then the place and does not call the network", () => {
  const graph = keyframeGraph({ prompt: "Uttu attend sur le quai", images: ["a.png", "b.png", "c.png", "lieu.png", "extra.png"], seed: 7 });
  const loads = Object.values(graph).filter(node => node.class_type === "LoadImage").map(node => node.inputs.image);
  assert.deepEqual(loads, ["a.png", "b.png", "c.png", "lieu.png"]);
  assert.match(JSON.stringify(graph), /Vertical 9:16 framing/);
  assert.match(JSON.stringify(graph), /First frame of a film shot/);
  assert.equal(KEYFRAME_QUOTE.kind, "hypothese");
  assert.throws(() => keyframeGraph({ prompt: "x", images: ["only.png"], seed: 1 }), /personnage et du décor/);
});

test("camera distance and angle are read in four languages and clamped", () => {
  assert.equal(cameraTravel("travelling arrière de 5 m").meters, 5);
  assert.equal(cameraTravel("dolly out 5 meters").meters, 5);
  assert.equal(cameraTravel("Rückfahrt 5 m").meters, 5);
  assert.equal(cameraTravel("travelling hacia atrás de 5 metros").meters, 5);
  assert.equal(cameraTravel("orbit 90 degrees to the left").degrees, 90);
  const far = cameraTravel("travelling arrière de 40 m");
  assert.equal(far.meters, 20);
  assert.equal(far.clamped, true);
});
