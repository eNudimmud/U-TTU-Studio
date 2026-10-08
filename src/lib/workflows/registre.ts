// Studio gestures. Each card hides one template id from the official Comfy catalog
// (docs/TEMPLATES-COMFY.md and the catalogs synced 2026-10-08). No node names here.
// A null `still` means the studio has no graph for it yet: the card stays, Créer stays off.

export const ROLES = ["visage", "tenue", "style", "lieu"] as const;
export type RoleRef = (typeof ROLES)[number];

export const ONGLET = ["cast", "decor", "prise", "montage"] as const;
export type Onglet = (typeof ONGLET)[number];

export type Fourniture = "texte" | "photo" | "photos" | "asset" | "video" | "audio";
export type NatureCout = "mesure" | "hypothese" | "non-mesure";
export type StillKindName = "texte-cast" | "texte-decor" | "photo-decor" | "photo-cast" | "planche";

export interface SlotImage {
  role: RoleRef;
  /** Template image input. Not a node class. */
  slot: string;
}

export interface Geste {
  id: string;
  onglet: Onglet;
  categorie: "identite" | "apparence" | "finition" | "lieu" | "variante" | "plan" | "raccord" | "mouvement" | "son" | "image";
  clef: string;
  fournit: readonly Fourniture[];
  slots: readonly SlotImage[];
  template: string;
  credits: number | null;
  high: number | null;
  nature: NatureCout;
  premier: boolean;
  /** Graph already in the studio. `prise` is the measured take. Null stays closed. */
  still: StillKindName | "prise" | null;
  minRefs: number;
  /** Appended to the visitor text inside the graph. Studio words, not a model setting. */
  consigne: string;
}

/** Ids read in the official catalogs or in docs/TEMPLATES-COMFY.md. Nothing else is allowed. */
export const TEMPLATES_OFFICIELS = [
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
] as const;

const KNOWN = new Set<string>(TEMPLATES_OFFICIELS);

function geste(row: Geste): Geste {
  if (!KNOWN.has(row.template)) throw new Error(`Template absent du catalogue : ${row.template}`);
  return row;
}

const FACE = (slot: string): SlotImage => ({ role: "visage", slot });
const TENUE = (slot: string): SlotImage => ({ role: "tenue", slot });
const STYLE = (slot: string): SlotImage => ({ role: "style", slot });
const LIEU = (slot: string): SlotImage => ({ role: "lieu", slot });

export const REGISTRE: readonly Geste[] = [
  geste({
    id: "cast-photos", onglet: "cast", categorie: "identite", clef: "castPhotos",
    fournit: ["photos"], slots: [FACE("image_1"), FACE("image_2"), FACE("image_3")],
    template: "api_nano_banana_2_1_image_edit", credits: 12, high: 18, nature: "hypothese",
    premier: true, still: "photo-cast", minRefs: 1,
    consigne: "Même personne que les photos. Visage reconnaissable. Fond simple. Pas de texte.",
  }),
  geste({
    id: "cast-planche", onglet: "cast", categorie: "identite", clef: "castSheet",
    fournit: ["photo"], slots: [FACE("image_1")],
    template: "templates-character_sheet", credits: 24, high: 36, nature: "hypothese",
    premier: true, still: "planche", minRefs: 1,
    consigne: "Planche : face, trois-quarts, profil, dos. Même personne.",
  }),
  geste({
    id: "cast-texte", onglet: "cast", categorie: "identite", clef: "castText",
    fournit: ["texte"], slots: [],
    template: "api_nano_banana_2_1_t2i", credits: 12, high: 18, nature: "hypothese",
    premier: true, still: "texte-cast", minRefs: 0,
    consigne: "Une personne fictive. Face, trois-quarts, profil, en pied. Fond neutre. Pas de texte.",
  }),
  geste({
    id: "cast-tenue", onglet: "cast", categorie: "apparence", clef: "castWardrobe",
    fournit: ["photos"], slots: [FACE("image_1"), TENUE("image_2")],
    template: "api_nano_banana_2_1_image_edit", credits: 12, high: 18, nature: "hypothese",
    premier: true, still: "photo-cast", minRefs: 1,
    consigne: "Garde le visage. Change seulement la tenue ou la coiffure demandée.",
  }),
  geste({
    id: "cast-angle", onglet: "cast", categorie: "apparence", clef: "castAngle",
    fournit: ["photo"], slots: [FACE("image_1")],
    template: "templates-1_click_multiple_character_angles-v1.0", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "",
  }),
  geste({
    id: "cast-expressions", onglet: "cast", categorie: "apparence", clef: "castExpression",
    fournit: ["photo", "video"], slots: [FACE("image_1")],
    template: "templates_liveportrait.app", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "",
  }),
  geste({
    id: "cast-eclair", onglet: "cast", categorie: "finition", clef: "castLight",
    fournit: ["photo"], slots: [FACE("image_1"), STYLE("image_2")],
    template: "template_character_portrait_relighting", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "",
  }),
  geste({
    id: "cast-agrandir", onglet: "cast", categorie: "finition", clef: "castUpscale",
    fournit: ["photo"], slots: [FACE("image_1")],
    template: "utility_seedvr2_3b_int8_upscale_image", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "",
  }),
  geste({
    id: "cast-volume", onglet: "cast", categorie: "finition", clef: "castVolume",
    fournit: ["photo"], slots: [FACE("image_1")],
    template: "api_hunyuan3d_image_to_model", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "",
  }),
  geste({
    id: "decor-texte", onglet: "decor", categorie: "lieu", clef: "decorText",
    fournit: ["texte"], slots: [],
    template: "api_nano_banana_2_1_t2i", credits: 12, high: 18, nature: "hypothese",
    premier: true, still: "texte-decor", minRefs: 0,
    consigne: "Plan cinéma 16:9, sans personne. Pas de texte.",
  }),
  geste({
    id: "decor-photo", onglet: "decor", categorie: "lieu", clef: "decorPhoto",
    fournit: ["photo"], slots: [LIEU("image_1")],
    template: "api_nano_banana_2_1_image_edit", credits: 12, high: 18, nature: "hypothese",
    premier: true, still: "photo-decor", minRefs: 1,
    consigne: "Même lieu que la photo. 16:9, sans personne. Pas de texte.",
  }),
  geste({
    id: "decor-heure", onglet: "decor", categorie: "variante", clef: "decorTime",
    fournit: ["photo", "texte"], slots: [LIEU("image_1")],
    template: "api_nano_banana_2_1_image_edit", credits: 12, high: 18, nature: "hypothese",
    premier: true, still: "photo-decor", minRefs: 1,
    consigne: "Même lieu. Change l’heure, la météo ou la saison. Sans personne.",
  }),
  geste({
    id: "decor-angles", onglet: "decor", categorie: "variante", clef: "decorAngles",
    fournit: ["photo"], slots: [LIEU("image_1")],
    template: "templates-1_click_multiple_scene_angles-v1.0", credits: null, high: null, nature: "non-mesure",
    premier: true, still: null, minRefs: 1, consigne: "",
  }),
  geste({
    id: "decor-elargir", onglet: "decor", categorie: "finition", clef: "decorWiden",
    fournit: ["photo"], slots: [LIEU("image_1")],
    template: "template_sirolim_any_aspect_ratio_nb2", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "",
  }),
  geste({
    id: "decor-objet", onglet: "decor", categorie: "variante", clef: "decorObject",
    fournit: ["photo", "texte"], slots: [LIEU("image_1")],
    template: "api_nano_banana_2_1_image_edit", credits: 12, high: 18, nature: "hypothese",
    premier: false, still: "photo-decor", minRefs: 1,
    consigne: "Même lieu. Enlève ou ajoute seulement ce que le texte demande. Sans personne.",
  }),
  geste({
    id: "decor-volume", onglet: "decor", categorie: "finition", clef: "decorVolume",
    fournit: ["photo"], slots: [LIEU("image_1")],
    template: "3d_pixal3d_trellis2_image_to_model", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "",
  }),
  geste({
    id: "prise-plan", onglet: "prise", categorie: "plan", clef: "prisePlan",
    fournit: ["asset", "texte"], slots: [FACE("image_1"), LIEU("image_2")],
    template: "video_minimax_h3_r2v", credits: 4, high: 6, nature: "mesure",
    premier: true, still: "prise", minRefs: 0,
    consigne: "",
  }),
  geste({
    id: "prise-image", onglet: "prise", categorie: "plan", clef: "priseStill",
    fournit: ["photo", "texte"], slots: [LIEU("image_1")],
    template: "video_minimax_h3_i2v", credits: null, high: null, nature: "non-mesure",
    premier: true, still: null, minRefs: 1, consigne: "",
  }),
  geste({
    id: "prise-raccord", onglet: "prise", categorie: "raccord", clef: "priseBridge",
    fournit: ["photos", "texte"], slots: [LIEU("image_1"), LIEU("image_2")],
    template: "video_minimax_h3_multiframe_reference", credits: null, high: null, nature: "non-mesure",
    premier: true, still: null, minRefs: 2, consigne: "",
  }),
  geste({
    id: "prise-prolonger", onglet: "prise", categorie: "raccord", clef: "priseExtend",
    fournit: ["video", "texte"], slots: [],
    template: "video_minimax_h3_i2v_continuation", credits: null, high: null, nature: "non-mesure",
    premier: true, still: null, minRefs: 0, consigne: "",
  }),
  geste({
    id: "prise-camera", onglet: "prise", categorie: "mouvement", clef: "priseCamera",
    fournit: ["video"], slots: [],
    template: "video_minimax_h3_fun_controlnet_union", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 0, consigne: "",
  }),
  geste({
    id: "prise-mouvement", onglet: "prise", categorie: "mouvement", clef: "priseMotion",
    fournit: ["photo", "video"], slots: [FACE("image_1")],
    template: "video_wan_animate2", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "",
  }),
  geste({
    id: "prise-levres", onglet: "prise", categorie: "mouvement", clef: "priseLips",
    fournit: ["photo", "audio"], slots: [FACE("image_1")],
    template: "video_ltx2_3_ia2v", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 1, consigne: "",
  }),
  geste({
    id: "prise-vidu", onglet: "prise", categorie: "plan", clef: "priseVidu",
    fournit: ["photos", "texte"], slots: [FACE("image_1"), LIEU("image_2")],
    template: "api_vidu_q4_preview_r2v", credits: 100, high: 150, nature: "hypothese",
    premier: false, still: null, minRefs: 2, consigne: "",
  }),
  geste({
    id: "mont-voix", onglet: "montage", categorie: "son", clef: "montVoice",
    fournit: ["texte"], slots: [],
    template: "api_elevenlabs_v4_text_to_speech", credits: 24.14, high: 36.21, nature: "hypothese",
    premier: true, still: null, minRefs: 0, consigne: "",
  }),
  geste({
    id: "mont-effet", onglet: "montage", categorie: "son", clef: "montSfx",
    fournit: ["texte"], slots: [],
    template: "api_elevenlabs_text_to_sound_effects", credits: 2.46, high: 3.69, nature: "hypothese",
    premier: true, still: null, minRefs: 0, consigne: "",
  }),
  geste({
    id: "mont-musique", onglet: "montage", categorie: "son", clef: "montMusic",
    fournit: ["texte"], slots: [],
    template: "api_sonilo_t2m", credits: 16, high: 24, nature: "hypothese",
    premier: true, still: null, minRefs: 0, consigne: "",
  }),
  geste({
    id: "mont-levres", onglet: "montage", categorie: "son", clef: "montLips",
    fournit: ["video", "audio"], slots: [],
    template: "video_ltx2_3_ia2v", credits: null, high: null, nature: "non-mesure",
    premier: true, still: null, minRefs: 0, consigne: "",
  }),
  geste({
    id: "mont-agrandir", onglet: "montage", categorie: "image", clef: "montUpscale",
    fournit: ["video"], slots: [],
    template: "utility_seedvr2_3b_int8_upscale_video", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 0, consigne: "",
  }),
  geste({
    id: "mont-fluide", onglet: "montage", categorie: "image", clef: "montFrames",
    fournit: ["video"], slots: [],
    template: "utility_video_frame_interpolation", credits: null, high: null, nature: "non-mesure",
    premier: false, still: null, minRefs: 0, consigne: "",
  }),
];

export function gesteParId(id: string): Geste | null {
  return REGISTRE.find(item => item.id === id) ?? null;
}

export function gestesOnglet(onglet: Onglet): { premiers: Geste[]; suite: Geste[] } {
  const rows = REGISTRE.filter(item => item.onglet === onglet);
  return { premiers: rows.filter(item => item.premier), suite: rows.filter(item => !item.premier) };
}

export function gesteOuvert(geste: Geste): boolean {
  return geste.still !== null && geste.credits !== null && geste.high !== null && geste.nature !== "non-mesure";
}

export interface CaseRef {
  id: string;
  role: RoleRef;
}

/** One box per image the graph actually receives. */
export function casesVisibles(row: Geste): CaseRef[] {
  return row.slots.map(slot => ({ id: slot.slot, role: slot.role }));
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
