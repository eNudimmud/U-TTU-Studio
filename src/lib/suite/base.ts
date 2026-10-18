// Official Comfy templates converted to API format by Comfy Cloud (saved workflow → api_format),
// then pruned: preview and compare nodes removed, BiRefNet gets a SaveImage, the LTX 2.3 prompt
// enhancer is bypassed (the visitor text goes straight to the encoder). Generated, do not edit by hand.
// Templates: utility_seedvr2_3b_int8_upscale_image, utility_birefnet_remove_background,
// templates_doc_workbox_klein_9b_image_extend, utility_seedvr2_3b_int8_upscale_video,
// utility_video_frame_interpolation, video_minimax_h3_i2v (same graph as video_minimax_h3_i2v_continuation),
// video_ltx2_3_ia2v.

import type { ApiGraph } from "../render/take-graph.ts";

export const SEEDVR2_IMAGE_BASE: ApiGraph = {
  "1": {
    "inputs": {
      "image": "watch_macro_shot.png"
    },
    "class_type": "LoadImage",
    "_meta": {
      "title": "Load Image"
    }
  },
  "9": {
    "inputs": {
      "filename_prefix": "seedvr2_after/image",
      "images": [
        "66:59",
        0
      ]
    },
    "class_type": "SaveImage",
    "_meta": {
      "title": "Save Image"
    }
  },
  "66:48": {
    "inputs": {
      "tile_size": 512,
      "overlap": 128,
      "temporal_size": 4096,
      "temporal_overlap": 8,
      "pixels": [
        "66:58",
        0
      ],
      "vae": [
        "66:51",
        0
      ]
    },
    "class_type": "VAEEncodeTiled",
    "_meta": {
      "title": "VAE Encode (Tiled)"
    }
  },
  "66:50": {
    "inputs": {
      "image": [
        "1",
        0
      ],
      "alpha": [
        "1",
        1
      ]
    },
    "class_type": "JoinImageWithAlpha",
    "_meta": {
      "title": "Join Image with Alpha"
    }
  },
  "66:51": {
    "inputs": {
      "vae_name": "seedvr2_ema_vae_fp16.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "Load VAE"
    }
  },
  "66:52": {
    "inputs": {
      "unet_name": "seedvr2_3b_int8_convrot.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "Load Diffusion Model"
    }
  },
  "66:54": {
    "inputs": {
      "seed": 959948902156062,
      "steps": 1,
      "cfg": 1,
      "sampler_name": "euler",
      "scheduler": "simple",
      "denoise": 1,
      "model": [
        "66:52",
        0
      ],
      "positive": [
        "66:61",
        0
      ],
      "negative": [
        "66:61",
        1
      ],
      "latent_image": [
        "66:48",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "KSampler"
    }
  },
  "66:55": {
    "inputs": {
      "tile_size": 512,
      "overlap": 128,
      "temporal_size": 4096,
      "temporal_overlap": 8,
      "samples": [
        "66:54",
        0
      ],
      "vae": [
        "66:51",
        0
      ]
    },
    "class_type": "VAEDecodeTiled",
    "_meta": {
      "title": "VAE Decode (Tiled)"
    }
  },
  "66:57": {
    "inputs": {
      "resize_type": "scale by multiplier",
      "resize_type.multiplier": 4,
      "scale_method": "lanczos",
      "input": [
        "66:50",
        0
      ]
    },
    "class_type": "ResizeImageMaskNode",
    "_meta": {
      "title": "Resize Image/Mask"
    }
  },
  "66:58": {
    "inputs": {
      "resized_images": [
        "66:57",
        0
      ]
    },
    "class_type": "SeedVR2Preprocess",
    "_meta": {
      "title": "Pre-Process SeedVR2 Input"
    }
  },
  "66:59": {
    "inputs": {
      "color_correction_method": "none",
      "images": [
        "66:55",
        0
      ],
      "original_resized_images": [
        "66:57",
        0
      ]
    },
    "class_type": "SeedVR2PostProcessing",
    "_meta": {
      "title": "Post-Process SeedVR2 Output"
    }
  },
  "66:61": {
    "inputs": {
      "model": [
        "66:52",
        0
      ],
      "vae_conditioning": [
        "66:48",
        0
      ]
    },
    "class_type": "SeedVR2Conditioning",
    "_meta": {
      "title": "Apply SeedVR2 Conditioning"
    }
  }
};

export const BIREFNET_BASE: ApiGraph = {
  "17": {
    "inputs": {
      "image": "the_lily_veil.png"
    },
    "class_type": "LoadImage",
    "_meta": {
      "title": "Load Image"
    }
  },
  "19:13": {
    "inputs": {
      "bg_removal_model": [
        "19:14",
        0
      ],
      "image": [
        "17",
        0
      ]
    },
    "class_type": "RemoveBackground",
    "_meta": {
      "title": "Remove Background"
    }
  },
  "19:14": {
    "inputs": {
      "bg_removal_name": "birefnet.safetensors"
    },
    "class_type": "LoadBackgroundRemovalModel",
    "_meta": {
      "title": "Load Background Removal Model"
    }
  },
  "19:15": {
    "inputs": {
      "mask": [
        "19:13",
        0
      ]
    },
    "class_type": "InvertMask",
    "_meta": {
      "title": "Invert Mask"
    }
  },
  "19:16": {
    "inputs": {
      "alpha": [
        "19:15",
        0
      ],
      "image": [
        "17",
        0
      ]
    },
    "class_type": "JoinImageWithAlpha",
    "_meta": {
      "title": "Join Image with Alpha"
    }
  },
  "save": {
    "class_type": "SaveImage",
    "inputs": {
      "filename_prefix": "uttu-detoure",
      "images": [
        "19:16",
        0
      ]
    },
    "_meta": {
      "title": "Enregistrer (PNG transparent)"
    }
  }
};

export const KLEIN9B_EXTEND_BASE: ApiGraph = {
  "133": {
    "inputs": {
      "noise": [
        "135",
        0
      ],
      "guider": [
        "136",
        0
      ],
      "sampler": [
        "137",
        0
      ],
      "sigmas": [
        "138",
        0
      ],
      "latent_image": [
        "139",
        0
      ]
    },
    "class_type": "SamplerCustomAdvanced",
    "_meta": {
      "title": "SamplerCustomAdvanced"
    }
  },
  "134": {
    "inputs": {
      "clip_name": "qwen_3_8b.safetensors",
      "type": "flux2",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "Load CLIP"
    }
  },
  "135": {
    "inputs": {
      "noise_seed": 754163315896983
    },
    "class_type": "RandomNoise",
    "_meta": {
      "title": "RandomNoise"
    }
  },
  "136": {
    "inputs": {
      "cfg": 1,
      "model": [
        "158",
        0
      ],
      "positive": [
        "148",
        0
      ],
      "negative": [
        "149",
        0
      ]
    },
    "class_type": "CFGGuider",
    "_meta": {
      "title": "CFG Guider"
    }
  },
  "137": {
    "inputs": {
      "sampler_name": "euler"
    },
    "class_type": "KSamplerSelect",
    "_meta": {
      "title": "KSamplerSelect"
    }
  },
  "138": {
    "inputs": {
      "steps": 4,
      "width": [
        "143",
        0
      ],
      "height": [
        "143",
        1
      ]
    },
    "class_type": "Flux2Scheduler",
    "_meta": {
      "title": "Flux2Scheduler"
    }
  },
  "139": {
    "inputs": {
      "batch_size": 1,
      "width": [
        "143",
        0
      ],
      "height": [
        "143",
        1
      ]
    },
    "class_type": "EmptyFlux2LatentImage",
    "_meta": {
      "title": "Empty Flux 2 Latent"
    }
  },
  "140": {
    "inputs": {
      "samples": [
        "133",
        0
      ],
      "vae": [
        "161",
        0
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE Decode"
    }
  },
  "142": {
    "inputs": {
      "filename_prefix": "Flux2-Klein",
      "images": [
        "167",
        0
      ]
    },
    "class_type": "SaveImage",
    "_meta": {
      "title": "Save Image"
    }
  },
  "143": {
    "inputs": {
      "image": [
        "165",
        0
      ]
    },
    "class_type": "GetImageSize",
    "_meta": {
      "title": "Get Image Size"
    }
  },
  "144": {
    "inputs": {
      "conditioning": [
        "157",
        0
      ]
    },
    "class_type": "ConditioningZeroOut",
    "_meta": {
      "title": "Conditioning Zero Out"
    }
  },
  "145": {
    "inputs": {
      "pixels": [
        "165",
        0
      ],
      "vae": [
        "161",
        0
      ]
    },
    "class_type": "VAEEncode",
    "_meta": {
      "title": "VAE Encode"
    }
  },
  "147": {
    "inputs": {
      "upscale_method": "nearest-exact",
      "megapixels": 1.5000000000000002,
      "resolution_steps": 1,
      "image": [
        "159",
        0
      ]
    },
    "class_type": "ImageScaleToTotalPixels",
    "_meta": {
      "title": "Scale Image to Total Pixels"
    }
  },
  "148": {
    "inputs": {
      "conditioning": [
        "157",
        0
      ],
      "latent": [
        "145",
        0
      ]
    },
    "class_type": "ReferenceLatent",
    "_meta": {
      "title": "Set Reference Latent"
    }
  },
  "149": {
    "inputs": {
      "conditioning": [
        "144",
        0
      ],
      "latent": [
        "145",
        0
      ]
    },
    "class_type": "ReferenceLatent",
    "_meta": {
      "title": "Set Reference Latent"
    }
  },
  "157": {
    "inputs": {
      "text": "remove the green part",
      "clip": [
        "134",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Positive Prompt)"
    }
  },
  "158": {
    "inputs": {
      "unet_name": "flux-2-klein-9b.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "Load Diffusion Model"
    }
  },
  "159": {
    "inputs": {
      "image": "red_panda.png"
    },
    "class_type": "LoadImage",
    "_meta": {
      "title": "Load Image"
    }
  },
  "161": {
    "inputs": {
      "vae_name": "flux2-vae.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "Load VAE"
    }
  },
  "164": {
    "inputs": {
      "left": 0,
      "top": 800,
      "right": 0,
      "bottom": 800,
      "feathering": 40,
      "image": [
        "147",
        0
      ]
    },
    "class_type": "ImagePadForOutpaint",
    "_meta": {
      "title": "Pad Image for Outpainting"
    }
  },
  "165": {
    "inputs": {
      "upscale_method": "nearest-exact",
      "megapixels": 1.0000000000000002,
      "resolution_steps": 1,
      "image": [
        "166",
        0
      ]
    },
    "class_type": "ImageScaleToTotalPixels",
    "_meta": {
      "title": "Scale Image to Total Pixels"
    }
  },
  "166": {
    "inputs": {
      "color": "0, 255, 0",
      "device": "cpu",
      "image": [
        "164",
        0
      ],
      "mask": [
        "164",
        1
      ]
    },
    "class_type": "DrawMaskOnImage",
    "_meta": {
      "title": "Draw Mask On Image"
    }
  },
  "167": {
    "inputs": {
      "method": "mkl",
      "strength": 1,
      "multithread": true,
      "image_ref": [
        "159",
        0
      ],
      "image_target": [
        "140",
        0
      ]
    },
    "class_type": "ColorMatch",
    "_meta": {
      "title": "Color Match"
    }
  }
};

export const SEEDVR2_VIDEO_BASE: ApiGraph = {
  "73": {
    "inputs": {
      "file": "grainy_perfume_shot_crf32.mp4",
      "video-preview": ""
    },
    "class_type": "LoadVideo",
    "_meta": {
      "title": "Load Video"
    }
  },
  "76": {
    "inputs": {
      "filename_prefix": "video/Upscaled_seedVR2",
      "format": "auto",
      "format.codec": "auto",
      "video": [
        "66:75",
        0
      ]
    },
    "class_type": "SaveVideo",
    "_meta": {
      "title": "Save Video"
    }
  },
  "66:48": {
    "inputs": {
      "tile_size": 512,
      "overlap": 128,
      "temporal_size": 64,
      "temporal_overlap": 8,
      "pixels": [
        "66:58",
        0
      ],
      "vae": [
        "66:51",
        0
      ]
    },
    "class_type": "VAEEncodeTiled",
    "_meta": {
      "title": "VAE Encode (Tiled)"
    }
  },
  "66:51": {
    "inputs": {
      "vae_name": "seedvr2_ema_vae_fp16.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "Load VAE"
    }
  },
  "66:52": {
    "inputs": {
      "unet_name": "seedvr2_3b_int8_convrot.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "Load Diffusion Model"
    }
  },
  "66:54": {
    "inputs": {
      "seed": 959948902156062,
      "steps": 1,
      "cfg": 1,
      "sampler_name": "euler",
      "scheduler": "simple",
      "denoise": 1,
      "model": [
        "66:52",
        0
      ],
      "positive": [
        "66:61",
        0
      ],
      "negative": [
        "66:61",
        1
      ],
      "latent_image": [
        "66:102",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "KSampler"
    }
  },
  "66:55": {
    "inputs": {
      "tile_size": 512,
      "overlap": 128,
      "temporal_size": 64,
      "temporal_overlap": 8,
      "samples": [
        "66:103",
        0
      ],
      "vae": [
        "66:51",
        0
      ]
    },
    "class_type": "VAEDecodeTiled",
    "_meta": {
      "title": "VAE Decode (Tiled)"
    }
  },
  "66:57": {
    "inputs": {
      "resize_type": "scale by multiplier",
      "resize_type.multiplier": 2,
      "scale_method": "lanczos",
      "input": [
        "66:74",
        0
      ]
    },
    "class_type": "ResizeImageMaskNode",
    "_meta": {
      "title": "Resize Image/Mask"
    }
  },
  "66:58": {
    "inputs": {
      "resized_images": [
        "66:57",
        0
      ]
    },
    "class_type": "SeedVR2Preprocess",
    "_meta": {
      "title": "Pre-Process SeedVR2 Input"
    }
  },
  "66:59": {
    "inputs": {
      "color_correction_method": "none",
      "images": [
        "66:55",
        0
      ],
      "original_resized_images": [
        "66:57",
        0
      ]
    },
    "class_type": "SeedVR2PostProcessing",
    "_meta": {
      "title": "Post-Process SeedVR2 Output"
    }
  },
  "66:61": {
    "inputs": {
      "model": [
        "66:52",
        0
      ],
      "vae_conditioning": [
        "66:102",
        0
      ]
    },
    "class_type": "SeedVR2Conditioning",
    "_meta": {
      "title": "Apply SeedVR2 Conditioning"
    }
  },
  "66:74": {
    "inputs": {
      "video": [
        "66:81",
        0
      ]
    },
    "class_type": "GetVideoComponents",
    "_meta": {
      "title": "Get Video Components"
    }
  },
  "66:75": {
    "inputs": {
      "images": [
        "66:59",
        0
      ],
      "audio": [
        "66:74",
        1
      ],
      "fps": [
        "66:74",
        2
      ],
      "bit_depth": [
        "66:74",
        3
      ]
    },
    "class_type": "CreateVideo",
    "_meta": {
      "title": "Create Video"
    }
  },
  "66:79": {
    "inputs": {
      "start_time": 0,
      "duration": 0,
      "strict_duration": false,
      "video": [
        "73",
        0
      ]
    },
    "class_type": "Video Slice",
    "_meta": {
      "title": "Trim Video"
    }
  },
  "66:81": {
    "inputs": {
      "switch": false,
      "on_true": [
        "66:79",
        0
      ],
      "on_false": [
        "73",
        0
      ]
    },
    "class_type": "ComfySwitchNode",
    "_meta": {
      "title": "If/Else Switch"
    }
  },
  "66:99": {
    "inputs": {
      "temporal_overlap": 0,
      "chunking_mode": "auto",
      "latent": [
        "66:48",
        0
      ]
    },
    "class_type": "SeedVR2TemporalChunk",
    "_meta": {
      "title": "Split SeedVR2 Latent"
    }
  },
  "66:100": {
    "inputs": {
      "latents": [
        "66:54",
        0
      ],
      "temporal_overlap": [
        "66:99",
        1
      ]
    },
    "class_type": "SeedVR2TemporalMerge",
    "_meta": {
      "title": "Merge SeedVR2 Latents"
    }
  },
  "66:102": {
    "inputs": {
      "on_false": [
        "66:48",
        0
      ],
      "on_true": [
        "66:99",
        0
      ],
      "switch": [
        "66:105",
        0
      ]
    },
    "class_type": "ComfySwitchNode",
    "_meta": {
      "title": "If/Else Switch"
    }
  },
  "66:103": {
    "inputs": {
      "on_false": [
        "66:54",
        0
      ],
      "on_true": [
        "66:100",
        0
      ],
      "switch": [
        "66:105",
        0
      ]
    },
    "class_type": "ComfySwitchNode",
    "_meta": {
      "title": "If/Else Switch"
    }
  },
  "66:105": {
    "inputs": {
      "value": false
    },
    "class_type": "PrimitiveBoolean",
    "_meta": {
      "title": "Boolean (Split Latent)"
    }
  }
};

export const INTERPOLATION_BASE: ApiGraph = {
  "4": {
    "inputs": {
      "file": "white_armored_warrior.mp4",
      "video-preview": ""
    },
    "class_type": "LoadVideo",
    "_meta": {
      "title": "Load Video"
    }
  },
  "7": {
    "inputs": {
      "filename_prefix": "video/ComfyUI",
      "format": "auto",
      "format.codec": "auto",
      "video": [
        "16:5",
        0
      ]
    },
    "class_type": "SaveVideo",
    "_meta": {
      "title": "Save Video"
    }
  },
  "16:1": {
    "inputs": {
      "model_name": "film_net_fp16.safetensors"
    },
    "class_type": "FrameInterpolationModelLoader",
    "_meta": {
      "title": "Load Frame Interpolation Model"
    }
  },
  "16:2": {
    "inputs": {
      "interp_model": [
        "16:1",
        0
      ],
      "images": [
        "16:3",
        0
      ],
      "multiplier": [
        "16:9",
        0
      ]
    },
    "class_type": "FrameInterpolate",
    "_meta": {
      "title": "Run Frame Interpolation Model"
    }
  },
  "16:5": {
    "inputs": {
      "images": [
        "16:2",
        0
      ],
      "audio": [
        "16:3",
        1
      ],
      "fps": [
        "16:10",
        0
      ]
    },
    "class_type": "CreateVideo",
    "_meta": {
      "title": "Create Video"
    }
  },
  "16:9": {
    "inputs": {
      "value": 2
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "Int (Multiplier)"
    }
  },
  "16:10": {
    "inputs": {
      "on_false": [
        "16:3",
        2
      ],
      "on_true": [
        "16:11",
        0
      ],
      "switch": [
        "16:13",
        0
      ]
    },
    "class_type": "ComfySwitchNode",
    "_meta": {
      "title": "If/Else Switch"
    }
  },
  "16:13": {
    "inputs": {
      "value": true
    },
    "class_type": "PrimitiveBoolean",
    "_meta": {
      "title": "Boolean (Apply multiplier to FPS?)"
    }
  },
  "16:3": {
    "inputs": {
      "video": [
        "4",
        0
      ]
    },
    "class_type": "GetVideoComponents",
    "_meta": {
      "title": "Get Video Components"
    }
  },
  "16:11": {
    "inputs": {
      "expression": "min(abs(b), 16) * a",
      "values.a": [
        "16:3",
        2
      ],
      "values.b": [
        "16:9",
        0
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "Math Expression"
    }
  }
};

export const H3_I2V_BASE: ApiGraph = {
  "92": {
    "inputs": {
      "filename_prefix": "video/MiniMax_H3",
      "format": "auto",
      "format.codec": "auto",
      "video": [
        "105:91",
        0
      ]
    },
    "class_type": "SaveVideo",
    "_meta": {
      "title": "Save Video"
    }
  },
  "114": {
    "inputs": {
      "image": "transparent_rgb_gaming_mouse.png"
    },
    "class_type": "LoadImage",
    "_meta": {
      "title": "Load Image"
    }
  },
  "115": {
    "inputs": {
      "aspect_ratio": "1:1 (Square)",
      "megapixels": 0.4,
      "multiple": 32,
      "preview": ""
    },
    "class_type": "ResolutionSelector",
    "_meta": {
      "title": "Resolution Selector"
    }
  },
  "105:11": {
    "inputs": {
      "vae_name": "minimax_h3_video_vae_int8_convrot.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "Load VAE"
    }
  },
  "105:24": {
    "inputs": {
      "vae_name": "minimax_h3_audio_vae_fp32.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "Load VAE"
    }
  },
  "105:23": {
    "inputs": {
      "samples": [
        "105:14",
        0
      ],
      "vae": [
        "105:24",
        0
      ]
    },
    "class_type": "VAEDecodeAudio",
    "_meta": {
      "title": "VAE Decode Audio"
    }
  },
  "105:10": {
    "inputs": {
      "samples": [
        "105:14",
        0
      ],
      "vae": [
        "105:11",
        0
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE Decode"
    }
  },
  "105:17": {
    "inputs": {
      "sampler_name": "res_multistep"
    },
    "class_type": "KSamplerSelect",
    "_meta": {
      "title": "KSamplerSelect"
    }
  },
  "105:9": {
    "inputs": {
      "scheduler": "simple",
      "denoise": 1,
      "model": [
        "105:122",
        0
      ],
      "steps": [
        "105:123",
        0
      ]
    },
    "class_type": "BasicScheduler",
    "_meta": {
      "title": "BasicScheduler"
    }
  },
  "105:14": {
    "inputs": {
      "noise": [
        "105:15",
        0
      ],
      "guider": [
        "105:16",
        0
      ],
      "sampler": [
        "105:17",
        0
      ],
      "sigmas": [
        "105:9",
        0
      ],
      "latent_image": [
        "105:104",
        1
      ]
    },
    "class_type": "SamplerCustomAdvanced",
    "_meta": {
      "title": "SamplerCustomAdvanced"
    }
  },
  "105:16": {
    "inputs": {
      "model": [
        "105:122",
        0
      ],
      "conditioning": [
        "105:104",
        0
      ]
    },
    "class_type": "BasicGuider",
    "_meta": {
      "title": "Basic Guider"
    }
  },
  "105:6": {
    "inputs": {
      "unet_name": "minimax_h3_fl2va_pruned_int8_convrot.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "Load Diffusion Model"
    }
  },
  "105:13": {
    "inputs": {
      "clip_name": "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors",
      "type": "minimax",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "Load CLIP"
    }
  },
  "105:15": {
    "inputs": {
      "noise_seed": 757358688076805
    },
    "class_type": "RandomNoise",
    "_meta": {
      "title": "RandomNoise"
    }
  },
  "105:91": {
    "inputs": {
      "fps": 24,
      "bit_depth": 8,
      "images": [
        "105:10",
        0
      ],
      "audio": [
        "105:23",
        0
      ]
    },
    "class_type": "CreateVideo",
    "_meta": {
      "title": "Create Video"
    }
  },
  "105:104": {
    "inputs": {
      "prompt": "Editorial tech product film. The transparent gaming mouse from <Picture 1> in its original scene: a pitch-black studio void with a dark, subtle reflective surface, lit by dramatic duotone vibrant blue and warm neon orange rim lighting, deep soft shadow falloff into pure black. Monochromatic dark palette with electric blue and amber accents. Material motif: glowing internal metallic micro-components and glossy acrylic refractions. The environment is constant throughout.\nSHOT 1: The scene opens exactly on image 1, the mouse resting confidently on the dark surface; the blue and orange lights slowly pulse brighter, refracting deeply through the transparent acrylic shell as the camera executes a slow, deliberate push-in to reveal the intricate circuitry.\nSHOT 2: Cut to an extreme macro profile of the ridged scroll wheel and layered internal micro-components; the camera glides slowly along the side as a sharp beam of warm orange light sweeps across the metallic textures, contrasting perfectly against the deep blue ambient glow.\nSHOT 3: Cut to a low-angle beauty shot: the mouse levitates weightlessly a few centimeters above the dark reflective surface, rotating in a slow, precise orbit; the duotone lighting flares gently along the glassy transparent edges before fading slowly into a sleek silhouette.\nAudio: deep pulsing sub-bass room tone, sharp tactile mechanical clicks, a sweeping glassy whoosh on cuts, and a rising electronic swell that resolves to near-silence on the final fade. ",
      "width": [
        "115",
        0
      ],
      "height": [
        "115",
        1
      ],
      "clip": [
        "105:13",
        0
      ],
      "vae": [
        "105:11",
        0
      ],
      "length": [
        "105:107",
        1
      ],
      "first_frame": [
        "114",
        0
      ]
    },
    "class_type": "MiniMaxH3ImageToVideo",
    "_meta": {
      "title": "MiniMax H3 Image to Video"
    }
  },
  "105:107": {
    "inputs": {
      "expression": "max(5, round(a * 24)) + (5 - (max(5, round(a * 24)) % 17)) % 17",
      "values.a": [
        "105:111",
        0
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "Math Expression"
    }
  },
  "105:111": {
    "inputs": {
      "value": 5
    },
    "class_type": "PrimitiveFloat",
    "_meta": {
      "title": "Float (duration)"
    }
  },
  "105:121": {
    "inputs": {
      "lora_name": "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors",
      "strength_model": 1,
      "model": [
        "105:6",
        0
      ]
    },
    "class_type": "LoraLoaderModelOnly",
    "_meta": {
      "title": "Load LoRA"
    }
  },
  "105:122": {
    "inputs": {
      "on_false": [
        "105:6",
        0
      ],
      "on_true": [
        "105:121",
        0
      ],
      "switch": [
        "105:126",
        0
      ]
    },
    "class_type": "ComfySwitchNode",
    "_meta": {
      "title": "If/Else Switch (Model)"
    }
  },
  "105:123": {
    "inputs": {
      "on_false": [
        "105:124",
        0
      ],
      "on_true": [
        "105:125",
        0
      ],
      "switch": [
        "105:126",
        0
      ]
    },
    "class_type": "ComfySwitchNode",
    "_meta": {
      "title": "If/Else Switch (Steps)"
    }
  },
  "105:124": {
    "inputs": {
      "value": 20
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "Int"
    }
  },
  "105:125": {
    "inputs": {
      "value": 8
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "Int"
    }
  },
  "105:126": {
    "inputs": {
      "value": false
    },
    "class_type": "PrimitiveBoolean",
    "_meta": {
      "title": "Boolean (Enable Lightning LoRA)"
    }
  }
};

export const LTX23_IA2V_BASE: ApiGraph = {
  "269": {
    "inputs": {
      "image": "cactus_man.png"
    },
    "class_type": "LoadImage",
    "_meta": {
      "title": "Load Image"
    }
  },
  "276": {
    "inputs": {
      "audio": "ltx_23_audio.mp3",
      "audioUI": "/api/view?filename=ltx_23_audio.mp3&type=input&subfolder=&"
    },
    "class_type": "LoadAudio",
    "_meta": {
      "title": "Load Audio"
    }
  },
  "341": {
    "inputs": {
      "filename_prefix": "video/LTX_2.3_ia2v",
      "format": "auto",
      "format.codec": "auto",
      "codec": "auto",
      "video": [
        "340:312",
        0
      ]
    },
    "class_type": "SaveVideo",
    "_meta": {
      "title": "Save Video"
    }
  },
  "340:285": {
    "inputs": {
      "noise_seed": 42
    },
    "class_type": "RandomNoise",
    "_meta": {
      "title": "RandomNoise"
    }
  },
  "340:286": {
    "inputs": {
      "noise_seed": 225158785956033
    },
    "class_type": "RandomNoise",
    "_meta": {
      "title": "RandomNoise"
    }
  },
  "340:287": {
    "inputs": {
      "video_latent": [
        "340:296",
        0
      ],
      "audio_latent": [
        "340:309",
        1
      ]
    },
    "class_type": "LTXVConcatAVLatent",
    "_meta": {
      "title": "Concat AV Latent"
    }
  },
  "340:288": {
    "inputs": {
      "sampler_name": "euler"
    },
    "class_type": "KSamplerSelect",
    "_meta": {
      "title": "KSamplerSelect"
    }
  },
  "340:289": {
    "inputs": {
      "sigmas": "0.85, 0.7250, 0.4219, 0.0"
    },
    "class_type": "ManualSigmas",
    "_meta": {
      "title": "ManualSigmas"
    }
  },
  "340:290": {
    "inputs": {
      "cfg": 1,
      "model": [
        "340:293",
        0
      ],
      "positive": [
        "340:292",
        0
      ],
      "negative": [
        "340:292",
        1
      ]
    },
    "class_type": "CFGGuider",
    "_meta": {
      "title": "CFG Guider"
    }
  },
  "340:291": {
    "inputs": {
      "noise": [
        "340:286",
        0
      ],
      "guider": [
        "340:315",
        0
      ],
      "sampler": [
        "340:298",
        0
      ],
      "sigmas": [
        "340:308",
        0
      ],
      "latent_image": [
        "340:326",
        0
      ]
    },
    "class_type": "SamplerCustomAdvanced",
    "_meta": {
      "title": "SamplerCustomAdvanced"
    }
  },
  "340:292": {
    "inputs": {
      "positive": [
        "340:307",
        0
      ],
      "negative": [
        "340:307",
        1
      ],
      "latent": [
        "340:309",
        0
      ]
    },
    "class_type": "LTXVCropGuides",
    "_meta": {
      "title": "LTXVCropGuides"
    }
  },
  "340:295": {
    "inputs": {
      "samples": [
        "340:309",
        0
      ],
      "upscale_model": [
        "340:313",
        0
      ],
      "vae": [
        "340:317",
        2
      ]
    },
    "class_type": "LTXVLatentUpsampler",
    "_meta": {
      "title": "LTXVLatentUpsampler"
    }
  },
  "340:296": {
    "inputs": {
      "strength": 1,
      "vae": [
        "340:317",
        2
      ],
      "image": [
        "340:334",
        0
      ],
      "latent": [
        "340:295",
        0
      ],
      "bypass": [
        "340:305",
        0
      ]
    },
    "class_type": "LTXVImgToVideoInplace",
    "_meta": {
      "title": "LTXVImgToVideoInplace"
    }
  },
  "340:298": {
    "inputs": {
      "sampler_name": "euler"
    },
    "class_type": "KSamplerSelect",
    "_meta": {
      "title": "KSamplerSelect"
    }
  },
  "340:303": {
    "inputs": {
      "samples": [
        "340:311",
        1
      ],
      "audio_vae": [
        "340:335",
        0
      ]
    },
    "class_type": "LTXVAudioVAEDecode",
    "_meta": {
      "title": "LTXV Audio VAE Decode"
    }
  },
  "340:306": {
    "inputs": {
      "clip": [
        "340:318",
        0
      ],
      "text": [
        "340:319",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "340:307": {
    "inputs": {
      "positive": [
        "340:306",
        0
      ],
      "negative": [
        "340:314",
        0
      ],
      "frame_rate": [
        "340:304",
        0
      ]
    },
    "class_type": "LTXVConditioning",
    "_meta": {
      "title": "LTXVConditioning"
    }
  },
  "340:308": {
    "inputs": {
      "sigmas": "1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0"
    },
    "class_type": "ManualSigmas",
    "_meta": {
      "title": "ManualSigmas"
    }
  },
  "340:309": {
    "inputs": {
      "av_latent": [
        "340:291",
        0
      ]
    },
    "class_type": "LTXVSeparateAVLatent",
    "_meta": {
      "title": "Separate AV Latent"
    }
  },
  "340:310": {
    "inputs": {
      "noise": [
        "340:285",
        0
      ],
      "guider": [
        "340:290",
        0
      ],
      "sampler": [
        "340:288",
        0
      ],
      "sigmas": [
        "340:289",
        0
      ],
      "latent_image": [
        "340:287",
        0
      ]
    },
    "class_type": "SamplerCustomAdvanced",
    "_meta": {
      "title": "SamplerCustomAdvanced"
    }
  },
  "340:311": {
    "inputs": {
      "av_latent": [
        "340:310",
        0
      ]
    },
    "class_type": "LTXVSeparateAVLatent",
    "_meta": {
      "title": "Separate AV Latent"
    }
  },
  "340:314": {
    "inputs": {
      "text": "pc game, console game, video game, cartoon, childish, ugly",
      "clip": [
        "340:318",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "340:315": {
    "inputs": {
      "cfg": 1,
      "model": [
        "340:293",
        0
      ],
      "positive": [
        "340:307",
        0
      ],
      "negative": [
        "340:307",
        1
      ]
    },
    "class_type": "CFGGuider",
    "_meta": {
      "title": "CFG Guider"
    }
  },
  "340:316": {
    "inputs": {
      "tile_size": 768,
      "overlap": 64,
      "temporal_size": 4096,
      "temporal_overlap": 4,
      "samples": [
        "340:311",
        0
      ],
      "vae": [
        "340:317",
        2
      ]
    },
    "class_type": "VAEDecodeTiled",
    "_meta": {
      "title": "VAE Decode (Tiled)"
    }
  },
  "340:325": {
    "inputs": {
      "strength": 0.7,
      "vae": [
        "340:317",
        2
      ],
      "image": [
        "340:334",
        0
      ],
      "latent": [
        "340:302",
        0
      ],
      "bypass": [
        "340:305",
        0
      ]
    },
    "class_type": "LTXVImgToVideoInplace",
    "_meta": {
      "title": "LTXVImgToVideoInplace"
    }
  },
  "340:330": {
    "inputs": {
      "value": 1280
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "Width"
    }
  },
  "340:333": {
    "inputs": {
      "value": 0,
      "width": [
        "340:330",
        0
      ],
      "height": [
        "340:324",
        0
      ]
    },
    "class_type": "SolidMask",
    "_meta": {
      "title": "Create Solid Mask"
    }
  },
  "340:335": {
    "inputs": {
      "ckpt_name": "ltx-2.3-22b-dev-fp8.safetensors"
    },
    "class_type": "LTXVAudioVAELoader",
    "_meta": {
      "title": "Load LTXV Audio VAE"
    }
  },
  "340:305": {
    "inputs": {
      "value": false
    },
    "class_type": "PrimitiveBoolean",
    "_meta": {
      "title": "Switch to Text to Video?"
    }
  },
  "340:334": {
    "inputs": {
      "img_compression": 18,
      "image": [
        "340:350",
        0
      ]
    },
    "class_type": "LTXVPreprocess",
    "_meta": {
      "title": "LTXV Preprocess"
    }
  },
  "340:301": {
    "inputs": {
      "expression": "a/2",
      "values.a": [
        "340:324",
        0
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "Math Expression"
    }
  },
  "340:299": {
    "inputs": {
      "expression": "a/2",
      "values.a": [
        "340:330",
        0
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "Math Expression"
    }
  },
  "340:304": {
    "inputs": {
      "expression": "a",
      "values.a": [
        "340:323",
        0
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "Math Expression"
    }
  },
  "340:312": {
    "inputs": {
      "bit_depth": "auto",
      "color_space": "sRGB",
      "images": [
        "340:316",
        0
      ],
      "audio": [
        "340:303",
        0
      ],
      "fps": [
        "340:304",
        0
      ]
    },
    "class_type": "CreateVideo",
    "_meta": {
      "title": "Create Video"
    }
  },
  "340:331": {
    "inputs": {
      "value": 9
    },
    "class_type": "PrimitiveFloat",
    "_meta": {
      "title": "Duration"
    }
  },
  "340:323": {
    "inputs": {
      "value": 24
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "Frame Rate"
    }
  },
  "340:302": {
    "inputs": {
      "batch_size": 1,
      "width": [
        "340:299",
        1
      ],
      "height": [
        "340:301",
        1
      ],
      "length": [
        "340:329",
        1
      ]
    },
    "class_type": "EmptyLTXVLatentVideo",
    "_meta": {
      "title": "Empty LTXV Latent Video"
    }
  },
  "340:329": {
    "inputs": {
      "expression": "a * b + 1",
      "values.a": [
        "340:331",
        0
      ],
      "values.b": [
        "340:323",
        0
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "Math Expression"
    }
  },
  "340:324": {
    "inputs": {
      "value": 720
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "Height"
    }
  },
  "340:332": {
    "inputs": {
      "start_index": 0,
      "duration": [
        "340:331",
        0
      ],
      "audio": [
        "276",
        0
      ]
    },
    "class_type": "TrimAudioDuration",
    "_meta": {
      "title": "Trim Audio Duration"
    }
  },
  "340:328": {
    "inputs": {
      "audio": [
        "340:332",
        0
      ],
      "audio_vae": [
        "340:335",
        0
      ]
    },
    "class_type": "LTXVAudioVAEEncode",
    "_meta": {
      "title": "LTXV Audio VAE Encode"
    }
  },
  "340:326": {
    "inputs": {
      "video_latent": [
        "340:325",
        0
      ],
      "audio_latent": [
        "340:327",
        0
      ]
    },
    "class_type": "LTXVConcatAVLatent",
    "_meta": {
      "title": "Concat AV Latent"
    }
  },
  "340:327": {
    "inputs": {
      "samples": [
        "340:328",
        0
      ],
      "mask": [
        "340:333",
        0
      ]
    },
    "class_type": "SetLatentNoiseMask",
    "_meta": {
      "title": "Set Latent Noise Mask"
    }
  },
  "340:313": {
    "inputs": {
      "model_name": "ltx-2.3-spatial-upscaler-x2-1.1.safetensors"
    },
    "class_type": "LatentUpscaleModelLoader",
    "_meta": {
      "title": "Load Latent Upscale Model"
    }
  },
  "340:293": {
    "inputs": {
      "lora_name": "ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors",
      "strength_model": 0.5,
      "model": [
        "340:317",
        0
      ]
    },
    "class_type": "LoraLoaderModelOnly",
    "_meta": {
      "title": "Load LoRA"
    }
  },
  "340:317": {
    "inputs": {
      "ckpt_name": "ltx-2.3-22b-dev-fp8.safetensors"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": {
      "title": "Load Checkpoint"
    }
  },
  "340:318": {
    "inputs": {
      "text_encoder": "gemma_3_12B_it_fp4_mixed.safetensors",
      "ckpt_name": "ltx-2.3-22b-dev-fp8.safetensors",
      "device": "default"
    },
    "class_type": "LTXAVTextEncoderLoader",
    "_meta": {
      "title": "Load LTXV Audio Text Encoder"
    }
  },
  "340:319": {
    "inputs": {
      "value": "The fuzzy cactus creature is talking to the viewer as it grips the steering wheel with one hand, the other hand gestures naturally as it speaks. The car is moving, revealing the sunlit coastal background, static camera fixed on character, smooth side-tracking shot matching the car speed\n\nscene: Sunlit coastal road trip, clear coastal background\ncharacter: Fuzzy cactus creature with big square sunglasses and a Hawaiian shirt\naction: One hand grips the steering wheel, the other gestures naturally while talking to the camera\ncamera: Fixed on character, smooth side-tracking shot matching car speed"
    },
    "class_type": "PrimitiveStringMultiline",
    "_meta": {
      "title": "Prompt"
    }
  },
  "340:297": {
    "inputs": {
      "resize_type": "scale dimensions",
      "resize_type.crop": "center",
      "resize_type.width": [
        "340:330",
        0
      ],
      "resize_type.height": [
        "340:324",
        0
      ],
      "scale_method": "lanczos",
      "input": [
        "269",
        0
      ]
    },
    "class_type": "ResizeImageMaskNode",
    "_meta": {
      "title": "Resize Image/Mask"
    }
  },
  "340:350": {
    "inputs": {
      "resize_type": "scale longer dimension",
      "resize_type.longer_size": 1536,
      "scale_method": "lanczos",
      "input": [
        "340:297",
        0
      ]
    },
    "class_type": "ResizeImageMaskNode",
    "_meta": {
      "title": "Resize Image/Mask"
    }
  }
};
