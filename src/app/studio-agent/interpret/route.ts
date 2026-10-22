import { handleSemantic } from '@/lib/agent/semantic-handler';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) { return handleSemantic(request); }
