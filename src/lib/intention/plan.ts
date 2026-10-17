// From a resolved intention (+ production memory) to what leaves: engine, references, resolution, graph, identity strategy.
// Every choice carries a reason key; the U*TTU line and the reliability card are rendered from these keys in 4 languages.

import { LTX_MEGAPIXELS, LTX_REFS_MAX } from "../render/ltx-graph.ts";
import { TAKE_ENGINE_TEMPLATE, TAKE_MEGAPIXELS, TAKE_PICTURES_MAX, type TakeEngine } from "../render/take-graph.ts";
import type { Inherited } from "../memoire/model.ts";
import type { Resolved } from "./resolve.ts";

export type Vars = Record<string, string | number>;
export interface Say {
  key: string;
  vars?: Vars;
}

export interface RefPick {
  path: string;
  kind: "planche" | "photo" | "etat" | "decor";
  owner: string;
}

export interface PlanCast {
  id: string;
  name: string;
  sheet: string | null;
  photos: readonly string[];
}

export interface PlanDecor {
  id: string;
  name: string;
  stills: readonly string[];
}

export interface PlanContext {
  cast: readonly PlanCast[];
  decor: PlanDecor | null;
  inherited: readonly Inherited[];
  /** Manual engine from Avancé. Wins over the automatic choice; the line says so. */
  engineOverride: TakeEngine | null;
  /** The previous plan of the sequence has a kept take in the same place. */
  previousInPlace: boolean;
  format: "16:9" | "9:16";
}

export interface IntentionPlan {
  engine: TakeEngine;
  auto: TakeEngine;
  template: string;
  resolution: string;
  refs: RefPick[];
  dropped: RefPick[];
  identity: "planche" | "photo" | "aucune";
  /** LTX with 2+ pictures: Klein composes one start frame inside the same graph, then LTX animates it. */
  keyframe: boolean;
  /** Short decision lines (U*TTU says them under the intention). */
  decisions: Say[];
  /** What may not hold. */
  warnings: Say[];
  /** English lines added to the prompt (style, rotation, continuity, identity, state). */
  promptLines: string[];
}

function resolutionOf(engine: TakeEngine, format: "16:9" | "9:16"): string {
  const megapixels = engine === "ltx" ? LTX_MEGAPIXELS : TAKE_MEGAPIXELS;
  const ratio = 16 / 9;
  const height = Math.round(Math.sqrt((megapixels * 1_000_000) / ratio) / 16) * 16;
  const width = Math.round((height * ratio) / 16) * 16;
  return format === "9:16" ? `${height}×${width}` : `${width}×${height}`;
}

/** French "de" + name with elision: "d’Élise", "de Malo". Other languages ignore it. */
export function deName(name: string): string {
  return /^[aeiouyhàâéèêîôû]/i.test(name.replace(/[^\p{L}]/gu, "")) ? `d’${name}` : `de ${name}`;
}

export function planIntention(resolved: Resolved, context: PlanContext): IntentionPlan {
  const decisions: Say[] = [];
  const warnings: Say[] = [];
  const promptLines: string[] = [];

  // References in identity order: each character's sheet (or first photo), then their state refs, then the place.
  const wanted: RefPick[] = [];
  for (const card of context.cast) {
    if (card.sheet) wanted.push({ path: card.sheet, kind: "planche", owner: card.name });
    else if (card.photos[0]) wanted.push({ path: card.photos[0], kind: "photo", owner: card.name });
    else warnings.push({ key: "missingRef", vars: { name: card.name } });
  }
  for (const row of context.inherited) for (const path of row.state?.refs ?? []) wanted.push({ path, kind: "etat", owner: row.name });
  if (context.decor) {
    if (context.decor.stills[0]) wanted.push({ path: context.decor.stills[0], kind: "decor", owner: context.decor.name });
    else warnings.push({ key: "missingDecorRef", vars: { name: context.decor.name } });
  }
  const unique = wanted.filter((pick, index) => wanted.findIndex(other => other.path === pick.path) === index);

  let auto: TakeEngine = "ltx";
  if (unique.length > LTX_REFS_MAX) {
    auto = "h3";
    decisions.push({ key: "engineH3Refs", vars: { count: unique.length, max: LTX_REFS_MAX } });
  } else if (context.cast.length >= 3) {
    auto = "h3";
    decisions.push({ key: "engineH3Cast", vars: { count: context.cast.length } });
  }
  const engine = context.engineOverride ?? auto;
  if (context.engineOverride && context.engineOverride !== auto) decisions.push({ key: "engineManual", vars: { engine: engine === "ltx" ? "LTX" : "H3" } });

  const limit = engine === "ltx" ? LTX_REFS_MAX : TAKE_PICTURES_MAX;
  const refs = unique.slice(0, limit);
  const dropped = unique.slice(limit);
  if (dropped.length) warnings.push({ key: "refsDropped", vars: { count: dropped.length, max: limit } });

  const identity = refs.some(pick => pick.kind === "planche") ? "planche" : refs.some(pick => pick.kind === "photo") ? "photo" : "aucune";
  const keyframe = engine === "ltx" && refs.length >= 2;
  const lead = context.cast[0]?.name ?? "";

  // Camera.
  const degrees = resolved.camera.degrees;
  if (resolved.camera.move === "orbite") {
    if (degrees) {
      decisions.push({ key: lead ? "orbitDegreesWho" : "orbitDegrees", vars: { degrees, name: lead, deName: deName(lead) } });
      promptLines.push(`[mouvement]   the camera orbits ${degrees} degrees around ${lead ? "the subject" : "the scene"}, steady speed.`);
    } else decisions.push({ key: lead ? "orbitWho" : "orbit", vars: { name: lead, deName: deName(lead) } });
    if (engine === "ltx") warnings.push({ key: "ltxMoveNotExact" });
  } else if (resolved.camera.move) {
    decisions.push({ key: `camera.${resolved.camera.move}` });
  }
  if (resolved.speed === "lent") promptLines.push("[rythme]      slow, unhurried movement.");
  if (resolved.speed === "rapide") promptLines.push("[rythme]      fast, energetic movement.");

  // Identity and continuity.
  const stated = context.inherited.filter(row => row.state);
  if (identity !== "aucune" && lead) {
    decisions.push({ key: identity === "planche" ? "identitySheet" : "identityPhoto", vars: { name: lead, deName: deName(lead) } });
  }
  for (const row of context.inherited) {
    if (row.identity) promptLines.push(`[identité]    ${row.name}: ${row.identity}`);
    if (row.state) promptLines.push(`[état]        ${row.name}: ${row.state.label} (keep it identical).`);
  }
  if (stated.length) decisions.push({ key: "stateKept", vars: { name: stated[0].name, state: stated[0].state!.label, code: stated[0].state!.fromCode || "?" } });
  if (context.previousInPlace && lead) {
    decisions.push({ key: "continuityLight", vars: { name: lead, deName: deName(lead) } });
    promptLines.push("[raccord]     same appearance and same lighting as the previous shot.");
  }
  if (keyframe) decisions.push({ key: "keyframeKlein", vars: { count: refs.length } });

  // Ambiance.
  if (resolved.ambiance.length) {
    promptLines.push(`[ambiance]    ${resolved.ambiance.map(item => item.en).join(", ")}.`);
    decisions.push({ key: "ambiance", vars: { label: resolved.ambiance.map(item => item.label).join(", ") } });
  }

  // Duration and what was not understood.
  if (resolved.duration && resolved.duration.asked !== resolved.duration.seconds) warnings.push({ key: "durationClamped", vars: { asked: resolved.duration.asked, seconds: resolved.duration.seconds } });
  for (const word of resolved.unknown) warnings.push({ key: "unknownName", vars: { word } });
  if (resolved.text && resolved.who.length === 0 && context.cast.length === 0) warnings.push({ key: "noWho" });

  return {
    engine,
    auto,
    template: TAKE_ENGINE_TEMPLATE[engine],
    resolution: resolutionOf(engine, context.format),
    refs,
    dropped,
    identity,
    keyframe,
    decisions,
    warnings,
    promptLines,
  };
}

/** Plain {var} filling, used by the tests and for strings outside next-intl. */
export function fill(template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

const CAMERA_KEYS = /^(orbit|camera\.)/;
const ENGINE_KEYS = /^(engineH3Refs|engineH3Cast|engineManual)$/;

/** U*TTU's short line: the camera decision, the continuity kept, an engine switch. Then what may not hold. */
export function uttuLine(plan: Pick<IntentionPlan, "decisions" | "warnings">): { line: Say[]; flags: Say[] } {
  const pick = (pattern: RegExp) => plan.decisions.find(item => pattern.test(item.key));
  const keep = ["continuityLight", "stateKept", "identitySheet", "identityPhoto"].map(key => plan.decisions.find(item => item.key === key)).find(Boolean);
  const line = [pick(CAMERA_KEYS), keep, pick(ENGINE_KEYS)].filter((item): item is Say => Boolean(item));
  return { line, flags: plan.warnings.slice(0, 3) };
}
