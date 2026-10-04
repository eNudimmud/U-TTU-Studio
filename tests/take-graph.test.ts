import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { TAKE_MODELS, TAKE_PICTURES_MAX, takeFrames, takeGraph, takeProfile } from "../src/lib/render/take-graph.ts";
import { takePrompt } from "../src/lib/render/take-prompt.ts";
import { H3_R2V_TEMPLATE } from "../src/lib/comfy-stack.ts";

const fixture = (name: string) => JSON.parse(readFileSync(`tests/fixtures/${name}.json`, "utf8"));

describe("la prise comme graphe", () => {
  it("builds exactly the graphs Comfy Cloud's pre-flight accepted on 3 October 2026", () => {
    const rapide = takeGraph({
      seconds: 5, quality: "rapide", aspect: "vertical",
      prompt: "<Picture 1> keeps the same person for the whole shot. <Picture 2> is the place, a quiet harbour at dusk. The shot: she walks along the quay, slow dolly.",
      pictures: ["red_superboy_on_city_roof.png", "mecha_dragon_lightning.png"], seed: 424242,
    });
    assert.deepEqual(rapide, fixture("take-graph-rapide"));
    const fine = takeGraph({ seconds: 8, quality: "fine", aspect: "horizontal", prompt: "<Picture 1> keeps the same person.", pictures: ["red_superboy_on_city_roof.png"], seed: 7 });
    assert.deepEqual(fine, fixture("take-graph-fine"));
  });

  it("uses the official template's models and turbo file, and wires every picture in order", () => {
    assert.equal(TAKE_MODELS.unet, H3_R2V_TEMPLATE.model);
    assert.equal(TAKE_MODELS.turboLora, H3_R2V_TEMPLATE.turboLora);
    const pictures = Array.from({ length: 12 }, (_, index) => `p${index}.jpg`);
    const graph = takeGraph({ seconds: 5, quality: "fine", aspect: "carre", prompt: "x", pictures, seed: 1 });
    const take = graph.take.inputs;
    for (let index = 0; index < TAKE_PICTURES_MAX; index++) assert.deepEqual(take[`ref_images.ref_image_${index}`], [`picture_${index + 1}`, 0]);
    assert.equal(take["ref_images.ref_image_9"], undefined);
    assert.equal(graph.picture_1.inputs.image, "p0.jpg");
    assert.equal(graph.lora, undefined, "the fine take does not load the turbo file");
    assert.deepEqual(graph.guider.inputs.model, ["unet", 0]);
    assert.equal(graph.sigmas.inputs.steps, 20);
    assert.equal(graph.size.inputs.aspect_ratio, "1:1 (Square)");
    assert.throws(() => takeGraph({ seconds: 5, quality: "fine", aspect: "carre", prompt: "x", pictures: [], seed: 1 }), /photo/);
    assert.throws(() => takeGraph({ seconds: 5, quality: "fine", aspect: "carre", prompt: "  ", pictures: ["a"], seed: 1 }), /plan/);
  });

  it("keeps the template's frame rule and keys calibration on the real settings", () => {
    assert.equal(takeFrames(5), 124);
    assert.equal(takeFrames(8), 192);
    assert.equal(takeFrames(0), 5);
    for (const seconds of [1, 3, 5, 8, 12]) assert.equal((takeFrames(seconds) - 5) % 17, 0);
    assert.equal(takeProfile({ seconds: 5, quality: "rapide", aspect: "vertical" }), "h3-4pas-5s-vertical");
    assert.notEqual(takeProfile({ seconds: 5, quality: "fine", aspect: "vertical" }), takeProfile({ seconds: 5, quality: "rapide", aspect: "vertical" }));
  });
});

describe("le texte de la prise", () => {
  it("names the look's photos first, then the place's, in connection order", () => {
    const text = takePrompt({ traits: ["yeux verts", "taches de rousseur"], lookPictures: 3, place: { name: "Le quai", note: "pluie fine.", pictures: 2 }, line: "Elle traverse le quai." });
    assert.match(text, /^<Picture 1>, <Picture 2> and <Picture 3> show the same person\./);
    assert.match(text, /What does not change: yeux verts, taches de rousseur\./);
    assert.match(text, /<Picture 4> and <Picture 5> show the place, Le quai\./);
    assert.match(text, /The place holds: pluie fine\./);
    assert.match(text, /The shot: Elle traverse le quai\.$/);
    const lone = takePrompt({ traits: [], lookPictures: 1, place: { name: "Serre", note: "", pictures: 0 }, line: "" });
    assert.equal(lone, "<Picture 1> shows the same person. Keep this person for the whole shot. The place: Serre.");
    const doubled = takePrompt({ traits: [], lookPictures: 2, place: null, line: "Elle avance.", tags: "image", subject: "mira_uttu" });
    assert.match(doubled, /^Image 1 and Image 2 show mira_uttu, the same person\./);
    assert.doesNotMatch(`${text}\n${lone}\n${doubled}`, /night city/i);
    const filmed = takePrompt({ traits: [], lookPictures: 0, place: { name: "Le quai", note: "", pictures: 1 }, line: "Elle avance.", tags: "image", subject: "mira_uttu" });
    assert.match(filmed, /^mira_uttu is the person\. Keep the same person for the whole shot\. Image 1 shows the place, Le quai\./);
  });
});
