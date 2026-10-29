// « Outils » : every tool of the Scenario ↔ Comfy map (docs/OUTILS.md) that has a ready
// official Comfy template, by family. A wired tool points at its registry row (budget,
// partner flag, template) and at the builder that makes its graph. A tool that is not
// wired yet carries a one-line reason and never shows a working button.

import { gesteOuvert, gesteParId, gesteVisible, templatePartenaire, type FiltreGestes, type Geste, type Onglet } from "../workflows/registre.ts";

export const FAMILLES = ["creer", "retoucher", "video", "3d", "son"] as const;
export type Famille = (typeof FAMILLES)[number];
export type Sous = "image" | "video" | "3d" | "son" | "texte";
export type Sortie = "image" | "video" | "audio" | "mesh";
/** What the panel asks for. `image2` is an optional second picture (références). */
export type Entree = "image" | "image2" | "video" | "audio";
export type Reglage = "aspect" | "camera" | "elargir" | "fluide" | "mesh" | "piste" | "resolution";
export type Moteur =
  | { kind: "generique" }
  | { kind: "klein" }
  | { kind: "suite" }
  | { kind: "take"; engine: "ltx" | "h3" }
  | { kind: "video" }
  | { kind: "mesh" }
  | { kind: "stem"; stem: "voix" | "effet" | "musique" };

export interface Outil {
  id: string;
  /** Row of the Scenario ↔ Comfy map. */
  num: number;
  famille: Famille;
  sous: Sous;
  /** Exact Comfy template id. */
  template: string;
  entrees: readonly Entree[];
  texte: "requis" | "facultatif" | "aucun";
  sortie: Sortie;
  /** Tabs that list it in their own family strip. */
  onglets: readonly Onglet[];
  /** Registry row: budget, partner flag, template. Absent while « bientôt ». */
  geste?: string;
  moteur?: Moteur;
  reglages?: readonly Reglage[];
  /** Estimated per started block of five seconds of the source. */
  parTranche?: boolean;
  /** The visitor confirms they may use the voice they upload. */
  consentement?: boolean;
  /** Pictures one run saves through the final node (the 8 angles). Each is its own asset. */
  lot?: number;
  /** i18n key under outils.why: why it is not wired yet. */
  bientot?: string;
  /** Partner price read with estimate_credits, shown on a « bientôt » card. */
  prix?: number;
}

const G = { kind: "generique" } as const;
const S = { kind: "suite" } as const;

export const OUTILS: readonly Outil[] = [
  // CRÉER · image
  { id: "img-klein", num: 1, famille: "creer", sous: "image", template: "image_flux3_klein_t2i", entrees: [], texte: "requis", sortie: "image", onglets: ["cast", "decor"], geste: "outil-img-klein", moteur: { kind: "klein" }, reglages: ["aspect"] },
  { id: "img-qwen", num: 2, famille: "creer", sous: "image", template: "image_qwen_image_2_1_t2i", entrees: [], texte: "requis", sortie: "image", onglets: ["cast", "decor"], geste: "outil-img-qwen", moteur: G, reglages: ["aspect"] },
  { id: "img-flux3", num: 3, famille: "creer", sous: "image", template: "api_bfl_flux3_t2i", entrees: [], texte: "requis", sortie: "image", onglets: ["cast", "decor"], geste: "outil-img-flux3", moteur: G, reglages: ["aspect"] },
  { id: "img-ideogram", num: 4, famille: "creer", sous: "image", template: "api_ideogram_v4_5_t2i", entrees: [], texte: "requis", sortie: "image", onglets: ["decor"], geste: "outil-img-ideogram", moteur: G, reglages: ["aspect"] },
  { id: "img-gpt", num: 5, famille: "creer", sous: "image", template: "api_openai_gpt_image_2_t2i", entrees: [], texte: "requis", sortie: "image", onglets: [], geste: "outil-img-gpt", moteur: G },
  { id: "img-seedream", num: 6, famille: "creer", sous: "image", template: "api_bytedance_seedream_5_0_pro_t2i", entrees: [], texte: "requis", sortie: "image", onglets: [], geste: "outil-img-seedream", moteur: G },
  { id: "img-nano", num: 7, famille: "creer", sous: "image", template: "api_nano_banana_2_1_t2i", entrees: [], texte: "requis", sortie: "image", onglets: [], geste: "outil-img-nano", moteur: G },
  { id: "img-refs", num: 8, famille: "creer", sous: "image", template: "image_qwen_image_2_1_image_edit", entrees: ["image", "image2"], texte: "requis", sortie: "image", onglets: ["cast"], geste: "outil-img-refs", moteur: G },
  { id: "img-360", num: 41, famille: "creer", sous: "image", template: "template_qwen_Image_2512_360_lora", entrees: [], texte: "requis", sortie: "image", onglets: ["decor"], geste: "outil-img-360", moteur: G },
  { id: "img-croquis", num: 42, famille: "creer", sous: "image", template: "image_qwen_Image_2512_controlnet", entrees: ["image"], texte: "requis", sortie: "image", onglets: ["decor"], geste: "outil-img-croquis", moteur: G },
  // CRÉER · vidéo
  { id: "vid-ltx-image", num: 9, famille: "creer", sous: "video", template: "video_ltx2_5_i2v", entrees: ["image", "image2"], texte: "requis", sortie: "video", onglets: ["prise"], geste: "prise-plan", moteur: { kind: "take", engine: "ltx" }, reglages: ["aspect"] },
  { id: "vid-texte", num: 10, famille: "creer", sous: "video", template: "video_ltx2_5_t2v", entrees: [], texte: "requis", sortie: "video", onglets: ["prise"], geste: "outil-vid-texte", moteur: G, reglages: ["aspect"] },
  { id: "vid-raccord", num: 11, famille: "creer", sous: "video", template: "video_ltx2_5_flf2v", entrees: ["image", "image2"], texte: "requis", sortie: "video", onglets: ["prise"], geste: "prise-raccord", moteur: { kind: "video" } },
  { id: "vid-h3-refs", num: 12, famille: "creer", sous: "video", template: "video_minimax_h3_r2v", entrees: ["image", "image2"], texte: "requis", sortie: "video", onglets: ["prise"], geste: "prise-plan-h3", moteur: { kind: "take", engine: "h3" }, reglages: ["aspect"] },
  { id: "vid-multi", num: 15, famille: "creer", sous: "video", template: "video_minimax_h3_multiframe_reference", entrees: ["image", "image2"], texte: "requis", sortie: "video", onglets: ["prise"], geste: "outil-vid-multi", moteur: G, reglages: ["aspect"] },
  { id: "vid-transition-style", num: 65, famille: "creer", sous: "video", template: "template_ltx2_3_style_transition", entrees: ["image", "image2"], texte: "requis", sortie: "video", onglets: ["prise"], geste: "outil-vid-transition-style", moteur: G, reglages: ["aspect"] },
  { id: "vid-h3-audio", num: 16, famille: "creer", sous: "video", template: "video_minimax_h3_r2v", entrees: ["image", "audio"], texte: "requis", sortie: "video", onglets: ["prise"], bientot: "h3Audio" },
  { id: "vid-kling", num: 17, famille: "creer", sous: "video", template: "api_kling_v3_video", entrees: ["image"], texte: "requis", sortie: "video", onglets: [], geste: "outil-vid-kling", moteur: G, reglages: ["aspect"] },
  { id: "vid-seedance", num: 18, famille: "creer", sous: "video", template: "api_seedance2_5_r2v", entrees: ["image"], texte: "requis", sortie: "video", onglets: [], geste: "outil-vid-seedance", moteur: G },
  { id: "vid-wan", num: 19, famille: "creer", sous: "video", template: "video_wan2_2_14B_i2v", entrees: ["image"], texte: "requis", sortie: "video", onglets: ["prise"], geste: "outil-vid-wan", moteur: G },
  { id: "vid-vidu", num: 21, famille: "creer", sous: "video", template: "api_vidu_q4_preview_r2v", entrees: ["image", "image2"], texte: "requis", sortie: "video", onglets: [], geste: "outil-vid-vidu", moteur: G, reglages: ["aspect"] },
  { id: "vid-h3max", num: 22, famille: "creer", sous: "video", template: "api_minimax_h3_max_r2v", entrees: ["image"], texte: "requis", sortie: "video", onglets: [], geste: "outil-vid-h3max", moteur: G },
  // CRÉER · 3D
  { id: "3d-ouvert", num: 24, famille: "3d", sous: "3d", template: "3d_pixal3d_trellis2_image_to_model", entrees: ["image"], texte: "aucun", sortie: "mesh", onglets: ["cast", "decor", "prise"], geste: "prise-volume-objet", moteur: { kind: "mesh" }, reglages: ["mesh"] },
  { id: "3d-tripo", num: 25, famille: "3d", sous: "3d", template: "api_tripo_p2_image_to_model", entrees: ["image"], texte: "aucun", sortie: "mesh", onglets: [], geste: "outil-3d-tripo", moteur: G },
  { id: "3d-hunyuan", num: 26, famille: "3d", sous: "3d", template: "api_hunyuan3d_image_to_model", entrees: ["image"], texte: "aucun", sortie: "mesh", onglets: ["cast"], geste: "outil-3d-hunyuan", moteur: G },
  { id: "3d-meshy", num: 27, famille: "3d", sous: "3d", template: "api_meshy7_1_image_to_model", entrees: ["image"], texte: "aucun", sortie: "mesh", onglets: [], geste: "outil-3d-meshy", moteur: G },
  { id: "3d-uv", num: 28, famille: "3d", sous: "3d", template: "api_hunyuan3d_model2uv", entrees: [], texte: "aucun", sortie: "mesh", onglets: [], bientot: "entree3d", prix: 42 },
  { id: "3d-parties", num: 29, famille: "3d", sous: "3d", template: "api_hunyuan3d_part", entrees: [], texte: "aucun", sortie: "mesh", onglets: [], bientot: "entree3d", prix: 127 },
  { id: "3d-monde", num: 31, famille: "3d", sous: "3d", template: "3d_triposplat_image_to_gaussian_splat", entrees: ["image"], texte: "aucun", sortie: "mesh", onglets: ["decor"], bientot: "splat" },
  // SON
  { id: "son-voix-ouverte", num: 32, famille: "son", sous: "son", template: "audio-chatterbox_tts_multilingual", entrees: ["audio"], texte: "requis", sortie: "audio", onglets: ["montage"], geste: "outil-son-voix-ouverte", moteur: G, consentement: true },
  { id: "son-voix", num: 32, famille: "son", sous: "son", template: "api_elevenlabs_v4_text_to_speech", entrees: [], texte: "requis", sortie: "audio", onglets: ["montage"], geste: "mont-voix", moteur: { kind: "stem", stem: "voix" } },
  { id: "son-dialogue", num: 33, famille: "son", sous: "son", template: "api_elevenlabs_v4_text_to_dialogue", entrees: [], texte: "requis", sortie: "audio", onglets: ["montage"], geste: "outil-son-dialogue", moteur: G },
  { id: "son-musique-ouverte", num: 34, famille: "son", sous: "son", template: "audio_ace_step1_5_xl_turbo", entrees: [], texte: "requis", sortie: "audio", onglets: ["montage"], geste: "outil-son-musique-ouverte", moteur: G },
  { id: "son-musique", num: 34, famille: "son", sous: "son", template: "api_sonilo_t2m", entrees: [], texte: "requis", sortie: "audio", onglets: ["montage"], geste: "mont-musique", moteur: { kind: "stem", stem: "musique" } },
  { id: "son-bruitage-ouvert", num: 35, famille: "son", sous: "son", template: "audio_stable_audio_3_medium", entrees: [], texte: "requis", sortie: "audio", onglets: ["montage"], geste: "outil-son-bruitage-ouvert", moteur: G },
  { id: "son-bruitage", num: 35, famille: "son", sous: "son", template: "api_elevenlabs_text_to_sound_effects", entrees: [], texte: "requis", sortie: "audio", onglets: ["montage"], geste: "mont-effet", moteur: { kind: "stem", stem: "effet" } },
  { id: "son-clone", num: 37, famille: "son", sous: "son", template: "audio-chatterbox_vc", entrees: ["audio"], texte: "aucun", sortie: "audio", onglets: [], bientot: "clone" },
  { id: "son-transcrire", num: 38, famille: "son", sous: "texte", template: "api_elevenLabs_speech_to_text", entrees: ["audio"], texte: "aucun", sortie: "audio", onglets: ["montage"], bientot: "texte", prix: 2 },
  { id: "son-musique-video", num: 56, famille: "son", sous: "son", template: "api_sonilo_v2m", entrees: ["video"], texte: "facultatif", sortie: "audio", onglets: ["montage"], geste: "outil-son-musique-video", moteur: G, parTranche: true },
  { id: "son-bruitage-video", num: 63, famille: "son", sous: "son", template: "api_mirelo_video_to_sfx", entrees: ["video"], texte: "facultatif", sortie: "audio", onglets: ["montage"], geste: "outil-son-bruitage-video", moteur: G, parTranche: true },
  { id: "son-separer", num: 64, famille: "son", sous: "son", template: "audio_melbandroformer_audio_separation", entrees: ["audio"], texte: "aucun", sortie: "audio", onglets: ["montage"], geste: "outil-son-separer", moteur: G, reglages: ["piste"] },
  // CRÉER · texte
  { id: "txt-decrire", num: 39, famille: "creer", sous: "texte", template: "llm_qwen3vl_text_gen", entrees: ["image"], texte: "aucun", sortie: "image", onglets: [], bientot: "texte" },
  // RETOUCHER
  { id: "ret-modifier", num: 43, famille: "retoucher", sous: "image", template: "image_flux3_klein_image_edit", entrees: ["image"], texte: "requis", sortie: "image", onglets: ["cast", "decor"], geste: "suite-modifier", moteur: S },
  { id: "ret-finaliser", num: 44, famille: "retoucher", sous: "image", template: "utility_seedvr2_3b_int8_upscale_image", entrees: ["image"], texte: "aucun", sortie: "image", onglets: ["cast", "decor"], geste: "suite-finaliser-image", moteur: S },
  { id: "ret-elargir", num: 45, famille: "retoucher", sous: "image", template: "templates_doc_workbox_klein_9b_image_extend", entrees: ["image"], texte: "facultatif", sortie: "image", onglets: ["decor"], geste: "suite-elargir", moteur: S, reglages: ["elargir"] },
  { id: "ret-detourer", num: 46, famille: "retoucher", sous: "image", template: "utility_birefnet_remove_background", entrees: ["image"], texte: "aucun", sortie: "image", onglets: ["cast"], geste: "suite-detourer", moteur: S },
  { id: "ret-gommer", num: 47, famille: "retoucher", sous: "image", template: "image_flux.1_fill_dev_OneReward", entrees: ["image"], texte: "requis", sortie: "image", onglets: [], bientot: "masque" },
  { id: "ret-vectoriser", num: 48, famille: "retoucher", sous: "image", template: "api_quiver_arrow2_image_to_svg", entrees: ["image"], texte: "aucun", sortie: "image", onglets: [], bientot: "svg", prix: 9 },
  { id: "ret-eclairer-ouvert", num: 50, famille: "retoucher", sous: "image", template: "image_qwen_image_edit_2509_relight", entrees: ["image"], texte: "requis", sortie: "image", onglets: ["cast"], geste: "outil-ret-eclairer-ouvert", moteur: G },
  { id: "ret-eclairer", num: 50, famille: "retoucher", sous: "image", template: "template_character_portrait_relighting", entrees: ["image"], texte: "requis", sortie: "image", onglets: ["cast"], geste: "outil-ret-eclairer", moteur: G },
  { id: "ret-angles-perso", num: 60, famille: "retoucher", sous: "image", template: "templates-1_click_multiple_character_angles-v1.0", entrees: ["image"], texte: "aucun", sortie: "image", onglets: ["cast"], geste: "cast-angle", moteur: G, lot: 8 },
  { id: "ret-angles-decor", num: 61, famille: "retoucher", sous: "image", template: "templates-1_click_multiple_scene_angles-v1.0", entrees: ["image"], texte: "aucun", sortie: "image", onglets: ["decor"], geste: "decor-angles", moteur: G, lot: 8 },
  { id: "ret-camera", num: 62, famille: "retoucher", sous: "image", template: "template_qwen_multiangle.app", entrees: ["image"], texte: "aucun", sortie: "image", onglets: ["cast", "decor"], geste: "outil-ret-camera", moteur: G, reglages: ["camera"] },
  // VIDÉO
  { id: "vid-animer", num: 13, famille: "video", sous: "video", template: "video_minimax_h3_i2v", entrees: ["image"], texte: "requis", sortie: "video", onglets: ["prise"], geste: "suite-animer", moteur: S, reglages: ["aspect"] },
  { id: "vid-prolonger", num: 14, famille: "video", sous: "video", template: "video_minimax_h3_i2v_continuation", entrees: ["video"], texte: "facultatif", sortie: "video", onglets: ["prise"], geste: "suite-prolonger", moteur: S },
  { id: "vid-parler", num: 36, famille: "video", sous: "video", template: "video_ltx2_3_ia2v", entrees: ["image", "audio"], texte: "requis", sortie: "video", onglets: ["prise", "montage"], geste: "suite-parler", moteur: S, reglages: ["aspect"] },
  { id: "vid-finaliser", num: 51, famille: "video", sous: "video", template: "utility_seedvr2_3b_int8_upscale_video", entrees: ["video"], texte: "aucun", sortie: "video", onglets: ["prise", "montage"], geste: "suite-finaliser-video", moteur: S, reglages: ["fluide"], parTranche: true },
  { id: "vid-prolonger-grok", num: 52, famille: "video", sous: "video", template: "api_grok_video_extend", entrees: ["video"], texte: "requis", sortie: "video", onglets: [], geste: "outil-vid-prolonger-grok", moteur: G },
  { id: "vid-recadrer", num: 53, famille: "video", sous: "video", template: "template_ltx2_3_lora_video_outpainting", entrees: ["video"], texte: "aucun", sortie: "video", onglets: ["prise"], geste: "prise-elargir", moteur: { kind: "video" } },
  { id: "vid-detourer", num: 54, famille: "video", sous: "video", template: "api_bria_remove_video_background", entrees: ["video"], texte: "aucun", sortie: "video", onglets: [], geste: "outil-vid-detourer", moteur: G, parTranche: true },
  { id: "vid-levres", num: 55, famille: "video", sous: "video", template: "api_sync_so_lip_sync_video", entrees: ["video", "audio"], texte: "aucun", sortie: "video", onglets: ["montage"], geste: "outil-vid-levres", moteur: G, parTranche: true },
  { id: "vid-effacer", num: 57, famille: "video", sous: "video", template: "template_ltx2_3_obscura_remova_lora_remove_object_from_video", entrees: ["video"], texte: "requis", sortie: "video", onglets: ["prise"], geste: "prise-effacer", moteur: { kind: "video" } },
  { id: "vid-fluidifier", num: 58, famille: "video", sous: "video", template: "utility_video_frame_interpolation", entrees: ["video"], texte: "aucun", sortie: "video", onglets: ["montage"], geste: "suite-fluidifier", moteur: S, parTranche: true },
  { id: "vid-mouvement", num: 23, famille: "video", sous: "video", template: "video_wan_animate2", entrees: ["image", "video"], texte: "facultatif", sortie: "video", onglets: ["prise"], geste: "outil-vid-mouvement", moteur: G },
  { id: "vid-genjutsu", num: 59, famille: "video", sous: "video", template: "api_higgsfield_genjutsu_motion_transfer", entrees: ["video", "image", "image2"], texte: "facultatif", sortie: "video", onglets: ["prise"], geste: "outil-vid-genjutsu", moteur: G, reglages: ["resolution"] },
];

export function outilParId(id: string): Outil | null {
  return OUTILS.find(item => item.id === id) ?? null;
}

export function outilParGeste(geste: string): Outil | null {
  return OUTILS.find(item => item.geste === geste) ?? null;
}

export function outilRow(outil: Outil): Geste | null {
  return outil.geste ? gesteParId(outil.geste) : null;
}

export function outilPartenaire(outil: Outil): boolean {
  return outilRow(outil)?.partenaire ?? templatePartenaire(outil.template);
}

export type Etat =
  | { kind: "pret" }
  | { kind: "bientot"; raison: string }
  | { kind: "masque"; raison: "openWeights" | "nano" };

/** Ready, hidden by a studio option, or not wired yet (with its reason). Never a fake button. */
export function outilEtat(outil: Outil, filtre: FiltreGestes = {}): Etat {
  const row = outilRow(outil);
  if (outil.bientot || !row || !gesteOuvert(row)) return { kind: "bientot", raison: outil.bientot ?? "unwired" };
  if (!gesteVisible(row, filtre)) return { kind: "masque", raison: row.option === "nano" && !filtre.nanoBanana ? "nano" : "openWeights" };
  return { kind: "pret" };
}

/** Family filter: a tool shows under its family and under the kind of thing it makes. */
export function dansFamille(outil: Outil, famille: Famille | "tout"): boolean {
  if (famille === "tout") return true;
  if (outil.famille === famille) return true;
  if (famille === "video") return outil.sous === "video";
  if (famille === "3d") return outil.sous === "3d";
  if (famille === "son") return outil.sous === "son";
  return false;
}

export function outilsOnglet(onglet: Onglet): Outil[] {
  return OUTILS.filter(item => item.onglets.includes(onglet));
}

/** Plain-text search over the localised name and line (lowercase, accents ignored). */
export function cherche(text: string, needle: string): boolean {
  const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const words = fold(needle).split(/\s+/).filter(Boolean);
  const hay = fold(text);
  return words.every(word => hay.includes(word));
}

/**
 * One intent, several models. The key is the card the visitor sees.
 * The first id is the open-weight default; the others are choices inside the tool.
 */
export const INTENT_MODELES: Record<string, readonly string[]> = {
  "vid-wan": ["vid-wan", "vid-ltx-image", "vid-animer", "vid-kling", "vid-seedance", "vid-h3max"],
  "vid-prolonger": ["vid-prolonger", "vid-prolonger-grok"],
  "3d-ouvert": ["3d-ouvert", "3d-tripo", "3d-hunyuan", "3d-meshy"],
  "son-voix-ouverte": ["son-voix-ouverte", "son-voix"],
  "son-musique-ouverte": ["son-musique-ouverte", "son-musique"],
  "son-bruitage-ouvert": ["son-bruitage-ouvert", "son-bruitage"],
  "ret-eclairer-ouvert": ["ret-eclairer-ouvert", "ret-eclairer"],
  "vid-h3-refs": ["vid-h3-refs", "vid-vidu"],
};

const VARIANTE = new Map<string, string>();
for (const [head, ids] of Object.entries(INTENT_MODELES)) for (const id of ids) VARIANTE.set(id, head);

/** The public card of a tool. A variant points at its open-weight default. */
export function intentDe(id: string): string {
  return VARIANTE.get(id) ?? id;
}

/** Where the card sits in the grid and the Créer menu. Video, 3D and sound leave « Créer ». */
export function familleVitrine(outil: Outil): Famille {
  if (outil.sous === "video") return "video";
  if (outil.sous === "3d") return "3d";
  if (outil.sous === "son") return "son";
  return outil.famille;
}

/** Ready models of one intent, open-weight first. Unwired tools are absent. */
export function modelesIntent(id: string, filtre: FiltreGestes = {}): Outil[] {
  const head = intentDe(id);
  const order = INTENT_MODELES[head] ?? [head];
  return order.flatMap(item => {
    const outil = outilParId(item);
    return outil && outilEtat(outil, filtre).kind === "pret" ? [outil] : [];
  });
}

/**
 * What menus, the grid and search list: one card per intent.
 * The ten unwired tools stay in `OUTILS` and never appear here.
 */
export function outilsPublics(filtre: FiltreGestes = {}): Outil[] {
  const seen = new Set<string>();
  const out: Outil[] = [];
  for (const item of OUTILS) {
    const head = intentDe(item.id);
    if (seen.has(head)) continue;
    seen.add(head);
    const models = modelesIntent(head, filtre);
    if (models[0]) out.push(models[0]);
  }
  return out;
}

/** A tab's tools, from the same public cards (a card shows if any of its models belongs to the tab). */
export function outilsPublicsOnglet(onglet: Onglet, filtre: FiltreGestes = {}): Outil[] {
  const onTab = new Set(OUTILS.filter(item => item.onglets.includes(onglet)).map(item => item.id));
  return outilsPublics(filtre).filter(item => {
    const ids = INTENT_MODELES[intentDe(item.id)] ?? [item.id];
    return ids.some(id => onTab.has(id));
  });
}

/** Splits a family so a column stays short (about eight names). */
export function colonnes<T>(items: readonly T[], size = 8): T[][] {
  const cols: T[][] = [];
  for (let index = 0; index < items.length; index += size) cols.push(items.slice(index, index + size));
  return cols;
}
