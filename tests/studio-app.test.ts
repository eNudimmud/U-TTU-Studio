import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import manifest from "../src/app/manifest.ts";
import { GUIDE_LINES, nextMoment } from "../src/lib/guide.ts";
import { resumeTab, tabFromLocation } from "../src/lib/studio-route.ts";

const read = (path: string) => readFileSync(path, "utf8");
const catalog = read("messages/fr.json");
const appFiles = readdirSync("src/components/app").filter(name => name.endsWith(".tsx")).map(name => `src/components/app/${name}`);

describe("le studio, une app", () => {
  it("opens on the next gesture and keeps old links working", () => {
    assert.equal(tabFromLocation("", ""), null);
    assert.equal(resumeTab({ lookReady: false, hasScene: true }), "lora");
    assert.equal(resumeTab({ lookReady: true, hasScene: false }), "scene");
    assert.equal(resumeTab({ lookReady: true, hasScene: true }), "prise");
    assert.equal(tabFromLocation("", "?step=look"), "look");
    assert.equal(tabFromLocation("#creer", ""), "look");
    assert.equal(tabFromLocation("#photos", ""), "look");
    assert.equal(tabFromLocation("#plateau", ""), "scene");
    assert.equal(tabFromLocation("#Take", ""), "prise");
    assert.equal(tabFromLocation("#sphère", ""), "sphere");
    assert.equal(tabFromLocation("#fiches", ""), "fiches");
    assert.equal(tabFromLocation("#fiche", ""), "fiches");
    assert.equal(tabFromLocation("#lora", ""), "lora");
    assert.equal(tabFromLocation("#personnage", ""), "lora");
    assert.equal(tabFromLocation("#rôle", ""), "lora");
    assert.equal(tabFromLocation("#Former", ""), "lora");
    assert.equal(tabFromLocation("#compte", ""), null);
    assert.equal(tabFromLocation("#montage", ""), "montage");
    assert.equal(tabFromLocation("#monter", ""), "montage");
    assert.equal(tabFromLocation("#edit", ""), "montage");
    assert.equal(tabFromLocation("#inconnu", "?step=prise"), "prise");
    assert.match(read("src/app/studio/page.tsx"), /<StudioApp initialTab=\{initialTab\} \/>/);
  });





  it("installs as an app that opens on the next gesture", () => {
    const app = manifest();
    assert.equal(app.display, "standalone");
    assert.equal(app.start_url, "/studio");
    assert.equal(app.theme_color, "#0F0F11");
    assert.ok(app.icons?.some(icon => icon.purpose === "maskable"));
  });
});
