import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { handleUttuChat } from "@/lib/agent/uttu-comfy";
import type { Knowledge } from "@/lib/agent/uttu";

// U*TTU's paid agent. It relays the visitor's own Comfy credential to Comfy Router for one
// answer and keeps nothing: no log of the key, no storage, no streaming, no cancel path.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

let knowledge: Promise<Knowledge> | null = null;
function loadKnowledge(): Promise<Knowledge> {
  knowledge ??= readFile(join(process.cwd(), "public", "agent", "knowledge.json"), "utf8").then(text => JSON.parse(text) as Knowledge);
  knowledge.catch(() => { knowledge = null; });
  return knowledge;
}

export async function POST(request: Request) {
  return handleUttuChat(request, { fetch, knowledge: loadKnowledge, uuid: () => crypto.randomUUID() });
}
