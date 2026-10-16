import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { priseGate, quoteSentence, resolveTakeQuote } from "../src/lib/render/billed-quote.ts";
import { takeProfile, DEFAULT_TAKE } from "../src/lib/render/take-graph.ts";
import { videoGesteGraph, VIDEO_GESTES } from "../src/lib/render/video-gestes.ts";
import { gesteOuvert, gesteParId } from "../src/lib/workflows/registre.ts";

describe("devis LTX estimé", () => {
  it("quotes the LTX take as an estimate, never as measured", () => {
    const quote = resolveTakeQuote(takeProfile(DEFAULT_TAKE), []);
    assert.equal(quote.source, "estimated");
    const line = quoteSentence(quote);
    assert.match(line, /^Estimé : environ 12 à 25 crédits\./);
    assert.doesNotMatch(line, /mesuré sur/);
    assert.doesNotMatch(line, /Pas encore mesuré/);
  });

  it("keeps quote-before-spend: the gate checks the estimate's ceiling", () => {
    const quote = resolveTakeQuote(takeProfile(DEFAULT_TAKE), []);
    assert.equal(priseGate(null, quote).allowed, false);
    assert.equal(priseGate({ credits: 20, readAt: 0 } as never, quote).allowed, false);
    const ok = priseGate({ credits: 30, readAt: 0 } as never, quote);
    assert.equal(ok.allowed, true);
    assert.match(ok.line, /^Estimé/);
  });

  it("keeps the measured H3 profile measured", () => {
    const quote = resolveTakeQuote(takeProfile({ ...DEFAULT_TAKE, engine: "h3" }), []);
    assert.equal(quote.source, "billed");
  });
});

describe("gestes vidéo de PRISE", () => {
  it("opens each video gesture with an estimated quote", () => {
    for (const id of VIDEO_GESTES) {
      const row = gesteParId(id);
      assert.ok(row && gesteOuvert(row), id);
      assert.equal(row.nature, "hypothese", id);
      assert.ok(row.credits !== null && row.high !== null && row.high > row.credits, id);
    }
  });

  it("patches only the visitor's files, text and seed", () => {
    const files = { image_1: "a.jpg", image_2: "b.jpg", video_1: "c.mp4" };
    for (const geste of VIDEO_GESTES) {
      const graph = videoGesteGraph({ geste, files, prompt: "Uttu traverse le quai.", seed: 7 });
      const text = JSON.stringify(graph);
      assert.equal(text.includes("PreviewAny"), false, geste);
      const used = Object.values(graph).flatMap(node => [node.inputs.image, node.inputs.file, node.inputs.video]).filter(value => typeof value === "string");
      assert.ok(used.every(name => Object.values(files).includes(name as string)), `${geste} ${used.join(",")}`);
      assert.ok(text.includes("uttu/"), geste);
    }
    assert.throws(() => videoGesteGraph({ geste: "prise-effacer", files, prompt: " ", seed: 0 }));
    assert.doesNotThrow(() => videoGesteGraph({ geste: "prise-elargir", files, prompt: "", seed: 0 }));
  });
});

describe("caméra maîtrisée", () => {
  it("feeds the maquette previs to the LTX IC-LoRA graph, in the project format", () => {
    const files = { image_1: "look.jpg", video_1: "uttu-previs.webm" };
    const graph = videoGesteGraph({ geste: "prise-previs", files, prompt: "Uttu ouvre la porte.", seed: 3, aspect: "vertical" });
    assert.equal(graph["199"].inputs.file, "uttu-previs.webm");
    assert.equal(graph["200"].inputs.image, "look.jpg");
    assert.equal(graph["129:113"].inputs.value, 704);
    assert.equal(graph["129:98"].inputs.value, 1280);
    assert.equal(graph["692"].inputs.duration, 5);
    assert.ok(Object.values(graph).some(node => node.class_type === "MoGeInference"));
    const row = gesteParId("prise-previs");
    assert.ok(row && gesteOuvert(row) && row.nature === "hypothese" && row.template === "video_ltx2_3_ic_lora");
  });
});
