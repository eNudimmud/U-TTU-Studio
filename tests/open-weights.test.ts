// Open-weights mode (Comfy « Open Source Higgsfield » contest): every engine a visitor can reach
// is listed here with its status. A new partner engine, or a visible one that changes template,
// fails this file until the table below is updated on purpose.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { LICENCE_A_VERIFIER, MINIMAX_H3_ATTRIBUTION, OPEN_WEIGHTS_MODE, licenceAVerifier, modeOpenWeights } from "../src/lib/open-weights.ts";
import { FAMILLES, OUTILS, familleVitrine, modelesIntent, outilEtat, outilParId, outilPartenaire, outilsPublics, outilsPublicsOnglet } from "../src/lib/outils/catalogue.ts";
import { ONGLET, REGISTRE, TEMPLATES_OFFICIELS, gesteOuvert, gesteVisible, templatePartenaire } from "../src/lib/workflows/registre.ts";
import { TAKE_ENGINES } from "../src/lib/render/take-graph.ts";
import { DEFAULT_PREFS, prefsSession } from "../src/lib/studio-prefs.ts";

type Statut = "open" | "open, MiniMax H3 licence (name shown)" | "open, licence to check";
const OW = { openWeightsOnly: true } as const;

/** Every tool model visible in open-weights mode: id → [template, status]. */
const VISIBLE: Record<string, [string, Statut]> = {
  "img-klein": ["image_flux3_klein_t2i", "open"],
  "img-qwen": ["image_qwen_image_2_1_t2i", "open"],
  "img-refs": ["image_qwen_image_2_1_image_edit", "open"],
  "img-360": ["template_qwen_Image_2512_360_lora", "open"],
  "img-croquis": ["image_qwen_Image_2512_controlnet", "open"],
  "vid-wan": ["video_wan2_2_14B_i2v", "open"],
  "vid-ltx-image": ["video_ltx2_5_i2v", "open"],
  "vid-animer": ["video_minimax_h3_i2v", "open, MiniMax H3 licence (name shown)"],
  "vid-texte": ["video_ltx2_5_t2v", "open"],
  "vid-raccord": ["video_ltx2_5_flf2v", "open"],
  "vid-h3-refs": ["video_minimax_h3_r2v", "open, MiniMax H3 licence (name shown)"],
  "vid-fasth3": ["video_fasth3_ominiref_r2v", "open, MiniMax H3 licence (name shown)"],
  "vid-pika": ["video_pika_h3_flex_ref2va", "open, MiniMax H3 licence (name shown)"],
  "vid-multi": ["video_minimax_h3_multiframe_reference", "open, MiniMax H3 licence (name shown)"],
  "vid-transition-style": ["template_ltx2_3_style_transition", "open"],
  "3d-ouvert": ["3d_pixal3d_trellis2_image_to_model", "open"],
  "son-voix-ouverte": ["audio-chatterbox_tts_multilingual", "open"],
  "son-musique-ouverte": ["audio_ace_step1_5_xl_turbo", "open"],
  "son-bruitage-ouvert": ["audio_stable_audio_3_medium", "open"],
  "son-separer": ["audio_melbandroformer_audio_separation", "open"],
  "ret-modifier": ["image_flux3_klein_image_edit", "open"],
  "ret-finaliser": ["utility_seedvr2_3b_int8_upscale_image", "open"],
  "ret-elargir": ["templates_doc_workbox_klein_9b_image_extend", "open"],
  "ret-detourer": ["utility_birefnet_remove_background", "open"],
  "ret-eclairer-ouvert": ["image_qwen_image_edit_2509_relight", "open"],
  "ret-lumiere-image": ["templates-portrait_light_migration", "open"],
  "ret-angles-perso": ["templates-1_click_multiple_character_angles-v1.0", "open"],
  "ret-angles-decor": ["templates-1_click_multiple_scene_angles-v1.0", "open"],
  "ret-camera": ["template_qwen_multiangle.app", "open"],
  "vid-prolonger": ["video_minimax_h3_i2v_continuation", "open, MiniMax H3 licence (name shown)"],
  "vid-parler": ["video_ltx2_3_ia2v", "open"],
  "vid-finaliser": ["utility_seedvr2_3b_int8_upscale_video", "open"],
  "vid-recadrer": ["template_ltx2_3_lora_video_outpainting", "open"],
  "vid-effacer": ["template_ltx2_3_obscura_remova_lora_remove_object_from_video", "open"],
  "vid-fluidifier": ["utility_video_frame_interpolation", "open"],
  "vid-mouvement": ["video_wan_animate2", "open"],
};

/** Partner-node tools the contest build must hide (JD's list, plus every other api_ node). */
const HIDDEN = [
  "vid-kling", "vid-seedance", "vid-vidu", "vid-h3max", "img-nano", "img-flux3", "img-ideogram", "img-gpt", "img-seedream",
  "3d-tripo", "3d-hunyuan", "3d-meshy",
  "son-voix", "son-dialogue", "son-musique", "son-bruitage", "son-musique-video", "son-bruitage-video",
  "ret-eclairer", "vid-prolonger-grok", "vid-detourer", "vid-levres", "vid-doubler", "vid-genjutsu",
];

/** Partner node classes, as they appear in Comfy graphs. */
const PARTNER_CLASS = /"(?:class_type|type)"\s*:\s*"[^"]*(?:Gemini|Kling|Vidu|Tripo|Meshy|OpenAI|Ideogram|ByteDance|Seedream|Seedance|Flux3Image|ElevenLabs|Sonilo|Hailuo|Bria|SyncSo|Veed|Grok|Higgsfield|Mirelo)[^"]*"/;

interface IndexRow { id: string; template: string; partner: boolean; template_file?: string; api_file?: string }
const INDEX: IndexRow[] = JSON.parse(readFileSync(new URL("../workflows/index.json", import.meta.url), "utf8")).workflows;
const root = new URL("../", import.meta.url);

function statut(template: string): Statut {
  if (MINIMAX_H3_ATTRIBUTION.includes(template)) return "open, MiniMax H3 licence (name shown)";
  return licenceAVerifier(template) ? "open, licence to check" : "open";
}

function visibleModels(): string[] {
  return outilsPublics(OW).flatMap(head => modelesIntent(head.id, OW).map(item => item.id));
}

describe("open-weights mode", () => {
  it("is on by default and only a build with NEXT_PUBLIC_OPEN_WEIGHTS_MODE=off turns it off", () => {
    assert.equal(modeOpenWeights(undefined), true);
    assert.equal(modeOpenWeights(""), true);
    assert.equal(modeOpenWeights("on"), true);
    assert.equal(modeOpenWeights("off"), false);
    assert.equal(modeOpenWeights(" OFF "), false);
    if (process.env.NEXT_PUBLIC_OPEN_WEIGHTS_MODE === undefined) assert.equal(OPEN_WEIGHTS_MODE, true);
  });

  it("lists every visible engine with its open-weights status", () => {
    const seen = visibleModels();
    assert.deepEqual([...seen].sort(), Object.keys(VISIBLE).sort());
    for (const id of seen) {
      const outil = outilParId(id)!;
      const [template, expected] = VISIBLE[id];
      assert.equal(outil.template, template, id);
      assert.equal(outilPartenaire(outil), false, id);
      assert.equal(statut(template), expected, id);
    }
  });

  it("hides every partner-node tool, and hidden tools say why instead of opening a dead page", () => {
    const seen = new Set(visibleModels());
    for (const id of HIDDEN) {
      const outil = outilParId(id);
      assert.ok(outil, id);
      assert.equal(seen.has(id), false, id);
      assert.equal(outilPartenaire(outil!), true, id);
      const etat = outilEtat(outil!, OW);
      assert.notEqual(etat.kind, "pret", id);
    }
    // Every ready partner model is in the hidden list: nothing slips through unnamed.
    for (const outil of OUTILS) {
      if (outilEtat(outil, { nanoBanana: true }).kind === "pret" && outilPartenaire(outil)) assert.ok(HIDDEN.includes(outil.id), outil.id);
    }
  });

  it("agrees with workflows/index.json and with the graphs themselves", () => {
    const visibleTemplates = new Set([
      ...Object.values(VISIBLE).map(([template]) => template),
      ...REGISTRE.filter(row => gesteVisible(row, OW) && gesteOuvert(row)).map(row => row.template),
    ]);
    for (const template of visibleTemplates) {
      const rows = INDEX.filter(row => row.template === template);
      assert.ok(rows.length, `${template} is exported in workflows/index.json`);
      for (const row of rows) {
        assert.equal(row.partner, false, `${row.id} (${template})`);
        for (const file of [row.template_file, row.api_file]) {
          if (!file || !existsSync(new URL(file, root))) continue;
          assert.doesNotMatch(readFileSync(new URL(file, root), "utf8"), PARTNER_CLASS, file);
        }
      }
    }
    // The registry's rule and the exported index say the same thing for every template.
    for (const row of INDEX) assert.equal(templatePartenaire(row.template), row.partner, `${row.id} (${row.template})`);
  });

  it("keeps CAST, DÉCOR, PRISE, MONTAGE and « Et ensuite ? » gestures on open weights", () => {
    const rows = REGISTRE.filter(row => row.onglet !== "outils" && gesteVisible(row, OW) && gesteOuvert(row));
    assert.ok(rows.length >= 20);
    for (const row of rows) assert.equal(row.partenaire, false, row.id);
    for (const onglet of ONGLET) assert.ok(outilsPublicsOnglet(onglet, OW).length > 0, onglet);
  });

  it("PRISE engines are open (LTX, local H3)", () => {
    assert.deepEqual([...TAKE_ENGINES].sort(), ["h3", "ltx"]);
    const plan = REGISTRE.filter(row => row.id.startsWith("prise-plan"));
    for (const row of plan) assert.equal(templatePartenaire(row.template), false, row.id);
  });

  it("leaves no empty family and keeps one count from the first paint on", () => {
    const counts = new Map<string, number>();
    for (const item of outilsPublics(OW)) counts.set(familleVitrine(item), (counts.get(familleVitrine(item)) ?? 0) + 1);
    for (const famille of FAMILLES) assert.ok((counts.get(famille) ?? 0) > 0, famille);
    const firstPaint = outilsPublics(prefsSession(DEFAULT_PREFS, true).outilsFiltre).length;
    const later = outilsPublics(prefsSession({ ...DEFAULT_PREFS, partenaires: true, nanoBanana: true }, true).outilsFiltre).length;
    assert.equal(later, firstPaint);
  });

  it("flags Hunyuan 3D 2.1 for a licence check, and keeps local H3, FastH3 and Pika H3 open, without hiding them", () => {
    for (const template of [...Object.keys(LICENCE_A_VERIFIER), ...MINIMAX_H3_ATTRIBUTION]) {
      assert.equal(templatePartenaire(template), false, template);
      assert.ok((TEMPLATES_OFFICIELS as readonly string[]).includes(template), template);
    }
  });
});

describe("open-weights mode: Uttu's knowledge", () => {
  it("never names, links or prices a partner-node tool or gesture", async () => {
    const { knowledge } = await import("../scripts/agent-knowledge.mjs");
    const k = knowledge("local", true) as { tools: { id: string; etat: string; public: boolean; cost: unknown; partenaire: boolean }[]; gestures: { id: string; partenaire: boolean }[]; locales: Record<string, { tools: Record<string, unknown> }> };
    for (const tool of k.tools.filter(item => item.partenaire)) {
      assert.notEqual(tool.etat, "pret", tool.id);
      assert.equal(tool.public, false, tool.id);
      assert.equal(tool.cost, null, tool.id);
      for (const locale of Object.values(k.locales)) assert.equal(tool.id in locale.tools, false, tool.id);
    }
    assert.equal(k.gestures.some(row => row.partenaire), false);
    const open = knowledge("local", false) as typeof k;
    assert.ok(open.tools.some(item => item.partenaire && item.etat === "pret"), "mode off still knows the partner tools");
  });
});

describe("open-weights mode: MiniMax H3 licence", () => {
  const LOCALES = ["en", "fr", "de", "es"] as const;
  const messages = Object.fromEntries(LOCALES.map(locale => [locale, JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"))]));

  it("names « MiniMax H3 » under the model name of every tool that runs it, in every language", () => {
    const h3Tools = OUTILS.filter(item => MINIMAX_H3_ATTRIBUTION.includes(item.template) && visibleModels().includes(item.id));
    assert.ok(h3Tools.length >= 6);
    for (const item of h3Tools) {
      assert.equal(item.attribution, true, `${item.id} shows its licence line (outils.attribution)`);
      for (const locale of LOCALES) assert.match(messages[locale].outils.attribution[item.id] ?? "", /MiniMax H3/, `${locale} ${item.id}`);
    }
  });

  it("names it on the PRISE engine label, the second-engine gesture and the send note", () => {
    for (const locale of LOCALES) {
      assert.match(messages[locale].stage.engine.h3, /^MiniMax H3 · /, locale);
      assert.match(messages[locale].gestes.prisePlanH3.phrase, /MiniMax H3/, locale);
      assert.match(messages[locale].film2.envoyeLead, /MiniMax H3/, locale);
      const storyboard = JSON.parse(readFileSync(new URL(`../messages/storyboard/${locale}.json`, import.meta.url), "utf8"));
      assert.doesNotMatch(JSON.stringify(storyboard), /\((?!MiniMax )H3\)/, locale);
    }
  });

  it("hides the H3 partner node (api_minimax_h3_max_r2v) and every gesture on it", () => {
    assert.equal(templatePartenaire("api_minimax_h3_max_r2v"), true);
    assert.ok(!visibleModels().includes("vid-h3max"));
    assert.ok(!REGISTRE.some(row => row.template === "api_minimax_h3_max_r2v" && gesteVisible(row, OW)));
  });
});

describe("open-weights mode: Montage Finaliser", () => {
  it("never sends the RTX Video pass (no public weights): the forced prefs take the SeedVR2 upscale path", () => {
    const source = readFileSync(new URL("../src/components/app/studio-session.tsx", import.meta.url), "utf8");
    assert.match(source, /const open = prefs\.openWeightsOnly;/);
    assert.match(source, /open \? "utility_seedvr2_3b_int8_upscale_video" : "RTXVideoSuperResolution"/);
    for (const stored of [DEFAULT_PREFS, { ...DEFAULT_PREFS, openWeightsOnly: false, partenaires: true }]) {
      assert.equal(prefsSession(stored, true).prefs.openWeightsOnly, true);
    }
    const finaliser = outilParId("vid-finaliser");
    assert.equal(finaliser?.template, "utility_seedvr2_3b_int8_upscale_video");
    assert.equal(templatePartenaire("utility_seedvr2_3b_int8_upscale_video"), false);
  });
});
