import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { EXEMPLE_GALERIE, exempleById, nearestExemple, thumbSrcSet } from "../src/lib/creation/exemple-galerie.ts";
import { planSend, type FilRef } from "../src/lib/barre/thread.ts";
import { DEFAULT_SETTINGS } from "../src/lib/barre/model.ts";

describe("accueil v2 galerie", () => {
  it("lists the approved v2 cards with real batch renders", () => {
    assert.equal(EXEMPLE_GALERIE.length, 8);
    assert.ok(exempleById("uttu-quai")?.video?.includes("prise-uttu-quai.mp4"));
    assert.ok(exempleById("hall-anime")?.video?.includes("wan-gare.mp4"));
    assert.ok(exempleById("rue-aube")?.img.includes("apres-decor-heure"));
    assert.ok(exempleById("quai-regard")?.img.includes("apres-decor-photo"));
  });

  it("picks a nearest example for the quote card when Comfy is unlinked", () => {
    assert.equal(nearestExemple({ mode: "video", tool: "prise", hasRefs: true }).id, "uttu-quai");
    assert.equal(nearestExemple({ mode: "video", tool: "vid-wan", hasRefs: true }).id, "hall-anime");
    assert.equal(nearestExemple({ mode: "image", hasRefs: true }).id, "rue-aube");
    assert.equal(nearestExemple({ mode: "image", hasRefs: false }).id, "quai");
  });

  it("exposes 640w thumbs for the first paint (P0-6)", () => {
    const first = EXEMPLE_GALERIE[0]!;
    assert.match(first.thumb, /-640\.webp$/);
    assert.match(thumbSrcSet(first.thumb, first.img), /640w/);
    for (const card of EXEMPLE_GALERIE) {
      const thumb = card.thumb.startsWith("/") ? `public${card.thumb}` : card.thumb;
      // poster jpgs are fine without -640; webp thumbs should exist when referenced as -640
      if (card.thumb.endsWith("-640.webp")) {
        assert.ok(readFileSync(thumb).byteLength > 1000, card.thumb);
      }
    }
  });

  it("keeps every video chip and routes vaulted cast+décor to PRISE (P0-2)", () => {
    const base = { text: "Uttu marche", last: null, lastName: "dernier", settings: DEFAULT_SETTINGS };
    const uttu: FilRef = { kind: "cast", id: "ex-uttu", name: "Uttu", src: "/a.webp", path: "Projets/p/Cast/ex-uttu.webp", vault: true };
    const quai: FilRef = { kind: "decor", id: "ex-quai", name: "Quai", src: "/b.webp", path: "Projets/p/Decors/ex-quai.webp", vault: true };
    const p = planSend({ ...base, mode: "video", refs: [uttu, quai] });
    assert.equal(p.kind === "run" && p.route.kind, "prise");
    assert.ok(p.kind === "run");
    assert.deepEqual(p.refs.map(r => r.id), ["ex-uttu", "ex-quai"]);

    const demo: FilRef = { kind: "cast", id: "demo-dj", name: "DJ", src: "/exemples/cast-dj.webp" };
    const decor: FilRef = { kind: "decor", id: "demo-quai", name: "Quai", src: "/exemples/decor-quai-nuit.webp" };
    const wan = planSend({ ...base, mode: "video", refs: [demo, decor] });
    assert.ok(wan.kind === "run" && wan.route.kind === "outil" && wan.route.id === "vid-wan");
    // All chips kept even when Animer falls back on the first picture.
    assert.deepEqual(wan.refs.map(r => r.id), ["demo-dj", "demo-quai"]);
  });

  it("wires the home to ToolShell / ToolStage and the gallery (no old Idées row)", () => {
    const home = readFileSync("src/components/app/studio-entry.tsx", "utf8");
    assert.match(home, /data-barre-v2/);
    assert.match(home, /ToolShell/);
    assert.match(home, /ToolStage/);
    assert.match(home, /ExempleGalerieGrid/);
    assert.match(home, /promoteExempleRefs/);
    assert.doesNotMatch(home, /u-barre-ideas/);
    assert.doesNotMatch(home, /const IDEAS/);
  });

  it("tutoiement, crédits, nothing free — in every locale", () => {
    for (const lang of ["fr", "en", "de", "es"]) {
      const barre = JSON.parse(readFileSync(`messages/${lang}.json`, "utf8")).barre;
      assert.ok(barre.galerie?.title);
      assert.ok(barre.galerie?.uttuQuai?.title);
      assert.doesNotMatch(JSON.stringify(barre.galerie), /gratuit|free|kostenlos|gratis/i);
      if (lang === "fr") {
        assert.match(barre.galerie.route, /\bTu\b|\bton\b|\bta\b|\btoi\b/i);
        assert.match(barre.galerie.lead, /\bTouche\b/);
      }
    }
  });
});

describe("outil shell (PR B)", () => {
  it("puts Retoucher and Finaliser on ToolShell, with compare default for Finaliser", () => {
    const hub = readFileSync("src/components/app/outils-hub.tsx", "utf8");
    assert.match(hub, /SHELL_COMPARE/);
    assert.match(hub, /ret-finaliser/);
    assert.match(hub, /ToolShell/);
    assert.match(hub, /compare \? "compare"/);
    const shell = readFileSync("src/components/app/tool-shell.tsx", "utf8");
    assert.match(shell, /data-tool-wipe/);
    assert.match(shell, /--wipe/);
  });

  it("marks DÉCOR and PRISE as on the coque", () => {
    const decor = readFileSync("src/components/app/stage-screens.tsx", "utf8");
    assert.match(decor, /ToolShell/);
    assert.match(decor, /ToolStage/);
    const prise = readFileSync("src/components/app/prise-stage.tsx", "utf8");
    assert.match(prise, /data-prise-shell/);
  });
});
