import { semanticRequest, parseSemanticResponse } from './kernel/semantic.ts';
import { emptyConversation, restoreConversation, type ProductionContext } from './kernel/production.ts';
import { studioActionRegistry } from './registry.ts';

/** BYOK, opt-in, one paid model request per explicit confirmation. No Comfy credentials. */
export async function handleSemantic(request: Request, doFetch: typeof fetch = fetch): Promise<Response> {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
  if (request.method !== 'POST') return reply({ error: 'method' }, 405);
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return reply({ error: 'origin' }, 403);
  if (request.headers.get('x-studio-model-confirmed') !== 'yes') return reply({ error: 'confirmation' }, 403);
  const key = request.headers.get('x-typesafe-key') ?? '';
  if (key.length < 10 || key.length > 512 || /[\s\u0000-\u001f]/.test(key)) return reply({ error: 'key' }, 400);
  const reader = request.body?.getReader(); if (!reader) return reply({ error: 'body' }, 400);
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 60_000) { await reader.cancel(); return reply({ error: 'size' }, 413); } chunks.push(part.value); }
  let data: Record<string, unknown>;
  try { const bytes = new Uint8Array(size); let at = 0; for (const c of chunks) { bytes.set(c, at); at += c.length; } data = JSON.parse(new TextDecoder().decode(bytes)); } catch { return reply({ error: 'body' }, 400); }
  if (!data || typeof data.message !== 'string' || !data.message.trim() || data.message.length > 2000 || typeof data.project !== 'string' || !/^[a-z0-9-]+$/.test(data.project)) return reply({ error: 'input' }, 400);
  const context: ProductionContext = { projectId: data.project, projectName: typeof data.name === 'string' ? data.name.slice(0, 100) : '', resources: [], selectedIds: [], evidence: {}, operations: studioActionRegistry() };
  if (Array.isArray(data.resources)) for (const raw of data.resources.slice(0,20)) {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !/^(cast|decor|take|asset):[a-zA-Z0-9-]{1,120}$/.test(raw.id) || typeof raw.name !== 'string' || !['image','video','audio','mesh'].includes(raw.kind)) continue;
    context.resources = [...context.resources, { id: raw.id, name: raw.name.slice(0,100), kind: raw.kind, role: 'asset', available: raw.available === true }];
    context.selectedIds = [...context.selectedIds, raw.id];
  }
  const conversation = typeof data.conversation === 'string' ? restoreConversation(data.conversation, context) : emptyConversation(context.projectId);
  try {
    const result = await doFetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(semanticRequest(data.message, conversation, context)), signal: AbortSignal.timeout(45_000), redirect: 'error', cache: 'no-store' });
    if (!result.ok) return reply({ error: 'provider' }, 502);
    const raw = await result.text(); if (raw.length > 250_000) return reply({ error: 'response' }, 502);
    const interpretation = parseSemanticResponse(JSON.parse(raw), context);
    return reply({ interpretation });
  } catch { return reply({ error: 'provider' }, 502); }
}
