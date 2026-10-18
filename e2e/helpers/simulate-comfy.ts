import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Comfy Cloud, simulated: same contract as the novice spec. Nothing leaves, nothing is spent.
const still = readFileSync('public/exemples/cast-uttu.webp');
const video = readFileSync('e2e/fixtures/prise-5s-vp9.mp4');

type Job = { kind: 'image' | 'video'; at: number; still: Buffer };

export async function simulateComfy(page: Page) {
  const jobs = new Map<string, Job>();
  const prompts: { kind: string; text: string }[] = [];
  let n = 0;
  let nextStill: Buffer = still;
  await page.addInitScript(() => localStorage.setItem('u-ttu-rendu', JSON.stringify({ mode: 'key', key: 'audit-fake-key-0123456789' })));
  await page.route(/overpass|nominatim|photon|panoramax|mapillary|tiles\.openfreemap|fal\.ai/, route => route.abort());
  await page.route(/\/api\/user$/, route => route.fulfill({ json: { id: 'novice' } }));
  await page.route(/\/api\/billing\/usage\/timeseries|customers\/balance/, route => route.fulfill({ json: { summary: { balance: { amount_micros: 500_000_000 } } } }));
  await page.route(/\/api\/upload\/image$/, route => route.fulfill({ json: { name: `entree-${++n}.webp` } }));
  await page.route(/\/api\/prompt$/, route => {
    const graph = route.request().postDataJSON()?.prompt ?? {};
    const nodes = Object.values(graph) as { class_type?: string; inputs?: Record<string, unknown> }[];
    const kind = nodes.some(node => /Video|LTXV|MiniMax/i.test(String(node.class_type))) ? 'video' : 'image';
    const text = nodes.flatMap(node => Object.values(node.inputs ?? {}).filter(value => typeof value === 'string' && value.length > 40)).join('\n');
    const id = `novice-job-${String(++n).padStart(4, '0')}`;
    jobs.set(id, { kind, at: Date.now(), still: nextStill });
    prompts.push({ kind, text });
    return route.fulfill({ json: { prompt_id: id, node_errors: {} } });
  });
  await page.route(/\/api\/job\/([^/]+)\/status$/, route => {
    const id = /job\/([^/]+)\/status/.exec(route.request().url())?.[1] ?? '';
    const job = jobs.get(id);
    return route.fulfill({ json: { status: job && Date.now() - job.at > 1200 ? 'success' : 'in_progress' } });
  });
  await page.route(/\/api\/jobs\/([^/?]+)$/, route => {
    const id = route.request().url().split('/').pop() ?? '';
    const job = jobs.get(id);
    return route.fulfill({ json: { status: 'success', outputs: { save: { images: [{ filename: `${id}.${job?.kind === 'video' ? 'mp4' : 'webp'}`, subfolder: '', type: 'output' }] } } } });
  });
  await page.route(/\/api\/view\?/, route => {
    const file = new URL(route.request().url()).searchParams.get('filename') ?? '';
    if (file.endsWith('.mp4')) return route.fulfill({ contentType: 'video/mp4', body: video });
    return route.fulfill({ contentType: 'image/webp', body: jobs.get(file.split('.')[0])?.still ?? still });
  });
  return { prompts, setStill(next: Buffer) { nextStill = next; } };
}

