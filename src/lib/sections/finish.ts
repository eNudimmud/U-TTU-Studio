import type { ApiGraph } from "../render/take-graph.ts";
import type { ProductionAsset } from "./model.ts";
import type { Section } from "./registry.ts";
export function finishSource(assets: ProductionAsset[], id: string, section: Section): ProductionAsset {
  const asset = assets.find(a => a.id === id && a.section === section && a.kind === "take" && a.kept);
  if (!asset) throw new Error("Finish demande une prise gardée dans ce projet et cet univers.");
  return asset;
}
export function finishEstimate(asset: ProductionAsset): number {
  return asset.media === "image" ? (asset.section === "anime" ? 1 : 2) : Math.ceil((asset.seconds || 5) / 5) * (asset.section === "anime" ? 3 : 42);
}
export function animeFinishGraph(source: string, media: "image" | "video"): ApiGraph {
  if (!source) throw new Error("La prise gardée est absente.");
  const n = (class_type: string, inputs: Record<string, unknown>) => ({ class_type, inputs });
  const graph: ApiGraph = {
    load: n(media === "image" ? "LoadImage" : "LoadVideo", media === "image" ? { image: source } : { file: source }),
    model: n("UpscaleModelLoader", { model_name: "RealESRGAN_x4plus_anime_6B.pth" }),
    upscale: n("ImageUpscaleWithModel", { upscale_model: ["model",0], image: [media === "image" ? "load" : "frames",0] }),
  };
  if (media === "video") {
    graph.frames = n("GetVideoComponents", { video: ["load",0] });
    graph.video = n("CreateVideo", { images: ["upscale",0], audio: ["frames",1], fps: ["frames",2] });
    graph.save = n("SaveVideo", { video: ["video",0], filename_prefix: "video/uttu-anime-finish", format: "auto", "format.codec": "auto" });
  } else graph.save = n("SaveImage", { images: ["upscale",0], filename_prefix: "uttu-anime-finish" });
  return graph;
}
export async function sectionFinishGraph(asset: ProductionAsset, uploaded: string, seed: number) {
  if (asset.section === "anime") return { graph: animeFinishGraph(uploaded,asset.media), outputNode:"save", template:"core_realesrgan_anime" };
  const {suiteGraph} = await import("../suite/graphs.ts");
  return { graph: suiteGraph({geste:asset.media === "image" ? "suite-finaliser-image" : "suite-finaliser-video",files:{source:uploaded},prompt:"",seed,seconds:asset.seconds,fluidifier:false}), outputNode:asset.media === "image" ? "9" : "76", template:`utility_seedvr2_3b_int8_upscale_${asset.media}` };
}
