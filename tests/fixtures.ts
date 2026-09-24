import { CONFIRMATIONS, type DatasetImage, type GateInput } from "../src/lib/gate/rules.ts";
import type { Angle, Framing } from "../src/lib/gate/vocabulary.ts";

let seed = 20260924;
const nextHash = () => {
  let hex = "";
  for (let i = 0; i < 16; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    hex += ((seed >>> 16) & 15).toString(16);
  }
  return hex;
};

let counter = 0;
export function makeImage(overrides: Partial<DatasetImage> = {}): DatasetImage {
  counter++;
  return {
    id: `img-${counter}`,
    name: `photo-${counter}.jpg`,
    readable: true,
    width: 2000,
    height: 2600,
    sharpness: 800,
    hash: nextHash(),
    mirrorHash: nextHash(),
    luma: 120,
    saturation: 0.3,
    angle: "face",
    framing: "gros-plan",
    variables: "",
    decision: "garder",
    reviewed: false,
    ...overrides,
  };
}

const VARIABLES = [
  "black leather jacket, rainy street at night, neon rim light",
  "white linen shirt, beach at sunrise, warm backlight",
  "grey hoodie, subway platform, fluorescent light",
  "red wool coat, snowy park, overcast daylight",
  "denim jacket, rooftop at dusk, golden hour",
  "green raincoat, forest trail, diffused light",
  "navy suit, office lobby, soft window light",
  "yellow sweater, cafe interior, tungsten lamps",
  "leather apron, pottery workshop, skylight",
  "running gear, stadium track, harsh noon sun",
  "silk dress, gallery opening, spotlights",
  "flannel shirt, cabin porch, evening lantern light",
  "wetsuit, harbor pier, foggy morning",
  "turtleneck, library stacks, desk lamp",
  "bomber jacket, parking garage, sodium vapor light",
];
const ANGLE_PLAN: Angle[] = ["face", "face", "face", "face", "face", "trois-quarts", "trois-quarts", "trois-quarts", "trois-quarts", "trois-quarts", "profil", "profil", "profil", "profil", "dos"];
const FRAMING_PLAN: Framing[] = ["gros-plan", "buste", "pied", "gros-plan", "buste", "pied", "gros-plan", "buste", "buste", "gros-plan", "pied", "buste", "gros-plan", "buste", "pied"];

export const INVARIANTS = "green eyes, freckles, scar on left cheek";

export function cleanDataset(): DatasetImage[] {
  return VARIABLES.map((variables, i) => makeImage({ variables, angle: ANGLE_PLAN[i], framing: FRAMING_PLAN[i] }));
}

export const allConfirmed = () => Object.fromEntries(CONFIRMATIONS.map(item => [item.id, true]));

export function cleanInput(images = cleanDataset()): GateInput {
  return { trigger: "mira_v1", invariants: INVARIANTS, images, confirmations: allConfirmed() };
}
