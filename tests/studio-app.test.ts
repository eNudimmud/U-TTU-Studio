import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import manifest from "../src/app/manifest.ts";
import { GUIDE_LINES, nextMoment } from "../src/lib/guide.ts";
import { FAMILLES } from "../src/lib/outils/catalogue.ts";
import { HOME_HASH } from "../src/lib/studio-boot.ts";
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
    // « Créer » is a bottom tab: an old #creer link lands on it, never on Film (CAST).
    assert.equal(tabFromLocation("#creer", ""), "outils");
    assert.equal(tabFromLocation("#créer", ""), "outils");
    assert.equal(tabFromLocation("#photos", ""), "look");
    assert.equal(tabFromLocation("#plateau", ""), "scene");
    assert.equal(tabFromLocation("#lieu", ""), "scene");
    assert.equal(tabFromLocation("#lieux", ""), "scene");
    assert.equal(tabFromLocation("#Lieu", ""), "scene");
    assert.equal(tabFromLocation("#place", ""), "scene");
    assert.equal(tabFromLocation("#places", ""), "scene");
    assert.equal(tabFromLocation("#finaliser", ""), "finaliser");
    assert.equal(tabFromLocation("#finish", ""), "finaliser");
    assert.equal(tabFromLocation("#look", ""), "look");
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
    assert.match(read("src/app/studio/legacy/page.tsx"), /home="\/studio\/legacy"/);
    assert.doesNotMatch(read("src/app/studio/page.tsx"), /LegacyStudioRedirect/);
    assert.doesNotMatch(read("src/components/app/studio-app.tsx"), /Tous les outils|Uttu Agent|Mes créations/);
    const rail = read("src/components/app/studio-nav.tsx");
    assert.doesNotMatch(rail, /data-rail-fam=\{fam\}[^>]*#outils\/tous|#outils\/tous[^>]*data-rail-fam/);
    for (const fam of FAMILLES) {
      assert.match(rail, new RegExp(`familyHash\\(fam\\)`));
      assert.equal(HOME_HASH.test(`#outils/${fam}`), true, fam);
      assert.equal(tabFromLocation(`#outils/${fam}`, ""), "outils");
    }
    assert.equal(HOME_HASH.test("#outils/tous"), true);
    assert.equal(HOME_HASH.test("#lieu"), false);
    assert.match(read("src/components/landing/legacy-hash.tsx"), /"lieu"/);
  });





  it("installs as an app that opens on the next gesture", () => {
    const app = manifest();
    assert.equal(app.display, "standalone");
    assert.equal(app.start_url, "/studio");
    assert.equal(app.theme_color, "#0F0F11");
    assert.ok(app.icons?.some(icon => icon.purpose === "maskable"));
  });
});
