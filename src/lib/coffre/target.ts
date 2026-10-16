export type StudioTargetKind = 'personnage' | 'lieu' | 'prise' | 'sequence' | 'plan' | 'asset';

export function studioTarget(kind: StudioTargetKind, id: string, project: string | null, demo = false): string {
  const query = new URLSearchParams();
  if (demo) query.set('demo', '1');
  if (project) query.set('project', project);
  const key = { personnage: 'cast', lieu: 'decor', prise: 'take', sequence: 'sequence', plan: 'plan', asset: 'asset' }[kind];
  query.set(key, id);
  return `/studio?${query}#${kind === 'sequence' || kind === 'asset' ? 'montage' : 'prise'}`;
}
