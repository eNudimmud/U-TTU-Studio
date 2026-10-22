import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SEMANTIC_MODEL_ENABLED } from "../src/lib/agent/semantic-flag.ts";

test("the third-party model (Jev / TypeSafe) is off for the submission", () => {
  assert.equal(SEMANTIC_MODEL_ENABLED, false);
  const panel = readFileSync("src/components/app/assistant-panel.tsx", "utf8");
  assert.match(panel, /\{SEMANTIC_MODEL_ENABLED && <details><summary>\{t\('agent\.model'\)\}/);
  const route = readFileSync("src/app/studio-agent/interpret/route.ts", "utf8");
  assert.match(route, /if \(!SEMANTIC_MODEL_ENABLED\) return Response\.json\(\{ error: 'disabled' \}, \{ status: 404/);
});
