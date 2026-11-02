// Script scenes and audio cues read from the board. No sample story is invented here.

import type { Storyboard } from "../storyboard/storyboard.ts";
import { shotRows, type SwEdit } from "./timeline.ts";

export interface SwScene {
  shotId: string;
  index: number;
  start: number;
  end: number;
  cadrage: Storyboard["sequences"][number]["plans"][number]["cadrage"];
  camera: Storyboard["sequences"][number]["plans"][number]["camera"];
  title: string;
  action: string;
  who: string | null;
  line: string;
  voice: boolean;
  proposal: boolean;
}

export interface SwCue {
  id: string;
  group: "narration" | "dialogue" | "music" | "sound";
  shotId: string | null;
  shotIndex: number | null;
  label: string;
  seconds: number;
  recorded: boolean;
  source: string | null;
}

export function scenesOf(sb: Storyboard, edit: SwEdit): SwScene[] {
  return shotRows(sb, edit).map(row => {
    const line = row.plan.dialogue.texte.trim();
    const voice = row.plan.dialogue.type === "voixoff";
    return {
      shotId: row.plan.id,
      index: row.index + 1,
      start: row.start,
      end: Math.round((row.start + row.duration) * 10) / 10,
      cadrage: row.plan.cadrage,
      camera: row.plan.camera,
      title: row.plan.titre,
      action: row.plan.action,
      who: voice ? null : row.plan.dialogue.qui,
      line,
      voice,
      proposal: row.plan.dialogue.source === "uttu" && line.length > 0,
    };
  });
}

export function wordCount(sb: Storyboard, edit: SwEdit): number {
  const text = scenesOf(sb, edit).flatMap(scene => [scene.title, scene.action, scene.line]).join(" ");
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function cuesOf(sb: Storyboard, edit: SwEdit, sources: ReadonlyMap<string, string> = new Map()): SwCue[] {
  const cues: SwCue[] = [];
  for (const scene of scenesOf(sb, edit)) {
    if (!scene.line) continue;
    if (scene.voice) {
      const id = `voice:${scene.shotId}`;
      cues.push({ id, group: "narration", shotId: scene.shotId, shotIndex: scene.index, label: scene.line, seconds: Math.max(1, scene.end - scene.start), recorded: sources.has(id), source: sources.get(id) ?? null });
    } else if (scene.who || scene.line) {
      const id = `voice:${scene.shotId}`;
      const spoken = scene.who ? scene.line : "";
      if (!spoken && !scene.voice) {
        /* a line with a speaker is dialogue; a blank speaker on a replique still counts */
      }
      if (scene.line && !scene.voice) {
        cues.push({ id, group: "dialogue", shotId: scene.shotId, shotIndex: scene.index, label: scene.who ? `${scene.who}` : scene.line, seconds: Math.max(1, Math.min(6, scene.end - scene.start)), recorded: sources.has(id), source: sources.get(id) ?? null });
      }
    }
  }
  if (sb.musique.trim() && edit.music !== false) {
    const total = scenesOf(sb, edit).reduce((max, scene) => Math.max(max, scene.end), 0);
    cues.push({ id: "music", group: "music", shotId: null, shotIndex: null, label: sb.musique.trim(), seconds: total, recorded: sources.has("music"), source: sources.get("music") ?? null });
  }
  for (const scene of scenesOf(sb, edit)) {
    const ambiance = scene.shotId ? shotAmbiance(sb, scene.shotId) : "";
    if (!ambiance) continue;
    const id = `sound:${scene.shotId}`;
    cues.push({ id, group: "sound", shotId: scene.shotId, shotIndex: scene.index, label: ambiance, seconds: Math.max(1, scene.end - scene.start), recorded: sources.has(id), source: sources.get(id) ?? null });
  }
  return cues;
}

function shotAmbiance(sb: Storyboard, shotId: string): string {
  for (const seq of sb.sequences) {
    const plan = seq.plans.find(item => item.id === shotId);
    if (plan) return plan.son.ambiance.trim();
  }
  return "";
}
