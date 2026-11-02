import type { ComponentType } from "react";
import * as StoryWeave from "storyweave-app";
import { StoryboardHolding, type HoldCopy } from "./storyboard-holding";

type StoryWeaveProps = { id?: string | null; print?: boolean };

/**
 * `?storyboard=sw` is outside the closed gate.
 * src/components/storyweave/storyweave-app.tsx mounts here when it exports
 * StoryWeaveApp, StoryWeave, or a default component. Until that file exists,
 * the same holding page shows with data-storyboard-gate="sw".
 */
export function StoryWeaveSlot({ copy, id, print }: { copy: HoldCopy; id: string | null; print: boolean }) {
  const mod = StoryWeave as Record<string, unknown>;
  if (mod.STORYWEAVE_MOUNTED === false) return <StoryboardHolding copy={copy} gate="sw" />;
  const View = [mod.StoryWeaveApp, mod.StoryWeave, mod.default].find((item): item is ComponentType<StoryWeaveProps> => typeof item === "function");
  if (!View) return <StoryboardHolding copy={copy} gate="sw" />;
  return <div data-storyboard-gate="sw" data-storyweave=""><View id={id} print={print} /></div>;
}
