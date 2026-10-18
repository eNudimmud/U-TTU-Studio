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
export type OngletGeste = Onglet | "suite";

export interface Geste {
  id: string;
  onglet: OngletGeste;
  categorie: "identite" | "apparence" | "finition" | "lieu" | "variante" | "plan" | "raccord" | "mouvement" | "vfx" | "son" | "image" | "suite";
  clef: string;
  fournit: readonly Fourniture[];
  slots: readonly SlotImage[];
  template: string;
  credits: number | null;
  high: number | null;
  nature: NatureCout;
  premier: boolean;
  /** Graph already in the studio. `prise` is the measured take. Null stays closed. */
  still: StillKindName | "prise" | "video" | "mesh" | "voix" | "effet" | "musique" | "suite" | null;
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
    template: KLEIN_EDIT, credits: 4, high: 6, nature: "hypothese",
    premier: true, still: "photo-cast", minRefs: 1,
    consigne: "Même personne que les photos. Visage reconnaissable. Fond simple. Pas de texte.",
  }),
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
  geste({
    id: "cast-angle", onglet: "cast", categorie: "apparence", clef: "castAngle",
    fournit: ["photo"], slots: [FACE("image_1")],
    template: "templates-1_click_multiple_character_angles-v1.0", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "", raison: "gestes.raisons.castAngle",
  }),
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
    template: KLEIN_EDIT, credits: 4, high: 6, nature: "hypothese",
    premier: true, still: "photo-decor", minRefs: 1,
    consigne: "Même lieu. Change l’heure, la météo ou la saison. Sans personne.",
  }),
  geste({
    id: "decor-angles", onglet: "decor", categorie: "variante", clef: "decorAngles",
    fournit: ["photo"], slots: [LIEU("image_1")],
    template: "templates-1_click_multiple_scene_angles-v1.0", credits: null, high: null, nature: "non-mesure",
    premier: true, still: null, minRefs: 1, consigne: "", raison: "gestes.raisons.decorAngles",
  }),
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
    template: "video_ltx2_5_i2v", credits: 12, high: 25, nature: "hypothese",
    premier: true, still: "prise", minRefs: 0,
    consigne: "",
  }),
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
    template: "video_ltx2_5_flf2v", credits: 12, high: 25, nature: "hypothese",
    premier: true, still: "video", minRefs: 2, consigne: "",
  }),
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
    template: "3d_pixal3d_trellis2_image_to_model", credits: 15, high: 30, nature: "hypothese",
    premier: false, still: "mesh", minRefs: 1, consigne: "",
  }),
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
    template: "template_ltx2_3_lora_video_outpainting", credits: 15, high: 30, nature: "hypothese",
    premier: false, still: "video", minRefs: 1, consigne: "",
  }),
  geste({
    id: "prise-effacer", onglet: "prise", categorie: "vfx", clef: "priseRemove",
    fournit: ["video", "texte"], slots: [{ role: "clip", slot: "video_1", media: "video" }],
    template: "template_ltx2_3_obscura_remova_lora_remove_object_from_video", credits: 15, high: 30, nature: "hypothese",
    premier: false, still: "video", minRefs: 1, consigne: "",
  }),
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
    template: KLEIN_EDIT, credits: 4, high: 6, nature: "hypothese",
    premier: false, still: "suite", minRefs: 1, consigne: "",
  }),
  geste({
    id: "suite-finaliser-image", onglet: "suite", categorie: "suite", clef: "suiteFinaliserImage",
    fournit: ["asset"], slots: [{ role: "plan", slot: "image" }],
    template: "utility_seedvr2_3b_int8_upscale_image", credits: 2, high: 4, nature: "hypothese",
    premier: false, still: "suite", minRefs: 1, consigne: "",
  }),
  geste({
    id: "suite-detourer", onglet: "suite", categorie: "suite", clef: "suiteDetourer",
    fournit: ["asset"], slots: [{ role: "plan", slot: "image" }],
    template: "utility_birefnet_remove_background", credits: 2, high: 4, nature: "hypothese",
    premier: false, still: "suite", minRefs: 1, consigne: "",
  }),
  geste({
    id: "suite-elargir", onglet: "suite", categorie: "suite", clef: "suiteElargir",
    fournit: ["asset", "texte"], slots: [{ role: "plan", slot: "image" }],
    template: "templates_doc_workbox_klein_9b_image_extend", credits: 2, high: 4, nature: "hypothese",
    premier: false, still: "suite", minRefs: 1, consigne: "",
  }),
  geste({
    id: "suite-animer", onglet: "suite", categorie: "suite", clef: "suiteAnimer",
    fournit: ["asset", "texte"], slots: [{ role: "debut", slot: "image" }],
    template: "video_minimax_h3_i2v", credits: 4, high: 8, nature: "hypothese",
    premier: false, still: "suite", minRefs: 1, consigne: "",
  }),
  geste({
    id: "suite-finaliser-video", onglet: "suite", categorie: "suite", clef: "suiteFinaliserVideo",
    fournit: ["video"], slots: [{ role: "clip", slot: "video", media: "video" }],
    template: "utility_seedvr2_3b_int8_upscale_video", credits: 8, high: 16, nature: "hypothese",
    premier: false, still: "suite", minRefs: 1, consigne: "",
  }),
  geste({
    id: "suite-fluidifier", onglet: "suite", categorie: "suite", clef: "suiteFluidifier",
    fournit: ["video"], slots: [{ role: "clip", slot: "video", media: "video" }],
    template: "utility_video_frame_interpolation", credits: 2, high: 4, nature: "hypothese",
    premier: false, still: "suite", minRefs: 1, consigne: "",
  }),
  geste({
    id: "suite-prolonger", onglet: "suite", categorie: "suite", clef: "suiteProlonger",
    fournit: ["video", "texte"], slots: [{ role: "fin", slot: "image" }],
    template: "video_minimax_h3_i2v_continuation", credits: 4, high: 8, nature: "hypothese",
    premier: false, still: "suite", minRefs: 1, consigne: "",
  }),
  geste({
    id: "suite-parler", onglet: "suite", categorie: "suite", clef: "suiteParler",
    fournit: ["asset", "audio", "texte"], slots: [{ role: "visage", slot: "image" }, { role: "voix", slot: "audio", media: "audio" }],
    template: "video_ltx2_3_ia2v", credits: 12, high: 25, nature: "hypothese",
    premier: false, still: "suite", minRefs: 2, consigne: "",
  }),
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
