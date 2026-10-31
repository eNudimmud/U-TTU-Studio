// Native creation: the already integrated Klein, LTX text-to-video and H3 reference templates.
import { KLEIN_BASE_CFG, kleinNodes } from '../render/klein-graph.ts';
import { H3_R2V_BASE } from '../render/h3-base.ts';
import { TAKE_ASPECTS, type ApiGraph } from '../render/take-graph.ts';
import { generiqueGraph } from '../outils/generique.ts';
import { gesteParId } from '../workflows/registre.ts';
import { CREATION_REFERENCES_MAX, fileLikeName } from './named-references.ts';

export interface BubbleSettings { format: '16:9' | '9:16' | '1:1'; resolution: '480p' | '720p'; duration: 5 | 10; sound: boolean }
export const BUBBLE_DEFAULTS: BubbleSettings = { format: '16:9', resolution: '480p', duration: 5, sound: true };
export type BubbleMode = 'image' | 'video';
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
  return ['16:9','9:16','1:1'].includes(v.format) && ['480p','720p'].includes(v.resolution) && [5,10].includes(v.duration) && typeof v.sound === 'boolean';
}
export function bubbleTool(mode: BubbleMode, count: number, audio = false): string {
  return mode === 'image' ? count ? 'img-refs' : 'img-klein' : count || audio ? 'vid-h3-refs' : 'vid-texte';
}
export function bubbleGeste(mode: BubbleMode, count: number, audio = false): string {
  return mode === 'image' ? count ? 'creation-image' : 'creation-image-texte' : count || audio ? 'creation-video-refs' : 'creation-video-texte';
}
const IMAGE_CREDITS_PER_MP = 1.4, IMAGE_EDIT_CREDITS_PER_MP = 2.4, UPSAMPLER_CREDITS = 1;
export function bubbleQuote(mode: BubbleMode, count: number, s: BubbleSettings, audio = false) {
  if (!validBubbleSettings(s) || count < 0 || count > CREATION_REFERENCES_MAX) return null;
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
    const credits = Math.ceil(perMp * (pixels + count * bubbleReferenceMegapixels(count)) + (count > 0 ? UPSAMPLER_CREDITS : 0));
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
  decor: 'the place where the scene happens: the new picture is set in or on this place, never in a generic one. Keep its architecture, shapes, colours and materials; the characters stand inside it at a believable scale. If the request names a part of it the pictures do not show (a deck, an interior, a street), build that part in the same design, colours and materials',
  objet: 'an object to include',
  style: 'the visual style to follow',
  photo: 'an attached photo',
};
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
export function bubblePrompt(text: string, refs: readonly BubbleReference[], mode: BubbleMode, slots?: readonly BubbleSlot[]): string {
  if (!refs.length) return text.trim();
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
    if (named) request = request.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(r.name.trim())}(?![\\p{L}\\p{N}])`, 'giu'), m => `${m} (${where})`);
    const role = ROLE[r.category ?? 'photo'] ?? ROLE.photo;
    const label = where.charAt(0).toUpperCase() + where.slice(1);
    return `- ${label}${named ? ` named ${JSON.stringify(r.name)}` : ''}: ${role}${r.description ? ` (${r.description.slice(0, 300)})` : ''}.`;
  }).join('\n');
  const note = bubbleStyleNote(bubbleStyle(text));
  return `${request}${REFERENCE_HEADER}${lines}\nUse every image: each distinct character or creature appears once, whole and recognisable, with its own anatomy, colours and clothing; never merge two subjects into one. Compose ONE new finished picture, without reference panels, labels or contact-sheet layout.${note ? `\n${note}` : ''}`;
}
/** Reference area per picture: the template's 1 MP up to three pictures, then the same 3 MP shared. */
export function bubbleReferenceMegapixels(count: number): number {
  return count <= 3 ? BUBBLE_REFERENCE_MEGAPIXELS : Math.round(3 / count * 1000) / 1000;
}
export function bubbleGraph(input: { mode: BubbleMode; settings: BubbleSettings; images: readonly string[]; audio?: string; prompt: string; seed: number; style?: BubbleStyle }): ApiGraph {
  const { settings: s, images, mode } = input;
  if (!validBubbleSettings(s) || images.length > CREATION_REFERENCES_MAX || !input.prompt.trim() || mode === 'image' && input.audio) throw new Error('bubble.invalid');
  const size = bubbleSize(s, mode);
  const aspect = s.format === '1:1' ? 'carre' : s.format === '9:16' ? 'vertical' : 'horizontal';
  if (mode === 'image') {
    const graph: ApiGraph = {};
    const links: [string, number][] = images.map((image, i) => {
      const id = `reference_${i + 1}`; graph[id] = { class_type: 'LoadImage', inputs: { image } }; return [id, 0];
    });
    Object.assign(graph, kleinNodes({ prefix: 'image_', prompt: input.prompt, seed: input.seed, aspect: s.format, images: links, megapixels: size.megapixels, referenceMegapixels: bubbleReferenceMegapixels(images.length), upsample: images.length > 0, referenceLimit: 7, cfg: KLEIN_BASE_CFG }));
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
