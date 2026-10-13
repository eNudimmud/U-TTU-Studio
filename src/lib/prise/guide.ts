// The maquette guides one key image. The price of that use is not measured yet.
// Nano Banana 2.1 edit without a guide is measured at 12.5. This path stays a hypothesis.

export const GUIDE_GRAPH = "api_nano_banana_2_1_image_edit";
export const GUIDE_CREDITS = 13;
export const GUIDE_MARK = "estimation à mesurer";

export interface GuideQuote {
  graph: typeof GUIDE_GRAPH;
  credits: number;
  statut: "hypothese";
  mark: typeof GUIDE_MARK;
  enabled: false;
}

export function guideQuote(): GuideQuote {
  return {
    graph: GUIDE_GRAPH,
    credits: GUIDE_CREDITS,
    statut: "hypothese",
    mark: GUIDE_MARK,
    enabled: false,
  };
}
