import { handleSemantic } from '@/lib/agent/semantic-handler';
import { SEMANTIC_MODEL_ENABLED } from '@/lib/agent/semantic-flag';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!SEMANTIC_MODEL_ENABLED) return Response.json({ error: 'disabled' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  return handleSemantic(request);
}
