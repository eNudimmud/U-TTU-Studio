import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { holdNextScripts } from "../src/lib/hold-scripts.ts";

describe("holdNextScripts", () => {
  it("keeps the chunk tag from running before the first paint", () => {
    const html = [
      '<script src="/_next/static/chunks/794-abc.js" async=""></script>',
      '<script src="/_next/static/chunks/webpack-def.js" id="_R_" async=""></script>',
      '<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/webpack-def.js"/>',
      '<script src="/_next/static/chunks/polyfills-abc.js" noModule=""></script>',
      '<script>self.__next_f.push([1,"<script src=\\"/_next/static/chunks/nope.js\\"></script>"])</script>',
    ].join("");
    const out = holdNextScripts(html);
    assert.doesNotMatch(out, /rel="preload" as="script" href="\/_next\/static\/chunks\/794-abc\.js"/);
    assert.match(out, /<script type="text\/plain" data-u-src="\/_next\/static\/chunks\/794-abc\.js"><\/script>/);
    assert.doesNotMatch(out, /<script src="\/_next\/static\/chunks\/794-abc\.js"/);
    assert.doesNotMatch(out, /rel="preload" as="script"/);
    assert.match(out, /data-u-src="\/_next\/static\/chunks\/webpack-def\.js" data-u-id="_R_"/);
    assert.match(out, /<script src="\/_next\/static\/chunks\/polyfills-abc\.js" noModule=""><\/script>/);
    assert.match(out, /self\.__next_f\.push/);
  });
});
