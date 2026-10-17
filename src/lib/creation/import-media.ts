import { castNote } from './fiche.ts';
import { assetNote, assetPaths, type AssetKind } from './assets.ts';
import { cleanCardName } from './gallery.ts';
import { emptySceneDraft, ensureActiveProject, slugify, writeBlob, writeScene, writeText } from '../coffre/model.ts';
import { projectVault } from '../render/recovery.ts';
import type { VaultStore } from '../coffre/store.ts';

/** Import existing media without a cloud operation or overwriting an earlier file. */
export async function importMedia(store: VaultStore, files: readonly File[], as?: 'personnage' | 'decor'): Promise<number> {
  const project = await ensureActiveProject(store);
  const vault = projectVault(store, project);
  let count = 0;
  for (const file of files) {
    if (!/^(image|video|audio)\//.test(file.type) || !file.size) continue;
    const kind: AssetKind = as && file.type.startsWith('image/') ? as : file.type.startsWith('video/') ? 'plan' : file.type.startsWith('audio/') ? 'son' : 'importe';
    const name = cleanCardName(file.name.replace(/\.[^.]+$/, '')) || 'Import';
    // UUID suffix also protects two tabs importing the same name at once.
    const id = `${slugify(name).slice(0, 24)}-${crypto.randomUUID().slice(0, 8)}`;
    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const paths = assetPaths(project, kind, id, ext);
    const at = new Date().toISOString();
    await writeBlob(vault, paths.media, file);
    if (kind === 'personnage') await writeText(vault, paths.note, castNote({ id, name, at, prompt: '', source: 'photos', photos: [paths.media], sheet: paths.media, template: '', quote: 0, cost: 0, project }));
    else if (kind === 'decor') await writeScene(vault, { ...emptySceneDraft(), id, name, stills: [paths.media], render: paths.media, home: 'Decors', source: 'photo', template: '', devis: 0, cout: 0 });
    else await writeText(vault, paths.note, assetNote({ id, kind, name, at, prompt: '', geste: '', template: '', refs: [], devis: null, cout: 0, media: paths.media, note: paths.note, preview: null, loose: false }));
    count++;
  }
  return count;
}
