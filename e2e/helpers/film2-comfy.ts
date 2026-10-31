import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

// Comfy Cloud simulated for the film2 specs: 0 real credits. Proves paths, never model quality.

const still = readFileSync('public/exemples/cast-coursiere.webp');
const decorStill = readFileSync('public/exemples/decor-quai-nuit.webp');
const video = readFileSync('e2e/fixtures/prise-5s-vp9.mp4');

type Job = { kind: 'image' | 'video'; at: number; save: string; fails: boolean };

/** `fail(n, kind)`: the n-th job (1-based) of that kind fails once, as Comfy reports it. */
export async function simulateComfy(page: Page, options: { fail?(index: number, kind: 'image' | 'video'): boolean } = {}) {
  const jobs = new Map<string, Job>();
  const prompts: { kind: string; at: number }[] = [];
  let n = 0;
  await page.addInitScript(() => localStorage.setItem('u-ttu-rendu', JSON.stringify({ mode: 'key', key: 'audit-fake-key-0123456789' })));
  await page.route(/overpass|nominatim|photon|panoramax|mapillary|tiles\.openfreemap|fal\.ai/, route => route.abort());
  await page.route(/\/api\/user$/, route => route.fulfill({ json: { id: 'novice' } }));
  await page.route(/\/api\/billing\/usage\/timeseries|customers\/balance/, route => route.fulfill({ json: { summary: { balance: { amount_micros: 500_000_000 } } } }));
  await page.route(/\/api\/upload\/image$/, route => route.fulfill({ json: { name: `entree-${++n}.webp` } }));
  await page.route(/\/api\/prompt$/, route => {
    const graph = route.request().postDataJSON()?.prompt ?? {};
    const entries = Object.entries(graph) as [string, { class_type?: string }][];
    const kind: 'image' | 'video' = entries.some(([, node]) => /Video|LTXV|MiniMax|Hunyuan|H3/i.test(String(node.class_type))) ? 'video' : 'image';
    const id = `film2-job-${String(++n).padStart(4, '0')}`;
    const save = entries.find(([, node]) => /^(Save|VHS_VideoCombine$)/.test(String(node.class_type)))?.[0] ?? 'save';
    prompts.push({ kind, at: Date.now() });
    const index = prompts.filter(item => item.kind === kind).length;
    jobs.set(id, { kind, at: Date.now(), save, fails: options.fail?.(index, kind) ?? false });
    return route.fulfill({ json: { prompt_id: id, node_errors: {} } });
  });
  await page.route(/\/api\/job\/([^/]+)\/status$/, route => {
    const id = /job\/([^/]+)\/status/.exec(route.request().url())?.[1] ?? '';
    const job = jobs.get(id);
    if (job && Date.now() - job.at > 1200) return route.fulfill({ json: job.fails ? { status: 'error', execution_error: { exception_message: 'Allocation on device failed', node_type: 'KSampler' } } : { status: 'success' } });
    return route.fulfill({ json: { status: 'in_progress' } });
  });
  await page.route(/\/api\/jobs\/([^/?]+)$/, route => {
    const id = route.request().url().split('/').pop() ?? '';
    const job = jobs.get(id);
    if (job?.fails) return route.fulfill({ json: { status: 'error', execution_error: { exception_message: 'Allocation on device failed', node_type: 'KSampler' }, outputs: {} } });
    return route.fulfill({ json: { status: 'success', outputs: { [job?.save ?? 'save']: { images: [{ filename: `${id}.${job?.kind === 'video' ? 'mp4' : 'webp'}`, subfolder: '', type: 'output' }] } } } });
  });
  let images = 0;
  await page.route(/\/api\/view\?/, route => {
    const file = new URL(route.request().url()).searchParams.get('filename') ?? '';
    if (file.endsWith('.mp4')) return route.fulfill({ contentType: 'video/mp4', body: video });
    return route.fulfill({ contentType: 'image/webp', body: images++ === 0 ? still : decorStill });
  });
  return { prompts };
}

