// Finish sharpens a take that already exists. It never samples a new picture.

import { suiteQuote } from "../suite/quote.ts";
import { gesteParId } from "../workflows/registre.ts";

export type FinishMedia = "video" | "image";

export interface FinishPlan {
  /** Catalogue id `runOutil` already knows. Anime video still uploads through the video upscaler, then swaps the graph. */
  tool: "vid-finaliser" | "ret-finaliser";
  engine: "seedvr2" | "realesrgan-anime";
  /** Registry row the quote is taken from. */
  geste: "suite-finaliser-video" | "suite-finaliser-image" | "anime-finish";
  credits: number;
  high: number;
  regenerates: false;
}

const ANIME = { credits: 3, high: 5 } as const;

/** Which enhance pass a kept take gets. Anime projects use Real-ESRGAN anime; everything else is SeedVR2. */
export function finishPlan(input: { media: FinishMedia; anime: boolean; seconds?: number }): FinishPlan {
  if (input.media === "image") {
    const quote = suiteQuote("suite-finaliser-image");
    return { tool: "ret-finaliser", engine: "seedvr2", geste: "suite-finaliser-image", credits: quote?.credits ?? 4, high: quote?.high ?? 6, regenerates: false };
  }
  if (input.anime) {
    const row = gesteParId("anime-finish");
    return {
      tool: "vid-finaliser",
      engine: "realesrgan-anime",
      geste: "anime-finish",
      credits: row?.credits ?? ANIME.credits,
      high: row?.high ?? ANIME.high,
      regenerates: false,
    };
  }
  const seconds = input.seconds && input.seconds > 0 ? input.seconds : 5;
  const quote = suiteQuote("suite-finaliser-video", { seconds, fluidifier: false });
  return { tool: "vid-finaliser", engine: "seedvr2", geste: "suite-finaliser-video", credits: quote?.credits ?? 42, high: quote?.high ?? 63, regenerates: false };
}
