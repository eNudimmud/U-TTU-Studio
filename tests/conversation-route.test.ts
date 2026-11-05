import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { conversationEngine, routerChatAllowed } from "../src/lib/agent/conversation-route.ts";

test("open-weights conversation uses Qwen3-VL and never the hosted router", () => {
  assert.equal(conversationEngine(true), "native-qwen3vl");
  assert.equal(routerChatAllowed(true), false);
});

test("with open-weights off, the panel's Comfy conversation is the router", () => {
  assert.equal(conversationEngine(false), "router-gpt5-nano");
  assert.equal(routerChatAllowed(false), true);
});

test("the panel asks the engine before any chat POST, and the plan focus can refuse", () => {
  const panel = readFileSync(new URL("../src/components/app/assistant-panel.tsx", import.meta.url), "utf8");
  const uttu = readFileSync(new URL("../src/components/app/uttu-free.tsx", import.meta.url), "utf8");
  assert.match(panel, /mayFocusPlanField\(document\.activeElement, node\)/);
  assert.match(uttu, /comfy && routerChatAllowed\(OPEN_WEIGHTS_MODE\)/);
});
