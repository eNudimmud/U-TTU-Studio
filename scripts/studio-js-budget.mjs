// Gzip of the studio route's page chunk. F34 measured 46 780 bytes (gzip level 9).
// The budget is that size plus about 8 KB, so a clear regression fails and a
// small comment does not.

import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const dir = ".next/static/chunks/app/studio";
const files = readdirSync(dir).filter(name => name.startsWith("page-") && name.endsWith(".js"));
if (files.length !== 1) {
  console.error(`Attendu un chunk app/studio/page-*.js, trouvé ${files.length}.`);
  process.exit(1);
}
const bytes = gzipSync(readFileSync(`${dir}/${files[0]}`), { level: 9 }).length;
const budget = 55_000;
console.log(`${files[0]} gzip ${bytes} octets, budget ${budget}`);
if (bytes > budget) {
  console.error(`Le JS initial du studio dépasse le budget : ${bytes} > ${budget}.`);
  process.exit(1);
}
