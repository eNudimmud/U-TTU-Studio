// CE5: the answer contract given to the model and the parser come from one module; the example in the
// prompt is itself a valid answer for the parser.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CADRAGES, CAMERAS, DUREES, FORMATS, INTENT_EXAMPLE, PAROLES, PREPARE_OUTPUTS, RENDUS, ROLES } from "../src/lib/cinema/intent-schema.ts";
import { INTENT_SYSTEM_PROMPT } from "../src/lib/cinema/intent-workflow.ts";
import { parseIntent } from "../src/lib/cinema/intent.ts";
import type { IntentContext } from "../src/lib/cinema/types.ts";

const CONTEXT: IntentContext = {
  scope: { projectId: "demo", storyboardId: "b1" }, locale: "fr", selectedShotId: "s1", storyboardRevision: 0,
  shots: [{ shotId: "s1", revision: 0, index: 0, titre: "Quai", action: "Sujet A attend", archived: false, lockedFields: [] }],
  references: [], capabilities: [], narrative: "",
};

describe("intent schema", () => {
  it("the prompt example, with real ids, is a valid answer", () => {
    const raw = JSON.stringify(INTENT_EXAMPLE).replaceAll("<projectId>", "demo").replaceAll("<storyboardId>", "b1").replaceAll("<shotId>", "s1");
    const parsed = parseIntent(raw, CONTEXT, { operationId: "op-1", source: "conversation", userText: "serre ce plan" });
    assert.equal(parsed.status, "valid", JSON.stringify(parsed));
  });

  it("every enum the parser accepts is written in the system prompt", () => {
    const prompt = INTENT_SYSTEM_PROMPT;
    for (const value of [...CADRAGES, ...CAMERAS, ...DUREES.map(String), ...FORMATS, ...RENDUS, ...PAROLES, ...ROLES, ...PREPARE_OUTPUTS]) {
      assert.ok(prompt.includes(String(value)), `missing ${value}`);
    }
    assert.match(prompt, /exactly one JSON object/);
    assert.match(prompt, /CONTEXT\.selected/);
  });
});
