// F29 — the novice path, counted, and the two rules that keep it that way.
// A gesture is one tap or one text entry. A screen passage is a view that
// differs from the view of the previous gesture. Safe defaults are already
// written; the paid confirmation stays, because the text that leaves is read first.

export const MIN_TARGET = 44;

export interface PathStep {
  kind: "tap" | "saisie";
  /** The view the person is on while they do the gesture. */
  screen: string;
}

/**
 * Shortest F28 path that files a take on a shot, plays the sequence, and exports.
 * One photo picker can hold both photos. Training a file and filming the path stay off this path.
 * Blank names count. A sheet you must close to continue counts.
 */
export const PATH_AVANT: readonly PathStep[] = [
  { kind: "tap", screen: "mon-studio" },
  { kind: "saisie", screen: "mon-studio" },
  { kind: "tap", screen: "mon-studio" },
  { kind: "tap", screen: "mon-studio" },
  { kind: "tap", screen: "personnage" },
  { kind: "tap", screen: "references" },
  { kind: "saisie", screen: "references" },
  { kind: "saisie", screen: "references" },
  { kind: "saisie", screen: "references" },
  { kind: "tap", screen: "references" },
  { kind: "saisie", screen: "scene" },
  { kind: "tap", screen: "scene" },
  { kind: "tap", screen: "scene" },
  { kind: "saisie", screen: "prise" },
  { kind: "tap", screen: "prise" },
  { kind: "tap", screen: "confirmation" },
  { kind: "tap", screen: "prise" },
  { kind: "saisie", screen: "sequences" },
  { kind: "tap", screen: "sequences" },
  { kind: "saisie", screen: "sequence" },
  { kind: "tap", screen: "sequence" },
  { kind: "tap", screen: "plan" },
  { kind: "tap", screen: "plan" },
  { kind: "tap", screen: "sequence" },
  { kind: "tap", screen: "sequence" },
  { kind: "tap", screen: "prise" },
  { kind: "tap", screen: "mon-studio" },
];

/**
 * The F29/F30 path. Atelier, Séquence 1 and Plan 1 are already written.
 * The character name, two traits, the place and the line are still typed.
 */
export const PATH_F30: readonly PathStep[] = [
  { kind: "tap", screen: "projet" },
  { kind: "tap", screen: "personnage" },
  { kind: "saisie", screen: "personnage" },
  { kind: "saisie", screen: "personnage" },
  { kind: "saisie", screen: "personnage" },
  { kind: "tap", screen: "personnage" },
  { kind: "saisie", screen: "scene" },
  { kind: "tap", screen: "scene" },
  { kind: "tap", screen: "scene" },
  { kind: "saisie", screen: "prise" },
  { kind: "tap", screen: "prise" },
  { kind: "tap", screen: "confirmation" },
  { kind: "tap", screen: "prise" },
  { kind: "tap", screen: "sequence" },
  { kind: "tap", screen: "sequence" },
];

/**
 * F31. Personnage 1, Lieu 1 and the shot line are already written.
 * Two traits stay on the screen and do not block. Posing the place opens the take.
 * The paid confirmation stays: the quote and the text that leaves are read first.
 */
export const PATH_APRES: readonly PathStep[] = [
  { kind: "tap", screen: "projet" },
  { kind: "tap", screen: "personnage" },
  { kind: "tap", screen: "personnage" },
  { kind: "tap", screen: "scene" },
  { kind: "tap", screen: "prise" },
  { kind: "tap", screen: "confirmation" },
  { kind: "tap", screen: "prise" },
  { kind: "tap", screen: "sequence" },
  { kind: "tap", screen: "sequence" },
];

/**
 * A decision is a blank the path will not pass, or two equal choices with no default.
 * A name already written, and a control already on the measured profile, are not decisions.
 * Before: project name, which way, character name, two traits, place, line, sequence name, shot name.
 * F30: character name, two traits, place, line.
 * F31: none. The written names and the written line are not decisions. Traits do not block.
 */
export const DECISIONS_AVANT = 9;
export const DECISIONS_F30 = 5;
export const DECISIONS_APRES = 0;

/** Times the path sends the person back before the next step is reachable. */
export const RETOURS_AVANT = 3;
export const RETOURS_F30 = 0;
export const RETOURS_APRES = 0;

/** The F31 path fails the test if it grows past this. */
export const GESTES_PLAFOND = 9;

/** A stored name, or the offered one, until the person clears the field. */
export function offeredName(stored: string, offered: string, cleared: boolean): string {
  if (cleared) return stored;
  const clean = stored.trim();
  return clean || offered;
}

export function pathCount(steps: readonly PathStep[]): { gestes: number; saisies: number; taps: number; ecrans: number } {
  const screens: string[] = [];
  for (const step of steps) {
    if (screens[screens.length - 1] !== step.screen) screens.push(step.screen);
  }
  return {
    gestes: steps.length,
    saisies: steps.filter(step => step.kind === "saisie").length,
    taps: steps.filter(step => step.kind === "tap").length,
    ecrans: screens.length,
  };
}

export function nextNumberedName(seed: string, used: readonly string[]): string {
  const taken = new Set(used.map(name => name.trim()).filter(Boolean));
  const clean = seed.trim();
  if (!clean) return "";
  if (!taken.has(clean)) return clean;
  const stem = clean.replace(/\s+\d+$/u, "");
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${stem} ${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${stem} ${taken.size + 1}`;
}

export interface PoseNames {
  sequence: string;
  shot: string;
}

export interface PoseSequence {
  id: string;
  name: string;
}

export interface PoseShot {
  id: string;
  name: string;
  sequenceId: string | null;
  takeIds: readonly string[];
}

export interface PosePlan {
  openSequenceId: string | null;
  createSequence: string | null;
  createShotName: string | null;
  adoptShotId: string | null;
}

/**
 * Where a finished take should sit. One sequence, one shot.
 * A shot that already holds the take is reused. Nothing is invented when the take id is empty.
 */
export function posePlan(
  takeId: string,
  sequences: readonly PoseSequence[],
  shots: readonly PoseShot[],
  names: PoseNames,
): PosePlan | null {
  if (!takeId.trim()) return null;
  const sequenceIds = new Set(sequences.map(item => item.id));
  const holding = shots.find(shot => shot.takeIds.includes(takeId) && shot.sequenceId && sequenceIds.has(shot.sequenceId));
  if (holding?.sequenceId) {
    return { openSequenceId: holding.sequenceId, createSequence: null, createShotName: null, adoptShotId: null };
  }
  const sequence = sequences[0] ?? null;
  const loose = shots.find(shot => shot.takeIds.includes(takeId)) ?? null;
  return {
    openSequenceId: sequence?.id ?? null,
    createSequence: sequence ? null : nextNumberedName(names.sequence, sequences.map(item => item.name)),
    createShotName: loose ? null : nextNumberedName(names.shot, shots.map(item => item.name)),
    adoptShotId: loose?.id ?? null,
  };
}

const INTERACTIVE = /(?:^|[\s,>+~])(?:button|a\b|summary|select|input|textarea|label|\.u-chip\b|\.u-slot-remove\b|\.u-link\b|\.u-icon\b|\.u-primary\b|\.u-secondary\b|\.u-drag\b|\.u-mark\b|\.u-credit\b|\.u-coffre\b|\.u-scene-add\b|\.u-scene\b|\.u-fiches-nav\b|\.u-sphere\b)/;

function compounds(selector: string): string[] {
  return selector.split(",").map(part => part.trim()).filter(Boolean);
}

function interactiveCompounds(selector: string): string[] {
  return compounds(selector).filter(part => {
    if (/::|svg|img|\.u-node|\.u-pulse|\.u-thread|\.u-scene-empty/.test(part)) return false;
    return INTERACTIVE.test(` ${part}`);
  });
}

/** Fixed pixel sizes on an interactive subject. A value under 44 px is a miss. */
export function cssTargetViolations(css: string): string[] {
  const violations: string[] = [];
  for (const block of css.split("}")) {
    const splitAt = block.lastIndexOf("{");
    if (splitAt < 0) continue;
    const selector = block.slice(0, splitAt);
    const body = block.slice(splitAt + 1);
    const interactive = interactiveCompounds(selector);
    if (interactive.length === 0) continue;
    for (const match of body.matchAll(/\b(min-height|height|min-width|width)\s*:\s*(\d+(?:\.\d+)?)px/g)) {
      const value = Number(match[2]);
      // 0 is the flex shrink floor (min-width: 0). It does not set the hit size.
      if (value === 0 || value >= MIN_TARGET) continue;
      violations.push(`${interactive.join(", ")} { ${match[1]}: ${value}px }`);
    }
  }
  return violations;
}

/**
 * A disabled button needs a visible reason: a Why line just after it, or aria-describedby.
 * The window is the following lines, so a long click handler still reaches the reason.
 */
export function disabledWithoutReason(source: string): string[] {
  const lines = source.split("\n");
  const problems: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].includes("disabled=")) continue;
    const around = lines.slice(Math.max(0, index - 12), index + 1).join("\n");
    const buttonAt = around.lastIndexOf("<button");
    const inputAt = Math.max(around.lastIndexOf("<input"), around.lastIndexOf("<select"), around.lastIndexOf("<textarea"));
    if (buttonAt < 0 || inputAt > buttonAt) continue;
    const ahead = lines.slice(index, index + 28).join("\n");
    if (/<Why\b/.test(ahead) || /aria-describedby=/.test(around)) continue;
    problems.push(`${index + 1}: ${lines[index].trim()}`);
  }
  return problems;
}
