import test from 'node:test';
import assert from 'node:assert/strict';
import { appendAgentMedia, localMediaDuration, type TimedResource } from '../src/lib/agent/montage.ts';
import { emptyEdit, trimVideo, setAudioLevels } from '../src/lib/montage/edit.ts';
import type { AgentDraft } from '../src/lib/agent/execution.ts';

const draft: AgentDraft = { version: 1, projectId: 'film', stepId: 'plan-1', operationId: 'local:montage', prompt: 'Assemble ces médias', resourceIds: ['asset:photo', 'asset:clip', 'asset:sound'] };
const resources: TimedResource[] = [
  { id: 'asset:photo', name: 'Photo', kind: 'image', role: 'asset', available: true, path: 'Projets/film/Assets/photo.webp', seconds: 5 },
  { id: 'asset:clip', name: 'Clip', kind: 'video', role: 'asset', available: true, path: 'Projets/film/Assets/clip.mp4', seconds: 3 },
  { id: 'asset:sound', name: 'Ambiance', kind: 'audio', role: 'asset', available: true, path: 'Projets/film/Assets/sound.wav', seconds: 8 },
];

test('library image, video and audio enter existing timeline tracks using durable paths', () => {
  const existing = { ...emptyEdit('suite', 'Film'), video: [{ id: 'user-clip', kind: 'image' as const, source: 'Projets/film/Assets/old.webp', label: 'Original', media: 2, start: 0, end: 2, takeId: null }] };
  const next = appendAgentMedia(existing, draft, resources);
  assert.deepEqual(next.video.map(c => c.label), ['Original', 'Photo', 'Clip']);
  assert.equal(next.audio[0].track, 'effets');
  assert.equal(next.audio[0].end, 8);
  assert.equal(next.video[0], existing.video[0]);
  assert.doesNotMatch(JSON.stringify(next), /blob:|https:/);
});

test('replaying an interrupted handoff preserves user trims, levels and clip count', () => {
  let edit = appendAgentMedia(emptyEdit('suite', 'Film'), draft, resources);
  edit = trimVideo(edit, edit.video[0].id, 'end', 2);
  edit = setAudioLevels(edit, edit.audio[0].id, { volume: 0.3 });
  assert.equal(appendAgentMedia(edit, draft, [...resources].reverse()), edit);
  assert.equal(edit.video[0].end, 2);
  assert.equal(edit.audio[0].volume, 0.3);
});

test('changing selection within a prepared step cannot reuse another clip identity or duplicate a legacy clip', () => {
  const first = appendAgentMedia(emptyEdit('suite', 'Film'), { ...draft, resourceIds: ['asset:photo'] }, [resources[0]]);
  // Earlier branch versions used an index; its user trim must survive migration.
  const legacy = { ...first, video: [{ ...first.video[0], id: 'agent-plan-1-0', end: 2 }] };
  const changed = { ...draft, resourceIds: ['asset:clip', 'asset:photo', 'asset:sound'] };
  const next = appendAgentMedia(legacy, changed, [resources[1], resources[0], resources[2]]);
  assert.equal(next.video.length, 2);assert.equal(next.audio.length, 1);
  assert.equal(next.video[0].id, 'agent-plan-1-0');assert.equal(next.video[0].end, 2);
  assert.equal(new Set([...next.video, ...next.audio].map(c => c.id)).size, 3);
  assert.equal(appendAgentMedia(next, { ...draft, resourceIds: ['asset:sound'] }, [resources[2]]), next);
});

test('timeline handoff rejects unavailable, foreign, unselected and unmeasurable media', () => {
  for (const patch of [{ available: false }, { id: 'asset:foreign' }, { path: 'Projets/other/secret.wav' }, { path: 'Projets/film/../secret.wav' }, { seconds: Infinity }, { seconds: 0 }, { kind: 'mesh' as const }]) {
    assert.throws(() => appendAgentMedia(emptyEdit('suite', 'Film'), draft, [{ ...resources[0], ...patch }]));
  }
});

test('duration reader refuses remote URLs before allocating a browser media element', async () => {
  await assert.rejects(localMediaDuration('video', 'https://private.invalid/media.mp4'), /cache local/);
});
