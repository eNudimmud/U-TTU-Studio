import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const FAL = /(^|[^\w-])fal([^\w-]|$)|fal\.ai|fal-ai|fal\.run|fal\.media/i;
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => { const p = join(dir, name); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : []; });
}

test("README and docs/ no longer mention fal (Comfy only)", () => {
  const hits = ["README.md", ...walk("docs")].filter(file => FAL.test(readFileSync(file, "utf8")));
  assert.deepEqual(hits, []);
});
