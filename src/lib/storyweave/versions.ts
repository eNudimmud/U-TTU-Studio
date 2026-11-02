// A published version is a named snapshot kept in the project. It has no public address.

import { lireStoryboard, type Storyboard } from "../storyboard/storyboard.ts";

export interface SwVersion {
  id: string;
  /** "1", "2", … — the screen says « Version N ». */
  name: string;
  savedAt: string;
  board: Storyboard;
}

export function versionsPath(boardId: string): string {
  return `.uttu/sw-versions-${boardId}.json`;
}

export function parseVersions(raw: string | null | undefined): SwVersion[] {
  if (!raw) return [];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return []; }
  const rows = Array.isArray(data) ? data : [];
  const out: SwVersion[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Partial<SwVersion> & { board?: unknown };
    const board = lireStoryboard(JSON.stringify(item.board ?? null));
    if (!board || typeof item.id !== "string" || typeof item.savedAt !== "string") continue;
    const name = typeof item.name === "string" && item.name.trim() ? item.name.trim().slice(0, 8) : String(out.length + 1);
    out.push({ id: item.id.slice(0, 80), name, savedAt: item.savedAt, board });
  }
  return out;
}

/** Appends the next Version N. The live board is copied; nothing is published to a URL. */
export function publishVersion(versions: readonly SwVersion[], board: Storyboard, now: string): SwVersion[] {
  const name = String(versions.length + 1);
  const id = `v${name}-${now.replace(/[^\d]/g, "").slice(0, 14) || "0"}`;
  return [...versions, { id, name, savedAt: now, board: structuredClone(board) }];
}

export function versionsJson(versions: readonly SwVersion[]): string {
  return `${JSON.stringify(versions.map(item => ({ id: item.id, name: item.name, savedAt: item.savedAt, board: item.board })), null, 2)}\n`;
}
