import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { quoteForKind, stillGraph } from '../src/lib/creation/still.ts';
import { gesteParId, gesteOuvert, templatePartenaire } from '../src/lib/workflows/registre.ts';
import { readPending, PENDING_RENDER_KEY } from '../src/lib/render/recovery.ts';
import { ltxTakeGraph } from '../src/lib/render/ltx-graph.ts';

const loads = (graph: Record<string, { class_type: string; inputs: Record<string, unknown> }>) => Object.values(graph).filter(node => node.class_type === 'LoadImage');

describe('Composer l’image clé', () => {
  it('is an open-weights Klein edit with an estimated quote', () => {
    const row = gesteParId('prise-image')!;
    assert.equal(row.template, 'image_flux3_klein_image_edit');
    assert.equal(templatePartenaire(row.template), false);
    assert.equal(gesteOuvert(row), true);
    assert.equal(row.nature, 'hypothese');
    assert.equal(row.still, 'plan-cle');
    assert.deepEqual([row.credits, row.high], [quoteForKind('plan-cle').credits, quoteForKind('plan-cle').high]);
    assert.equal(quoteForKind('plan-cle').kind, 'hypothese');
  });

  it('sends the cast then the décor, four references at most, in the project format', () => {
    const graph = stillGraph({ kind: 'plan-cle', template: 'image_flux3_klein_image_edit', prompt: 'Uttu attend sur le quai', images: ['a.png', 'b.png', 'c.png', 'lieu.png', 'extra.png'], seed: 7 });
    assert.deepEqual(loads(graph).map(node => node.inputs.image), ['a.png', 'b.png', 'c.png', 'lieu.png']);
    const text = JSON.stringify(graph);
    assert.match(text, /Vertical 9:16 framing/);
    assert.match(text, /First frame of a film shot/);
    assert.match(text, /Uttu attend sur le quai/);
    assert.match(JSON.stringify(stillGraph({ kind: 'plan-cle-169', prompt: 'x', images: ['a.png', 'lieu.png'], seed: 1 })), /Horizontal 16:9 framing/);
    assert.throws(() => stillGraph({ kind: 'plan-cle', prompt: 'x', images: [], seed: 1 }), /personnage et du décor/);
  });

  it('keeps a receipt the recovery accepts', () => {
    const receipt = { version: 1, kind: 'still', geste: 'prise-image', project: 'atelier', id: 'plan-01-cle-abc', name: 'Image clé', prompt: '', at: '2026-10-17T10:00:00Z', account: 'x', refs: [], template: 'image_flux3_klein_image_edit', quote: 4, balanceBefore: 10, jobId: 'job-12345678' };
    const storage = { getItem: (key: string) => key === PENDING_RENDER_KEY ? JSON.stringify(receipt) : null };
    assert.equal(readPending(storage)?.kind, 'still');
  });

  it('a kept key frame becomes the single LTX first frame, without a second Klein pass', () => {
    const graph = ltxTakeGraph({ prompt: 'p', pictures: ['cle.png'], seed: 1, seconds: 5, aspect: 'vertical' });
    assert.deepEqual(loads(graph).map(node => node.inputs.image), ['cle.png']);
    assert.ok(!JSON.stringify(graph).includes('frame_decode'));
  });

  it('goes through the paid lock and the confirmation, never straight to the cloud', () => {
    const session = readFileSync('src/components/app/studio-session.tsx', 'utf8');
    assert.match(session, /composeKeyframe: input => paid\(\(\) => composeKeyframe\(input\)/);
    assert.match(session, /kind: "still", geste: row\.id/);
    assert.match(session, /recoverableClient\(client, localStorage, receipt\)/);
    const stage = readFileSync('src/components/app/prise-stage.tsx', 'utf8');
    assert.match(stage, /confirmed: true/);
    assert.match(stage, /data-keyframe-send/);
    assert.doesNotMatch(stage, /n'est pas branché/);
  });
});
