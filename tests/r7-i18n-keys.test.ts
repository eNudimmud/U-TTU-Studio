import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = join(import.meta.dirname, "..");
const fr = JSON.parse(readFileSync(join(root, "messages/fr.json"), "utf8")) as Record<string, unknown>;

function hasKey(catalog: Record<string, unknown>, dotted: string): boolean {
  let cur: unknown = catalog;
  for (const part of dotted.split(".")) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur) || !(part in (cur as object))) return false;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" || typeof cur === "number";
}

/** Collect static `r7.…` keys from t("…") / t(`…`) in studio sources. */
function usedR7Keys(): string[] {
  const dirs = ["src/components", "src/lib"];
  const keys = new Set<string>();
  const re = /\bt\(\s*[`"'](r7\.[a-zA-Z0-9_.]+)[`"']/g;
  const reTpl = /\bt\(\s*`(r7\.[a-zA-Z0-9_.$\{\}]+)`/g;
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
        const text = readFileSync(path, "utf8");
        for (const m of text.matchAll(re)) keys.add(m[1]!);
        for (const m of text.matchAll(reTpl)) {
          const raw = m[1]!;
          // Expand known dynamic cadrage / tuile branches to concrete keys.
          if (raw.includes("${")) {
            if (raw.startsWith("r7.cadrage.")) {
              for (const c of ["large", "americain", "moyen", "gros", "tgp", "plongee", "contre"]) {
                keys.add(`r7.cadrage.${c}`);
              }
            } else if (raw.startsWith("r7.tuile.")) {
              // leave dynamic tuile.* — covered by catalogue elsewhere; skip bare template
            }
          } else {
            keys.add(raw);
          }
        }
      }
    }
  }
  for (const d of dirs) walk(join(root, d));
  return [...keys].sort();
}

describe("clés r7 dans le dictionnaire FR", () => {
  it("échoue si une clé r7.* utilisée manque dans messages/fr.json", () => {
    const used = usedR7Keys();
    const missing = used.filter(key => !hasKey(fr, key));
    assert.deepEqual(missing, [], `clés r7 manquantes dans FR: ${missing.join(", ")}`);
  });
});
