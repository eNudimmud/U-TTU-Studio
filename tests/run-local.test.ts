import assert from 'node:assert/strict';
import { it } from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Runs the actual CLI with a fake fetch transport. No local server or cloud call.
function cli(partner: boolean) {
  const dir = mkdtempSync(join(tmpdir(), 'uttu-cli-'));
  try {
    const graph = join(dir, 'graph.json'), media = join(dir, 'photo=original.png'), preload = join(dir, 'transport.mjs');
    writeFileSync(graph, JSON.stringify({ image: { class_type: 'LoadImage', inputs: { image: 'input.png', text: '<texte du visiteur>' } } }));
    writeFileSync(media, 'source-bytes');
    writeFileSync(preload, `
import assert from 'node:assert/strict';
let uploads = 0, posts = 0;
globalThis.fetch = async (url, init) => {
  const path = new URL(url).pathname;
  if (path === '/object_info') return Response.json({ LoadImage: { api_node: ${partner} } });
  if (path === '/upload/image') {
    assert.equal(${partner}, false, 'partner guard precedes upload');
    uploads++;
    assert.equal(init.body.get('overwrite'), 'false');
    assert.match(init.body.get('image').name, /^uttu-[a-f0-9-]+-input.png$/);
    assert.equal(await init.body.get('image').text(), 'source-bytes');
    return Response.json({ name: 'assigned.png', subfolder: 'preserved' });
  }
  if (path === '/prompt') {
    posts++;
    assert.equal(posts, 1);
    const graph = JSON.parse(init.body).prompt;
    assert.equal(graph.image.inputs.image, 'preserved/assigned.png');
    assert.equal(graph.image.inputs.text, 'Scene');
    return Response.json({ prompt_id: 'local-job' });
  }
  if (path === '/history/local-job') {
    assert.equal(uploads, 1);
    assert.equal(posts, 1);
    return Response.json({ 'local-job': { outputs: { save: { images: [{ filename: 'result.png' }] } } } });
  }
  assert.fail('Unexpected request: ' + path);
};
`);
    return spawnSync(process.execPath, ['--import', preload, resolve('scripts/run-local.mjs'), graph, '--text', 'Scene', '--image', `input.png=${media}`], { encoding: 'utf8', timeout: 10_000, env: { ...process.env, COMFY_URL: 'http://127.0.0.1:8188' } });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
it('the local CLI keeps source files intact and submits the returned upload path exactly once', () => {
  const result = cli(false);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /queued local-job/);
  assert.match(result.stdout, /filename=result.png/);
});
it('the local CLI refuses partner nodes before uploading or submitting without explicit opt-in', () => {
  const result = cli(true);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Partner nodes in this graph/);
  assert.doesNotMatch(result.stdout, /queued/);
});
