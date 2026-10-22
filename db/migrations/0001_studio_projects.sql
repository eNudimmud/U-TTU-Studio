-- U*TTU Studio · project metadata sync (Neon Postgres).
-- Only project notes (Markdown/JSON manifest). No media, keys, cookies or signed URLs.
-- Run once in the Neon SQL editor, as the database owner. Idempotent.

CREATE TABLE IF NOT EXISTS studio_projects (
  owner_id    text        NOT NULL CHECK (owner_id ~ '^user_[A-Za-z0-9]{1,64}$'),
  project_id  text        NOT NULL CHECK (project_id ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  revision    integer     NOT NULL CHECK (revision > 0),
  hash        text        NOT NULL CHECK (hash ~ '^[0-9a-f]{64}$'),
  manifest    jsonb       NOT NULL CHECK (octet_length(manifest::text) <= 1100000),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, project_id)
);

-- Bounded history: the last 10 revisions per project, for restoring a version by hand.
CREATE TABLE IF NOT EXISTS studio_project_versions (
  owner_id    text        NOT NULL,
  project_id  text        NOT NULL,
  revision    integer     NOT NULL,
  hash        text        NOT NULL,
  manifest    jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, project_id, revision)
);

-- Defence in depth: every query sets app.owner_id from the verified Clerk session.
-- FORCE applies the policies to the table owner too (Neon's role is not a superuser).
ALTER TABLE studio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_projects FORCE ROW LEVEL SECURITY;
ALTER TABLE studio_project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_project_versions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS studio_projects_owner ON studio_projects;
CREATE POLICY studio_projects_owner ON studio_projects
  USING (owner_id = current_setting('app.owner_id', true))
  WITH CHECK (owner_id = current_setting('app.owner_id', true));

DROP POLICY IF EXISTS studio_project_versions_owner ON studio_project_versions;
CREATE POLICY studio_project_versions_owner ON studio_project_versions
  USING (owner_id = current_setting('app.owner_id', true))
  WITH CHECK (owner_id = current_setting('app.owner_id', true));
