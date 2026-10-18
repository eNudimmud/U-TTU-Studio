// The measurement plan for « Et ensuite ? »: one minimal real run per new tool, to replace
// each « estimé » by a measured figure. Nothing here runs: the plan is shown, then approved.
// The reserve (high) is the most each run may cost; the total must stay under the ceiling.

import { suiteQuote } from "./quote.ts";
import type { SuiteGeste } from "./graphs.ts";

/** JD's ceiling for the whole measurement round, in Comfy credits. */
export const MESURE_PLAFOND = 80;

export interface MesureRun {
  geste: SuiteGeste;
  /** The smallest input that still measures the real path. */
  entree: string;
  credits: number;
  high: number;
}

const ENTREES: Record<SuiteGeste, string> = {
  "suite-modifier": "1 image 1 MP, une phrase",
  "suite-finaliser-image": "1 image 1 MP, ×2",
  "suite-detourer": "1 image 1 MP",
  "suite-elargir": "1 image 1 MP, côtés",
  "suite-animer": "1 image, 5 s, 16:9, LoRA 8 pas",
  "suite-finaliser-video": "1 prise de 5 s, 1080p, sans fluidifier",
  "suite-fluidifier": "1 prise de 5 s, ×2",
  "suite-prolonger": "dernière image d’une prise, 5 s",
  "suite-parler": "1 image + 5 s de voix, 1280×720",
};

export function mesurePlan(): { runs: MesureRun[]; credits: number; high: number } {
  const runs = (Object.keys(ENTREES) as SuiteGeste[]).map(geste => {
    const quote = suiteQuote(geste, { seconds: 5 });
    if (!quote) throw new Error(`Pas de devis : ${geste}`);
    return { geste, entree: ENTREES[geste], credits: quote.credits, high: quote.high };
  });
  const sum = (pick: (run: MesureRun) => number) => Math.round(runs.reduce((total, run) => total + pick(run), 0) * 10) / 10;
  return { runs, credits: sum(run => run.credits), high: sum(run => run.high) };
}
