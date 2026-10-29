// Studio gestures. Each card hides one template id from the official Comfy catalog
// (docs/TEMPLATES-COMFY.md and the catalogs synced 2026-10-08). No node names here.
// A null `still` means the studio has no graph for it yet: the card stays, Créer stays off.

export const ROLES = ["visage", "tenue", "style", "lieu", "debut", "fin", "plan", "voix", "clip"] as const;
export type RoleRef = (typeof ROLES)[number];

export const ONGLET = ["cast", "decor", "prise", "montage"] as const;
export type Onglet = (typeof ONGLET)[number];

export type Fourniture = "texte" | "photo" | "photos" | "asset" | "video" | "audio";
export type NatureCout = "mesure" | "hypothese" | "non-mesure";
export type StillKindName = "texte-cast" | "texte-decor" | "photo-decor" | "photo-cast" | "planche";

export interface SlotImage {
  role: RoleRef;
  /** Template input name. Not a node class. */
  slot: string;
  media?: "image" | "video" | "audio";
}

/** « Et ensuite ? » tools live on an asset or a take, not in a tab. */
/** The tool hub (« Outils ») runs whole templates from one panel. */
export type OngletGeste = Onglet | "suite" | "outils";

export interface Geste {
  id: string;
  onglet: OngletGeste;
  categorie: "identite" | "apparence" | "finition" | "lieu" | "variante" | "plan" | "raccord" | "mouvement" | "vfx" | "son" | "image" | "suite" | "outil";
  clef: string;
  fournit: readonly Fourniture[];
  slots: readonly SlotImage[];
  template: string;
  credits: number | null;
  high: number | null;
  nature: NatureCout;
  premier: boolean;
  /** Graph already in the studio. `prise` is the measured take. Null stays closed. */
  still: StillKindName | "prise" | "video" | "mesh" | "voix" | "effet" | "musique" | "suite" | "outil" | null;
  minRefs: number;
  /** i18n key. One line, shown when the gesture stays under Bientôt. */
  raison?: string;
  /** Appended to the visitor text inside the graph. Studio words, not a model setting. */
  consigne: string;
  /** The graph runs a partner (paid API) node. Hidden under Open Weights Only. Checked against workflows/index.json. */
  partenaire: boolean;
  /** Off by default. Shown only when the visitor turns that option on. */
  option?: "nano";
}

export interface FiltreGestes {
  openWeightsOnly?: boolean;
  nanoBanana?: boolean;
}

/** Ids read in the official catalogs or in docs/TEMPLATES-COMFY.md. Nothing else is allowed. */
export const TEMPLATES_OFFICIELS = [
  "image_qwen_image_instantx_controlnet",
  "api_higgsfield_genjutsu_motion_transfer",
  "image_flux3_klein_t2i",
  "image_flux3_klein_image_edit",
  "api_bfl_flux3_image_edit",
  "video_ltx2_5_i2v",
  "video_ltx2_5_flf2v",
  "video_ltx2_3_ic_lora",
  "template_ltx2_3_lora_video_outpainting",
  "template_ltx2_3_obscura_remova_lora_remove_object_from_video",
  "api_nano_banana_2_1_t2i",
  "api_nano_banana_2_1_image_edit",
  "templates-character_sheet",
  "templates-1_click_multiple_character_angles-v1.0",
  "template_character_portrait_relighting",
  "templates_liveportrait.app",
  "utility_seedvr2_3b_int8_upscale_image",
  "api_hunyuan3d_image_to_model",
  "templates-1_click_multiple_scene_angles-v1.0",
  "template_sirolim_any_aspect_ratio_nb2",
  "3d_pixal3d_trellis2_image_to_model",
  "3d_hunyuan3d-v2.1",
  "video_minimax_h3_r2v",
  "video_minimax_h3_i2v",
  "video_minimax_h3_multiframe_reference",
  "video_minimax_h3_i2v_continuation",
  "video_minimax_h3_fun_controlnet_union",
  "video_wan_animate2",
  "video_ltx2_3_ia2v",
  "api_vidu_q4_preview_r2v",
  "api_elevenlabs_v4_text_to_speech",
  "api_elevenlabs_text_to_sound_effects",
  "api_sonilo_t2m",
  "utility_seedvr2_3b_int8_upscale_video",
  "utility_video_frame_interpolation",
  "utility_birefnet_remove_background",
  "templates_doc_workbox_klein_9b_image_extend",
  "image_qwen_image_2_1_t2i",
  "api_bfl_flux3_t2i",
  "api_ideogram_v4_5_t2i",
  "api_openai_gpt_image_2_t2i",
  "api_bytedance_seedream_5_0_pro_t2i",
  "image_qwen_image_2_1_image_edit",
  "video_ltx2_5_t2v",
  "api_kling_v3_video",
  "api_seedance2_5_r2v",
  "video_wan2_2_14B_i2v",
  "api_minimax_h3_max_r2v",
  "api_tripo_p2_image_to_model",
  "api_meshy7_1_image_to_model",
  "audio-chatterbox_tts_multilingual",
  "api_elevenlabs_v4_text_to_dialogue",
  "audio_ace_step1_5_xl_turbo",
  "audio_stable_audio_3_medium",
  "template_qwen_Image_2512_360_lora",
  "image_qwen_Image_2512_controlnet",
  "api_grok_video_extend",
  "api_bria_remove_video_background",
  "api_sync_so_lip_sync_video",
  "api_sonilo_v2m",
  "api_hunyuan3d_model2uv",
  "api_hunyuan3d_part",
  "3d_triposplat_image_to_gaussian_splat",
  "audio-chatterbox_vc",
  "api_elevenLabs_speech_to_text",
  "llm_qwen3vl_text_gen",
  "image_flux.1_fill_dev_OneReward",
  "api_quiver_arrow2_image_to_svg",
  // Top 10 (docs/mesures/workflows-top10-2026-10-29.md).
  "template_qwen_multiangle.app",
] as const;

const KNOWN = new Set<string>(TEMPLATES_OFFICIELS);

/** Templates whose graph holds a partner node without an api_ prefix. Read in workflows/index.json. */
const PARTENAIRES_SANS_PREFIXE = new Set<string>(["templates-character_sheet", "template_sirolim_any_aspect_ratio_nb2", "template_character_portrait_relighting"]);

export function templatePartenaire(template: string): boolean {
  return template.startsWith("api_") || PARTENAIRES_SANS_PREFIXE.has(template);
}

function geste(row: Omit<Geste, "partenaire"> & { partenaire?: boolean }): Geste {
  if (!KNOWN.has(row.template)) throw new Error(`Template absent du catalogue : ${row.template}`);
  return { ...row, partenaire: row.partenaire ?? templatePartenaire(row.template) };
}

const KLEIN_T2I = "image_flux3_klein_t2i";
const KLEIN_EDIT = "image_flux3_klein_image_edit";
const FLUX3_API = "api_bfl_flux3_image_edit";
const FACE = (slot: string): SlotImage => ({ role: "visage", slot });
const TENUE = (slot: string): SlotImage => ({ role: "tenue", slot });
const STYLE = (slot: string): SlotImage => ({ role: "style", slot });
const LIEU = (slot: string): SlotImage => ({ role: "lieu", slot });

export const REGISTRE: readonly Geste[] = [
  geste({
    id: "cast-photos", onglet: "cast", categorie: "identite", clef: "castPhotos",
    fournit: ["photos"], slots: [FACE("image_1"), FACE("image_2")],
    template: KLEIN_EDIT, credits: 4, high: 6, nature: "mesure",
    premier: true, still: "photo-cast", minRefs: 1,
    consigne: "Même personne que les photos. Visage reconnaissable. Fond simple. Pas de texte.",
  }), // mesuré 27.10.2026 : 3,57 crédits pour Klein édition, 1 photo, 1 MP (job f704495a)
  geste({
    id: "cast-planche", onglet: "cast", categorie: "identite", clef: "castSheet",
    fournit: ["photo"], slots: [FACE("image_1")],
    template: FLUX3_API, credits: 28, high: 42, nature: "hypothese",
    premier: true, still: "planche", minRefs: 1,
    consigne: "Planche : face, trois-quarts, profil, dos. Même personne.",
  }),
  geste({
    id: "cast-texte", onglet: "cast", categorie: "identite", clef: "castText",
    fournit: ["texte"], slots: [],
    template: KLEIN_T2I, credits: 4, high: 6, nature: "mesure",
    premier: true, still: "texte-cast", minRefs: 0,
    consigne: "Une personne fictive. Face, trois-quarts, profil, en pied. Fond neutre. Pas de texte.",
  }),
  geste({
    id: "cast-refs", onglet: "cast", categorie: "identite", clef: "castRefs",
    fournit: ["photos"], slots: [FACE("image_1"), FACE("image_2"), FACE("image_3"), TENUE("image_4"), STYLE("image_5")],
    template: FLUX3_API, credits: 14, high: 21, nature: "hypothese",
    premier: false, still: "photo-cast", minRefs: 2,
    consigne: "Même personne que les photos. Visage reconnaissable. Fond simple. Pas de texte.",
  }),
  geste({
    id: "cast-texte-nano", onglet: "cast", categorie: "identite", clef: "castTextNano",
    fournit: ["texte"], slots: [],
    template: "api_nano_banana_2_1_t2i", credits: 12, high: 18, nature: "hypothese",
    premier: false, still: "texte-cast", minRefs: 0, option: "nano",
    consigne: "Une personne fictive. Face, trois-quarts, profil, en pied. Fond neutre. Pas de texte.",
  }),
  geste({
    id: "cast-photos-nano", onglet: "cast", categorie: "identite", clef: "castPhotosNano",
    fournit: ["photos"], slots: [FACE("image_1"), FACE("image_2"), FACE("image_3")],
    template: "api_nano_banana_2_1_image_edit", credits: 12, high: 18, nature: "hypothese",
    premier: false, still: "photo-cast", minRefs: 1, option: "nano",
    consigne: "Même personne que les photos. Visage reconnaissable. Fond simple. Pas de texte.",
  }),
  geste({
    id: "cast-tenue", onglet: "cast", categorie: "apparence", clef: "castWardrobe",
    fournit: ["photos"], slots: [FACE("image_1"), TENUE("image_2")],
    template: KLEIN_EDIT, credits: 4, high: 6, nature: "hypothese",
    premier: true, still: "photo-cast", minRefs: 2,
    consigne: "Garde le visage. Change seulement la tenue ou la coiffure demandée.",
  }),
  geste({ id: "cast-angle", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "templates-1_click_multiple_character_angles-v1.0", credits: 11, high: 17, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 29.10.2026 : 10,87 crédits pour 8 angles 832×1248, un portrait (job d68df6c9)
  geste({
    id: "cast-expressions", onglet: "cast", categorie: "apparence", clef: "castExpression",
    fournit: ["photo", "video"], slots: [FACE("image_1"), { role: "clip", slot: "video_1", media: "video" }],
    template: "templates_liveportrait.app", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 2, consigne: "", raison: "gestes.raisons.castExpression",
  }),
  geste({
    id: "cast-eclair", onglet: "cast", categorie: "finition", clef: "castLight",
    fournit: ["photo"], slots: [FACE("image_1"), STYLE("image_2")],
    template: "template_character_portrait_relighting", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "", raison: "gestes.raisons.castLight",
  }),
  geste({
    id: "cast-agrandir", onglet: "cast", categorie: "finition", clef: "castUpscale",
    fournit: ["photo"], slots: [FACE("image_1")],
    template: "utility_seedvr2_3b_int8_upscale_image", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "", raison: "gestes.raisons.castUpscale",
  }),
  geste({
    id: "cast-volume", onglet: "cast", categorie: "finition", clef: "castVolume",
    fournit: ["photo"], slots: [FACE("image_1")],
    template: "api_hunyuan3d_image_to_model", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "", raison: "gestes.raisons.castVolume",
  }),
  geste({
    id: "decor-texte", onglet: "decor", categorie: "lieu", clef: "decorText",
    fournit: ["texte"], slots: [],
    template: KLEIN_T2I, credits: 4, high: 6, nature: "mesure",
    premier: true, still: "texte-decor", minRefs: 0,
    consigne: "Plan cinéma 16:9, sans personne. Pas de texte.",
  }),
  geste({
    id: "decor-photo", onglet: "decor", categorie: "lieu", clef: "decorPhoto",
    fournit: ["photo"], slots: [LIEU("image_1")],
    template: KLEIN_EDIT, credits: 4, high: 6, nature: "mesure",
    premier: true, still: "photo-decor", minRefs: 1,
    consigne: "Même lieu que la photo. 16:9, sans personne. Pas de texte.",
  }),
  geste({
    id: "decor-texte-nano", onglet: "decor", categorie: "lieu", clef: "decorTextNano",
    fournit: ["texte"], slots: [],
    template: "api_nano_banana_2_1_t2i", credits: 12, high: 18, nature: "hypothese",
    premier: false, still: "texte-decor", minRefs: 0, option: "nano",
    consigne: "Plan cinéma 16:9, sans personne. Pas de texte.",
  }),
  geste({
    id: "decor-photo-nano", onglet: "decor", categorie: "lieu", clef: "decorPhotoNano",
    fournit: ["photo"], slots: [LIEU("image_1")],
    template: "api_nano_banana_2_1_image_edit", credits: 12, high: 18, nature: "hypothese",
    premier: false, still: "photo-decor", minRefs: 1, option: "nano",
    consigne: "Même lieu que la photo. 16:9, sans personne. Pas de texte.",
  }),
  geste({
    id: "decor-heure", onglet: "decor", categorie: "variante", clef: "decorTime",
    fournit: ["photo", "texte"], slots: [LIEU("image_1")],
    template: KLEIN_EDIT, credits: 4, high: 7, nature: "mesure",
    premier: true, still: "photo-decor", minRefs: 1,
    consigne: "Même lieu. Change l’heure, la météo ou la saison. Sans personne.",
  }), // mesuré 27.10.2026 : 4,42 crédits pour Klein édition 16:9 (lot exemples ; 2e run fa472751 : 3,19) (job ca924213)
  geste({ id: "decor-angles", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "templates-1_click_multiple_scene_angles-v1.0", credits: 9, high: 14, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 29.10.2026 : 9,05 crédits pour 8 angles 1360×768, un décor (job 03ceae25)
  geste({
    id: "decor-elargir", onglet: "decor", categorie: "finition", clef: "decorWiden",
    fournit: ["photo"], slots: [LIEU("image_1")],
    template: "template_sirolim_any_aspect_ratio_nb2", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "", raison: "gestes.raisons.decorWiden", option: "nano",
  }),
  geste({
    id: "decor-objet", onglet: "decor", categorie: "variante", clef: "decorObject",
    fournit: ["photo", "texte"], slots: [LIEU("image_1"), { role: "style", slot: "image_2" }],
    template: FLUX3_API, credits: 14, high: 21, nature: "hypothese",
    premier: false, still: "photo-decor", minRefs: 1,
    consigne: "Même lieu. Enlève ou ajoute seulement ce que le texte demande. Sans personne.",
  }),
  geste({
    id: "decor-volume", onglet: "decor", categorie: "finition", clef: "decorVolume",
    fournit: ["photo"], slots: [LIEU("image_1")],
    template: "3d_pixal3d_trellis2_image_to_model", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "", raison: "gestes.raisons.decorVolume",
  }),
  geste({
    id: "prise-plan", onglet: "prise", categorie: "plan", clef: "prisePlan",
    fournit: ["asset", "texte"], slots: [FACE("image_1"), LIEU("image_2")],
    template: "video_ltx2_5_i2v", credits: 15, high: 23, nature: "mesure",
    premier: true, still: "prise", minRefs: 0,
    consigne: "",
  }), // mesuré 27.10.2026 : 15,10 crédits pour 5 s 16:9 0,9 MP, première image Klein incluse (bab714ce : 14,66 ; 82d63ed9 : 14,55) (job d4d2fa37)
  geste({
    id: "prise-plan-cadre", onglet: "prise", categorie: "plan", clef: "prisePlan",
    fournit: ["asset", "texte"], slots: [FACE("image_1"), LIEU("image_2"), { role: "plan", slot: "depth" }, { role: "plan", slot: "edges" }],
    template: "video_ltx2_5_i2v", credits: 23, high: 39, nature: "hypothese",
    premier: false, still: "prise", minRefs: 2, consigne: "",
  }), // Klein apparence → Qwen InstantX profondeur + contours → LTX. Nouveau profil, non mesuré.
  geste({
    id: "prise-plan-h3", onglet: "prise", categorie: "plan", clef: "prisePlanH3",
    fournit: ["asset", "texte"], slots: [FACE("image_1"), LIEU("image_2")],
    template: "video_minimax_h3_r2v", credits: 4, high: 6, nature: "mesure",
    premier: true, still: "prise", minRefs: 0,
    consigne: "",
  }),
  geste({
    id: "prise-image", onglet: "prise", categorie: "plan", clef: "priseStill",
    fournit: ["photo", "texte"], slots: [LIEU("image_1")],
    template: "video_minimax_h3_i2v", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "", raison: "gestes.raisons.priseStill",
  }),
  geste({
    id: "prise-raccord", onglet: "prise", categorie: "raccord", clef: "priseBridge",
    fournit: ["photos", "texte"], slots: [{ role: "debut", slot: "image_1" }, { role: "fin", slot: "image_2" }],
    template: "video_ltx2_5_flf2v", credits: 7, high: 11, nature: "mesure",
    premier: true, still: "video", minRefs: 2, consigne: "",
  }), // mesuré 27.10.2026 : 6,98 crédits pour 5 s 1280×720 (job e89d94be)
  geste({
    id: "prise-prolonger", onglet: "prise", categorie: "raccord", clef: "priseExtend",
    fournit: ["photo", "texte"], slots: [{ role: "plan", slot: "image_1" }],
    template: "video_minimax_h3_i2v_continuation", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "", raison: "gestes.raisons.priseExtend",
  }),
  geste({
    id: "prise-camera", onglet: "prise", categorie: "mouvement", clef: "priseCamera",
    fournit: ["photo", "video"], slots: [{ role: "plan", slot: "image_1" }, { role: "clip", slot: "video_1", media: "video" }],
    template: "video_ltx2_3_ic_lora", credits: 15, high: 30, nature: "hypothese",
    premier: false, still: "video", minRefs: 2, consigne: "",
  }),
  geste({
    id: "prise-previs", onglet: "prise", categorie: "mouvement", clef: "prisePrevis",
    fournit: ["photo", "video", "texte"], slots: [{ role: "plan", slot: "image_1" }, { role: "clip", slot: "video_1", media: "video" }],
    template: "video_ltx2_3_ic_lora", credits: 15, high: 30, nature: "hypothese",
    premier: true, still: "video", minRefs: 2, consigne: "",
  }),
  geste({
    id: "prise-volume-perso", onglet: "prise", categorie: "image", clef: "priseVolumePerso",
    fournit: ["photo"], slots: [FACE("image_1")],
    template: "3d_hunyuan3d-v2.1", credits: 8, high: 16, nature: "hypothese",
    premier: false, still: "mesh", minRefs: 1, consigne: "",
  }),
  geste({
    id: "prise-volume-objet", onglet: "prise", categorie: "image", clef: "priseVolumeObjet",
    fournit: ["photo"], slots: [LIEU("image_1")],
    template: "3d_pixal3d_trellis2_image_to_model", credits: 17, high: 25, nature: "mesure",
    premier: false, still: "mesh", minRefs: 1, consigne: "",
  }), // mesuré 27.10.2026 : 16,65 crédits pour Trellis2, 1 objet (job 8653fbd3)
  geste({
    id: "prise-mouvement", onglet: "prise", categorie: "mouvement", clef: "priseMotion",
    fournit: ["photo", "video"], slots: [FACE("image_1")],
    template: "video_wan_animate2", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "", raison: "gestes.raisons.priseMotion",
  }),
  geste({
    id: "prise-levres", onglet: "prise", categorie: "mouvement", clef: "priseLips",
    fournit: ["photo", "audio"], slots: [FACE("image_1"), { role: "voix", slot: "audio_1", media: "audio" }],
    template: "video_ltx2_3_ia2v", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 2, consigne: "", raison: "gestes.raisons.priseLips",
  }),
  geste({
    id: "prise-vidu", onglet: "prise", categorie: "plan", clef: "priseVidu",
    fournit: ["photos", "texte"], slots: [FACE("image_1"), LIEU("image_2")],
    template: "api_vidu_q4_preview_r2v", credits: 100, high: 150, nature: "hypothese",
    premier: false, still: null, minRefs: 2, consigne: "", raison: "gestes.raisons.priseVidu",
  }),
  geste({
    id: "prise-elargir", onglet: "prise", categorie: "vfx", clef: "priseOutpaint",
    fournit: ["video"], slots: [{ role: "clip", slot: "video_1", media: "video" }],
    template: "template_ltx2_3_lora_video_outpainting", credits: 16, high: 25, nature: "mesure",
    premier: false, still: "video", minRefs: 1, consigne: "",
  }), // mesuré 27.10.2026 : 16,32 crédits pour prise de 5 s élargie (job 38d04073)
  geste({
    id: "prise-effacer", onglet: "prise", categorie: "vfx", clef: "priseRemove",
    fournit: ["video", "texte"], slots: [{ role: "clip", slot: "video_1", media: "video" }],
    template: "template_ltx2_3_obscura_remova_lora_remove_object_from_video", credits: 25, high: 38, nature: "mesure",
    premier: false, still: "video", minRefs: 1, consigne: "",
  }), // mesuré 27.10.2026 : 25,11 crédits pour 5 s 1280×704 (job 414e91bc)
  geste({
    id: "mont-voix", onglet: "montage", categorie: "son", clef: "montVoice",
    fournit: ["texte"], slots: [],
    template: "api_elevenlabs_v4_text_to_speech", credits: 24.14, high: 36.21, nature: "hypothese",
    premier: true, still: "voix", minRefs: 0, consigne: "",
  }),
  geste({
    id: "mont-effet", onglet: "montage", categorie: "son", clef: "montSfx",
    fournit: ["texte"], slots: [],
    template: "api_elevenlabs_text_to_sound_effects", credits: 2.46, high: 3.69, nature: "hypothese",
    premier: true, still: "effet", minRefs: 0, consigne: "",
  }),
  geste({
    id: "mont-musique", onglet: "montage", categorie: "son", clef: "montMusic",
    fournit: ["texte"], slots: [],
    template: "api_sonilo_t2m", credits: 16, high: 24, nature: "hypothese",
    premier: true, still: "musique", minRefs: 0, consigne: "",
  }),
  geste({
    id: "mont-levres", onglet: "montage", categorie: "son", clef: "montLips",
    fournit: ["video", "audio"], slots: [{ role: "plan", slot: "video_1", media: "video" }, { role: "voix", slot: "audio_1", media: "audio" }],
    template: "video_ltx2_3_ia2v", credits: null, high: null, nature: "non-mesure",
    premier: true, still: null, minRefs: 2, consigne: "", raison: "gestes.raisons.montLips",
  }),
  geste({
    id: "mont-agrandir", onglet: "montage", categorie: "image", clef: "montUpscale",
    fournit: ["video"], slots: [{ role: "plan", slot: "video_1", media: "video" }],
    template: "utility_seedvr2_3b_int8_upscale_video", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "", raison: "gestes.raisons.montUpscale",
  }),
  geste({
    id: "mont-fluide", onglet: "montage", categorie: "image", clef: "montFrames",
    fournit: ["video"], slots: [],
    template: "utility_video_frame_interpolation", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 0, consigne: "", raison: "gestes.raisons.montFrames",
  }),
  // « Et ensuite ? » : the next step on an asset or a take. Open weights only. Estimated,
  // never measured yet: each estimate is shown as « estimé » with its reserve.
  geste({
    id: "suite-modifier", onglet: "suite", categorie: "suite", clef: "suiteModifier",
    fournit: ["asset", "texte"], slots: [{ role: "plan", slot: "image" }],
    template: KLEIN_EDIT, credits: 4, high: 6, nature: "mesure",
    premier: false, still: "suite", minRefs: 1, consigne: "",
  }), // mesuré 27.10.2026 : 3,81 crédits pour Klein édition 1 MP (4e7167a7 : 3,37 ; dfa1f0bb : 3,06) (job 14bd97c6)
  geste({
    id: "suite-finaliser-image", onglet: "suite", categorie: "suite", clef: "suiteFinaliserImage",
    fournit: ["asset"], slots: [{ role: "plan", slot: "image" }],
    template: "utility_seedvr2_3b_int8_upscale_image", credits: 2, high: 3, nature: "mesure",
    premier: false, still: "suite", minRefs: 1, consigne: "",
  }), // mesuré 27.10.2026 : 1,56 crédits pour SeedVR2, 1 image (job efe8fc8e)
  geste({
    id: "suite-detourer", onglet: "suite", categorie: "suite", clef: "suiteDetourer",
    fournit: ["asset"], slots: [{ role: "plan", slot: "image" }],
    template: "utility_birefnet_remove_background", credits: 1, high: 1, nature: "mesure",
    premier: false, still: "suite", minRefs: 1, consigne: "",
  }), // mesuré 27.10.2026 : 0,58 crédits pour BiRefNet, 1 image (5c8bb7c1 : 0,29) (job e7f5f0af)
  geste({
    id: "suite-elargir", onglet: "suite", categorie: "suite", clef: "suiteElargir",
    fournit: ["asset", "texte"], slots: [{ role: "plan", slot: "image" }],
    template: "templates_doc_workbox_klein_9b_image_extend", credits: 5, high: 8, nature: "mesure",
    premier: false, still: "suite", minRefs: 1, consigne: "",
  }), // mesuré 27.10.2026 : 5,18 crédits pour Klein extend 1,5 MP (2b32b187 : 3,61 ; ac0c40b9 : 1,18) (job 79105d4e)
  geste({
    id: "suite-animer", onglet: "suite", categorie: "suite", clef: "suiteAnimer",
    fournit: ["asset", "texte"], slots: [{ role: "debut", slot: "image" }],
    template: "video_minimax_h3_i2v", credits: 4, high: 8, nature: "hypothese",
    premier: false, still: "suite", minRefs: 1, consigne: "",
  }),
  geste({
    id: "suite-finaliser-video", onglet: "suite", categorie: "suite", clef: "suiteFinaliserVideo",
    fournit: ["video"], slots: [{ role: "clip", slot: "video", media: "video" }],
    template: "utility_seedvr2_3b_int8_upscale_video", credits: 28, high: 42, nature: "mesure",
    premier: false, still: "suite", minRefs: 1, consigne: "",
  }), // mesuré 27.10.2026 : 27,50 crédits pour 5 s 832×480 → 1872×1080, 1 bloc (job 414d76ab)
  geste({
    id: "suite-fluidifier", onglet: "suite", categorie: "suite", clef: "suiteFluidifier",
    fournit: ["video"], slots: [{ role: "clip", slot: "video", media: "video" }],
    template: "utility_video_frame_interpolation", credits: 2, high: 4, nature: "mesure",
    premier: false, still: "suite", minRefs: 1, consigne: "",
  }), // mesuré 27.10.2026 : 2,01 crédits pour 5,2 s 864×480, ×2 images/s, 1 bloc (job 9bf02d99)
  geste({
    id: "suite-prolonger", onglet: "suite", categorie: "suite", clef: "suiteProlonger",
    fournit: ["video", "texte"], slots: [{ role: "fin", slot: "image" }],
    template: "video_minimax_h3_i2v_continuation", credits: 6, high: 10, nature: "mesure",
    premier: false, still: "suite", minRefs: 1, consigne: "",
  }), // mesuré 27.10.2026 : 6,11 crédits pour 5 s 0,4 MP (job 1ba17b95)
  geste({
    id: "suite-parler", onglet: "suite", categorie: "suite", clef: "suiteParler",
    fournit: ["asset", "audio", "texte"], slots: [{ role: "visage", slot: "image" }, { role: "voix", slot: "audio", media: "audio" }],
    template: "video_ltx2_3_ia2v", credits: 8, high: 13, nature: "mesure",
    premier: false, still: "suite", minRefs: 2, consigne: "",
  }), // mesuré 27.10.2026 : 8,09 crédits pour 5 s 1280×720 (job 804f983f)
  // Home bubble: dynamic sizes / durations / named-reference counts are estimates, never measurements.
  geste({ id: "creation-image-texte", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "image_flux3_klein_t2i", credits: 2, high: 4, nature: "hypothese", premier: false, still: "outil", minRefs: 0, consigne: "" }),
  geste({ id: "creation-image", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "image_flux3_klein_image_edit", credits: 3, high: 6, nature: "hypothese", premier: false, still: "outil", minRefs: 0, consigne: "" }),
  geste({ id: "creation-video-refs", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "video_minimax_h3_r2v", credits: 5, high: 10, nature: "hypothese", premier: false, still: "outil", minRefs: 0, consigne: "" }),
  geste({ id: "creation-video-texte", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "video_ltx2_5_t2v", credits: 5, high: 10, nature: "hypothese", premier: false, still: "outil", minRefs: 0, consigne: "" }),
  // « Outils » : one panel per whole template, opened from the hub. Each estimate is shown
  // « estimé » unless a real job was billed: open weights are guessed from the studio's measured
  // neighbours, partner prices come from Comfy's estimate_credits on the template. Rows marked
  // « mesure » cite the job read in the Comfy billing activity (docs/mesures/test-visiteur-2026-10-27.md).
  geste({ id: "outil-img-klein", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "image_flux3_klein_t2i", credits: 3, high: 6, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 27.10.2026 : 3,49 crédits pour 16:9 1 MP (f3758996 : 3,12) (job 4c096c0d)
  geste({ id: "outil-img-qwen", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "image_qwen_image_2_1_t2i", credits: 3, high: 5, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 27.10.2026 : 3,00 crédits pour 16:9 1 MP (job 97dffff3)
  geste({ id: "outil-img-flux3", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_bfl_flux3_t2i", credits: 14, high: 22, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 27.10.2026 : 14,48 crédits pour API, 1 image (job 338e614b)
  geste({ id: "outil-img-ideogram", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_ideogram_v4_5_t2i", credits: 18, high: 28, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 27.10.2026 : 18,10 crédits pour API, 1 image (job 02bbd0d4)
  geste({ id: "outil-img-gpt", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_openai_gpt_image_2_t2i", credits: 1, high: 2, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 27.10.2026 : 1,26 crédits pour API, 1 image (job ff433a2a)
  geste({ id: "outil-img-seedream", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_bytedance_seedream_5_0_pro_t2i", credits: 10, high: 15, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 27.10.2026 : 9,50 crédits pour API, 1 image (job f8d6b6d4)
  geste({ id: "outil-img-nano", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_nano_banana_2_1_t2i", credits: 12, high: 18, nature: "hypothese", premier: false, still: "outil", minRefs: 0, consigne: "", option: "nano" }),
  geste({ id: "outil-img-refs", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "image_qwen_image_2_1_image_edit", credits: 2, high: 4, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 27.10.2026 : 2,01 crédits pour 1024×1024, 1 référence (job 2ac9e65b)
  geste({ id: "outil-ret-camera", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "template_qwen_multiangle.app", credits: 3, high: 5, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 29.10.2026 : 3,29 crédits pour 1 angle 832×1248 (job 4a23ca60)
  geste({ id: "outil-img-360", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "template_qwen_Image_2512_360_lora", credits: 20, high: 30, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }),
  geste({ id: "outil-img-croquis", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "image_qwen_Image_2512_controlnet", credits: 17, high: 26, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }),
  geste({ id: "outil-vid-texte", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "video_ltx2_5_t2v", credits: 5, high: 8, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 27.10.2026 : 4,72 crédits pour 5 s 16:9 0,9 MP (job b782b20d)
  geste({ id: "outil-vid-kling", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_kling_v3_video", credits: 177, high: 266, nature: "hypothese", premier: false, still: "outil", minRefs: 0, consigne: "" }),
  geste({ id: "outil-vid-seedance", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_seedance2_5_r2v", credits: 352, high: 528, nature: "hypothese", premier: false, still: "outil", minRefs: 0, consigne: "" }),
  geste({ id: "outil-vid-wan", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "video_wan2_2_14B_i2v", credits: 8, high: 13, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 27.10.2026 : 8,44 crédits pour 5 s 832×480 (lot exemples ; 261e9e69 : 6,32) (job c8d97094)
  geste({ id: "outil-vid-vidu", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_vidu_q4_preview_r2v", credits: 100, high: 151, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 27.10.2026 : 100,23 crédits pour API, 1 clip (job 11703345)
  geste({ id: "outil-vid-h3max", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_minimax_h3_max_r2v", credits: 181, high: 272, nature: "hypothese", premier: false, still: "outil", minRefs: 0, consigne: "" }),
  geste({ id: "outil-vid-mouvement", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "video_wan_animate2", credits: 17, high: 25, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 27.10.2026 : 16,59 crédits pour 81 images 482×854 (job 6ad03f2c)
  geste({ id: "outil-vid-genjutsu", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_higgsfield_genjutsu_motion_transfer", credits: 480, high: 720, nature: "hypothese", premier: false, still: "outil", minRefs: 0, consigne: "" }), // 5 s 480p ; le formulaire calcule par seconde et par résolution.
  geste({ id: "outil-3d-tripo", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_tripo_p2_image_to_model", credits: 232, high: 348, nature: "hypothese", premier: false, still: "outil", minRefs: 0, consigne: "" }),
  geste({ id: "outil-3d-hunyuan", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_hunyuan3d_image_to_model", credits: 190, high: 285, nature: "hypothese", premier: false, still: "outil", minRefs: 0, consigne: "" }),
  geste({ id: "outil-3d-meshy", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_meshy7_1_image_to_model", credits: 362, high: 543, nature: "hypothese", premier: false, still: "outil", minRefs: 0, consigne: "" }),
  geste({ id: "outil-son-voix-ouverte", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "audio-chatterbox_tts_multilingual", credits: 3, high: 5, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 27.10.2026 : 2,80 crédits pour 1 phrase (job 6aba380e)
  geste({ id: "outil-son-dialogue", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_elevenlabs_v4_text_to_dialogue", credits: 4, high: 6, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 27.10.2026 : 3,57 crédits pour API 2,39 + GPU 1,18 (job 23c3206b)
  geste({ id: "outil-son-musique-ouverte", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "audio_ace_step1_5_xl_turbo", credits: 3, high: 6, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 27.10.2026 : 3,37 crédits pour 30 s (job a14b4cd4)
  geste({ id: "outil-son-bruitage-ouvert", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "audio_stable_audio_3_medium", credits: 2, high: 3, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 27.10.2026 : 1,66 crédits pour 1 bruitage (job 54ab5718)
  geste({ id: "outil-ret-eclairer", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "template_character_portrait_relighting", credits: 18, high: 27, nature: "hypothese", premier: false, still: "outil", minRefs: 0, consigne: "" }),
  geste({ id: "outil-vid-prolonger-grok", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_grok_video_extend", credits: 136, high: 204, nature: "hypothese", premier: false, still: "outil", minRefs: 0, consigne: "" }),
  geste({ id: "outil-vid-detourer", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_bria_remove_video_background", credits: 63, high: 95, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 27.10.2026 : 63,30 crédits pour API, 1 clip (job 74567076)
  geste({ id: "outil-vid-levres", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_sync_so_lip_sync_video", credits: 280, high: 420, nature: "mesure", premier: false, still: "outil", minRefs: 0, consigne: "" }), // mesuré 27.10.2026 : 278 crédits pour ~5 s → registre 280 / high 420
  geste({ id: "outil-son-musique-video", onglet: "outils", categorie: "outil", clef: "outil", fournit: ["asset"], slots: [], template: "api_sonilo_v2m", credits: 10, high: 15, nature: "hypothese", premier: false, still: "outil", minRefs: 0, consigne: "" }),
];

export function gesteParId(id: string): Geste | null {
  return REGISTRE.find(item => item.id === id) ?? null;
}

/** What a visitor sees with these options. Nano Banana is off unless asked; Open Weights Only drops partner nodes. */
export function gesteVisible(row: Geste, filtre: FiltreGestes = {}): boolean {
  if (row.option === "nano" && !filtre.nanoBanana) return false;
  if (filtre.openWeightsOnly && row.partenaire) return false;
  return true;
}

/** The « Et ensuite ? » tools a visitor sees. */
export function gestesSuite(filtre: FiltreGestes = {}): Geste[] {
  return REGISTRE.filter(item => item.onglet === "suite" && gesteVisible(item, filtre));
}

export function gestesOnglet(onglet: Onglet, filtre: FiltreGestes = {}): { premiers: Geste[]; suite: Geste[] } {
  const rows = REGISTRE.filter(item => item.onglet === onglet && gesteVisible(item, filtre));
  return { premiers: rows.filter(item => item.premier), suite: rows.filter(item => !item.premier) };
}

export function gesteOuvert(geste: Geste): boolean {
  return geste.still !== null && geste.credits !== null && geste.high !== null && geste.nature !== "non-mesure";
}

export interface CaseRef {
  id: string;
  role: RoleRef;
  media: "image" | "video" | "audio";
}

/** One box per file the graph actually receives. */
export function casesVisibles(row: Geste): CaseRef[] {
  return row.slots.map(slot => ({ id: slot.slot, role: slot.role, media: slot.media ?? "image" }));
}

export interface RefInput {
  id: string;
  role: RoleRef;
}

/** One reference fills the first free slot of the same role. Extra photos stay on the card, not in a hidden node. */
export function mapReferences(row: Geste, refs: readonly RefInput[]): { slot: string; refId: string }[] {
  const used = new Set<string>();
  const out: { slot: string; refId: string }[] = [];
  for (const slot of row.slots) {
    const ref = refs.find(item => item.role === slot.role && !used.has(item.id));
    if (!ref) continue;
    used.add(ref.id);
    out.push({ slot: slot.slot, refId: ref.id });
  }
  return out;
}

export function refsPourGraphe(row: Geste, refs: readonly RefInput[]): string[] {
  return mapReferences(row, refs).map(item => item.refId);
}

/**
 * The node that saves the final result, per template, by node id in the graph we send.
 * The studio reads this node only. Comfy also lists the loaded inputs among the outputs
 * (LoadVideo previews the source clip), so « the first video » may be the visitor's own file.
 * Checked against every graph in outils/base.ts and every wired tool graph by tests/sortie-finale.test.ts.
 */
export const NOEUD_SORTIE: Readonly<Record<string, string>> = {
  api_higgsfield_genjutsu_motion_transfer: "10",
  image_qwen_image_2_1_t2i: "461",
  api_bfl_flux3_t2i: "2",
  api_ideogram_v4_5_t2i: "5",
  api_openai_gpt_image_2_t2i: "269",
  api_bytedance_seedream_5_0_pro_t2i: "2",
  api_nano_banana_2_1_t2i: "3",
  image_qwen_image_2_1_image_edit: "461",
  video_ltx2_5_t2v: "75",
  api_kling_v3_video: "2",
  api_seedance2_5_r2v: "16",
  video_wan2_2_14B_i2v: "108",
  api_vidu_q4_preview_r2v: "6",
  api_minimax_h3_max_r2v: "2",
  video_wan_animate2: "246",
  api_tripo_p2_image_to_model: "14",
  api_hunyuan3d_image_to_model: "13",
  api_meshy7_1_image_to_model: "17",
  "audio-chatterbox_tts_multilingual": "3",
  api_elevenlabs_v4_text_to_dialogue: "220",
  audio_ace_step1_5_xl_turbo: "111",
  audio_stable_audio_3_medium: "57",
  template_qwen_Image_2512_360_lora: "60",
  image_qwen_Image_2512_controlnet: "60",
  template_character_portrait_relighting: "138",
  api_grok_video_extend: "3",
  api_bria_remove_video_background: "5",
  api_sync_so_lip_sync_video: "13",
  api_sonilo_v2m: "728",
  // Top 10 (29.10.2026): the 8 angles leave through one Batch Images node and one save.
  "templates-1_click_multiple_character_angles-v1.0": "991",
  "templates-1_click_multiple_scene_angles-v1.0": "991",
  "template_qwen_multiangle.app": "2",
  // Tools that load a file of the kind they save (suite graphs).
  image_flux3_klein_image_edit: "save",
  utility_seedvr2_3b_int8_upscale_image: "9",
  templates_doc_workbox_klein_9b_image_extend: "142",
  utility_birefnet_remove_background: "save",
  utility_seedvr2_3b_int8_upscale_video: "76",
  template_ltx2_3_lora_video_outpainting: "5152",
  template_ltx2_3_obscura_remova_lora_remove_object_from_video: "53",
  utility_video_frame_interpolation: "7",
};
