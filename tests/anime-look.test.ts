import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { memoryVault } from "../src/lib/coffre/store.ts";
import { ACTIVE_FILE } from "../src/lib/coffre/project.ts";
import { proposerLook } from "../src/lib/look/agent.ts";
import { ANISORA_HIGH, ANISORA_LOW, FINISH_TEMPLATE, KLEIN_EDIT_TEMPLATE, KREA_STYLE_TEMPLATE, LTX_I2V_TEMPLATE, QWEN_EDIT_TEMPLATE, REALESRGAN_ANIME, WAN_I2V_TEMPLATE, grapheFinition, noeudPartenaire, regenere } from "../src/lib/look/graphs.ts";
import { annulerLook, appliquerLook, estGuide, lireLook, lookAnime, sansGuide } from "../src/lib/look/model.ts";
import { annulerLookProjet, confirmerLook, lireLookProjet } from "../src/lib/look/persist.ts";
import { COUT_PLAN_JEU, EXEMPLE_FILM, EXEMPLE_PREPA, devisFilm, devisPreparation, libelleEstime } from "../src/lib/look/quote.ts";
import { consulterLook, resolveLook, routePlan, seedDuPlan } from "../src/lib/look/resolve.ts";
import { LOOK_COPY } from "../src/lib/look/copy.ts";
import { gesteParId, gesteVisible } from "../src/lib/workflows/registre.ts";

const FORBIDDEN_PRICE = /\b(free|gratuit|kostenlos|gratis)\b/i;

describe("anime look, absent by default", () => {
  it("reads a missing file as no look", () => {
    assert.equal(lireLook(null).look, null);
    assert.equal(lireLook("").look, null);
    assert.equal(lireLook("{").look, null);
    assert.equal(lireLook(JSON.stringify({ schemaVersion: 2, look: lookAnime() })).look, null);
    assert.equal(resolveLook(null), null);
  });

  it("leaves every existing stage on its own template", () => {
    for (const id of ["cast-photos", "decor-photo", "prise-plan", "suite-finaliser-video"]) {
      const row = gesteParId(id)!;
      const seen = consulterLook(id, null);
      assert.equal(seen.changed, false, id);
      assert.equal(seen.template, "");
      assert.equal(row.template.length > 0, true);
    }
  });
});

describe("anime look, pipeline", () => {
  const look = lookAnime("theatrical");

  it("maps each stage to the open template from the spec", () => {
    const profile = resolveLook(look)!;
    assert.equal(profile.stages.style.template, KREA_STYLE_TEMPLATE);
    assert.equal(profile.stages.style.gesteId, "anime-style-frame");
    assert.deepEqual(profile.stages.style.loras, ["krea2_style_reference"]);
    assert.equal(profile.stages.sheet.template, QWEN_EDIT_TEMPLATE);
    assert.equal(profile.stages.sheet.repli?.template, KLEIN_EDIT_TEMPLATE);
    assert.equal(profile.stages.decor.template, KREA_STYLE_TEMPLATE);
    assert.equal(profile.stages.acting.template, WAN_I2V_TEMPLATE);
    assert.equal(profile.stages.acting.slots["129.unet_name"], ANISORA_HIGH);
    assert.equal(profile.stages.acting.slots["129.unet_name_1"], ANISORA_LOW);
    assert.equal(profile.stages.camera.template, LTX_I2V_TEMPLATE);
    assert.equal(profile.stages.finish.template, FINISH_TEMPLATE);
    assert.equal(profile.interpolation, false);
    assert.equal(profile.stages.acting.post.onTwos, true);
    assert.equal(profile.stages.camera.post.onTwos, false);
    assert.equal(profile.stages.acting.post.interpolation, false);
  });

  it("uses the retro LoRA only for the 90s preset", () => {
    const retro = resolveLook(lookAnime("retro"))!;
    assert.deepEqual(retro.stages.style.loras, ["krea2_style_reference", "krea2_retroanime"]);
  });

  it("consults the look before the usual stage template", () => {
    const sheet = consulterLook("cast-photos", look, { refs: 2 });
    assert.equal(sheet.changed, true);
    assert.equal(sheet.template, QWEN_EDIT_TEMPLATE);
    assert.equal(sheet.gesteId, "anime-sheet");
    const klein = consulterLook("cast-planche", look, { refs: 3 });
    assert.equal(klein.template, KLEIN_EDIT_TEMPLATE);
    assert.equal(klein.gesteId, "anime-sheet-klein");
    const painted = consulterLook("decor-texte", look);
    assert.equal(painted.template, KREA_STYLE_TEMPLATE);
    const fromPhoto = consulterLook("decor-photo", look, { placePhoto: true });
    assert.equal(fromPhoto.template, QWEN_EDIT_TEMPLATE);
    assert.equal(fromPhoto.gesteId, "anime-decor-photo");
    const finish = consulterLook("suite-finaliser-video", look);
    assert.equal(finish.template, FINISH_TEMPLATE);
    assert.equal(finish.graph && regenere(finish.graph), false);
    assert.equal(finish.regenerates, false);
  });

  it("routes a shot from framing and camera words, never from a name", () => {
    assert.equal(routePlan({ cadrage: "large", camera: "fixe", action: "Lio lights a lantern above the river city" }), "camera");
    assert.equal(routePlan({ cadrage: "serre", camera: "fixe", action: "Mara holds still in the workshop" }), "acting");
    assert.equal(routePlan({ cadrage: "moyen", camera: "fixe", action: "a quiet close moment" }), "acting");
    assert.equal(routePlan({ cadrage: "moyen", camera: "approche", action: "someone steps closer" }), "camera");
    assert.equal(routePlan({ cadrage: "serre", camera: "fixe", action: "a slow crane over the table" }), "camera");
    assert.equal(routePlan({ cadrage: "detail", camera: "fixe", action: "dolly in on the hands" }), "camera");
    assert.equal(routePlan({ cadrage: "moyen", camera: "autour" }), "camera");
    assert.equal(routePlan({ cadrage: "serre", camera: "fixe", action: "travelling avant le long du quai" }), "camera");
    const named = consulterLook("prise-plan", look, { shot: { cadrage: "serre", camera: "fixe", action: "River city, Workshop, Lio" } });
    assert.equal(named.route, "acting");
    assert.equal(named.template, WAN_I2V_TEMPLATE);
    const wide = consulterLook("prise-plan-h3", look, { shot: { cadrage: "large", camera: "fixe", action: "no proper name here" } });
    assert.equal(wide.route, "camera");
    assert.equal(wide.template, LTX_I2V_TEMPLATE);
  });

  it("keeps one seed per shot id", () => {
    assert.equal(seedDuPlan("plan-a"), seedDuPlan("plan-a"));
    assert.notEqual(seedDuPlan("plan-a"), seedDuPlan("plan-b"));
  });

  it("finishes by upscaling the take, with no sampler and no partner node", () => {
    const graph = grapheFinition({ video: "prise.mp4", styleFrame: "style.png" });
    const types = Object.values(graph).map(node => node.class_type).sort();
    assert.deepEqual(types, ["ColorTransfer", "ImageUpscaleWithModel", "LoadImage", "UpscaleModelLoader", "VHS_LoadVideo", "VHS_VideoCombine"]);
    assert.equal(graph.model.inputs.model_name, REALESRGAN_ANIME);
    assert.equal(graph.color.inputs.method, "mkl_lab");
    assert.equal(graph.color.inputs.source_stats, "uniform");
    assert.equal(regenere(graph), false);
    assert.equal(noeudPartenaire(graph), false);
    assert.equal(JSON.stringify(graph).includes("utility-gan_upscaler"), false);
    assert.equal(JSON.stringify(graph).includes("utility_video_upscale"), false);
  });

  it("hides the anime rows until the look is on, and keeps them off partner nodes", () => {
    for (const id of ["anime-style-frame", "anime-sheet", "anime-sheet-klein", "anime-decor", "anime-decor-photo", "anime-first-frame", "anime-prise-jeu", "anime-prise-camera", "anime-finish"]) {
      const row = gesteParId(id);
      assert.ok(row, id);
      assert.equal(row.option, "anime25d");
      assert.equal(row.partenaire, false, id);
      assert.equal(row.nature === "hypothese" || row.nature === "mesure", true, id);
      assert.equal(gesteVisible(row), false, id);
      assert.equal(gesteVisible(row, { anime25d: true, openWeightsOnly: true }), true, id);
    }
  });
});

describe("anime look, quotes", () => {
  it("prices the illustrated film as an estimate, never as free", () => {
    assert.equal(devisPreparation(1, 2).credits, EXEMPLE_PREPA);
    assert.equal(COUT_PLAN_JEU.credits, 19);
    assert.equal(EXEMPLE_PREPA + 3 * 19, EXEMPLE_FILM);
    for (const locale of ["en", "fr", "de", "es"] as const) {
      const label = libelleEstime(locale, 70);
      assert.match(label, /^≈ 70 /);
      assert.equal(FORBIDDEN_PRICE.test(label), false, label);
      assert.match(label, /estimat|estimés|geschätzt|estimados/);
    }
    const precise = devisFilm(["camera", "acting", "acting"], 1, 2);
    assert.equal(precise.nature, "hypothese");
    assert.equal(precise.estimated, true);
  });
});

describe("anime look, page copy", () => {
  it("keeps every price an estimate and the concept-art caption in English", () => {
    assert.equal(LOOK_COPY.en.caption, "Concept art — your project is rendered on Comfy with the open anime pipeline");
    for (const [locale, copy] of Object.entries(LOOK_COPY)) {
      for (const step of copy.steps) assert.equal(FORBIDDEN_PRICE.test(step.cost), false, `${locale} ${step.cost}`);
      assert.match(copy.finalNote, /≈ 70/);
      assert.match(copy.steps[0]!.cost, /≈ 3/);
      assert.match(copy.steps[4]!.cost, /≈ 3/);
    }
    assert.match(LOOK_COPY.en.finalNote, /Choosing the look is free/);
    assert.equal(/\bgratuit\b/i.test(LOOK_COPY.fr.finalNote), false);
    assert.equal(/\bkostenlos\b/i.test(LOOK_COPY.de.finalNote), false);
    assert.equal(/\bgratis\b/i.test(LOOK_COPY.es.finalNote), false);
  });
});

describe("anime look, agent", () => {
  it("turns a free sentence into a proposal and does not launch", () => {
    const proposal = proposerLook("make the project anime", null, {
      characters: [{ name: "Uttu" }, { name: "Mara" }],
      places: [{ name: "North hall" }, { name: "Yard" }],
      shots: [
        { cadrage: "large", camera: "fixe", action: "the valley" },
        { cadrage: "serre", camera: "fixe", action: "a hand" },
      ],
    });
    assert.ok(proposal);
    assert.equal(proposal.launches, false);
    assert.equal(proposal.posted, false);
    assert.equal(proposal.needsConfirmation, true);
    assert.equal(proposal.keepsMedia, true);
    assert.equal(proposal.look.kind, "anime25d");
    assert.equal(proposal.preset, "theatrical");
    assert.match(proposal.label, /≈ \d+ credits estimated/);
    assert.equal(FORBIDDEN_PRICE.test(proposal.summary + proposal.label), false);
    assert.equal(proposal.remake.some(line => line.stage === "sheet" && line.count === 1), true);
    assert.equal(estGuide("Uttu"), true);
    assert.equal(estGuide("U*TTU"), true);
    assert.equal(sansGuide([{ name: "Uttu" }, { name: "Mara" }]).length, 1);
  });

  it("hears the 90s sentence and the French one, and ignores animate", () => {
    assert.equal(proposerLook("make it look like a 90s anime", null)?.preset, "retro");
    const fr = proposerLook("passe le projet en anime", null);
    assert.match(fr?.label ?? "", /crédits estimés/);
    assert.match(fr?.summary ?? "", /confirmation/);
    assert.equal(proposerLook("animate the wide shot", null), null);
    assert.equal(proposerLook("please render a castle", null), null);
  });

  it("quotes any story the same way, with no baked-in names", () => {
    const a = proposerLook("make the project anime", null, {
      characters: [{ name: "One" }],
      places: [{ name: "Room" }],
      shots: [{ cadrage: "moyen", camera: "fixe" }],
    });
    const b = proposerLook("make the project anime", null, {
      characters: [{ name: "Two" }],
      places: [{ name: "Street" }],
      shots: [{ cadrage: "moyen", camera: "fixe" }],
    });
    assert.equal(a?.quote.credits, b?.quote.credits);
    assert.equal(JSON.stringify(a?.look).includes("One"), false);
    assert.equal(JSON.stringify(b?.look).includes("Street"), false);
  });
});

describe("anime look, persistence", () => {
  it("writes the look only on confirm, and undo restores none without deleting media", async () => {
    const store = memoryVault();
    await store.put({ path: ACTIVE_FILE, text: JSON.stringify({ actif: "atelier" }), updatedAt: 1 });
    await store.put({ path: "Projets/atelier/Prises/prise-1.mp4", text: "media", updatedAt: 1 });
    assert.equal((await lireLookProjet(store, "atelier")).look, null);
    const saved = await confirmerLook(store, "atelier", lookAnime("neon"), "2026-11-02T02:36:00.000Z", "op-1");
    assert.equal(saved.mediaUntouched, true);
    assert.equal(saved.after?.preset, "neon");
    assert.equal((await lireLookProjet(store, "atelier")).look?.preset, "neon");
    assert.equal((await store.get("Projets/atelier/Prises/prise-1.mp4"))?.text, "media");
    const undone = await annulerLookProjet(store, "atelier", "2026-11-02T02:40:00.000Z", "op-2");
    assert.equal(undone.after, null);
    assert.equal(undone.mediaUntouched, true);
    assert.equal((await lireLookProjet(store, "atelier")).look, null);
    assert.equal((await store.get("Projets/atelier/Prises/prise-1.mp4"))?.text, "media");
  });

  it("round-trips a document and undoes in memory", () => {
    const first = appliquerLook(null, lookAnime("daylight"), "t1", "a");
    const parsed = lireLook(JSON.stringify(first.document));
    assert.equal(parsed.look?.preset, "daylight");
    const back = annulerLook(parsed, "t2", "b");
    assert.equal(back.after, null);
    assert.equal(back.document.look, null);
  });
});
