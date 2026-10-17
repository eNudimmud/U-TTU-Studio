import { ensureActiveProject, writeBlob, writeText } from '../coffre/model.ts';
import type { VaultStore } from '../coffre/store.ts';
import { assetNote } from '../creation/assets.ts';

/** A single imported file must contain its textures/buffers to survive a ZIP round trip. */
export async function modelExtension(file: Blob, name: string): Promise<'glb' | 'gltf'> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let document: { asset?: { version?: string }; buffers?: { uri?: string }[]; images?: { uri?: string }[] };
  let extension: 'glb' | 'gltf';
  try {
    if (/\.glb$/i.test(name)) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (bytes.length < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.length || view.getUint32(16, true) !== 0x4e4f534a) throw new Error();
      const size = view.getUint32(12, true);
      if (20 + size > bytes.length) throw new Error();
      document = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + size)));
      extension = 'glb';
    } else if (/\.gltf$/i.test(name)) {
      document = JSON.parse(new TextDecoder().decode(bytes));
      extension = 'gltf';
    } else throw new Error();
    if (document.asset?.version !== '2.0') throw new Error();
  } catch { throw new Error('previs.invalidModel'); }
  if ([...(document.buffers ?? []), ...(document.images ?? [])].some(item => item.uri && !item.uri.startsWith('data:'))) throw new Error('previs.externalModel');
  return extension;
}

export async function importModel(vault: VaultStore, file: File): Promise<string> {
  const ext = await modelExtension(file, file.name);
  const project = await ensureActiveProject(vault);
  const id = `model-${crypto.randomUUID()}`;
  const path = `Projets/${project}/Assets/${id}.${ext}`;
  const note = `Projets/${project}/Assets/${id}.md`;
  await writeBlob(vault, path, file);
  await writeText(vault, note, assetNote({ id, kind: 'importe', name: file.name.replace(/\.(glb|gltf)$/i, ''), at: new Date().toISOString(), prompt: '', geste: '', template: '', refs: [], devis: 0, cout: 0, media: path, note, preview: null, loose: false }));
  return path;
}
