import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
test('vendored kernel files match the pinned independent Agent commit manifest',()=>{
 const root='src/lib/agent/kernel/';const source=JSON.parse(readFileSync(root+'source.json','utf8'));
 assert.match(source.commit,/^[a-f0-9]{40}$/);assert.equal(source.repository,'https://github.com/eNudimmud/Uttu-studio-AGENT');
 for(const [file,sha] of Object.entries(source.files))assert.equal(createHash('sha256').update(readFileSync(root+file)).digest('hex'),sha,file);
});
