// Builds public/agent/knowledge.json: what Uttu (free mode, no model) knows about the studio.
// Sources: the tool catalogue, the gesture registry (cost bounds), the studio tabs, the four
// message catalogs and a short summary of the key docs. Deterministic: same commit, same file.
// Run: node --experimental-strip-types --no-warnings scripts/agent-knowledge.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FAMILLES, OUTILS, outilEtat, outilRow, outilsPublics } from "../src/lib/outils/catalogue.ts";
import { REGISTRE, gesteOuvert } from "../src/lib/workflows/registre.ts";
import { UTTU_LOCALES, buildKnowledge } from "../src/lib/agent/uttu.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const KEY_DOCS = ["docs/STUDIO_AGENT.md", "docs/WORKFLOWS.md", "docs/LEXIQUE.md", "docs/UX-GUIDE.md", "docs/CREDITS.md"];

function commitSha() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { return "local"; }
}

export function knowledge(sha = commitSha()) {
  const byId = new Map(OUTILS.map(tool => [tool.id, tool]));
  const gestures = new Map(REGISTRE.map(row => [row.id, row]));
  return buildKnowledge({
    sha,
    tools: OUTILS,
    toolState: id => outilEtat(byId.get(id)).kind,
    publicTools: outilsPublics().map(tool => tool.id),
    toolRow: id => outilRow(byId.get(id)),
    gestures: REGISTRE,
    gestureOpen: id => gesteOuvert(gestures.get(id)),
    families: FAMILLES,
    messages: Object.fromEntries(UTTU_LOCALES.map(locale => [locale, JSON.parse(readFileSync(join(root, `messages/${locale}.json`), "utf8"))])),
    docs: KEY_DOCS.map(file => ({ file, text: readFileSync(join(root, file), "utf8") })),
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = join(root, "public/agent/knowledge.json");
  mkdirSync(dirname(out), { recursive: true });
  const text = `${JSON.stringify(knowledge())}\n`;
  writeFileSync(out, text);
  console.log(`agent-knowledge: ${out.slice(root.length + 1)} · ${(text.length / 1024).toFixed(1)} KB`);
}
