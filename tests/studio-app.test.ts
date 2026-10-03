import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import manifest from "../src/app/manifest.ts";
import { GUIDE_LINES, nextMoment } from "../src/lib/guide.ts";
import { resumeTab, tabFromLocation } from "../src/lib/studio-route.ts";

const read = (path: string) => readFileSync(path, "utf8");
const appFiles = readdirSync("src/components/app").filter(name => name.endsWith(".tsx")).map(name => `src/components/app/${name}`);

describe("le studio, une app", () => {
  it("opens on the next gesture and keeps old links working", () => {
    assert.equal(tabFromLocation("", ""), null);
    assert.equal(resumeTab({ lookReady: false, hasScene: true }), "look");
    assert.equal(resumeTab({ lookReady: true, hasScene: false }), "scene");
    assert.equal(resumeTab({ lookReady: true, hasScene: true }), "prise");
    assert.equal(tabFromLocation("", "?step=look"), "look");
    assert.equal(tabFromLocation("#creer", ""), "look");
    assert.equal(tabFromLocation("#plateau", ""), "scene");
    assert.equal(tabFromLocation("#Take", ""), "prise");
    assert.equal(tabFromLocation("#sphère", ""), "sphere");
    assert.equal(tabFromLocation("#compte", ""), "compte");
    assert.equal(tabFromLocation("#inconnu", "?step=prise"), "prise");
    assert.match(read("src/app/studio/page.tsx"), /<StudioApp \/>/);
  });

  it("finishes a take inside the app: no Comfy tab, no Comfy frame as the studio", () => {
    for (const file of appFiles) {
      const text = read(file);
      assert.doesNotMatch(text, /cloud\.comfy\.org|comfy-embed|run_template/, file);
      assert.doesNotMatch(text, /@clerk\//, `${file} stays off Clerk`);
    }
    const context = read("src/components/app/studio-context.tsx");
    assert.match(context, /submitTake\(/);
    assert.match(context, /followTake\(/);
    assert.match(context, /saveInFlight\(localStorage, flight\)/, "a queued take survives a reload");
    assert.ok(context.indexOf("runGate(fresh, claim)") < context.indexOf("submitTake("), "the balance is re-read and gated before anything is sent");
    const sheets = read("src/components/app/sheets.tsx");
    assert.match(sheets, /Tourner · débit sur mon compte/);
    assert.match(sheets, /disabled=\{!gate\.allowed\}/);
  });

  it("publishes from the result, with the file, and never posts by itself", () => {
    const publish = read("src/components/app/publish.tsx");
    assert.match(publish, /navigator\.share\(\{ files: \[/);
    assert.ok(publish.indexOf("async function share()") < publish.indexOf("navigator.share({ files"), "share runs only on the tap");
    assert.match(publish, /xComposerUrl\(caption\)/);
    assert.doesNotMatch(publish, /fetch\("https|api\.x\.com|api\.twitter\.com|upload\.twitter\.com/);
  });

  it("lets U*TTU guide in one short line, with her canon face", () => {
    for (const [moment, line] of Object.entries(GUIDE_LINES)) {
      assert.ok(line.length <= 80, `${moment} stays short`);
      assert.doesNotMatch(line, /\b(comfy|fal|lora|flux|seedance|night city)\b/i, moment);
    }
    const bubble = read("src/components/app/guide-bubble.tsx");
    assert.match(bubble, /\/images\/uttu-canon-portrait\.webp/, "her face comes from the canon portrait");
    assert.equal(nextMoment(["look-photos", "look-name"], { off: false, seen: ["look-photos"] }), "look-name");
    assert.equal(nextMoment(["look-photos"], { off: true, seen: [] }), null);
    assert.equal(nextMoment([false, null, "take-ready"], { off: false, seen: [] }), "take-ready");
  });

  it("installs as an app that opens on the next gesture", () => {
    const app = manifest();
    assert.equal(app.display, "standalone");
    assert.equal(app.start_url, "/studio");
    assert.equal(app.theme_color, "#0B0A09");
  });
});
