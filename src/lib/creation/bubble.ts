// Native creation: the already integrated Klein, LTX text-to-video and H3 reference templates.
import { kleinNodes } from '../render/klein-graph.ts';
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
const IMAGE_CREDITS_PER_MP = 1.4, UPSAMPLER_CREDITS = 1;
export function bubbleQuote(mode: BubbleMode, count: number, s: BubbleSettings, audio = false) {
  if (!validBubbleSettings(s) || count < 0 || count > CREATION_REFERENCES_MAX) return null;
  const id = bubbleTool(mode, count, audio);
  const row = gesteParId(id === 'img-klein' ? 'cast-eclair' : id === 'img-refs' ? 'suite-modifier' : id === 'vid-h3-refs' ? 'prise-plan-h3' : 'outil-vid-texte');
  // Different sizes/reference counts are estimates. Never inherit the source row's measured label.
  const pixels = bubbleSize(s, mode).megapixels;
  if (mode === 'image') {
    // Klein edit cost follows the pixels it reads and writes: canvas + each reference at BUBBLE_REFERENCE_MEGAPIXELS,
    // plus the vision prompt upsampler when references are attached. Measured on Comfy Cloud (rtx_pro_6000, 2026-10-30):
    // 1344×768 + 3 refs at 1 MP + upsampler = 23.7 GPU s ≈ 6.5 credits; without upsampler 20.2 s ≈ 5.5; 864×480 + 3 refs at 0.4 MP = 7.3 s ≈ 2.0.
    const credits = Math.ceil(IMAGE_CREDITS_PER_MP * (pixels + count * BUBBLE_REFERENCE_MEGAPIXELS) + (count > 0 ? UPSAMPLER_CREDITS : 0));
    return { credits, high: Math.ceil(credits * 1.5), kind: 'estime' as const };
  }
  const base = row?.credits ?? 5;
  const factor = s.duration / 5 * Math.max(1, pixels / 0.4) * (1 + Math.max(0, count - 1) * 0.15 + (audio ? 0.2 : 0));
  const credits = Math.ceil(base * factor);
  return { credits, high: Math.ceil(credits * 2), kind: 'estime' as const };
}
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'];
const ROLE: Record<string, string> = {
  cast: 'a character from the cast — when it is a character sheet (several views of the same character), it shows ONE character to keep identical: same face, body, outfit and logos',
  decor: 'the place / setting',
  objet: 'an object to include',
  style: 'the visual style to follow',
  photo: 'an attached photo',
};
export function bubblePrompt(text: string, refs: readonly { name: string; description?: string; category?: string }[], mode: BubbleMode): string {
  if (!refs.length) return text.trim();
  if (mode === 'video') {
    const names = refs.map((r, i) => `<Picture ${i + 1}>: ${JSON.stringify(r.name)}${r.category ? ` (${r.category})` : ''}${r.description ? ` — ${r.description.slice(0, 500)}` : ''}`).join('\n');
    return `${text.trim()}\n\nNamed visual references (a contact sheet contains several views of the same subject):\n${names}\nUse each named reference for its assigned subject. Return a single finished scene, without reference panels, labels or contact-sheet layout.`;
  }
  // Klein's edit template reads its pictures by ordinal (« the first image »), never by token or file name.
  const lines = refs.map((r, i) => {
    const name = r.name && !fileLikeName(r.name) ? ` named ${JSON.stringify(r.name)}` : '';
    const role = ROLE[r.category ?? 'photo'] ?? ROLE.photo;
    return `- The ${ORDINALS[i] ?? `${i + 1}th`} image${name}: ${role}${r.description ? ` (${r.description.slice(0, 300)})` : ''}.`;
  }).join('\n');
  return `${text.trim()}\n\nReference images, in order:\n${lines}\nUse every image: each distinct character or creature appears once, whole and recognisable, with its own anatomy, colours and clothing; never merge two subjects into one. Compose ONE new finished picture, without reference panels, labels or contact-sheet layout.`;
}
export function bubbleGraph(input: { mode: BubbleMode; settings: BubbleSettings; images: readonly string[]; audio?: string; prompt: string; seed: number }): ApiGraph {
  const { settings: s, images, mode } = input;
  if (!validBubbleSettings(s) || images.length > CREATION_REFERENCES_MAX || !input.prompt.trim() || mode === 'image' && input.audio) throw new Error('bubble.invalid');
  const size = bubbleSize(s, mode);
  const aspect = s.format === '1:1' ? 'carre' : s.format === '9:16' ? 'vertical' : 'horizontal';
  if (mode === 'image') {
    const graph: ApiGraph = {};
    const links: [string, number][] = images.map((image, i) => {
      const id = `reference_${i + 1}`; graph[id] = { class_type: 'LoadImage', inputs: { image } }; return [id, 0];
    });
    Object.assign(graph, kleinNodes({ prefix: 'image_', prompt: input.prompt, seed: input.seed, aspect: s.format, images: links, megapixels: size.megapixels, referenceMegapixels: BUBBLE_REFERENCE_MEGAPIXELS, upsample: images.length > 0, referenceLimit: 7 }));
    // ReferenceMultiLatent's default output canvas follows reference 1. Use the same official
    // EmptyFlux2LatentImage as t2i so the selected frame also applies to reference edits.
    graph.canvas = { class_type: 'EmptyFlux2LatentImage', inputs: { width: size.width, height: size.height, batch_size: 1 } };
    graph[images.length ? 'image_7' : 'image_18:7'].inputs.latent_image = ['canvas', 0];
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
