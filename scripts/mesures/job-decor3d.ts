// Job de mesure P0-3 (voir docs/mesures/decor-3d-2026-10-29.md) : les trois volumes à Redux 0,1, une photo chacun.
// Les noms sont ceux rendus par upload_file de Comfy Cloud. Un seul job, chargeurs partagés.
import { writeFileSync } from "node:fs";
import { decor3dGraph, decor3dPrompt } from "../../src/lib/render/decor-3d.ts";
const cpvue = "99b5b6d972e705573179d58d09fc04d63f3c506956743f9e4a59f3776933350c.jpg", cpphoto = "bd134c4bec8e065c1fa88e200ca148c706e4e86ead780bfdec42a3b3c97c3430.jpg";
const cp = decor3dPrompt({ place: "Central Park, New York, with the Manhattan skyline", photos: 1 });
const cp0 = decor3dPrompt({ place: "Central Park, New York, with the Manhattan skyline", photos: 0 });
const depth = "4a5c9c878332745982c049f66db4bf616505d26e3f2a3ba158ee26a967c9ebf4.png";
const vol = decor3dPrompt({ place: "three buildings on a small paved square", photos: 1 });
const g = decor3dGraph([
  { depth, photos: ["08d7868c0d8dbf3890b3e8e43e4027a5b37081e6bb23f2bd876075303a2f1dda.jpg"], prompt: vol, seed: 11, styleStrength: 0.1 },
  { depth, photos: ["800adc63c24a409b173826649cdf7e3376ddf4e2840bbe1d878f36b6d3b5d7f0.jpg"], prompt: vol, seed: 11, styleStrength: 0.1 },
  { depth, photos: ["4045a3c4d059dd39859a264305f48d4fc2bb7bd53ae6f2e5df48d50d09bf35c1.jpg"], prompt: vol, seed: 11, styleStrength: 0.1 },
]);
writeFileSync(process.argv[2] ?? "job-decor3d.json", JSON.stringify(g, null, 1));
console.log(Object.keys(g).length);
