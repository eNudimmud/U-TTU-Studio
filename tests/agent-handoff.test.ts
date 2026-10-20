import test from "node:test";
import assert from "node:assert/strict";
import { resolveStudioHandoff } from "../src/lib/agent/handoff.ts";

test("restores a vault-backed blob preview by its saved path", () => {
  assert.equal(resolveStudioHandoff({ url: "", path: "assets/42.png", kind: "image", name: "42.png" }, {
    "assets/42.png": "blob:https://studio.example/current-document",
  }), "blob:https://studio.example/current-document");
});
test("does not confuse a vault path with a directly usable URL", () => {
  assert.equal(resolveStudioHandoff({ url: "", path: "assets/missing.png", kind: "image", name: "missing.png" }, {}), undefined);
});
test("falls back to a durable URL and rejects unsafe previews", () => {
  assert.equal(resolveStudioHandoff({ url: "/assets/image.png", kind: "image", name: "image.png" }, {}), "/assets/image.png");
  assert.equal(resolveStudioHandoff({ url: "data:image/png;base64,AAAA", kind: "image", name: "image.png" }, {}), undefined);
});
