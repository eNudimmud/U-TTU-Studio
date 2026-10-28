// Prepare the image-only A/B validation. No network, no account, no submission.
// node --experimental-strip-types scripts/prepare-prise-cadrage.mjs /tmp/cadrage-a.api.json a
import { writeFileSync } from 'node:fs';
import { ltxTakeGraph } from '../src/lib/render/ltx-graph.ts';
const [output, variant = 'a'] = process.argv.slice(2);
if (!output || !/^[ab]$/.test(variant)) throw new Error('Indique le fichier API de sortie, puis a ou b.');
const graph = ltxTakeGraph({ pictures:['uttu-personnage.png','uttu-decor.png'], prompt:'First frame of a film. The person from image 1 in the place from image 2. Follow the depth and edge controls for the camera and composition. Same face, same outfit. No text.', seed:42, seconds:5, aspect:'horizontal', controls:{depth:`cadrage-${variant}-depth.png`,edges:`cadrage-${variant}-edges.png`} });
const kept = new Set();
function keep(id) {
 if (kept.has(id)) return;
 if (!graph[id]) throw new Error(`Nœud manquant : ${id}`);
 kept.add(id);
 for (const value of Object.values(graph[id].inputs)) if (Array.isArray(value) && typeof value[0] === 'string' && graph[value[0]]) keep(value[0]);
}
keep('control_save');
const still = Object.fromEntries(Object.entries(graph).filter(([id])=>kept.has(id)));
if (Object.values(still).some(n=>/LTX|Video/.test(n.class_type))) throw new Error('La validation doit produire une image seule.');
writeFileSync(output, JSON.stringify(still,null,2)+'\n');
console.log('Image seule : ≈ 12 crédits estimés ; plafond de vérification du solde : 22 crédits.');
console.log('Fichier préparé. Aucun job soumis. Remplace les noms par les fichiers réellement importés avant toute soumission.');
