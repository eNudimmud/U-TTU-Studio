// Qwen Image InstantX Union ControlNet + Lotus depth — API graph from
// Comfy Cloud template `image_qwen_image_instantx_controlnet`, captured from a
// successful cadre-decor run (prompt_id 0aa60e2d). Structure locked by Lotus
// depth of the kept 3D colour frame; photoreal fill by Qwen Image Lightning.
// Patch LoadImage 71, CLIP text 111:6, and KSampler seed 111:3.

import type { ApiGraph } from "./take-graph.ts";

export const INSTANTX_CADRE_TEMPLATE = "image_qwen_image_instantx_controlnet" as const;

export const INSTANTX_CADRE_BASE: ApiGraph = {
  "71": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "PLACEHOLDER.png"
    },
    "_meta": {
      "title": "Cadre 3D (base fixe)"
    }
  },
  "113": {
    "class_type": "FluxKontextImageScale",
    "inputs": {
      "image": [
        "71",
        0
      ]
    },
    "_meta": {
      "title": "FluxKontextImageScale"
    }
  },
  "112:10": {
    "class_type": "UNETLoader",
    "inputs": {
      "unet_name": "lotus-depth-d-v1-1.safetensors",
      "weight_dtype": "default"
    },
    "_meta": {
      "title": "Load Diffusion Model"
    }
  },
  "112:14": {
    "class_type": "VAELoader",
    "inputs": {
      "vae_name": "vae-ft-mse-840000-ema-pruned.safetensors"
    },
    "_meta": {
      "title": "Load VAE"
    }
  },
  "112:115": {
    "class_type": "LotusConditioning",
    "inputs": {},
    "_meta": {
      "title": "LotusConditioning"
    }
  },
  "112:18": {
    "class_type": "DisableNoise",
    "inputs": {},
    "_meta": {
      "title": "DisableNoise"
    }
  },
  "112:19": {
    "class_type": "BasicGuider",
    "inputs": {
      "conditioning": [
        "112:115",
        0
      ],
      "model": [
        "112:10",
        0
      ]
    },
    "_meta": {
      "title": "Basic Guider"
    }
  },
  "112:20": {
    "class_type": "BasicScheduler",
    "inputs": {
      "denoise": 1,
      "model": [
        "112:10",
        0
      ],
      "scheduler": "normal",
      "steps": 1
    },
    "_meta": {
      "title": "BasicScheduler"
    }
  },
  "112:21": {
    "class_type": "KSamplerSelect",
    "inputs": {
      "sampler_name": "euler"
    },
    "_meta": {
      "title": "KSamplerSelect"
    }
  },
  "112:28": {
    "class_type": "SetFirstSigma",
    "inputs": {
      "sigma": 999.0,
      "sigmas": [
        "112:20",
        0
      ]
    },
    "_meta": {
      "title": "SetFirstSigma"
    }
  },
  "112:23": {
    "class_type": "VAEEncode",
    "inputs": {
      "pixels": [
        "113",
        0
      ],
      "vae": [
        "112:14",
        0
      ]
    },
    "_meta": {
      "title": "VAE Encode"
    }
  },
  "112:16": {
    "class_type": "SamplerCustomAdvanced",
    "inputs": {
      "guider": [
        "112:19",
        0
      ],
      "latent_image": [
        "112:23",
        0
      ],
      "noise": [
        "112:18",
        0
      ],
      "sampler": [
        "112:21",
        0
      ],
      "sigmas": [
        "112:28",
        0
      ]
    },
    "_meta": {
      "title": "SamplerCustomAdvanced"
    }
  },
  "112:114": {
    "class_type": "VAEDecode",
    "inputs": {
      "samples": [
        "112:16",
        0
      ],
      "vae": [
        "112:14",
        0
      ]
    },
    "_meta": {
      "title": "VAE Decode"
    }
  },
  "112:22": {
    "class_type": "ImageInvert",
    "inputs": {
      "image": [
        "112:114",
        0
      ]
    },
    "_meta": {
      "title": "Invert Image Colors"
    }
  },
  "111:37": {
    "class_type": "UNETLoader",
    "inputs": {
      "unet_name": "qwen_image_fp8_e4m3fn.safetensors",
      "weight_dtype": "default"
    },
    "_meta": {
      "title": "Load Diffusion Model"
    }
  },
  "111:38": {
    "class_type": "CLIPLoader",
    "inputs": {
      "clip_name": "qwen_2.5_vl_7b_fp8_scaled.safetensors",
      "device": "default",
      "type": "qwen_image"
    },
    "_meta": {
      "title": "Load CLIP"
    }
  },
  "111:39": {
    "class_type": "VAELoader",
    "inputs": {
      "vae_name": "qwen_image_vae.safetensors"
    },
    "_meta": {
      "title": "Load VAE"
    }
  },
  "111:80": {
    "class_type": "LoraLoaderModelOnly",
    "inputs": {
      "lora_name": "Qwen-Image-Lightning-4steps-V1.0.safetensors",
      "model": [
        "111:37",
        0
      ],
      "strength_model": 0.7
    },
    "_meta": {
      "title": "Load LoRA"
    }
  },
  "111:66": {
    "class_type": "ModelSamplingAuraFlow",
    "inputs": {
      "model": [
        "111:80",
        0
      ],
      "shift": 3.1
    },
    "_meta": {
      "title": "ModelSamplingAuraFlow"
    }
  },
  "111:6": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "clip": [
        "111:38",
        0
      ],
      "text": "PLACEHOLDER"
    },
    "_meta": {
      "title": "CLIP Text Encode (Positive Prompt)"
    }
  },
  "111:7": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "clip": [
        "111:38",
        0
      ],
      "text": ""
    },
    "_meta": {
      "title": "CLIP Text Encode (Negative Prompt)"
    }
  },
  "111:84": {
    "class_type": "ControlNetLoader",
    "inputs": {
      "control_net_name": "Qwen-Image-InstantX-ControlNet-Union.safetensors"
    },
    "_meta": {
      "title": "Load ControlNet Model"
    }
  },
  "111:85": {
    "class_type": "ControlNetApplyAdvanced",
    "inputs": {
      "control_net": [
        "111:84",
        0
      ],
      "end_percent": 1,
      "image": [
        "112:22",
        0
      ],
      "negative": [
        "111:7",
        0
      ],
      "positive": [
        "111:6",
        0
      ],
      "start_percent": 0,
      "strength": 1,
      "vae": [
        "111:39",
        0
      ]
    },
    "_meta": {
      "title": "Apply ControlNet"
    }
  },
  "111:76": {
    "class_type": "VAEEncode",
    "inputs": {
      "pixels": [
        "112:22",
        0
      ],
      "vae": [
        "111:39",
        0
      ]
    },
    "_meta": {
      "title": "VAE Encode"
    }
  },
  "111:3": {
    "class_type": "KSampler",
    "inputs": {
      "cfg": 1,
      "denoise": 0.85,
      "latent_image": [
        "111:76",
        0
      ],
      "model": [
        "111:66",
        0
      ],
      "negative": [
        "111:85",
        1
      ],
      "positive": [
        "111:85",
        0
      ],
      "sampler_name": "euler",
      "scheduler": "simple",
      "seed": 0,
      "steps": 4
    },
    "_meta": {
      "title": "KSampler"
    }
  },
  "111:8": {
    "class_type": "VAEDecode",
    "inputs": {
      "samples": [
        "111:3",
        0
      ],
      "vae": [
        "111:39",
        0
      ]
    },
    "_meta": {
      "title": "VAE Decode"
    }
  },
  "60": {
    "class_type": "SaveImageAdvanced",
    "inputs": {
      "images": [
        "111:8",
        0
      ],
      "filename_prefix": "uttu-still",
      "format": "png",
      "format.bit_depth": "8-bit",
      "format.input_color_space": "sRGB"
    },
    "_meta": {
      "title": "Enregistrer"
    }
  }
} as ApiGraph;
