import test from "node:test";
import assert from "node:assert/strict";
import { agentSourceId, safeHandoffUrl } from "../src/lib/agent/source.ts";

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

test("rejects data and filesystem previews as durable references", () => {
  assert.equal(agentSourceId({ url: "data:image/png;base64,AAAA" }), undefined);
  assert.equal(agentSourceId({ url: "filesystem:https://studio.example/temporary/image" }), undefined);
});

test("handoff strips temporary previews but preserves durable URL references", () => {
  for (const url of ["blob:https://studio.example/a", "data:image/png;base64,AAAA", "filesystem:https://studio.example/a", "javascript:alert(1)"]) {
    assert.equal(safeHandoffUrl(url), "");
  }
  assert.equal(safeHandoffUrl("/assets/real.png"), "/assets/real.png");
});
