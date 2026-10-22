import type { ProjectManifest } from "./manifest.ts";
import type { ProjectStore, StoredProject } from "./server.ts";

/** Minimal surface of @neondatabase/serverless `neon()` used here, so tests can inject a fake. */
export interface SqlClient {
  query(text: string, params?: unknown[]): PromiseLike<Record<string, unknown>[]> & object;
  transaction(queries: (PromiseLike<Record<string, unknown>[]> & object)[]): Promise<Record<string, unknown>[][]>;
}

export const MAX_PROJECTS_PER_OWNER = 100;
export const HISTORY = 10;

const OWNER = "SELECT set_config('app.owner_id', $1, true)";
const COLUMNS = "project_id, revision, hash, updated_at";

function row(r: Record<string, unknown>, withManifest = false): StoredProject {
  const at = r.updated_at;
  return {
    project: String(r.project_id),
    revision: Number(r.revision),
    hash: String(r.hash),
    updatedAt: at instanceof Date ? at.toISOString() : String(at),
    ...(withManifest ? { manifest: (typeof r.manifest === "string" ? JSON.parse(r.manifest) : r.manifest) as ProjectManifest } : {}),
  };
}

// One statement per write: compare-and-set, history and pruning are atomic together.
const CREATE = `WITH quota AS (SELECT count(*) AS n FROM studio_projects WHERE owner_id = $1),
up AS (
  INSERT INTO studio_projects (owner_id, project_id, revision, hash, manifest, updated_at)
  SELECT $1, $2, 1, $3, $4::jsonb, now() FROM quota WHERE quota.n < ${MAX_PROJECTS_PER_OWNER}
  ON CONFLICT (owner_id, project_id) DO NOTHING
  RETURNING owner_id, ${COLUMNS}, manifest
),
hist AS (INSERT INTO studio_project_versions (owner_id, project_id, revision, hash, manifest, created_at) SELECT owner_id, project_id, revision, hash, manifest, updated_at FROM up)
SELECT ${COLUMNS}, (SELECT n FROM quota) AS projects FROM up`;

const UPDATE = `WITH up AS (
  UPDATE studio_projects SET revision = revision + 1, hash = $3, manifest = $4::jsonb, updated_at = now()
  WHERE owner_id = $1 AND project_id = $2 AND revision = $5
  RETURNING owner_id, ${COLUMNS}, manifest
),
hist AS (INSERT INTO studio_project_versions (owner_id, project_id, revision, hash, manifest, created_at) SELECT owner_id, project_id, revision, hash, manifest, updated_at FROM up),
prune AS (DELETE FROM studio_project_versions v USING up WHERE v.owner_id = up.owner_id AND v.project_id = up.project_id AND v.revision <= up.revision - ${HISTORY})
SELECT ${COLUMNS} FROM up`;

export function neonProjectStore(sql: SqlClient): ProjectStore {
  const scoped = async (owner: string, text: string, params: unknown[]) => {
    const [, rows] = await sql.transaction([sql.query(OWNER, [owner]), sql.query(text, params)]);
    return rows;
  };
  const current = async (owner: string, project: string) => {
    const rows = await scoped(owner, `SELECT ${COLUMNS} FROM studio_projects WHERE owner_id = $1 AND project_id = $2`, [owner, project]);
    return rows[0] ? row(rows[0]) : null;
  };
  return {
    async list(owner) {
      return (await scoped(owner, `SELECT ${COLUMNS} FROM studio_projects WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT ${MAX_PROJECTS_PER_OWNER}`, [owner])).map(r => row(r));
    },
    async get(owner, project) {
      const rows = await scoped(owner, `SELECT ${COLUMNS}, manifest FROM studio_projects WHERE owner_id = $1 AND project_id = $2`, [owner, project]);
      return rows[0] ? row(rows[0], true) : null;
    },
    async put(owner, project, baseRevision, manifest, hash) {
      const json = JSON.stringify(manifest);
      if (baseRevision === 0) {
        const rows = await scoped(owner, CREATE, [owner, project, hash, json]);
        if (rows[0]) return { ok: true, project: row(rows[0]) };
        const existing = await current(owner, project);
        if (!existing) return { ok: false, quota: true };
        return { ok: false, conflict: existing };
      }
      const rows = await scoped(owner, UPDATE, [owner, project, hash, json, baseRevision]);
      if (rows[0]) return { ok: true, project: row(rows[0]) };
      return { ok: false, conflict: await current(owner, project) };
    },
  };
}
