import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { readFrontmatter, text } from "../src/lib/coffre/markdown.ts";
import { montageCues } from "../src/lib/coffre/montage.ts";
import type { Shot, Take } from "../src/lib/coffre/model.ts";
import { CHOISIS, FINAL_SENTENCE, PAS_MESURE, QUATRE_K } from "../src/lib/prise/copy.ts";
import {
  CAP_RATIO, QUOTE_ESSAI, QUOTE_IMAGE, capOf, decide, emptyPlan, pourquoiLevres, type PlanInput,
} from "../src/lib/prise/decision.ts";
import { chooseFinaliser, finaliserDefaults, vcubeQuote } from "../src/lib/prise/finaliser.ts";
import { DEFAULT_PROJECT_FORMAT, formatMarkdown, readProjectFormat } from "../src/lib/prise/format.ts";
import { buildPrompt, referenceGrammar } from "../src/lib/prise/prompt.ts";
import { finalPath, moveId, planFromJson, planMarkdown, planStateFromJson, priseMarkdown } from "../src/lib/prise/vault.ts";

function plan(patch: Partial<PlanInput> = {}): PlanInput {
  return { ...emptyPlan("9:16"), castIds: ["lina"], castNames: ["Lina"], decorId: "quai", decorName: "Quai, nuit", decorNote: "night, wet platform, sodium lights", ...patch };
}

const filmed = (id: string, patch: Partial<Take> = {}): Take => ({
  id,
  at: "2026-10-08T12:00:00.000Z",
  sceneId: null,
  sceneName: "",
  line: "Plan",
  settings: { seconds: 5, quality: "rapide", aspect: "horizontal" },
  profile: "h3-4pas-5s-horizontal",
  jobId: "job",
  video: `Projets/atelier/Prises/${id}.mp4`,
  poster: null,
  prompt: "",
  gpuSeconds: null,
  costCredits: null,
  balanceBefore: null,
  balanceAfter: null,
  engine: "comfy",
  loraId: null,
  resolution: null,
  costUsd: null,
  costSource: null,
  announcedCredits: null,
  announcedHigh: null,
  ...patch,
});

describe("table de décision du plan", () => {
  it("keeps a single take column and a 1.5 ceiling", () => {
    assert.equal(CAP_RATIO, 1.5);
    assert.equal(capOf(QUOTE_IMAGE), 18.75);
    assert.equal(capOf(QUOTE_ESSAI), 6.45);
    assert.equal(DEFAULT_PROJECT_FORMAT, "16:9");
  });

  it("turns the buttons off until a person or a place is chosen", () => {
    const row = decide(emptyPlan(), "composer");
    assert.equal(row.row, 0);
    assert.equal(row.enabled, false);
    assert.equal(row.pourquoi, CHOISIS);
    assert.equal(row.reason, CHOISIS);
  });

  it("composes the key image first, at the measured price", () => {
    const row = decide(plan(), "composer");
    assert.equal(row.row, 1);
    assert.equal(row.graph, "api_nano_banana_2_1_image_edit");
    assert.equal(row.pourquoi, "On fixe d'abord le cadre sur une image : 12,5 crédits au lieu d'une vidéo ratée.");
    assert.equal(row.quote, 12.5);
    assert.equal(row.cap, 18.75);
    assert.equal(row.statut, "mesure");
    assert.equal(row.enabled, true);
  });

  it("offers the measured quick test only when there is no key image", () => {
    const open = decide(plan(), "essai");
    assert.equal(open.row, 2);
    assert.equal(open.graph, "video_minimax_h3_r2v");
    assert.equal(open.pourquoi, "Pas d'image clé : on donne directement tes personnages et ton lieu au modèle. Plus rapide, cadre moins sûr.");
    assert.equal(open.quote, 4.3);
    assert.equal(open.cap, 6.45);
    assert.equal(open.enabled, true);
    const held = decide(plan({ imageCle: "validee" }), "essai");
    assert.equal(held.enabled, false);
  });

  it("picks the first matching take row and keeps its sentence verbatim", () => {
    const lips = decide(plan({ imageCle: "validee", paroles: "replique", replique: "Marc ?", cadrage: "moyen", camera: "fixe" }), "tourner");
    assert.equal(lips.row, 6);
    assert.equal(lips.graph, "video_ltx2_3_ia2v");
    assert.equal(lips.pourquoi, pourquoiLevres("Lina"));
    assert.equal(lips.pourquoi, "Le visage de Lina dit ta phrase avec sa voix.");
    assert.equal(lips.enabled, false);
    assert.equal(lips.reason, PAS_MESURE);

    const moving = decide(plan({ imageCle: "validee", paroles: "replique", cadrage: "gros", camera: "suivi" }), "tourner");
    assert.equal(moving.row, 7);
    assert.equal(moving.suite, "api_sync_so_lip_sync_video");
    assert.equal(moving.pourquoi, "Les lèvres seront recalées après coup. Attention, c'est cher : ≈ 200 pour 5 s.");

    const wide = decide(plan({ imageCle: "validee", paroles: "voix-off", cadrage: "large" }), "tourner");
    assert.equal(wide.row, 8);
    assert.equal(wide.pourquoi, "De loin, on ne lit pas les lèvres : la voix est posée au montage.");

    const ends = decide(plan({ imageCle: "validee", imageFin: true }), "tourner");
    assert.equal(ends.row, 9);
    assert.equal(ends.graph, "video_ltx2_5_flf2v");
    assert.equal(ends.pourquoi, "Tu as fixé le début et la fin : le modèle invente le mouvement entre les deux.");

    const bridge = decide(plan({ imageCle: "validee", enchainer: true, previousKept: true }), "tourner");
    assert.equal(bridge.row, 10);
    assert.equal(bridge.graph, "video_minimax_h3_i2v");
    assert.equal(bridge.pourquoi, "Ce plan commence exactement là où le précédent s'arrête.");

    const frames = decide(plan({ imageCle: "validee", keyframes: 4 }), "tourner");
    assert.equal(frames.row, 11);
    assert.equal(frames.graph, "video_minimax_h3_multiframe_reference");
    assert.equal(frames.pourquoi, "Le plan passe par tes images dans l'ordre.");

    const still = decide(plan({ imageCle: "validee" }), "tourner");
    assert.equal(still.row, 12);
    assert.equal(still.graph, "video_minimax_h3_i2v");
    assert.equal(still.pourquoi, "Ton image clé devient la première image du plan. Caméra et action viennent de tes tuiles.");
    assert.equal(still.statut, "inconnu");
    assert.equal(still.enabled, false);
    assert.equal(still.reason, PAS_MESURE);
  });

  it("prices a retouch from the grid and leaves an unmeasured move closed", () => {
    const edit = decide(plan({ retoucher: true, hasKeptTake: true }), "tourner");
    assert.equal(edit.row, 5);
    assert.equal(edit.graph, "api_flux_video_edit");
    assert.equal(edit.quote, 45.25);
    assert.equal(edit.cap, capOf(45.25));
    assert.equal(edit.statut, "hypothese");
    assert.equal(edit.enabled, false);
    const gesture = decide(plan({ gesteFilme: true }), "tourner");
    assert.equal(gesture.row, 3);
    assert.equal(gesture.graph, "video_wan_animate2");
    assert.equal(gesture.quote, null);
    assert.equal(gesture.statut, "inconnu");
  });
});

describe("texte envoyé", () => {
  it("assembles picture tags, the shot size and a 40/60 timeline for H3", () => {
    const text = buildPrompt(plan({
      castIds: ["lina", "marc"],
      castNames: ["Lina", "Marc"],
      castPlanche: [true, false],
      camera: "travelling-avant",
      cadrage: "moyen",
      action: "se retourne",
      duree: 5,
      paroles: "replique",
      replique: "Marc ? C'est toi ?",
    }), { graph: "video_minimax_h3_i2v", son: true });
    assert.equal(text.grammar, "picture");
    assert.match(text.text, /<Picture 1> = Lina \(portrait \+ planche\), <Picture 2> = Marc, <Picture 3> = Quai, nuit/);
    assert.match(text.text, /medium shot, waist up, 9:16\./);
    assert.match(text.text, /In <Picture 3>, night, wet platform, sodium lights\./);
    assert.match(text.text, /slow dolly in\./);
    assert.match(text.text, /\[0s-2s\] <Picture 1> stands still and breathes\./);
    assert.match(text.text, /\[2s-5s\] <Picture 1> turns around\./);
    assert.match(text.text, /says in French: "Marc \? C'est toi \?"/);
    assert.doesNotMatch(text.text, /negative|seed|class_type|nœud/i);
  });

  it("names references in words when the graph has no verified tag", () => {
    assert.equal(referenceGrammar("api_nano_banana_2_1_image_edit"), "words");
    const text = buildPrompt(plan(), { graph: "api_nano_banana_2_1_image_edit", son: false });
    assert.doesNotMatch(text.text, /<Picture/);
    assert.match(text.text, /image 1 = Lina/);
  });
});

describe("finaliser", () => {
  it("enhances the kept take at 1080p and refuses 4K", () => {
    const video = chooseFinaliser(finaliserDefaults("video", 5));
    assert.equal(video.sentence, FINAL_SENTENCE);
    assert.equal(video.graph, "api_bytedance_vcube_video_enhance");
    assert.equal(video.quote, 10);
    assert.equal(vcubeQuote(8), 16.64);
    assert.equal(video.cap, 15);
    assert.equal(video.statut, "hypothese");
    assert.equal(video.enabled, false);
    assert.equal(video.reason, PAS_MESURE);
    assert.equal(video.resolution4k.enabled, false);
    assert.equal(video.resolution4k.reason, QUATRE_K);
    const blocked = chooseFinaliser({ ...finaliserDefaults("video", 5), resolution: "4k" });
    assert.equal(blocked.enabled, false);
    assert.equal(blocked.reason, QUATRE_K);
  });

  it("switches the video graph when sharpness is off, and adds interpolation without a price", () => {
    const sharp = chooseFinaliser({ ...finaliserDefaults("video", 5), nettete: false });
    assert.equal(sharp.graph, "api_wavespeed_flshvsr_video_upscale");
    assert.equal(sharp.quote, 19);
    const smooth = chooseFinaliser({ ...finaliserDefaults("video", 5), fluidifier: true });
    assert.equal(smooth.graphs.some(item => item.id === "utility_video_frame_interpolation" && item.choisi), true);
    assert.equal(smooth.quote, null);
    assert.equal(smooth.statut, "inconnu");
  });

  it("restores an image without regenerating it", () => {
    const image = chooseFinaliser(finaliserDefaults("image"));
    assert.match(image.sentence, /sans être refaite|telle quelle/);
    assert.equal(image.graph, "utility_seedvr2_7b_int8_upscale_image");
    assert.equal(image.quote, null);
    assert.equal(image.enabled, false);
    const fix = chooseFinaliser({ ...finaliserDefaults("image"), nettete: false });
    assert.equal(fix.graph, "api_wavespeed_seedvr2_ai_image_fix");
    assert.equal(fix.quote, 2.11);
    assert.equal(fix.cap, 3.17);
    assert.equal(fix.graphs.some(item => item.id === "api_magnific_image_upscale_precise" && item.quote === 35.91 && !item.choisi), true);
  });
});

describe("mémoire du plan", () => {
  it("keeps the original and the final file, and reads the format once", () => {
    assert.equal(finalPath("Prises/plan-03-prise-2.mp4"), "Prises/plan-03-prise-2-final.mp4");
    assert.equal(finalPath("Refs/plan-03-image-cle.webp"), "Refs/plan-03-image-cle-final.webp");
    const note = priseMarkdown({
      id: "plan-03-prise-2",
      planId: "plan-03",
      template: "video_minimax_h3_i2v",
      entrees: ["Refs/plan-03-image-cle.webp", "Cast/lina", "Lieux/quai-nuit"],
      camera: "travelling-avant",
      duree: 5,
      devis: "inconnu",
      plafond: null,
      cout: 0,
      promptId: "",
      etat: "gardee",
      date: "2026-10-08",
      video: "Prises/plan-03-prise-2.mp4",
      finalVideo: "Prises/plan-03-prise-2-final.mp4",
      prompt: "medium shot",
    });
    assert.match(note, /template: "video_minimax_h3_i2v"/);
    assert.match(note, /etat: "gardee"/);
    assert.match(note, /video_finale: "Prises\/plan-03-prise-2-final\.mp4"/);
    assert.doesNotMatch(note, /qualite:|brouillon|class_type|run_template|partner_generate/);
    const stored = planMarkdown({
      id: "plan-03",
      name: "Plan 03",
      ordre: 2,
      etat: "finalisee",
      input: plan(),
      graph: "video_minimax_h3_i2v",
      pourquoi: "Ton image clé devient la première image du plan. Caméra et action viennent de tes tuiles.",
      takeIds: ["plan-03-prise-2"],
      imageCle: "Refs/plan-03-image-cle.webp",
      imageFin: "",
      finalVideo: "Prises/plan-03-prise-2-final.mp4",
    });
    assert.match(stored, /composeur:/);
    assert.match(stored, /Version finalisée/);
    const storedJson = text(readFrontmatter(stored).fields.composeur);
    const round = planFromJson(storedJson, emptyPlan());
    assert.equal(planStateFromJson(storedJson).etat, "finalisee");
    assert.equal(round.cadrage, "moyen");
    assert.equal(round.decorId, "quai");
    assert.equal(round.camera, "fixe");
    assert.equal(readProjectFormat(formatMarkdown("9:16")), "9:16");
    assert.equal(readProjectFormat(undefined), "16:9");
    assert.deepEqual(moveId(["a", "b", "c"], "c", "a"), ["c", "a", "b"]);
  });

  it("sends a kept or final take to the cut and leaves an essai out", () => {
    const shots: Shot[] = [{ id: "plan-03", name: "Plan 03", sequenceId: "seq", takeIds: ["essai", "garde", "fin"], note: "", ordre: 0 }];
    const takes = [
      filmed("essai", { etat: "essai" }),
      filmed("garde", { etat: "gardee" }),
      filmed("fin", { etat: "finalisee", finalVideo: "Projets/atelier/Prises/fin-final.mp4" }),
    ];
    assert.deepEqual(montageCues(shots, takes, "seq").map(cue => [cue.takeId, cue.source]), [
      ["garde", "Projets/atelier/Prises/garde.mp4"],
      ["fin", "Projets/atelier/Prises/fin-final.mp4"],
    ]);
  });
});

describe("écran PRISE", () => {
  it("composes plans and does not spend or show the old gesture list", () => {
    const source = readFileSync("src/components/app/prise-stage.tsx", "utf8");
    assert.match(source, /Ce que l'app va faire/);
    assert.match(source, /Composer l'image/);
    assert.match(source, /Essai rapide/);
    assert.match(source, /Finaliser \(agrandir\)/);
    assert.match(source, /Texte envoyé/);
    assert.match(source, /requestRun\(\)/);
    assert.doesNotMatch(source, /confirmRun\(|GestePicker|Bientôt|prise-plan|run_template|submit_workflow|partner_generate|estimate_credits|fal\.ai/);
    assert.match(readFileSync("src/components/app/studio-app.tsx", "utf8"), /FormatSwitch/);
    assert.match(readFileSync("src/components/app/app.css", "utf8"), /@media \(min-width: 1024px\)[\s\S]*u-prise-dock/);
  });
});
