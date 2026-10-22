import { manifestHash, PROJECT_ID, validateManifest, type ProjectManifest } from "./manifest.ts";

export interface StoredProject { project: string; revision: number; hash: string; updatedAt: string; manifest?: ProjectManifest }
export type PutResult = { ok: true; project: StoredProject } | { ok: false; conflict: StoredProject | null } | { ok: false; quota: true };

/** Every call is scoped to the owner the server derived from a verified Clerk session. */
export interface ProjectStore {
  list(owner: string): Promise<StoredProject[]>;
  get(owner: string, project: string): Promise<StoredProject | null>;
  /** Compare-and-set: succeeds only when the stored revision equals baseRevision (0 = create). */
  put(owner: string, project: string, baseRevision: number, manifest: ProjectManifest, hash: string): Promise<PutResult>;
}

export interface SyncDeps {
  enabled: boolean;
  /** Verified Clerk user id for this bearer token, or null. */
  verify(token: string, origin: string): Promise<string | null>;
  store(): ProjectStore;
}

const MAX_BODY = 1_200_000;
const reply = (body: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(body, { status, headers: { "cache-control": "no-store", ...extra } });

async function owner(request: Request, deps: SyncDeps): Promise<string | Response> {
  const origin = request.headers.get("origin");
  const self = new URL(request.url).origin;
  if (request.method !== "GET" && origin !== self) return reply({ error: "origin" }, 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") return reply({ error: "origin" }, 403);
  const auth = request.headers.get("authorization") ?? "";
  const token = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(auth)?.[1];
  if (!token) return reply({ error: "auth" }, 401);
  try {
    const id = await deps.verify(token, self);
    return id ?? reply({ error: "auth" }, 401);
  } catch { return reply({ error: "auth" }, 401); }
}

async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("body");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > MAX_BODY) { await reader.cancel(); throw new Error("size"); }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size); let at = 0;
  for (const c of chunks) { bytes.set(c, at); at += c.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

const summary = (p: StoredProject) => ({ project: p.project, revision: p.revision, hash: p.hash, updatedAt: p.updatedAt });

/** GET /studio-sync/projects */
export async function handleList(request: Request, deps: SyncDeps): Promise<Response> {
  if (!deps.enabled) return reply({ error: "disabled" }, 404);
  const who = await owner(request, deps); if (who instanceof Response) return who;
  try { return reply({ projects: (await deps.store().list(who)).map(summary) }); }
  catch { return reply({ error: "store" }, 503); }
}

/** GET or PUT /studio-sync/projects/{project} */
export async function handleProject(request: Request, project: string, deps: SyncDeps): Promise<Response> {
  if (!deps.enabled) return reply({ error: "disabled" }, 404);
  if (!PROJECT_ID.test(project)) return reply({ error: "project" }, 400);
  if (request.method !== "GET" && request.method !== "PUT") return reply({ error: "method" }, 405, { allow: "GET, PUT" });
  const who = await owner(request, deps); if (who instanceof Response) return who;
  const store = deps.store();
  if (request.method === "GET") {
    try {
      const found = await store.get(who, project);
      return found ? reply({ ...summary(found), manifest: found.manifest }, 200, { etag: `"${found.revision}"` }) : reply({ error: "missing" }, 404);
    } catch { return reply({ error: "store" }, 503); }
  }
  let body: unknown;
  try { body = await readBody(request); } catch (e) { return reply({ error: e instanceof Error && e.message === "size" ? "size" : "body" }, e instanceof Error && e.message === "size" ? 413 : 400); }
  const data = body as { baseRevision?: unknown; manifest?: unknown } | null;
  const baseRevision = data?.baseRevision;
  if (typeof baseRevision !== "number" || !Number.isInteger(baseRevision) || baseRevision < 0) return reply({ error: "revision" }, 400);
  const checked = validateManifest(data?.manifest, project);
  if (!checked.ok) return reply({ error: checked.error }, checked.error === "size" ? 413 : 422);
  try {
    const result = await store.put(who, project, baseRevision, checked.manifest, await manifestHash(checked.manifest));
    if (result.ok) return reply(summary(result.project), baseRevision === 0 ? 201 : 200, { etag: `"${result.project.revision}"` });
    if ("quota" in result) return reply({ error: "quota" }, 429);
    // Both versions are kept: the server row is untouched and the device keeps its notes.
    return reply({ error: "conflict", current: result.conflict ? summary(result.conflict) : null }, 409);
  } catch { return reply({ error: "store" }, 503); }
}
