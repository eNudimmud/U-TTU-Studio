import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { X_COMPOSER, X_DIRECT_NEEDS, X_TEXT_MAX, clipForX, shareableFile, takeCaption, xComposerUrl, xLength } from "../src/lib/share.ts";

describe("publier une prise", () => {
  it("writes a plain caption from the take and the place", () => {
    assert.equal(takeCaption({ line: "Elle traverse le quai.", place: "Quai, nuit" }), "Elle traverse le quai — Quai, nuit. Tourné dans U*TTU Studio.");
    assert.equal(takeCaption({ line: "  ", place: "" }), "Tourné dans U*TTU Studio.");
    assert.equal(takeCaption({ place: "Serre" }), "Serre. Tourné dans U*TTU Studio.");
  });

  it("counts like X and opens X's own composer", () => {
    assert.equal(xLength("a https://example.com/a/very/long/path b"), 2 + 23 + 2);
    assert.equal(xLength("été"), 3);
    assert.equal([...clipForX("x".repeat(400))].length, X_TEXT_MAX);
    const url = new URL(xComposerUrl("Quai & pluie #1"));
    assert.equal(`${url.origin}${url.pathname}`, X_COMPOSER);
    assert.equal(url.searchParams.get("text"), "Quai & pluie #1");
    assert.equal(X_COMPOSER, "https://x.com/intent/post");
    assert.deepEqual([...X_DIRECT_NEEDS], ["X_CLIENT_ID", "X_CLIENT_SECRET"]);
  });

  it("accepts a take file and refuses anything else", () => {
    assert.equal(shareableFile({ type: "video/mp4", size: 1024 }), true);
    assert.equal(shareableFile({ type: "image/png", size: 1024 }), true);
    assert.equal(shareableFile({ type: "application/pdf", size: 1024 }), false);
    assert.equal(shareableFile({ type: "video/mp4", size: 0 }), false);
    assert.equal(shareableFile({ type: "video/mp4", size: 600 * 1024 * 1024 }), false);
  });

  it("posts only through a tap, never through an API, and leaves direct posting off", () => {
    const post = readFileSync("src/components/studio/post-take.tsx", "utf8");
    assert.doesNotMatch(post, /fetch\(|XMLHttpRequest|api\.x\.com|api\.twitter\.com|upload\.twitter\.com/);
    assert.match(post, /navigator\.share\(payload\)/);
    assert.ok(post.indexOf("async function share()") < post.indexOf("navigator.share(payload)"), "share runs only in the click handler");
    assert.match(post, /xComposerUrl\(words\)/);
    assert.match(post, /rel="noopener noreferrer"/);
    assert.match(post, /disabled aria-describedby/);
    assert.match(post, /Publier sans quitter le studio/);
  });
});
