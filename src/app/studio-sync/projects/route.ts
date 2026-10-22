import { handleList } from "@/lib/sync/server";
import { syncDeps } from "@/lib/sync/deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return handleList(request, syncDeps()); }
