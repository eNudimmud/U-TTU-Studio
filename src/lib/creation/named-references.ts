// One reference catalogue, projected from the existing CAST / DÉCOR notes and Refs/.
// Pictures stay in the local vault (IndexedDB, folder mirror and ZIP export).
import { readFrontmatter, list, text, withFrontmatter } from '../coffre/markdown.ts';
import { castNote } from './fiche.ts';
import { cleanCardName } from './gallery.ts';
import { emptySceneDraft, sceneMarkdown } from '../coffre/model.ts';
import { cleanPath, type VaultStore } from '../coffre/store.ts';

export const REFERENCE_CATEGORIES = ['cast', 'decor', 'objet', 'style'] as const;
export type ReferenceCategory = typeof REFERENCE_CATEGORIES[number];
export const REFERENCE_PHOTOS_MAX = 3;
export const CREATION_REFERENCES_MAX = 7;
export interface NamedReference {
  id: string; name: string; description: string; category: ReferenceCategory;
  images: string[]; preview: string; note: string;
}
export interface ReferenceDraft {
  name: string; description: string; category: ReferenceCategory;
  images: string[]; preview: string;
}
const PICTURE = /\.(png|jpe?g|webp|gif|avif)$/i;
const scopedPicture = (path: string, project: string) => Boolean(cleanPath(path)) && path.startsWith(`Projets/${project}/`) && PICTURE.test(path);
export function referenceFromNote(path: string, source: string, project: string): NamedReference | null {
  const prefix = `Projets/${project}/`;
  if (!path.startsWith(prefix)) return null;
  const match = /\/(Cast|Decors|Lieux|Refs)\/([a-z0-9-]+)\.md$/.exec(path);
  if (!match || match[2] === 'canon') return null;
  const f = readFrontmatter(source).fields;
  const category: ReferenceCategory | null = match[1] === 'Cast' && f.type === 'cast' ? 'cast'
    : (match[1] === 'Decors' || match[1] === 'Lieux') && ['decor', 'lieu', 'scene'].includes(text(f.type)) ? 'decor'
    : match[1] === 'Refs' && f.type === 'reference' && (f.categorie === 'objet' || f.categorie === 'style') ? f.categorie : null;
  if (!category) return null;
  const preview = text(f.sheet) || text(f.rendu) || text(f.apercu);
  const candidates = category === 'cast' ? list(f.photos) : category === 'decor' ? list(f.images) : list(f.images);
  const images = [...new Set((candidates.length ? candidates : [preview]).filter(p => scopedPicture(p, project)))].slice(0, REFERENCE_PHOTOS_MAX);
  return { id: match[2], name: cleanCardName(text(f.nom)) || match[2], description: text(f.prompt) || text(f.note) || text(f.description), category, images, preview: scopedPicture(preview, project) ? preview : images[0] ?? '', note: path };
}
export async function readNamedReferences(store: VaultStore, project: string | null): Promise<NamedReference[]> {
  if (!project) return [];
  return (await store.list()).flatMap(e => {
    const ref = e.text ? referenceFromNote(e.path, e.text, project) : null;
    return ref ? [ref] : [];
  }).sort((a, b) => a.name.localeCompare(b.name));
}
export function referenceNotePath(project: string, id: string, category: ReferenceCategory): string {
  if (!/^[a-z0-9-]+$/.test(project) || !/^[a-z0-9-]+$/.test(id) || !REFERENCE_CATEGORIES.includes(category)) throw new Error('namedRefs.invalid');
  return `Projets/${project}/${category === 'cast' ? 'Cast' : category === 'decor' ? 'Decors' : 'Refs'}/${id}.md`;
}
export function validateReference(input: ReferenceDraft, project: string): void {
  if (!cleanCardName(input.name) || !REFERENCE_CATEGORIES.includes(input.category)
    || input.images.length < 1 || input.images.length > REFERENCE_PHOTOS_MAX
    || input.images.some(p => !scopedPicture(p, project)) || !scopedPicture(input.preview, project)) throw new Error('namedRefs.invalid');
}
/** Preserve production metadata when editing a CAST / DÉCOR card. */
export function namedReferenceNote(project: string, id: string, input: ReferenceDraft, original?: string): string {
  validateReference(input, project);
  const name = cleanCardName(input.name), description = input.description.trim().slice(0, 2000);
  if (original) {
    const { fields, body } = readFrontmatter(original);
    const same = input.category === 'cast' ? fields.type === 'cast' : input.category === 'decor' ? ['lieu', 'scene', 'decor'].includes(text(fields.type)) : fields.type === 'reference';
    if (same) return withFrontmatter({ ...fields, nom: name,
      ...(input.category === 'cast' ? { prompt: description, photos: input.images, sheet: input.preview }
        : input.category === 'decor' ? { prompt: description, note: description, images: input.images, rendu: input.preview }
        : { categorie: input.category, description, images: input.images, apercu: input.preview }),
    }, body.replace(/^# [^\n]*/, `# ${name}`));
  }
  if (input.category === 'cast') return castNote({ id, name, prompt: description, source: 'photos', photos: input.images, sheet: input.preview, at: new Date().toISOString(), template: '', quote: 0, cost: 0, project });
  if (input.category === 'decor') return sceneMarkdown({ ...emptySceneDraft(), id, name, note: description, prompt: description, stills: input.images, render: input.preview, home: 'Decors', source: 'photo', template: '', devis: 0, cout: 0 }, project);
  return withFrontmatter({ type: 'reference', nom: name, categorie: input.category, description, images: input.images, apercu: input.preview }, `# ${name}\n\n${description}\n\n![[${input.preview}]]\n`);
}
