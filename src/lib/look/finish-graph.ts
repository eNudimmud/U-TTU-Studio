// Real-ESRGAN anime finish. Sharpens frames already made. No sampler, no prompt, no partner node.

export interface FinishNode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta: { title: string };
}

export type FinishGraph = Record<string, FinishNode>;

export const FINISH_TEMPLATE = "core_realesrgan_anime";
export const REALESRGAN_ANIME = "RealESRGAN_x4plus_anime_6B.pth";

export interface FinishInput {
  video: string;
  /** Style frame, when the palette lock is on. Colors move toward it; the drawing does not. */
  styleFrame?: string | null;
  prefix?: string;
}

/** Real-ESRGAN x4plus anime, then an optional color match. */
export function grapheFinition(input: FinishInput): FinishGraph {
  const video = input.video.trim();
  if (!video) throw new Error("La finition part d'une prise déjà faite.");
  const graph: FinishGraph = {
    load: { class_type: "VHS_LoadVideo", inputs: { video, force_rate: 0, frame_load_cap: 0 }, _meta: { title: "Prise" } },
    model: { class_type: "UpscaleModelLoader", inputs: { model_name: REALESRGAN_ANIME }, _meta: { title: "Real-ESRGAN anime" } },
    upscale: { class_type: "ImageUpscaleWithModel", inputs: { upscale_model: ["model", 0], image: ["load", 0] }, _meta: { title: "Agrandir" } },
  };
  let images: [string, number] = ["upscale", 0];
  if (input.styleFrame) {
    graph.style = { class_type: "LoadImage", inputs: { image: input.styleFrame }, _meta: { title: "Cadre de style" } };
    graph.color = {
      class_type: "ColorTransfer",
      inputs: { image: ["upscale", 0], reference: ["style", 0], method: "mkl_lab", source_stats: "uniform" },
      _meta: { title: "Caler les couleurs" },
    };
    images = ["color", 0];
  }
  graph.save = {
    class_type: "VHS_VideoCombine",
    inputs: { images, frame_rate: 24, loop_count: 0, filename_prefix: input.prefix ?? "video/uttu-anime-finish", format: "video/h264-mp4", save_output: true },
    _meta: { title: "Enregistrer" },
  };
  return graph;
}
