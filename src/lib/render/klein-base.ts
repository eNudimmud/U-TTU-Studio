// FLUX 3 Image Klein (open weights), from the official templates
// `image_flux3_klein_t2i` and `image_flux3_klein_image_edit` (ComfyUI frontend
// graphToPrompt, 2026-10-16). Removed: previews, the image compare and the
// bounding-box layout editor (no layout from the studio). The template's prompt
// upsampler stays in the graph behind its own switch, turned off: the visitor's
// text goes straight to the encoder, as in the measured runs.

import type { ApiGraph } from "./take-graph.ts";

export const KLEIN_T2I_BASE: ApiGraph = {
  "19": {
    "inputs": {
      "aspect_ratio": "1:1 (Square)",
      "megapixels": 1,
      "multiple": 16
    },
    "class_type": "ResolutionSelector",
    "_meta": {
      "title": "Resolution Selector"
    }
  },
  "18:17": {
    "inputs": {
      "value": "close up profile of a young male athlete with closed eyes pressing his sweaty forehead against a soccer ball, right hand gripping the ball, stark white background, athletic jacket, white ball with jagged red graphic patterns, high contrast studio lighting, highly detailed skin texture, sharp focus Absolutely no text, no typography, no letters, no words, no numbers, no logos, no watermark, no captions, pure imagery only."
    },
    "class_type": "PrimitiveStringMultiline",
    "_meta": {
      "title": "Text (Multiline)"
    }
  },
  "18:12": {
    "inputs": {
      "clip_name": "qwen3.5_9b_flux3_prompt_upsampler_w4a8.safetensors",
      "type": "flux3",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "Load CLIP"
    }
  },
  "18:14": {
    "inputs": {
      "value": "You are the prompt upsampler of a text-to-image model. Expand the user's short request into ONE detailed, self-contained caption: the exact text the image model receives. Output only the caption, with no greetings, explanations, refusals, questions, Markdown, headings, JSON, coordinates, ids or angle-bracket tokens, and no quotes around it. If the input is not clearly an image request, caption a visualization of its concept. The request may begin with a \"TARGET CANVAS: W:H\" line: compose for that canvas (wide spreads content sideways, tall stacks it) and never mention the ratio or the canvas.\n\nFidelity and planning: keep every explicit subject, attribute, count, spatial constraint, style cue and piece of wording; never contradict, substitute, drop or narrow the request, and keep an abstract concept abstract. Decide everything left open as ONE concrete, consistent plan; never offer alternatives or hedge. Never re-express a stated constraint through another mechanism; add camera optics (depth of field, bokeh, blur) only when asked for or implied. Without a stated style, plan an actual photograph and open with the medium convention (\"Full-color outdoor photograph, ...\", \"Full-color indoor photograph, ...\", \"Studio photograph, ...\", \"Close-up photograph, ...\"); keep \"Photorealistic\" for renders, and turn \"photorealistic\" or \"realistic\" requests for photos into the photograph convention. Give a photograph a few ordinary, non-ideal specifics drawn from the scene's own objects instead of the stock-photo ideal. Do not invent names, brands, logos or celebrities; keep user-named ones. A long request keeps its content but not its wording: drop appraisal and sales vocabulary, turn moods into observable physical facts, and add only new concrete content with positions. Time of day is lighting, not rendered text.\n\nCaption format: one continuous prose block in the generative voice, never \"this image shows\", \"we can see\" or \"is visible\". Lead with medium and style, then scene, lighting and camera, then the subjects with concrete colors, materials and state. Every person in focus gets an observable profile: ethnicity, gender, age range, skin tone (\"fair skin\", \"brown skin\"), hair and clothing. Make the layout reconstructable from words: frame-relative positions (frame-left, frame-right, upper, lower, foreground, midground, background), sentence-initial anchors (\"On the left, ...\", \"In the background, ...\"), relations (holds, faces, behind) and a consistent order; describe up to about ten instances one by one, beyond that give the exact count and arrangement. Out-of-focus or distant planes are shapes, colors and silhouettes, never identities or readable text, and the background takes about a sixth of the caption. Be definite: no hedging adverbs, no quality or emotion judgments, no closing sentence about mood; state negations as what is present. Rendered text: transcribe every wording verbatim inside double quotes in its original language and script, keep the line breaks of multi-line text, and give its typography, color and placement; author concrete, domain-correct wording when the request needs text it does not supply, and name canonical structures (calendar, keyboard, periodic table) exactly with their full layout. All prose is English; only quoted text keeps its language. Typical length is 100 to 350 words, more for complex scenes.\n\nOutput only the caption.\n"
    },
    "class_type": "PrimitiveStringMultiline",
    "_meta": {
      "title": "Text (System prompt)"
    }
  },
  "18:11": {
    "inputs": {
      "prompt": [
        "18:17",
        0
      ],
      "max_length": 3584,
      "sampling_mode": "on",
      "sampling_mode.temperature": 1,
      "sampling_mode.top_k": 1,
      "sampling_mode.top_p": 0.95,
      "sampling_mode.min_p": 0,
      "sampling_mode.repetition_penalty": 1,
      "sampling_mode.seed": 758781618552631,
      "sampling_mode.presence_penalty": 1.5,
      "thinking": false,
      "use_default_template": true,
      "mtp": "off",
      "clip": [
        "18:12",
        0
      ],
      "system_prompt": [
        "18:14",
        0
      ]
    },
    "class_type": "TextGenerate",
    "_meta": {
      "title": "Generate Text"
    }
  },
  "18:1": {
    "inputs": {
      "unet_name": "flux3_image_klein_base_int8_convrot.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "Load Diffusion Model"
    }
  },
  "18:4": {
    "inputs": {
      "text": [
        "18:16",
        0
      ],
      "clip": [
        "18:2",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "Positive Prompt"
    }
  },
  "18:2": {
    "inputs": {
      "clip_name": "qwen3vl_4b_int8_convrot.safetensors",
      "type": "flux3",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "Load CLIP"
    }
  },
  "18:7": {
    "inputs": {
      "seed": 758781618552631,
      "steps": 50,
      "cfg": 3.5,
      "sampler_name": "euler",
      "scheduler": "simple",
      "denoise": 1,
      "model": [
        "18:1",
        0
      ],
      "positive": [
        "18:4",
        0
      ],
      "negative": [
        "18:5",
        0
      ],
      "latent_image": [
        "18:6",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "KSampler"
    }
  },
  "18:3": {
    "inputs": {
      "vae_name": "flux2-vae.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "Load VAE"
    }
  },
  "18:16": {
    "inputs": {
      "switch": false,
      "on_false": [
        "18:17",
        0
      ],
      "on_true": [
        "18:11",
        0
      ]
    },
    "class_type": "ComfySwitchNode",
    "_meta": {
      "title": "If/Else Switch"
    }
  },
  "18:6": {
    "inputs": {
      "width": [
        "19",
        0
      ],
      "height": [
        "19",
        1
      ],
      "batch_size": 1
    },
    "class_type": "EmptyFlux2LatentImage",
    "_meta": {
      "title": "Empty Flux 2 Latent"
    }
  },
  "18:5": {
    "inputs": {
      "text": "",
      "clip": [
        "18:2",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "Negative Prompt (empty = reference default)"
    }
  },
  "18:8": {
    "inputs": {
      "samples": [
        "18:7",
        0
      ],
      "vae": [
        "18:3",
        0
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE Decode"
    }
  }
};

/** Reference images are wired at runtime into node 17 (images.imageN) and 50 (the upsampler batch). */
export const KLEIN_EDIT_BASE: ApiGraph = {
  "2": {
    "inputs": {
      "clip_name": "qwen3vl_4b_int8_convrot.safetensors",
      "type": "flux3",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "Load CLIP"
    }
  },
  "3": {
    "inputs": {
      "vae_name": "flux2-vae.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "Load VAE"
    }
  },
  "4": {
    "inputs": {
      "text": [
        "51",
        0
      ],
      "clip": [
        "2",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "Positive Prompt"
    }
  },
  "7": {
    "inputs": {
      "seed": 1106932821006959,
      "steps": 50,
      "cfg": 1,
      "sampler_name": "euler",
      "scheduler": "simple",
      "denoise": 1,
      "model": [
        "59",
        0
      ],
      "positive": [
        "17",
        0
      ],
      "negative": [
        "17",
        1
      ],
      "latent_image": [
        "17",
        2
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "KSampler"
    }
  },
  "8": {
    "inputs": {
      "samples": [
        "7",
        0
      ],
      "vae": [
        "3",
        0
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE Decode"
    }
  },
  "17": {
    "inputs": {
      "resolution": "resize",
      "resolution.megapixels": 1,
      "positive": [
        "4",
        0
      ],
      "negative": [
        "58",
        0
      ],
      "vae": [
        "3",
        0
      ],
      "images.image0": [
        "54",
        0
      ]
    },
    "class_type": "ReferenceMultiLatent",
    "_meta": {
      "title": "Set Reference Multi Latent"
    }
  },
  "46": {
    "inputs": {
      "clip_name": "qwen3.5_9b_flux3_prompt_upsampler_w4a8.safetensors",
      "type": "flux3",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "Load CLIP"
    }
  },
  "47": {
    "inputs": {
      "prompt": [
        "61",
        0
      ],
      "max_length": 3584,
      "sampling_mode": "on",
      "sampling_mode.temperature": 1,
      "sampling_mode.top_k": 1,
      "sampling_mode.top_p": 0.95,
      "sampling_mode.min_p": 0,
      "sampling_mode.repetition_penalty": 1,
      "sampling_mode.seed": 0,
      "sampling_mode.presence_penalty": 0,
      "thinking": false,
      "use_default_template": true,
      "mtp": "off",
      "clip": [
        "46",
        0
      ],
      "image": [
        "50",
        0
      ],
      "system_prompt": [
        "48",
        0
      ]
    },
    "class_type": "TextGenerate",
    "_meta": {
      "title": "Generate Text"
    }
  },
  "48": {
    "inputs": {
      "value": "You are the prompt upsampler of an image-editing model. You see the reference image(s), attached in order (the first image, the second image, ...), and the user's short request. Expand it into ONE detailed, self-contained instruction: the caption the editing model receives together with the same images. Output only the instruction as one continuous English prose block, with no greetings, explanations, Markdown, JSON, coordinates, ids or angle-bracket tokens. Read a vague or conversational request as the most plausible edit of the supplied images.\\n\\nPick the voice by task shape. When one reference stays and gets bounded changes, write an imperative editing instruction on it (\\\"Remove the ...\\\", \\\"Change the ... to ...\\\", \\\"Zoom in on ...\\\"); a whole-image transformation opens with its scope (\\\"Convert the entire image into ...\\\", \\\"Apply a ... filter over the entire scene\\\", \\\"Horizontally flip the entire image so that ...\\\", \\\"Shift the camera viewpoint to ...\\\", then where the major elements should now be). When the references are drawn into a newly composed frame (combining subjects, a new scene, a garment, object or style donor), write a generation request (\\\"Create a photograph of ...\\\", \\\"Create an anime-style illustration of ...\\\", \\\"Generate a new image featuring ...\\\") that says what to take from each image, by ordinal, and what is newly generated.\\n\\nKeep every explicit edit, constraint, count, position, style cue and piece of wording, and decide what is left open as one concrete plan. Ground everything in what is actually visible: identify each referent unambiguously by its real appearance, never mention content that is not there, and use every image the user attached. State every end state concretely (which color, how large, which pose, which material) and give new content enough appearance to be generated. Cover the knock-on effects of the change (shadows, reflections, occlusion, perspective, scale, lighting) and say what fills a removed region. A zoom-in names what stays in frame and which neighbors are cropped out; an outpainting continues the scene in the same medium. Describe the change, not the whole scene, and close an editing instruction with one compact clause naming what stays unchanged; transferred people keep their identity, face and accessories unless asked otherwise. Transcribe on-image text verbatim in its original language inside double quotes, with line breaks as \\\\n, and match the original font, size and color when replacing it. Name recognizable public figures, brands and landmarks you can see. Directions are frame-relative; use no evaluative or quality words. Typical length is 50 to 150 words.\\n\\nOutput only the instruction."
    },
    "class_type": "PrimitiveStringMultiline",
    "_meta": {
      "title": "Text (System prompt)"
    }
  },
  "50": {
    "inputs": {
      "images.image0": [
        "54",
        0
      ]
    },
    "class_type": "BatchImagesNode",
    "_meta": {
      "title": "Batch Images"
    }
  },
  "51": {
    "inputs": {
      "switch": true,
      "on_false": [
        "47",
        0
      ],
      "on_true": [
        "61",
        0
      ]
    },
    "class_type": "ComfySwitchNode",
    "_meta": {
      "title": "If/Else Switch"
    }
  },
  "58": {
    "inputs": {
      "text": "",
      "clip": [
        "2",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "Positive Prompt"
    }
  },
  "59": {
    "inputs": {
      "unet_name": "flux3_image_klein_base_int8_convrot.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "Load Diffusion Model"
    }
  },
  "61": {
    "class_type": "PrimitiveStringMultiline",
    "inputs": {
      "value": ""
    },
    "_meta": {
      "title": "Prompt"
    }
  }
};
