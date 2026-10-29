// Top 10, batch son (29.10.2026): sound effects timed to a video (Mirelo), voice / music split (MelBand).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { noeudSortie } from "../src/lib/render/sortie.ts";
import { outilEtat, outilParId, outilsOnglet } from "../src/lib/outils/catalogue.ts";
import { OUTIL_PISTES } from "../src/lib/outils/generique.ts";
import { outilGraph, outilQuote } from "../src/lib/outils/graphs.ts";
import { gesteOuvert, gesteParId, NOEUD_SORTIE, TEMPLATES_OFFICIELS } from "../src/lib/workflows/registre.ts";

type Node = { class_type: string; inputs: Record<string, unknown> };
const saves = (graph: Record<string, Node>) => Object.values(graph).filter(node => /^Save/.test(node.class_type));

describe("top 10 · bruitage d’une vidéo", () => {
  const outil = outilParId("son-bruitage-video")!;

  it("takes the shot, keeps speech and saves only the effects track", () => {
    assert.equal(outilEtat(outil).kind, "pret");
    assert.ok(outilsOnglet("montage").includes(outil));
    const graph = outilGraph(outil, { files: { video: "prise.mp4" }, prompt: "pluie sur le quai", seed: 7 }) as Record<string, Node>;
    assert.equal(graph["7"].inputs.file, "prise.mp4");
    assert.equal(graph["4"].inputs["model.prompt"], "pluie sur le quai");
    assert.equal(graph["4"].inputs["model.preserve_speech"], true);
    assert.equal(saves(graph).length, 1);
    assert.equal(noeudSortie(graph, outil.template), "2");
    assert.equal(NOEUD_SORTIE[outil.template], "2");
  });

  it("is priced per started 5 s block, from the measured job", () => {
    assert.equal(outil.parTranche, true);
    assert.equal(outilQuote(outil), null);
    assert.deepEqual(outilQuote(outil, { seconds: 5 }), { credits: 15, high: 18, kind: "estime" });
    assert.deepEqual(outilQuote(outil, { seconds: 9 }), { credits: 30, high: 36, kind: "estime" });
    const row = gesteParId("outil-son-bruitage-video")!;
    assert.equal(row.nature, "mesure");
    assert.equal(row.partenaire, true);
    assert.ok(gesteOuvert(row));
  });
});

describe("top 10 · séparer voix et musique", () => {
  const outil = outilParId("son-separer")!;

  it("keeps the voice by default and the music on request, through one save", () => {
    assert.equal(outilEtat(outil).kind, "pret");
    assert.deepEqual(OUTIL_PISTES, ["voix", "musique"]);
    const voix = outilGraph(outil, { files: { audio: "mix.mp3" }, prompt: "", seed: 1 }) as Record<string, Node>;
    assert.equal(voix["1"].inputs.audio, "mix.mp3");
    assert.deepEqual(voix["4"].inputs.audio, ["3", 0]);
    const musique = outilGraph(outil, { files: { audio: "mix.mp3" }, prompt: "", seed: 1, piste: "musique" }) as Record<string, Node>;
    assert.deepEqual(musique["4"].inputs.audio, ["3", 1]);
    for (const graph of [voix, musique]) {
      assert.equal(saves(graph).length, 1);
      assert.equal(noeudSortie(graph, outil.template), "4");
    }
  });

  it("is an open-weights tool measured under one crédit", () => {
    assert.deepEqual(outilQuote(outil), { credits: 1, high: 1, kind: "estime" });
    const row = gesteParId("outil-son-separer")!;
    assert.equal(row.nature, "mesure");
    assert.equal(row.partenaire, false);
    for (const template of ["api_mirelo_video_to_sfx", "audio_melbandroformer_audio_separation"]) assert.ok((TEMPLATES_OFFICIELS as readonly string[]).includes(template));
  });
});
