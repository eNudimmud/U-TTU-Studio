import { handleProject } from "@/lib/sync/server";
import { syncDeps } from "@/lib/sync/deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
type Context = { params: Promise<{ project: string }> };
export async function GET(request: Request, { params }: Context) { return handleProject(request, (await params).project, syncDeps()); }
export async function PUT(request: Request, { params }: Context) { return handleProject(request, (await params).project, syncDeps()); }
