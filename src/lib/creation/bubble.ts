// Native creation: the already integrated Klein, LTX text-to-video and H3 reference templates.
import { KLEIN_BASE_CFG, kleinNodes } from '../render/klein-graph.ts';
import { H3_R2V_BASE } from '../render/h3-base.ts';
import { TAKE_ASPECTS, type ApiGraph } from '../render/take-graph.ts';
import { generiqueGraph } from '../outils/generique.ts';
import { OUTIL_BASES } from '../outils/base.ts';
import { gesteParId } from '../workflows/registre.ts';
import { CREATION_REFERENCES_MAX, fileLikeName } from './named-references.ts';

/**
 * Image engine when references are attached. `klein`: FLUX 3 Klein, open weights, the default.
 * `qwen`: Qwen Image 2.1 edit, open weights, its vision encoder reads each photo as its own numbered
 * image. `nano`: Nano Banana 2.1, a paid Google partner node, only reachable with partner services on
 * (the studio runs open weights only by default, JD 31.10.2026).
 */
export type BubbleImageEngine = 'nano' | 'klein' | 'qwen' | 'flux2';
/** `flux2`: FLUX.2 dev, open weights (non-commercial licence, run on Comfy Cloud for credits), JD 01.11.2026. */
export const OPEN_BUBBLE_ENGINES = ['klein', 'qwen', 'flux2'] as const;
export interface BubbleSettings { format: '16:9' | '9:16' | '1:1'; resolution: '480p' | '720p'; duration: 5 | 10; sound: boolean; engine?: BubbleImageEngine }
export const BUBBLE_DEFAULTS: BubbleSettings = { format: '16:9', resolution: '480p', duration: 5, sound: true };
export type BubbleMode = 'image' | 'video';
/**
 * The engine an image bubble runs on. Text-only stills stay on Klein; open-weights accounts never reach
 * Nano Banana, whatever was saved. With partners allowed and nothing chosen, Nano stays the default.
 */
export function bubbleImageEngine(mode: BubbleMode, count: number, s: Pick<BubbleSettings, 'engine'>, openWeightsOnly = false): BubbleImageEngine | null {
  if (mode !== 'image') return null;
  if (count === 0) return 'klein';
  if (s.engine === 'klein' || s.engine === 'qwen' || s.engine === 'flux2') return s.engine;
  return openWeightsOnly ? 'klein' : 'nano';
}
/** The engines the bubble settings offer: open weights only never lists a partner engine. */
export function bubbleEngineChoices(openWeightsOnly: boolean): readonly BubbleImageEngine[] {
  return openWeightsOnly ? OPEN_BUBBLE_ENGINES : ['nano', ...OPEN_BUBBLE_ENGINES];
}
/**
 * Output frame. Video keeps 480p/720p. A still is never a video frame: the same two choices give
 * Klein's native 1 MP (16:9 = 1344×768) or 2 MP, the sizes the official templates work at.
 */
const STILL_SIZES = {
  '480p': { '16:9': [1344, 768], '9:16': [768, 1344], '1:1': [1024, 1024] },
  '720p': { '16:9': [1920, 1088], '9:16': [1088, 1920], '1:1': [1440, 1440] },
} as const;
export function bubbleSize(s: BubbleSettings, mode: BubbleMode = 'video'): { width: number; height: number; megapixels: number } {
  if (mode === 'image') {
    const [width, height] = STILL_SIZES[s.resolution][s.format];
    return { width, height, megapixels: width * height / (1024 * 1024) };
  }
  const side = s.resolution === '720p' ? 720 : 480;
  const long = Math.round(side * 16 / 9 / 32) * 32;
  const short = Math.round(side / 32) * 32;
  const width = s.format === '9:16' ? short : s.format === '1:1' ? short : long;
  const height = s.format === '16:9' ? short : s.format === '1:1' ? short : long;
  return { width, height, megapixels: width * height / (1024 * 1024) };
}
/** What the resolution choice is called: « 480p » for a video, « 1 MP » for a still. */
export function bubbleResolutionLabel(mode: BubbleMode, resolution: BubbleSettings['resolution']): string {
  return mode === 'image' ? resolution === '720p' ? '2 MP' : '1 MP' : resolution;
}
/** References are encoded at the official template's 1 MP: a character sheet keeps readable views. */
export const BUBBLE_REFERENCE_MEGAPIXELS = 1;
export function validBubbleSettings(s: unknown): s is BubbleSettings {
  if (!s || typeof s !== 'object') return false;
  const v = s as BubbleSettings;
  return ['16:9','9:16','1:1'].includes(v.format) && ['480p','720p'].includes(v.resolution) && [5,10].includes(v.duration) && typeof v.sound === 'boolean' && (v.engine === undefined || v.engine === 'nano' || v.engine === 'klein' || v.engine === 'qwen' || v.engine === 'flux2');
}
export function bubbleTool(mode: BubbleMode, count: number, audio = false): string {
  return mode === 'image' ? count ? 'img-refs' : 'img-klein' : count || audio ? 'vid-h3-refs' : 'vid-texte';
}
export function bubbleGeste(mode: BubbleMode, count: number, audio = false, engine: BubbleImageEngine | null = null): string {
  if (mode === 'image' && count && engine === 'nano') return 'creation-image-nano';
  if (mode === 'image' && count && engine === 'qwen') return 'creation-image-qwen';
  if (mode === 'image' && count && engine === 'flux2') return 'creation-image-flux2';
  return mode === 'image' ? count ? 'creation-image' : 'creation-image-texte' : count || audio ? 'creation-video-refs' : 'creation-video-texte';
}
/**
 * Nano Banana 2.1 is priced per output image (Comfy estimate_credits, 2026-10-31, 7 references):
 * ≈ 12 credits at 1K, ≈ 17 at 2K. The reference photos add little; the upper bound keeps a margin.
 */
export const NANO_QUOTE = { '480p': { credits: 12, high: 15 }, '720p': { credits: 17, high: 22 } } as const;
export const NANO_RESOLUTION = { '480p': '1K', '720p': '2K' } as const;
const IMAGE_CREDITS_PER_MP = 1.4, IMAGE_EDIT_CREDITS_PER_MP = 2.4, UPSAMPLER_CREDITS = 1;
/**
 * Past three pictures the area stays 3 MP, but each extra picture still costs: the upsampler reads it and
 * the sampler attends to its tokens. Measured: 3 refs = 38.5 GPU s ≈ 10.5 credits (fef595a7); 7 refs =
 * 14 credits, twice (job 96b0a72b, 50.9 GPU s; then JD's 31.10 evening test). (14 − 10.5) / 4 ≈ 0.85.
 */
const EXTRA_REFERENCE_CREDITS = 0.85;
/**
 * Qwen Image 2.1 edit (25 steps, cfg 1, no prompt enhancer): measured 2.01 credits for a 1 MP picture and
 * one 1 MP reference (job 2ac9e65b, 27.10.2026), so ≈ 1 credit per MP the sampler reads and writes. Each
 * picture is also read by the 8B vision encoder: 0.25 per picture is a margin, not a measure.
 */
const QWEN_CREDITS_PER_MP = 1, QWEN_CREDITS_PER_PICTURE = 0.25;
/**
 * FLUX.2 dev (32B, 20 steps, guidance 4, Mistral 3 Small 24B text encoder). First run on Comfy Cloud
 * (01.11.2026, job d107aeb5, rtx_pro_6000): 1344×768 + 5 refs at 1 MP = 128 GPU s ≈ 35 credits, about
 * 5.8 per MP read and written. One run, possibly a cold worker, attributed from the billing feed: the
 * quote keeps 6 per MP + 2 for the text encoder (7 refs ≈ 50 crédits estimés, 5 refs ≈ 38, high ×2) and still says
 * « prix à confirmer » (FLUX2_PRICE_CONFIRMED) until the studio reads a billed cost itself.
 */
const FLUX2_CREDITS_PER_MP = 6, FLUX2_ENCODER_CREDITS = 2;
export const FLUX2_REFERENCE_MEGAPIXELS = 1;
export const FLUX2_PRICE_CONFIRMED = false;
/** True while the engine's price is a reckoning, not a measure: the bubble says « prix à confirmer ». */
export function bubblePriceUnconfirmed(mode: BubbleMode, count: number, engine: BubbleImageEngine | null): boolean {
  return mode === 'image' && count > 0 && engine === 'flux2' && !FLUX2_PRICE_CONFIRMED;
}
export function bubbleQuote(mode: BubbleMode, count: number, s: BubbleSettings, audio = false, engine: BubbleImageEngine | null = null) {
  if (!validBubbleSettings(s) || count < 0 || count > CREATION_REFERENCES_MAX) return null;
  if (mode === 'image' && count > 0 && engine === 'nano') return { ...NANO_QUOTE[s.resolution], kind: 'estime' as const };
  if (mode === 'image' && count > 0 && engine === 'qwen') {
    const credits = Math.ceil(QWEN_CREDITS_PER_MP * (bubbleSize(s, mode).megapixels + count * bubbleReferenceMegapixels(count)) + count * QWEN_CREDITS_PER_PICTURE);
    return { credits, high: Math.ceil(credits * 2), kind: 'estime' as const };
  }
  if (mode === 'image' && count > 0 && engine === 'flux2') {
    const credits = Math.ceil(FLUX2_CREDITS_PER_MP * (bubbleSize(s, mode).megapixels + count * FLUX2_REFERENCE_MEGAPIXELS) + FLUX2_ENCODER_CREDITS);
    return { credits, high: Math.ceil(credits * 2), kind: 'estime' as const };
  }
  const id = bubbleTool(mode, count, audio);
  const row = gesteParId(id === 'img-klein' ? 'cast-eclair' : id === 'img-refs' ? 'suite-modifier' : id === 'vid-h3-refs' ? 'prise-plan-h3' : 'outil-vid-texte');
  // Different sizes/reference counts are estimates. Never inherit the source row's measured label.
  const pixels = bubbleSize(s, mode).megapixels;
  if (mode === 'image') {
    // Klein edit cost follows the pixels it reads and writes: canvas + each reference at BUBBLE_REFERENCE_MEGAPIXELS,
    // plus the vision prompt upsampler when references are attached. Measured on Comfy Cloud (rtx_pro_6000, 2026-10-30):
    // 1344×768 + 3 refs at 1 MP + upsampler at cfg 1 = 23.7 GPU s ≈ 6.5 credits (job 9e8c477b); at cfg 3.5
    // (KLEIN_BASE_CFG, a second pass per step) = 38.5 s ≈ 10.5 credits (job fef595a7). Text-only stays on t2i (cfg 3.5).
    const perMp = count > 0 ? IMAGE_EDIT_CREDITS_PER_MP : IMAGE_CREDITS_PER_MP;
    const credits = Math.ceil(perMp * (pixels + count * bubbleReferenceMegapixels(count)) + (count > 0 ? UPSAMPLER_CREDITS : 0) + Math.max(0, count - 3) * EXTRA_REFERENCE_CREDITS);
    return { credits, high: Math.ceil(credits * 1.5), kind: 'estime' as const };
  }
  const base = row?.credits ?? 5;
  const factor = s.duration / 5 * Math.max(1, pixels / 0.4) * (1 + Math.max(0, count - 1) * 0.15 + (audio ? 0.2 : 0));
  const credits = Math.ceil(base * factor);
  return { credits, high: Math.ceil(credits * 2), kind: 'estime' as const };
}
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'];
const ordinal = (i: number) => ORDINALS[i] ?? `${i + 1}th`;
/** « the first image », « the second and third images », « the fourth to sixth images ». */
export function imageOrdinals(first: number, count: number): string {
  if (count <= 1) return `the ${ordinal(first)} image`;
  if (count === 2) return `the ${ordinal(first)} and ${ordinal(first + 1)} images`;
  return `the ${ordinal(first)} to ${ordinal(first + count - 1)} images`;
}
const ROLE: Record<string, string> = {
  cast: 'a character from the cast: keep this exact character, same face, species, body, colours, outfit and logos. A picture with several views (a character sheet) still shows ONE character',
  decor: 'the place where the scene happens: the new picture is set in or on this place, never in a generic one. Keep its architecture, shapes, colours and materials; the characters are inside it at a believable scale. If the request names a part of it the pictures do not show (a deck, an interior, a street), build that part in the same design, colours and materials',
  objet: 'an object to include',
  style: 'the visual style to follow',
  photo: 'an attached photo',
};
const NOUN: Record<string, string> = { cast: 'character', decor: 'place', objet: 'object', style: 'style', photo: 'subject', result: 'subject' };
/** The order the pictures are sent in: who first, what next, where last. */
const ORDER: Record<string, number> = { cast: 0, photo: 1, result: 1, objet: 2, style: 3, decor: 4 };
export interface BubbleReference { name: string; description?: string; category?: string; /** Pictures of this reference, in send order. */ pictures?: readonly string[] }
export interface BubbleSlot { ref: number; picture: string }
/**
 * Every saved photo of every attached reference reaches the graph as its own image, never a
 * pre-made contact sheet: each reference gets one picture, then the rest round-robin up to `max`.
 * Pictures of the same reference stay consecutive so the prompt can name them together.
 * Null when there are more references than pictures the engine reads.
 */
export function bubbleReferenceSlots(refs: readonly BubbleReference[], max = CREATION_REFERENCES_MAX): BubbleSlot[] | null {
  if (refs.length > max) return null;
  const order = refs.map((r, i) => i).sort((a, b) => (ORDER[refs[a].category ?? 'photo'] ?? 1) - (ORDER[refs[b].category ?? 'photo'] ?? 1) || a - b);
  const lists = refs.map(r => [...new Set((r.pictures ?? []).filter(Boolean))]);
  const counts = refs.map(() => 0);
  let left = max;
  for (let round = 0; left > 0; round++) {
    let added = false;
    for (const i of order) if (left > 0 && lists[i].length > round) { counts[i]++; left--; added = true; }
    if (!added) break;
  }
  return order.flatMap(i => lists[i].slice(0, counts[i]).map(picture => ({ ref: i, picture })));
}
/** A bubble chip as the slots read it: every saved photo the page can load, else its preview. */
export function chipReference(ref: { kind: string; name: string; description?: string; path?: string; src?: string; images?: readonly string[] }, loadable: (path: string) => boolean): BubbleReference {
  const photos = (ref.images ?? []).filter(loadable);
  return { name: ref.name, description: ref.description, category: ref.kind, pictures: photos.length ? photos : [ref.path || ref.src || ''] };
}
/** How many pictures a bubble sends: image mode sends every photo (up to seven), video one per chip. */
export function bubblePictureCount(mode: BubbleMode, refs: readonly BubbleReference[]): number {
  return mode === 'image' ? bubbleReferenceSlots(refs)?.length ?? refs.length : refs.length;
}
/** The rendering the visitor asked for, in FR/EN/DE/ES. `null`: nothing said. */
export type BubbleStyle = 'photo' | 'drawn' | null;
const DRAWN = /(dessin|dessiné|cartoon|anime|manga|illustr|aquarell|watercolou?r|peinture|painting|pixel ?art|comic|bande dessinée|\bbd\b|zeichn|gemälde|dibujo|caricatur|pintura|ilustraci|croquis|sketch|skizze|boceto|low ?poly|toon)/i;
const PHOTO = /(photo|foto|réalis|realis|realist|cinéma|cinema|kino|live[- ]action|prise de vue|reportage|documentar)/i;
export function bubbleStyle(text: string): BubbleStyle {
  return DRAWN.test(text) ? 'drawn' : PHOTO.test(text) ? 'photo' : null;
}
/** Said after the upsampler too (it may soften it), so it always reaches the text encoder. */
export function bubbleStyleNote(style: BubbleStyle): string {
  if (style === 'photo') return 'Style: a real photograph, photorealistic, natural light, real camera lens and depth of field, lifelike skin, fur, fabric and metal textures, exactly as real as the references. Not a cartoon, not an illustration, not a painting, not anime, not a 3D-animation render.';
  if (style === 'drawn') return '';
  return 'Style: keep the rendering of the reference images; photographic references give a photographic picture, not a cartoon.';
}
/** Negative prompt for Klein base (cfg > 1 reads it). Only when a photo was asked for. */
export function bubbleNegative(style: BubbleStyle): string {
  return style === 'photo' ? 'cartoon, illustration, drawing, painting, anime, 3d animation render, toon shading, plush toy, flat colours, low detail' : '';
}
const REFERENCE_HEADER = '\n\nReference images, in order:\n';
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** « image 1 », « images 2 and 3 », « images 4 to 6 ». */
export function imageNumbers(first: number, count: number): string {
  if (count <= 1) return `image ${first + 1}`;
  if (count === 2) return `images ${first + 1} and ${first + 2}`;
  return `images ${first + 1} to ${first + count}`;
}
const NANO_NOUN: Record<string, string> = { cast: 'character', decor: 'place (the setting)', objet: 'object', style: 'visual style', photo: 'subject', result: 'subject' };
const NANO_ROLE: Record<string, string> = {
  cast: 'keep this exact character: same face, species, body proportions, colours, outfit, markings and logos',
  decor: 'the scene happens in or on this place; keep its architecture, shapes, colours and materials, and build any part the request names that the pictures do not show in the same design',
  objet: 'include this exact object',
  style: 'follow this visual style only; never copy its subjects',
  photo: 'use what this photo shows',
};
/** Always said: a sheet of panels describes a design, it is never the picture to make. */
export const NANO_SHEET_RULE = 'An image made of several panels, views or labelled drawings is a design sheet: use it only to understand the design. Never copy its panels, layout, grid, labels, captions or plain background into the new picture.';
/** Generic studio rules, sent as the Nano Banana system prompt. No name, no lore. */
export const NANO_SYSTEM_PROMPT = [
  'You are the image engine of a film studio. You always return exactly one finished image, never text.',
  'The user attaches numbered reference images. Each one belongs to a named reference listed in the request, with its category: character, object, place or style.',
  'Characters and objects keep their exact identity from their own images: face, species, anatomy, proportions, colours, clothing, markings and logos. Never mix two references, never lend one reference\'s features to another, never merge two characters into one.',
  'A place is the setting of the scene. Characters are inside it at a believable scale, with consistent light and perspective; their poses follow the request.',
  NANO_SHEET_RULE,
  'Follow the visual style the request asks for; when it asks for none, keep the rendering of the reference images.',
  'Never add text, captions, watermarks or borders.',
].join('\n');
function nanoPrompt(text: string, refs: readonly BubbleReference[], sent: readonly BubbleSlot[]): string {
  const groups: { ref: number; first: number; count: number }[] = [];
  sent.forEach((slot, i) => { const last = groups[groups.length - 1]; if (last && last.ref === slot.ref) last.count++; else groups.push({ ref: slot.ref, first: i, count: 1 }); });
  let request = text.trim();
  const lines = groups.map(g => {
    const r = refs[g.ref];
    const where = imageNumbers(g.first, g.count);
    const category = r.category ?? 'photo';
    const named = r.name && !fileLikeName(r.name);
    if (named) request = request.replace(new RegExp(`(?<![\\p{L}\\p{N}_@])@?${escapeRe(r.name.trim())}(?![\\p{L}\\p{N}_])`, 'giu'), m => `${m.replace(/^@/, '')} (${where})`);
    const label = where.charAt(0).toUpperCase() + where.slice(1);
    const description = r.description?.trim() ? ` ${r.description.trim().replace(/\s+/g, ' ').slice(0, 300)}.` : '';
    return `- ${label}: ${named ? `${JSON.stringify(r.name.trim())}, ` : ''}${NANO_NOUN[category] ?? NANO_NOUN.photo}. ${(NANO_ROLE[category] ?? NANO_ROLE.photo).replace(/^./, c => c.toUpperCase())}.${description}`;
  }).join('\n');
  return `${request}\n\nReference images, numbered in the order they are attached:\n${lines}\n${NANO_SHEET_RULE}\nCompose ONE new picture of this scene, where every named character and object appears once, whole and recognisable.`;
}
/**
 * Reference photos give identity and design, never the pose: without this, an engine tends to copy the
 * stance of the first character sheet into every picture (JD 31.10.2026, same pose on every run).
 */
export const POSE_RULE = 'Poses, gestures and camera angle come from the request, never from the reference photos: give each character a fresh, natural pose that acts out the request.';
/** Qwen Image 2.1 names its inputs `<image1>`, `<image2>`… (the official prompt enhancer's own rule). */
const qwenTags = (first: number, count: number) => Array.from({ length: count }, (_, i) => `<image${first + i + 1}>`).join(' ');
function qwenPrompt(text: string, refs: readonly BubbleReference[], sent: readonly BubbleSlot[]): string {
  const groups: { ref: number; first: number; count: number }[] = [];
  sent.forEach((slot, i) => { const last = groups[groups.length - 1]; if (last && last.ref === slot.ref) last.count++; else groups.push({ ref: slot.ref, first: i, count: 1 }); });
  let request = text.trim();
  const lines = groups.map(g => {
    const r = refs[g.ref];
    const where = qwenTags(g.first, g.count);
    const category = r.category ?? 'photo';
    const named = r.name && !fileLikeName(r.name);
    if (named) request = request.replace(new RegExp(`(?<![\\p{L}\\p{N}_@])@?${escapeRe(r.name.trim())}(?![\\p{L}\\p{N}_])`, 'giu'), m => `${m.replace(/^@/, '')} (${where})`);
    const description = r.description?.trim() ? ` ${r.description.trim().replace(/\s+/g, ' ').slice(0, 300)}.` : '';
    return `- ${where}: ${named ? `${JSON.stringify(r.name.trim())}, ` : ''}${NANO_NOUN[category] ?? NANO_NOUN.photo}. ${(NANO_ROLE[category] ?? NANO_ROLE.photo).replace(/^./, c => c.toUpperCase())}.${description}`;
  }).join('\n');
  const note = bubbleStyleNote(bubbleStyle(text));
  return `${request}\n\nReference images:\n${lines}\n${NANO_SHEET_RULE}\n${POSE_RULE}\nCompose ONE new picture of this scene, where every named character and object appears once, whole and recognisable. Never merge two characters, never lend one reference's features to another.${note ? `\n${note}` : ''}`;
}
export function bubblePrompt(text: string, refs: readonly BubbleReference[], mode: BubbleMode, slots?: readonly BubbleSlot[], engine: BubbleImageEngine | null = null): string {
  if (!refs.length) return text.trim();
  if (mode === 'image' && engine === 'nano') return nanoPrompt(text, refs, slots ?? refs.map((r, ref) => ({ ref, picture: '' })));
  if (mode === 'image' && engine === 'qwen') return qwenPrompt(text, refs, slots ?? refs.map((r, ref) => ({ ref, picture: '' })));
  if (mode === 'video') {
    const names = refs.map((r, i) => `<Picture ${i + 1}>: ${JSON.stringify(r.name)}${r.category ? ` (${r.category})` : ''}${r.description ? ` — ${r.description.slice(0, 500)}` : ''}`).join('\n');
    return `${text.trim()}\n\nNamed visual references (a contact sheet contains several views of the same subject):\n${names}\nUse each named reference for its assigned subject. Return a single finished scene, without reference panels, labels or contact-sheet layout.`;
  }
  // Klein's edit template reads its pictures by ordinal (« the first image »), never by token or file name.
  const sent = slots ?? refs.map((r, ref) => ({ ref, picture: '' }));
  const groups: { ref: number; first: number; count: number }[] = [];
  sent.forEach((slot, i) => { const last = groups[groups.length - 1]; if (last && last.ref === slot.ref) last.count++; else groups.push({ ref: slot.ref, first: i, count: 1 }); });
  let request = text.trim();
  const lines = groups.map(g => {
    const r = refs[g.ref];
    const where = imageOrdinals(g.first, g.count);
    const named = r.name && !fileLikeName(r.name);
    // « Enki » alone means nothing to the text encoder; say which pictures it is.
    // « @Enki » or « Enki » becomes « Enki (the character from the first image, <description>) ».
    if (named) {
      const brief = r.description?.trim() ? `, ${r.description.trim().replace(/\s+/g, ' ').slice(0, 120)}` : '';
      request = request.replace(new RegExp(`(?<![\\p{L}\\p{N}_@])@?${escapeRe(r.name.trim())}(?![\\p{L}\\p{N}_])`, 'giu'), m => `${m.replace(/^@/, '')} (the ${NOUN[r.category ?? 'photo'] ?? NOUN.photo} from ${where}${brief})`);
    }
    const role = ROLE[r.category ?? 'photo'] ?? ROLE.photo;
    const label = where.charAt(0).toUpperCase() + where.slice(1);
    return `- ${label}${named ? ` named ${JSON.stringify(r.name)}` : ''}: ${role}${r.description ? ` (${r.description.slice(0, 300)})` : ''}.`;
  }).join('\n');
  const note = bubbleStyleNote(bubbleStyle(text));
  return `${request}${REFERENCE_HEADER}${lines}\nUse every image: each distinct character or creature appears once, whole and recognisable, with its own anatomy, colours and clothing; never merge two subjects into one. The images of a name define that name only: never lend its face, fur, colours, clothing or shapes to another name or to the place; the images of a place define only the setting. ${POSE_RULE} Compose ONE new finished picture, without reference panels, labels or contact-sheet layout.${note ? `\n${note}` : ''}`;
}
/** Reference area per picture: the template's 1 MP up to three pictures, then the same 3 MP shared. */
export function bubbleReferenceMegapixels(count: number): number {
  return count <= 3 ? BUBBLE_REFERENCE_MEGAPIXELS : Math.round(3 / count * 1000) / 1000;
}
/**
 * Nano Banana 2.1 composition: one LoadImage per photo on its own `model.images.image_N`, in send
 * order (cast, objects, style, place). No batch, no crop, no upsampler, no style note: the prompt
 * numbers the images and the system prompt carries the studio rules. The frame is always fixed.
 */
export function nanoBubbleNodes(input: { settings: BubbleSettings; images: readonly string[]; prompt: string; seed: number }): ApiGraph {
  const graph: ApiGraph = {};
  const slots: Record<string, [string, number]> = {};
  input.images.forEach((image, i) => {
    const id = `reference_${i + 1}`;
    graph[id] = { class_type: 'LoadImage', inputs: { image } };
    slots[`model.images.image_${i + 1}`] = [id, 0];
  });
  graph.nano = {
    class_type: 'GeminiNanoBanana2V2',
    inputs: {
      prompt: input.prompt,
      model: 'Gemini Nano Banana 2.1',
      'model.aspect_ratio': input.settings.format,
      'model.resolution': NANO_RESOLUTION[input.settings.resolution],
      'model.thinking_level': 'MEDIUM',
      ...slots,
      seed: Number.isSafeInteger(input.seed) && input.seed >= 0 ? input.seed : 0,
      response_modalities: 'IMAGE',
      system_prompt: NANO_SYSTEM_PROMPT,
      temperature: 1,
      top_p: 0.95,
    },
    _meta: { title: 'Nano Banana 2.1' },
  };
  graph.save = { class_type: 'SaveImage', inputs: { images: ['nano', 0], filename_prefix: 'uttu/creation-image' } };
  return graph;
}
/**
 * JD 31.10.2026: three Klein runs (seeds 1406790374, 96585588, 2049149149; greedy then sampled caption) drew the
 * same staging, same placement and stance, although the init latent is empty and no earlier result is loaded.
 * The only constants are the references and the request, so the model falls into its own default staging.
 * Each run therefore gets one generic staging, picked by its seed, that the request always overrides.
 */
export const BUBBLE_STAGINGS = [
  'a wide shot, the characters small on the left third of the frame, the setting filling the rest',
  'a medium shot from a low angle, the characters on the right side of the frame',
  'a view from behind one character\'s shoulder, looking past them at the others',
  'a high angle looking down, the characters apart from each other across the frame',
  'a medium shot, the characters face to face, seen in profile',
  'a diagonal composition, one character close in the foreground, the others further back',
  'a wide side view, the characters caught in mid-motion, moving across the frame',
  'an eye-level shot, the characters side by side, each doing something different',
] as const;
export function bubbleStaging(seed: number): string {
  const i = Number.isSafeInteger(seed) && seed >= 0 ? seed % BUBBLE_STAGINGS.length : 0;
  return `Staging for this picture, unless the request says otherwise: ${BUBBLE_STAGINGS[i]}. Pose every character for this staging and the action.`;
}
/** Qwen Image 2.1 reads each reference at about `side`×`side`: the same area per picture as Klein. */
export function qwenReferenceSide(count: number): number {
  return Math.max(512, Math.round(Math.sqrt(bubbleReferenceMegapixels(count)) * 1024 / 32) * 32);
}
/**
 * Qwen Image 2.1 edit, open weights, from the official template: one LoadImage per photo on its own
 * `images.image_N` of TextEncodeQwenImage21 (seen by the Qwen3-VL encoder one by one, no batch, no crop),
 * in send order (cast, objects, style, place). The prompt enhancer is removed: the visitor's action
 * reaches the encoder verbatim. The canvas is always the chosen frame, never reference 1's.
 */
export function qwenBubbleNodes(input: { settings: BubbleSettings; images: readonly string[]; prompt: string; seed: number; style?: BubbleStyle }): ApiGraph {
  const base = structuredClone(OUTIL_BASES.image_qwen_image_2_1_image_edit);
  const size = bubbleSize(input.settings, 'image');
  const graph: ApiGraph = {};
  for (const [id, node] of Object.entries(base)) {
    if (['470', '475', '461', '459:477', '459:479', '459:480', '459:484', '459:485', '459:500'].includes(id)) continue;
    graph[id] = node;
  }
  const encode = graph['459:474'].inputs;
  for (const key of Object.keys(encode)) if (key.startsWith('images.')) delete encode[key];
  input.images.forEach((image, i) => {
    const id = `reference_${i + 1}`;
    graph[id] = { class_type: 'LoadImage', inputs: { image } };
    encode[`images.image_${i + 1}`] = [id, 0];
  });
  encode.prompt = input.prompt;
  encode.resolution = qwenReferenceSide(input.images.length);
  const style = input.style !== undefined ? input.style : bubbleStyle(input.prompt.split('\n\nReference images:')[0]);
  encode.negative_prompt = bubbleNegative(style);
  graph['459:456'].inputs = { ...graph['459:456'].inputs, width: size.width, height: size.height, batch_size: 1 };
  graph['459:468'].inputs.switch = true;
  graph['459:458'].inputs.seed = Number.isSafeInteger(input.seed) && input.seed >= 0 ? input.seed : 0;
  graph.save = { class_type: 'SaveImage', inputs: { images: ['459:457', 0], filename_prefix: 'uttu/creation-image' } };
  return graph;
}
/**
 * FLUX.2 dev multi-reference, open weights, built from the official `image_flux2` template (its subgraph
 * flattened, Turbo LoRA off as shipped: 20 steps, euler, guidance 4). The template reads one reference;
 * here each photo gets the template's own chain, LoadImage → ImageScaleToTotalPixels (1 MP, lanczos) →
 * VAEEncode → ReferenceLatent, chained one after the other on the conditioning, in send order (cast,
 * objects, style, place). Canvas: the chosen frame on EmptyFlux2LatentImage, never a reference's size.
 * Same prompt as Klein (ordinals, POSE_RULE) plus the seed's staging and the style note; no upsampler.
 */
export function flux2BubbleNodes(input: { settings: BubbleSettings; images: readonly string[]; prompt: string; seed: number; style?: BubbleStyle }): ApiGraph {
  const size = bubbleSize(input.settings, 'image');
  const style = input.style !== undefined ? input.style : bubbleStyle(input.prompt.split(REFERENCE_HEADER)[0]);
  const note = bubbleStyleNote(style);
  const text = [input.prompt, bubbleStaging(input.seed), note].filter(Boolean).join('\n');
  const graph: ApiGraph = {
    unet: { class_type: 'UNETLoader', inputs: { unet_name: 'flux2_dev_fp8mixed.safetensors', weight_dtype: 'default' } },
    clip: { class_type: 'CLIPLoader', inputs: { clip_name: 'mistral_3_small_flux2_bf16.safetensors', type: 'flux2', device: 'default' } },
    vae: { class_type: 'VAELoader', inputs: { vae_name: 'full_encoder_small_decoder.safetensors' } },
    prompt: { class_type: 'CLIPTextEncode', inputs: { clip: ['clip', 0], text } },
    guidance: { class_type: 'FluxGuidance', inputs: { conditioning: ['prompt', 0], guidance: 4 } },
  };
  let conditioning: [string, number] = ['guidance', 0];
  input.images.forEach((image, i) => {
    const n = i + 1;
    graph[`reference_${n}`] = { class_type: 'LoadImage', inputs: { image } };
    graph[`scale_${n}`] = { class_type: 'ImageScaleToTotalPixels', inputs: { image: [`reference_${n}`, 0], upscale_method: 'lanczos', megapixels: FLUX2_REFERENCE_MEGAPIXELS, resolution_steps: 1 } };
    graph[`encode_${n}`] = { class_type: 'VAEEncode', inputs: { pixels: [`scale_${n}`, 0], vae: ['vae', 0] } };
    graph[`ref_${n}`] = { class_type: 'ReferenceLatent', inputs: { conditioning, latent: [`encode_${n}`, 0] } };
    conditioning = [`ref_${n}`, 0];
  });
  Object.assign(graph, {
    canvas: { class_type: 'EmptyFlux2LatentImage', inputs: { width: size.width, height: size.height, batch_size: 1 } },
    sigmas: { class_type: 'Flux2Scheduler', inputs: { steps: 20, width: size.width, height: size.height } },
    guider: { class_type: 'BasicGuider', inputs: { model: ['unet', 0], conditioning } },
    sampler: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    noise: { class_type: 'RandomNoise', inputs: { noise_seed: Number.isSafeInteger(input.seed) && input.seed >= 0 ? input.seed : 0 } },
    sample: { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['noise', 0], guider: ['guider', 0], sampler: ['sampler', 0], sigmas: ['sigmas', 0], latent_image: ['canvas', 0] } },
    decode: { class_type: 'VAEDecode', inputs: { samples: ['sample', 0], vae: ['vae', 0] } },
    save: { class_type: 'SaveImage', inputs: { images: ['decode', 0], filename_prefix: 'uttu/creation-image' } },
  });
  return graph;
}
export function bubbleGraph(input: { mode: BubbleMode; settings: BubbleSettings; images: readonly string[]; audio?: string; prompt: string; seed: number; style?: BubbleStyle; engine?: BubbleImageEngine | null }): ApiGraph {
  const { settings: s, images, mode } = input;
  if (!validBubbleSettings(s) || images.length > CREATION_REFERENCES_MAX || !input.prompt.trim() || mode === 'image' && input.audio) throw new Error('bubble.invalid');
  if (mode === 'image' && images.length && input.engine === 'nano') return nanoBubbleNodes({ settings: s, images, prompt: input.prompt, seed: input.seed });
  if (mode === 'image' && images.length && input.engine === 'flux2') return flux2BubbleNodes({ settings: s, images, prompt: input.prompt, seed: input.seed, style: input.style });
  if (mode === 'image' && images.length && input.engine === 'qwen') return qwenBubbleNodes({ settings: s, images, prompt: input.prompt, seed: input.seed, style: input.style });
  const size = bubbleSize(s, mode);
  const aspect = s.format === '1:1' ? 'carre' : s.format === '9:16' ? 'vertical' : 'horizontal';
  if (mode === 'image') {
    const graph: ApiGraph = {};
    const links: [string, number][] = images.map((image, i) => {
      const id = `reference_${i + 1}`; graph[id] = { class_type: 'LoadImage', inputs: { image } }; return [id, 0];
    });
    Object.assign(graph, kleinNodes({ prefix: 'image_', prompt: images.length ? `${input.prompt}\n${bubbleStaging(input.seed)}` : input.prompt, seed: input.seed, aspect: s.format, images: links, megapixels: size.megapixels, referenceMegapixels: bubbleReferenceMegapixels(images.length), upsample: images.length > 0, referenceLimit: 7, cfg: KLEIN_BASE_CFG }));
    // ReferenceMultiLatent's default output canvas follows reference 1. Use the same official
    // EmptyFlux2LatentImage as t2i so the selected frame also applies to reference edits.
    graph.canvas = { class_type: 'EmptyFlux2LatentImage', inputs: { width: size.width, height: size.height, batch_size: 1 } };
    graph[images.length ? 'image_7' : 'image_18:7'].inputs.latent_image = ['canvas', 0];
    if (images.length) {
      // The upsampler rewrites the request; the style it asked for is said again after it.
      const style = input.style !== undefined ? input.style : bubbleStyle(input.prompt.split(REFERENCE_HEADER)[0]);
      const note = bubbleStyleNote(style);
      if (note) {
        graph.style_note = { class_type: 'StringConcatenate', inputs: { string_a: ['image_51', 0], string_b: note, delimiter: '\n\n' } };
        graph.image_4.inputs.text = ['style_note', 0];
      }
      const negative = bubbleNegative(style);
      if (negative) graph.image_58.inputs.text = negative;
    }
    graph.save = { class_type: 'SaveImage', inputs: { images: ['image_decode',0], filename_prefix: 'uttu/creation-image' } };
    return graph;
  }
  if (images.length || input.audio) {
    const graph = structuredClone(H3_R2V_BASE);
    graph['138'].inputs.value = input.prompt;
    graph['132'].inputs.value = s.duration;
    graph['146'].inputs.value = true;
    graph['129'].inputs.noise_seed = input.seed;
    graph['115'].inputs.aspect_ratio = TAKE_ASPECTS[aspect];
    graph['115'].inputs.megapixels = size.megapixels;
    graph['92'].inputs.filename_prefix = 'uttu/creation-video';
    images.forEach((image, i) => { const id = `reference_${i + 1}`; graph[id] = { class_type: 'LoadImage', inputs: { image } }; graph['136'].inputs[`ref_images.ref_image_${i}`] = [id,0]; });
    if (input.audio) { graph.reference_audio = { class_type: 'LoadAudio', inputs: { audio: input.audio } }; graph['136'].inputs['ref_audios.ref_audio_0'] = ['reference_audio',0]; }
    if (!s.sound) delete graph['130'].inputs.audio;
    return graph;
  }
  const graph = generiqueGraph({ template: 'video_ltx2_5_t2v', files: {}, prompt: input.prompt, seed: input.seed, prefix: 'uttu/creation-video', aspect: aspect === 'carre' ? 'horizontal' : aspect });
  graph['409'].inputs.aspect_ratio = TAKE_ASPECTS[aspect];
  graph['409'].inputs.megapixels = size.megapixels;
  graph['405:362'].inputs.value = s.duration;
  if (!s.sound) for (const node of Object.values(graph)) if (node.class_type === 'CreateVideo') delete node.inputs.audio;
  return graph;
}
