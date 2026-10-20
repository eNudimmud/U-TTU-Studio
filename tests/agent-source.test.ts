import test from "node:test";
import assert from "node:assert/strict";
import { agentSourceId } from "../src/lib/agent/source.ts";

test("keeps a Studio vault path even when preview is a blob URL", () => {
  assert.equal(agentSourceId({ url: "blob:https://studio.example/abc", path: "Projets/demo/asset.png" }), "Projets/demo/asset.png");
});
test("rejects temporary blob URLs without a durable asset path", () => {
  assert.equal(agentSourceId({ url: "blob:https://studio.example/abc" }), undefined);
});
test("allows persistable URLs and rejects empty references", () => {
  assert.equal(agentSourceId({ url: "/assets/sample.png" }), "/assets/sample.png");
  assert.equal(agentSourceId({ url: "" }), undefined);
});
