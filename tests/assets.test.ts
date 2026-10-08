import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assetNote, filterAssets, galleryColumns, looseAssets, readAssetNote, type AssetRecord } from "../src/lib/creation/assets.ts";

function card(patch: Partial<AssetRecord> = {}): AssetRecord {
  return {
    id: "uttu",
    kind: "personnage",
    name: "Uttu",
    at: "2026-10-08T12:00:00.000Z",
    prompt: "Une femme au manteau sombre.",
    geste: "cast-photos",
    template: "api_nano_banana_2_1_image_edit",
    refs: ["Projets/atelier/Cast/uttu-p1.jpg"],
    devis: 12,
    cout: null,
    media: "Projets/atelier/Cast/uttu.png",
    note: "Projets/atelier/Cast/uttu.md",
    preview: null,
    loose: false,
    ...patch,
  };
}

describe("galerie d’assets", () => {
  it("writes a fiche and reads the same gesture, refs and cost back", () => {
    const source = assetNote(card());
    assert.match(source, /type: "cast"/);
    assert.match(source, /geste: "cast-photos"/);
    assert.match(source, /cout: null/);
    const back = readAssetNote("uttu", source);
    assert.equal(back?.name, "Uttu");
    assert.equal(back?.geste, "cast-photos");
    assert.equal(back?.template, "api_nano_banana_2_1_image_edit");
    assert.deepEqual(back?.refs, ["Projets/atelier/Cast/uttu-p1.jpg"]);
    assert.equal(back?.cout, null);
    assert.equal(back?.devis, 12);
    assert.equal(back?.kind, "personnage");
  });

  it("brings a loose vault file back and skips it once a note exists", () => {
    const paths = ["Projets/atelier/Assets/photo.png", "Projets/autre/Assets/photo.png"];
    const loose = looseAssets(paths, "atelier");
    assert.equal(loose.length, 1);
    assert.equal(loose[0]?.media, "Projets/atelier/Assets/photo.png");
    assert.equal(loose[0]?.kind, "importe");
    assert.equal(loose[0]?.loose, true);
    const noted = looseAssets([...paths, "Projets/atelier/Assets/photo.md"], "atelier");
    assert.equal(noted.length, 0);
    assert.equal(looseAssets(["Projets/atelier/Cast/canon.md", "Projets/atelier/Cast/canon.png"], "atelier").length, 0);
  });

  it("filters by kind and keeps every card on a scrolling grid", () => {
    const rows = [card(), card({ id: "quai", kind: "decor", name: "Quai" })];
    assert.equal(filterAssets(rows, "decor", "").length, 1);
    assert.equal(filterAssets(rows, "tout", "uttu").length, 1);
    assert.equal(galleryColumns(360), 1);
    assert.equal(galleryColumns(390), 2);
    assert.equal(galleryColumns(768), 3);
    assert.equal(galleryColumns(1280), 4);
    assert.equal(galleryColumns(1440), 5);
  });
});
