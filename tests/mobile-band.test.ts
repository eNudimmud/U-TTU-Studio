import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { liftDelta } from "../src/lib/mobile-band.ts";

describe("bande mobile, 390 px", () => {
  it("scrolls a field that the chain or the keyboard would cover", () => {
    assert.equal(liftDelta({ top: 100, bottom: 160 }, 80, 400), 0);
    assert.equal(liftDelta({ top: 420, bottom: 480 }, 80, 387), 93);
    assert.equal(liftDelta({ top: 10, bottom: 60 }, 80, 387), -70);
    assert.equal(liftDelta({ top: 100, bottom: 500 }, 80, 387), 20);
    assert.equal(liftDelta({ top: 10, bottom: 40 }, 80, 40), 0);
  });

  it("keeps touch targets and wrapping on the phone skin", () => {
    const css = readFileSync("src/components/app/app.css", "utf8");
    assert.match(css, /\.u-guide-actions \.u-link \{ min-height: 44px/);
    assert.match(css, /\.u-fiches-nav \{ min-height: 44px/);
    assert.match(css, /\.u-comfort-gaps \.u-link \{ min-height: 44px/);
    assert.match(css, /\.u-scene span:last-child \{[^}]*white-space: normal/);
    assert.match(css, /\.u-pair figcaption \{[^}]*white-space: normal/);
    assert.match(css, /scroll-margin-bottom: calc\(148px \+ var\(--u-safe\)\)/);
    assert.doesNotMatch(css, /\.u-comfort-gaps \.u-link \{ min-height: 0/);
    const app = readFileSync("src/components/app/studio-app.tsx", "utf8");
    assert.match(app, /liftDelta/);
    assert.match(app, /scrollBehavior = "auto"/);
    assert.match(css, /\.u-guide-line \{ min-height: 4\.2em/);
    assert.match(readFileSync("src/components/app/scene-screen.tsx", "utf8"), /\{ready && <>/);
    assert.match(readFileSync("src/components/app/screens.tsx", "utf8"), /\{ready && <>/);
    assert.match(app, /from "\.\/studio-frames"/);
    assert.match(app, /<CastStage /);
    assert.match(app, /\/mon-studio/);
    assert.doesNotMatch(app, /<StudioDrawer /);
    assert.match(css, /\.u-chain \{[^}]*bottom: 0/);
    assert.match(readFileSync("src/app/layout.tsx", "utf8"), /interactiveWidget: "resizes-content"/);
    const full = statSync("public/images/uttu-canon-portrait.webp").size;
    const face = statSync("public/images/uttu-guide-face.webp").size;
    assert.ok(face < 40_000, `guide face stays small (${face})`);
    assert.ok(face < full / 4, "the bubble does not load the full portrait");
  });
});