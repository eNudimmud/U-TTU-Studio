import { castNote } from './fiche.ts';
import { assetNote, assetPaths, type AssetKind } from './assets.ts';
import { cleanCardName } from './gallery.ts';
import { emptySceneDraft, ensureActiveProject, slugify, writeBlob, writeScene, writeText } from '../coffre/model.ts';
import { projectVault } from '../render/recovery.ts';
import type { VaultStore } from '../coffre/store.ts';

const NUMBERED = /^(?:\d+|\d+x\d+|v\d+|@?\d+x)$/i;
/** Words a camera, an export or a web page puts in a file name: they never name a character. */
const GENERIC = new Set(['portrait', 'photo', 'image', 'img', 'pic', 'picture', 'perso', 'personnage', 'character', 'avatar', 'profil', 'profile', 'decor', 'décor', 'scan', 'final', 'copy', 'copie', 'edit', 'crop', 'web', 'hd', 'small', 'large', 'thumb', 'screenshot', 'capture']);

/**
 * The name a card gets at import, from its file name. A name someone typed stays as typed (« Portrait-archive », « Léa »).
 * An exported file name loses its sizes, numbers and generic words: « uttu-portrait-640.webp » → « Uttu ».
 * A camera number with nothing else stays (« 1000052812 »): the picker hides those until someone names them.
 */
export function importName(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, '');
  const typed = cleanCardName(stem);
  const tokens = stem.split(/[-_.\s]+/).filter(Boolean);
  const exported = tokens.some(token => NUMBERED.test(token)) || (stem === stem.toLowerCase() && /[-_]/.test(stem));
  if (!exported) return typed;
  const words = tokens.filter(token => !NUMBERED.test(token));
  const named = words.filter(token => !GENERIC.has(token.toLowerCase()));
  // Nothing but a camera prefix or a generic word: keep the file's name, the CAST prompt asks for a real one.
  if (!named.length) return typed;
  const name = named.join(' ');
  return cleanCardName(name.charAt(0).toUpperCase() + name.slice(1)) || typed;
}

export interface ImportedItem { id: string; name: string; kind: AssetKind }

/** Import existing media without a cloud operation or overwriting an earlier file. */
export async function importMedia(store: VaultStore, files: readonly File[], as?: 'personnage' | 'decor'): Promise<number> {
  return (await importMediaItems(store, files, as)).length;
}

/** Same import, and what it created, so the studio can select and name it. */
export async function importMediaItems(store: VaultStore, files: readonly File[], as?: 'personnage' | 'decor'): Promise<ImportedItem[]> {
  const project = await ensureActiveProject(store);
  const vault = projectVault(store, project);
  const items: ImportedItem[] = [];
  for (const file of files) {
    if (!/^(image|video|audio)\//.test(file.type) || !file.size) continue;
    const kind: AssetKind = as && file.type.startsWith('image/') ? as : file.type.startsWith('video/') ? 'plan' : file.type.startsWith('audio/') ? 'son' : 'importe';
    const name = importName(file.name) || 'Import';
    // UUID suffix also protects two tabs importing the same name at once.
    const id = `${slugify(name).slice(0, 24)}-${crypto.randomUUID().slice(0, 8)}`;
    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const paths = assetPaths(project, kind, id, ext);
    const at = new Date().toISOString();
    await writeBlob(vault, paths.media, file);
    if (kind === 'personnage') await writeText(vault, paths.note, castNote({ id, name, at, prompt: '', source: 'photos', photos: [paths.media], sheet: paths.media, template: '', quote: 0, cost: 0, project }));
    else if (kind === 'decor') await writeScene(vault, { ...emptySceneDraft(), id, name, stills: [paths.media], render: paths.media, home: 'Decors', source: 'photo', template: '', devis: 0, cout: 0 });
    else await writeText(vault, paths.note, assetNote({ id, kind, name, at, prompt: '', geste: '', template: '', refs: [], devis: null, cout: 0, media: paths.media, note: paths.note, preview: null, loose: false }));
    items.push({ id, name, kind });
  }
  return items;
}
