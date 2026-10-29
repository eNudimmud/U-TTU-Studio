// API exported directly from Comfy Cloud, 2026-10-28.
// Editor-only video-preview and duplicate legacy codec are omitted.
import type { ApiGraph } from "../render/take-graph.ts";
export const GENJUTSU_BASE: ApiGraph = {
  "9": {
    "inputs": {
      "model": "genjutsu-v1.0",
      "model.prompt": "Recast the dancer as the snow queen from the first reference image, and use the second reference image for the new setting. Keep the source motion, camera movement, timing and audio.",
      "model.resolution": "720p",
      "model.seed": 42,
      "model.video": [
        "13",
        0
      ],
      "model.reference_images.image_1": [
        "14",
        0
      ],
      "model.reference_images.image_2": [
        "15",
        0
      ]
    },
    "class_type": "HiggsfieldMotionTransferNode"
  },
  "10": {
    "inputs": {
      "filename_prefix": "video/genjutsu_motion_transfer",
      "format": "auto",
      "format.codec": "auto",
      "video": [
        "9",
        0
      ]
    },
    "class_type": "SaveVideo"
  },
  "13": {
    "inputs": {
      "file": "rooftop_dancer.mp4"
    },
    "class_type": "LoadVideo"
  },
  "14": {
    "inputs": {
      "image": "snow_queen_ref.png"
    },
    "class_type": "LoadImage"
  },
  "15": {
    "inputs": {
      "image": "ice_palace_ref.png"
    },
    "class_type": "LoadImage"
  }
};
