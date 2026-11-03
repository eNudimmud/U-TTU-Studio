// Cinema CGI — the photoreal pipeline, curated from the studio's existing tool registry
// (src/lib/outils/catalogue.ts). No new backend: every id here is already wired, Comfy only.
// Open weights come first in each group; a partner (paid API) sibling, when one exists, is
// listed last and only when the group would otherwise have no faithful-reference option.
//
// Exhaustive by design: every open-weight Comfy template usable for a photoreal shoot — character,
// set, shot/video, motion control, lip-sync/audio, edit, upscale/enhance — has a line below or a
// one-line reason it was left out (see the PR description). Finish never regenerates: it only
// reaches ret-finaliser and vid-finaliser (SeedVR2), both upscale-only tools.

import { outilParId, type Outil } from "../outils/catalogue.ts";

export type CgiStepId = "cast" | "decor" | "prise" | "montage" | "finaliser";

export interface CgiTool {
  id: string;
  /** i18n key suffix: cgi.why.<id> (src/lib/cgi/copy.ts). */
  why: string;
}

export interface CgiGroup {
  /** i18n key suffix: cgi.group.<key> — a sub-heading inside a step ("Camera moves", "Motion control"…). */
  key: string;
  tools: readonly CgiTool[];
}

export interface CgiStep {
  id: CgiStepId;
  groups: readonly CgiGroup[];
}

export const CGI_PIPELINE: readonly CgiStep[] = [
  {
    id: "cast",
    groups: [
      { key: "make", tools: [
        { id: "img-klein", why: "fastKlein" },
        { id: "img-refs", why: "fromPhotos" },
      ] },
      { key: "refine", tools: [
        { id: "ret-angles-perso", why: "turnaround" },
        { id: "ret-eclairer-ouvert", why: "relight" },
        { id: "ret-detourer", why: "cutout" },
      ] },
      { key: "volume", tools: [
        { id: "3d-ouvert", why: "volume" },
      ] },
    ],
  },
  {
    id: "decor",
    groups: [
      { key: "makeSet", tools: [
        { id: "img-klein", why: "fastKlein" },
        { id: "img-croquis", why: "fromSketch" },
        { id: "img-360", why: "panorama" },
      ] },
      { key: "refine", tools: [
        { id: "ret-angles-decor", why: "turnaroundSet" },
      ] },
      { key: "volume", tools: [
        { id: "3d-ouvert", why: "volumeSet" },
      ] },
    ],
  },
  {
    id: "prise",
    groups: [
      { key: "reference", tools: [
        { id: "vid-h3-refs", why: "h3Refs" },
        { id: "vid-fasth3", why: "fasth3" },
        { id: "vid-multi", why: "h3Multi" },
      ] },
      { key: "camera", tools: [
        { id: "vid-ltx-image", why: "ltxImage" },
        { id: "vid-texte", why: "ltxText" },
        { id: "vid-raccord", why: "ltxBridge" },
        { id: "vid-transition-style", why: "ltxTransition" },
      ] },
      { key: "simple", tools: [
        { id: "vid-wan", why: "wanAnimate" },
      ] },
      { key: "control", tools: [
        { id: "vid-mouvement", why: "wanMotion" },
        { id: "vid-recadrer", why: "ltxReframe" },
        { id: "vid-effacer", why: "ltxErase" },
        { id: "vid-prolonger", why: "h3Continue" },
      ] },
    ],
  },
  {
    id: "montage",
    groups: [
      { key: "edit", tools: [
        { id: "ret-modifier", why: "kleinEdit" },
        { id: "ret-elargir", why: "kleinExtend" },
      ] },
      { key: "talk", tools: [
        { id: "vid-parler", why: "ltxTalk" },
      ] },
      { key: "sound", tools: [
        { id: "son-voix-ouverte", why: "chatterbox" },
        { id: "son-musique-ouverte", why: "aceStep" },
        { id: "son-bruitage-ouvert", why: "stableAudio" },
        { id: "son-separer", why: "melband" },
      ] },
    ],
  },
  {
    id: "finaliser",
    groups: [
      { key: "finish", tools: [
        { id: "ret-finaliser", why: "seedvrImage" },
        { id: "vid-finaliser", why: "seedvrVideo" },
        { id: "vid-fluidifier", why: "frameSmooth" },
      ] },
    ],
  },
];

export function cgiToolIds(): string[] {
  return CGI_PIPELINE.flatMap(step => step.groups.flatMap(group => group.tools.map(tool => tool.id)));
}

export interface CgiResolved extends CgiTool {
  outil: Outil;
}

/** Every curated tool, resolved against the live catalogue. Throws if an id drifts out of sync
 *  (tests/cgi-pipeline.test.ts pins this so a renamed or removed tool fails loudly, not silently). */
export function cgiResolve(step: CgiStep): { key: string; tools: CgiResolved[] }[] {
  return step.groups.map(group => ({
    key: group.key,
    tools: group.tools.map(tool => {
      const outil = outilParId(tool.id);
      if (!outil) throw new Error(`Cinema CGI: pas d'outil pour "${tool.id}".`);
      return { ...tool, outil };
    }),
  }));
}
