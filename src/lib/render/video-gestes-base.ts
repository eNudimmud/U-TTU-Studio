// The four LTX video gestures, exported from the official Comfy templates
// (ComfyUI frontend graphToPrompt, 2026-10-16). Preview and side-by-side
// comparison nodes removed; unreachable nodes pruned. In the outpainting graph,
// the unused i2v picture is the clip's first frame instead of a second upload.
// Open weights only. Nothing here opens a network by itself.

import type { ApiGraph } from "./take-graph.ts";

/** From `video_ltx2_5_flf2v`. */
export const VIDEO_BRIDGE_BASE: ApiGraph = {
  "31": {
    "inputs": {
      "image": "robot_hand.png"
    },
    "class_type": "LoadImage",
    "_meta": {
      "title": "Load First Frame"
    }
  },
  "39": {
    "inputs": {
      "image": "robot_hand_energy.png"
    },
    "class_type": "LoadImage",
    "_meta": {
      "title": "Load Last Frame"
    }
  },
  "68": {
    "inputs": {
      "filename_prefix": "video/ltx2.5_flf2v",
      "format": "auto",
      "format.codec": "auto",
      "codec": "auto",
      "video": [
        "251:218",
        0
      ]
    },
    "class_type": "SaveVideo",
    "_meta": {
      "title": "Save Video"
    }
  },
  "251:210": {
    "inputs": {
      "video_latent": [
        "251:204",
        2
      ],
      "audio_latent": [
        "251:197",
        0
      ]
    },
    "class_type": "LTXVConcatAVLatent",
    "_meta": {
      "title": "Concat AV Latent"
    }
  },
  "251:219": {
    "inputs": {
      "tile_size": 512,
      "overlap": 64,
      "temporal_size": 64,
      "temporal_overlap": 16,
      "samples": [
        "251:200",
        2
      ],
      "vae": [
        "251:229",
        0
      ]
    },
    "class_type": "VAEDecodeTiled",
    "_meta": {
      "title": "VAE Decode (Tiled)"
    }
  },
  "251:220": {
    "inputs": {
      "samples": [
        "251:221",
        1
      ],
      "audio_vae": [
        "251:227",
        0
      ]
    },
    "class_type": "LTXVAudioVAEDecode",
    "_meta": {
      "title": "LTXV Audio VAE Decode"
    }
  },
  "251:221": {
    "inputs": {
      "av_latent": [
        "251:211",
        1
      ]
    },
    "class_type": "LTXVSeparateAVLatent",
    "_meta": {
      "title": "Separate AV Latent"
    }
  },
  "251:206": {
    "inputs": {
      "frame_idx": 0,
      "strength": 0.7,
      "positive": [
        "251:202",
        0
      ],
      "negative": [
        "251:202",
        1
      ],
      "vae": [
        "251:229",
        0
      ],
      "latent": [
        "251:201",
        0
      ],
      "image": [
        "251:199",
        0
      ]
    },
    "class_type": "LTXVAddGuide",
    "_meta": {
      "title": "LTXVAddGuide"
    }
  },
  "251:239": {
    "inputs": {
      "sigmas": "1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0"
    },
    "class_type": "ManualSigmas",
    "_meta": {
      "title": "ManualSigmas"
    }
  },
  "251:204": {
    "inputs": {
      "frame_idx": -1,
      "strength": 0.7,
      "positive": [
        "251:206",
        0
      ],
      "negative": [
        "251:206",
        1
      ],
      "vae": [
        "251:229",
        0
      ],
      "latent": [
        "251:206",
        2
      ],
      "image": [
        "251:195",
        0
      ]
    },
    "class_type": "LTXVAddGuide",
    "_meta": {
      "title": "LTXVAddGuide"
    }
  },
  "251:197": {
    "inputs": {
      "frames_number": [
        "251:226",
        1
      ],
      "frame_rate": [
        "251:205",
        0
      ],
      "batch_size": 1,
      "audio_vae": [
        "251:227",
        0
      ]
    },
    "class_type": "LTXVEmptyLatentAudio",
    "_meta": {
      "title": "Empty LTXV Latent Audio"
    }
  },
  "251:200": {
    "inputs": {
      "positive": [
        "251:204",
        0
      ],
      "negative": [
        "251:204",
        1
      ],
      "latent": [
        "251:221",
        0
      ]
    },
    "class_type": "LTXVCropGuides",
    "_meta": {
      "title": "LTXVCropGuides"
    }
  },
  "251:201": {
    "inputs": {
      "width": [
        "251:203",
        0
      ],
      "height": [
        "251:203",
        1
      ],
      "length": [
        "251:226",
        1
      ],
      "batch_size": 1
    },
    "class_type": "EmptyLTXVLatentVideo",
    "_meta": {
      "title": "Empty LTXV Latent Video"
    }
  },
  "251:211": {
    "inputs": {
      "noise": [
        "251:196",
        0
      ],
      "guider": [
        "251:235",
        0
      ],
      "sampler": [
        "251:208",
        0
      ],
      "sigmas": [
        "251:239",
        0
      ],
      "latent_image": [
        "251:210",
        0
      ]
    },
    "class_type": "SamplerCustomAdvanced",
    "_meta": {
      "title": "SamplerCustomAdvanced"
    }
  },
  "251:202": {
    "inputs": {
      "frame_rate": [
        "251:212",
        0
      ],
      "positive": [
        "251:222",
        0
      ],
      "negative": [
        "251:217",
        0
      ]
    },
    "class_type": "LTXVConditioning",
    "_meta": {
      "title": "LTXVConditioning"
    }
  },
  "251:208": {
    "inputs": {
      "eta": 0,
      "s_noise": 1
    },
    "class_type": "SamplerEulerAncestral",
    "_meta": {
      "title": "SamplerEulerAncestral"
    }
  },
  "251:218": {
    "inputs": {
      "fps": [
        "251:212",
        0
      ],
      "bit_depth": 8,
      "color_space": "sRGB",
      "codec": "none",
      "images": [
        "251:219",
        0
      ],
      "audio": [
        "251:220",
        0
      ]
    },
    "class_type": "CreateVideo",
    "_meta": {
      "title": "Create Video"
    }
  },
  "251:235": {
    "inputs": {
      "video_cfg": 1,
      "audio_cfg": 1,
      "model": [
        "251:230",
        0
      ],
      "positive": [
        "251:204",
        0
      ],
      "negative": [
        "251:204",
        1
      ]
    },
    "class_type": "LTXVDualCFGGuider",
    "_meta": {
      "title": "LTXV Dual CFG Guider"
    }
  },
  "251:196": {
    "inputs": {
      "noise_seed": 873293130933086
    },
    "class_type": "RandomNoise",
    "_meta": {
      "title": "RandomNoise"
    }
  },
  "251:217": {
    "inputs": {
      "text": "blurry, out of focus, overexposed, underexposed, low contrast, washed out colors, excessive noise, grainy texture, poor lighting, flickering, motion blur, distorted proportions, unnatural skin tones, deformed facial features, asymmetrical face, missing facial features, extra limbs, disfigured hands, wrong hand count, artifacts around text, unreadable text on shirt or hat, incorrect lettering on cap (“PNTR”), incorrect t-shirt slogan (“JUST DO IT”), missing microphone, misplaced microphone, inconsistent perspective, camera shake, incorrect depth of field, background too sharp, background clutter, distracting reflections, harsh shadows, inconsistent lighting direction, color banding, cartoonish rendering, 3D CGI look, unrealistic materials, uncanny valley effect, incorrect ethnicity, wrong gender, exaggerated expressions, smiling, laughing, exaggerated sadness, wrong gaze direction, eyes looking at camera, mismatched lip sync, silent or muted audio, distorted voice, robotic voice, echo, background noise, off-sync audio, missing sniff sounds, incorrect dialogue, added dialogue, repetitive speech, jittery movement, awkward pauses, incorrect timing, unnatural transitions, inconsistent framing, tilted camera, missing door or shelves, missing shallow depth of field, flat lighting, inconsistent tone, cinematic oversaturation, stylized filters, or AI artifacts.",
      "clip": [
        "251:228",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "251:222": {
    "inputs": {
      "text": [
        "251:248",
        0
      ],
      "clip": [
        "251:228",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "251:248": {
    "inputs": {
      "switch": [
        "251:250",
        0
      ],
      "on_false": [
        "251:252",
        0
      ],
      "on_true": [
        "251:247",
        0
      ]
    },
    "class_type": "ComfySwitchNode",
    "_meta": {
      "title": "If/Else Switch"
    }
  },
  "251:203": {
    "inputs": {
      "image": [
        "251:213",
        0
      ]
    },
    "class_type": "GetImageSize",
    "_meta": {
      "title": "Get Image Size"
    }
  },
  "251:195": {
    "inputs": {
      "img_compression": 18,
      "image": [
        "251:214",
        0
      ]
    },
    "class_type": "LTXVPreprocess",
    "_meta": {
      "title": "LTXV Preprocess"
    }
  },
  "251:199": {
    "inputs": {
      "img_compression": 18,
      "image": [
        "251:213",
        0
      ]
    },
    "class_type": "LTXVPreprocess",
    "_meta": {
      "title": "LTXV Preprocess"
    }
  },
  "251:247": {
    "inputs": {
      "prompt": [
        "251:252",
        0
      ],
      "max_length": 600,
      "sampling_mode": "on",
      "sampling_mode.temperature": 0.7,
      "sampling_mode.top_k": 64,
      "sampling_mode.top_p": 0.95,
      "sampling_mode.min_p": 0.05,
      "sampling_mode.repetition_penalty": 1.15,
      "sampling_mode.seed": 0,
      "sampling_mode.presence_penalty": 0,
      "thinking": false,
      "use_default_template": true,
      "mtp": "auto",
      "clip": [
        "251:246",
        0
      ],
      "image": [
        "251:199",
        0
      ]
    },
    "class_type": "TextGenerateLTX2Prompt",
    "_meta": {
      "title": "Generate LTX2 Prompt"
    }
  },
  "251:213": {
    "inputs": {
      "resize_type": "scale dimensions",
      "resize_type.width": [
        "251:215",
        0
      ],
      "resize_type.height": [
        "251:216",
        0
      ],
      "resize_type.crop": "center",
      "scale_method": "nearest-exact",
      "input": [
        "31",
        0
      ]
    },
    "class_type": "ResizeImageMaskNode",
    "_meta": {
      "title": "Resize Image/Mask"
    }
  },
  "251:214": {
    "inputs": {
      "resize_type": "scale dimensions",
      "resize_type.width": [
        "251:215",
        0
      ],
      "resize_type.height": [
        "251:216",
        0
      ],
      "resize_type.crop": "center",
      "scale_method": "nearest-exact",
      "input": [
        "39",
        0
      ]
    },
    "class_type": "ResizeImageMaskNode",
    "_meta": {
      "title": "Resize Image/Mask"
    }
  },
  "251:230": {
    "inputs": {
      "unet_name": "ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "Load Diffusion Model"
    }
  },
  "251:229": {
    "inputs": {
      "vae_name": "ltx-2.5-video-vae-bf16.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "Load VAE"
    }
  },
  "251:227": {
    "inputs": {
      "vae_name": "ltx-2.5-audio-vae-bf16.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "Load VAE"
    }
  },
  "251:228": {
    "inputs": {
      "clip_name": "gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors",
      "type": "ltxv",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "Load CLIP"
    }
  },
  "251:246": {
    "inputs": {
      "clip_name": "gemma4_e2b_it_int8_convrot.safetensors",
      "type": "ltxv",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "Load CLIP"
    }
  },
  "251:250": {
    "inputs": {
      "value": false
    },
    "class_type": "PrimitiveBoolean",
    "_meta": {
      "title": "Boolean (Enable Prompt Enhance)"
    }
  },
  "251:215": {
    "inputs": {
      "value": 1280
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "Width"
    }
  },
  "251:216": {
    "inputs": {
      "value": 720
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "height"
    }
  },
  "251:212": {
    "inputs": {
      "expression": "a",
      "values.a": [
        "251:205",
        0
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "Math Expression"
    }
  },
  "251:198": {
    "inputs": {
      "value": 5
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "Duration"
    }
  },
  "251:226": {
    "inputs": {
      "expression": "a * b + 1",
      "values.a": [
        "251:198",
        0
      ],
      "values.b": [
        "251:205",
        0
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "Math Expression"
    }
  },
  "251:205": {
    "inputs": {
      "value": 24
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "Frame Rate(int)"
    }
  },
  "251:252": {
    "inputs": {
      "value": "Use the provided start image as the first frame and the provided end image as the final frame anchor. The video opens on the back of the robotic hand, four fingers slightly curled, joints glowing faintly in the darkness, a low electrical hum filling the space. The hand rotates slowly at the wrist, turning from the back view toward the palm side, the four visible fingers uncurling gently one by one, starting with the index finger, then the middle, ring, and pinky, each joint clicking softly. As the palm turns upward, the thumb swings out from the side of the hand into view, clearly separate from the four fingers, all five fingers spreading open. A blue energy crystal fades into existence above the palm, its hum rising into a resonant tone, thin energy threads coiling around it, particles crackling softly as they spiral away like sparks. The crystal rotates slowly, hovering above the fully open hand, light spilling between the five spread fingers, the crystal's steady hum filling the silence as the video ends on the open palm with the glowing crystal.\n"
    },
    "class_type": "PrimitiveStringMultiline",
    "_meta": {
      "title": "Prompt"
    }
  }
};

/** From `video_ltx2_3_ic_lora`. */
export const VIDEO_CAMERA_BASE: ApiGraph = {
  "68": {
    "inputs": {
      "filename_prefix": "video/ltx2.3_ic_lora",
      "format": "auto",
      "format.codec": "auto",
      "codec": "auto",
      "video": [
        "129:122",
        0
      ]
    },
    "class_type": "SaveVideo",
    "_meta": {
      "title": "Save Video"
    }
  },
  "199": {
    "inputs": {
      "file": "stone_ruins.mp4"
    },
    "class_type": "LoadVideo",
    "_meta": {
      "title": "Load Video"
    }
  },
  "200": {
    "inputs": {
      "image": "the_forgotten_gate.png"
    },
    "class_type": "LoadImage",
    "_meta": {
      "title": "Load Image"
    }
  },
  "692": {
    "inputs": {
      "start_time": 0,
      "duration": 5,
      "strict_duration": false,
      "video": [
        "199",
        0
      ]
    },
    "class_type": "Video Slice",
    "_meta": {
      "title": "Trim Video"
    }
  },
  "697:13": {
    "inputs": {
      "resolution_level": 9,
      "fov_x_degrees": 0,
      "batch_size": 4,
      "force_projection": true,
      "apply_mask": true,
      "refine_steps": 3,
      "moge_model": [
        "697:32",
        0
      ],
      "image": [
        "697:53",
        0
      ]
    },
    "class_type": "MoGeInference",
    "_meta": {
      "title": "Run MoGe Inference"
    }
  },
  "697:25": {
    "inputs": {
      "output": "depth",
      "moge_geometry": [
        "697:13",
        0
      ]
    },
    "class_type": "MoGeRender",
    "_meta": {
      "title": "Render MoGe Geometry"
    }
  },
  "697:32": {
    "inputs": {
      "model_name": "moge_2_vitl_normal_fp16.safetensors"
    },
    "class_type": "LoadMoGeModel",
    "_meta": {
      "title": "Load MoGe Model"
    }
  },
  "697:36": {
    "inputs": {
      "expression": "a > 2048",
      "values.a": [
        "697:37",
        0
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "Math Expression"
    }
  },
  "697:37": {
    "inputs": {
      "image": [
        "697:70",
        0
      ]
    },
    "class_type": "GetImageSize",
    "_meta": {
      "title": "Get Image Size"
    }
  },
  "697:42": {
    "inputs": {
      "switch": [
        "697:36",
        2
      ],
      "on_false": [
        "697:70",
        0
      ],
      "on_true": [
        "697:705",
        0
      ]
    },
    "class_type": "ComfySwitchNode",
    "_meta": {
      "title": "If/Else Switch"
    }
  },
  "697:53": {
    "inputs": {
      "switch": true,
      "on_false": [
        "697:70",
        0
      ],
      "on_true": [
        "697:42",
        0
      ]
    },
    "class_type": "ComfySwitchNode",
    "_meta": {
      "title": "If/Else Switch"
    }
  },
  "697:70": {
    "inputs": {
      "video": [
        "692",
        0
      ]
    },
    "class_type": "GetVideoComponents",
    "_meta": {
      "title": "Get Video Components"
    }
  },
  "697:705": {
    "inputs": {
      "resize_type": "scale longer dimension",
      "resize_type.longer_size": 2048,
      "scale_method": "area",
      "input": [
        "697:70",
        0
      ]
    },
    "class_type": "ResizeImageMaskNode",
    "_meta": {
      "title": "Resize Image/Mask"
    }
  },
  "129:101": {
    "inputs": {
      "frames_number": [
        "129:694",
        2
      ],
      "frame_rate": [
        "129:114",
        0
      ],
      "batch_size": 1,
      "audio_vae": [
        "129:126",
        0
      ]
    },
    "class_type": "LTXVEmptyLatentAudio",
    "_meta": {
      "title": "Empty LTXV Latent Audio"
    }
  },
  "129:106": {
    "inputs": {
      "positive": [
        "129:115",
        0
      ],
      "negative": [
        "129:115",
        1
      ],
      "latent": [
        "129:121",
        0
      ]
    },
    "class_type": "LTXVCropGuides",
    "_meta": {
      "title": "LTXVCropGuides"
    }
  },
  "129:108": {
    "inputs": {
      "width": [
        "129:113",
        0
      ],
      "height": [
        "129:98",
        0
      ],
      "length": [
        "129:694",
        2
      ],
      "batch_size": 1
    },
    "class_type": "EmptyLTXVLatentVideo",
    "_meta": {
      "title": "Empty LTXV Latent Video"
    }
  },
  "129:109": {
    "inputs": {
      "frame_rate": [
        "129:123",
        0
      ],
      "positive": [
        "129:128",
        0
      ],
      "negative": [
        "129:112",
        0
      ]
    },
    "class_type": "LTXVConditioning",
    "_meta": {
      "title": "LTXVConditioning"
    }
  },
  "129:114": {
    "inputs": {
      "value": 25
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "Frame Rate(int)"
    }
  },
  "129:115": {
    "inputs": {
      "frame_idx": 0,
      "strength": 1,
      "positive": [
        "129:109",
        0
      ],
      "negative": [
        "129:109",
        1
      ],
      "vae": [
        "129:127",
        2
      ],
      "latent": [
        "129:198",
        0
      ],
      "image": [
        "697:25",
        0
      ],
      "iclora_parameters": [
        "129:196",
        0
      ]
    },
    "class_type": "LTXVAddGuide",
    "_meta": {
      "title": "LTXVAddGuide"
    }
  },
  "129:119": {
    "inputs": {
      "video_latent": [
        "129:115",
        2
      ],
      "audio_latent": [
        "129:101",
        0
      ]
    },
    "class_type": "LTXVConcatAVLatent",
    "_meta": {
      "title": "Concat AV Latent"
    }
  },
  "129:123": {
    "inputs": {
      "expression": "a",
      "values.a": [
        "129:114",
        0
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "Math Expression"
    }
  },
  "129:113": {
    "inputs": {
      "value": 1280
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "Width"
    }
  },
  "129:98": {
    "inputs": {
      "value": 704
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "height"
    }
  },
  "129:112": {
    "inputs": {
      "text": "blurry, out of focus, overexposed, underexposed, low contrast, washed out colors, excessive noise, grainy texture, poor lighting, flickering, motion blur, distorted proportions, unnatural skin tones, deformed facial features, asymmetrical face, missing facial features, extra limbs, disfigured hands, wrong hand count, artifacts around text, unreadable text on shirt or hat, incorrect lettering on cap (“PNTR”), incorrect t-shirt slogan (“JUST DO IT”), missing microphone, misplaced microphone, inconsistent perspective, camera shake, incorrect depth of field, background too sharp, background clutter, distracting reflections, harsh shadows, inconsistent lighting direction, color banding, cartoonish rendering, 3D CGI look, unrealistic materials, uncanny valley effect, incorrect ethnicity, wrong gender, exaggerated expressions, smiling, laughing, exaggerated sadness, wrong gaze direction, eyes looking at camera, mismatched lip sync, silent or muted audio, distorted voice, robotic voice, echo, background noise, off-sync audio, missing sniff sounds, incorrect dialogue, added dialogue, repetitive speech, jittery movement, awkward pauses, incorrect timing, unnatural transitions, inconsistent framing, tilted camera, missing door or shelves, missing shallow depth of field, flat lighting, inconsistent tone, cinematic oversaturation, stylized filters, or AI artifacts.",
      "clip": [
        "129:103",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "129:122": {
    "inputs": {
      "fps": [
        "129:123",
        0
      ],
      "bit_depth": "auto",
      "color_space": "sRGB",
      "codec": "none",
      "images": [
        "129:105",
        0
      ],
      "audio": [
        "129:107",
        0
      ]
    },
    "class_type": "CreateVideo",
    "_meta": {
      "title": "Create Video"
    }
  },
  "129:105": {
    "inputs": {
      "tile_size": 768,
      "overlap": 64,
      "temporal_size": 4096,
      "temporal_overlap": 64,
      "samples": [
        "129:106",
        2
      ],
      "vae": [
        "129:127",
        2
      ]
    },
    "class_type": "VAEDecodeTiled",
    "_meta": {
      "title": "VAE Decode (Tiled)"
    }
  },
  "129:107": {
    "inputs": {
      "samples": [
        "129:121",
        1
      ],
      "audio_vae": [
        "129:126",
        0
      ]
    },
    "class_type": "LTXVAudioVAEDecode",
    "_meta": {
      "title": "LTXV Audio VAE Decode"
    }
  },
  "129:121": {
    "inputs": {
      "av_latent": [
        "129:704",
        0
      ]
    },
    "class_type": "LTXVSeparateAVLatent",
    "_meta": {
      "title": "Separate AV Latent"
    }
  },
  "129:128": {
    "inputs": {
      "text": [
        "129:211",
        0
      ],
      "clip": [
        "129:103",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "129:127": {
    "inputs": {
      "ckpt_name": "ltx-2.3-22b-distilled-fp8.safetensors"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": {
      "title": "Load Checkpoint"
    }
  },
  "129:126": {
    "inputs": {
      "ckpt_name": "ltx-2.3-22b-distilled-fp8.safetensors"
    },
    "class_type": "LTXVAudioVAELoader",
    "_meta": {
      "title": "Load LTXV Audio VAE"
    }
  },
  "129:103": {
    "inputs": {
      "text_encoder": "gemma_3_12B_it_fp4_mixed.safetensors",
      "ckpt_name": "ltx-2.3-22b-distilled-fp8.safetensors",
      "device": "default"
    },
    "class_type": "LTXAVTextEncoderLoader",
    "_meta": {
      "title": "Load LTXV Audio Text Encoder"
    }
  },
  "129:195": {
    "inputs": {
      "lora_name": "ltx-2.3-22b-ic-lora-union-control-ref0.5.safetensors",
      "strength_model": 1,
      "model": [
        "129:127",
        0
      ]
    },
    "class_type": "LoraLoaderModelOnly",
    "_meta": {
      "title": "Load LoRA"
    }
  },
  "129:196": {
    "inputs": {
      "iclora_model": [
        "129:195",
        0
      ]
    },
    "class_type": "GetICLoRAParameters",
    "_meta": {
      "title": "Get IC-LoRA Parameters"
    }
  },
  "129:198": {
    "inputs": {
      "strength": 1,
      "bypass": false,
      "vae": [
        "129:127",
        2
      ],
      "image": [
        "200",
        0
      ],
      "latent": [
        "129:108",
        0
      ]
    },
    "class_type": "LTXVImgToVideoInplace",
    "_meta": {
      "title": "LTXVImgToVideoInplace"
    }
  },
  "129:208": {
    "inputs": {
      "lora_name": "gemma-3-12b-it-abliterated_lora_rank64_bf16.safetensors",
      "strength_model": 1,
      "strength_clip": 1,
      "model": [
        "129:127",
        0
      ],
      "clip": [
        "129:103",
        0
      ]
    },
    "class_type": "LoraLoader",
    "_meta": {
      "title": "Load LoRA (Model and CLIP)"
    }
  },
  "129:209": {
    "inputs": {
      "prompt": "A slow forward dolly shot on a bright, sunlit day in a lush jungle ruin. A lone figure in nature-themed armor stands before a weathered stone arch overgrown with ivy. A textured marble sphere wrapped in twisting vines levitates in the arch’s center, spinning slowly. As the camera glides forward, vines sway softly, leaves flutter in the light breeze. Strong golden sunlight streams through the canopy, illuminating the mossy ruins with bright, clear light. The scene feels vibrant and peaceful, with subtle natural motion.",
      "max_length": 2048,
      "sampling_mode": "on",
      "sampling_mode.temperature": 0.7,
      "sampling_mode.top_k": 64,
      "sampling_mode.top_p": 0.95,
      "sampling_mode.min_p": 0.05,
      "sampling_mode.repetition_penalty": 1.05,
      "sampling_mode.seed": 0,
      "sampling_mode.presence_penalty": 0,
      "thinking": false,
      "use_default_template": true,
      "mtp": "auto",
      "clip": [
        "129:208",
        1
      ],
      "image": [
        "200",
        0
      ]
    },
    "class_type": "TextGenerateLTX2Prompt",
    "_meta": {
      "title": "Generate LTX2 Prompt"
    }
  },
  "129:211": {
    "inputs": {
      "switch": [
        "129:212",
        0
      ],
      "on_false": "A slow forward dolly shot on a bright, sunlit day in a lush jungle ruin. A lone figure in nature-themed armor stands before a weathered stone arch overgrown with ivy. A textured marble sphere wrapped in twisting vines levitates in the arch’s center, spinning slowly. As the camera glides forward, vines sway softly, leaves flutter in the light breeze. Strong golden sunlight streams through the canopy, illuminating the mossy ruins with bright, clear light. The scene feels vibrant and peaceful, with subtle natural motion.",
      "on_true": [
        "129:209",
        0
      ]
    },
    "class_type": "ComfySwitchNode",
    "_meta": {
      "title": "If/Else Switch"
    }
  },
  "129:212": {
    "inputs": {
      "value": false
    },
    "class_type": "PrimitiveBoolean",
    "_meta": {
      "title": "Boolean (Enable Prompt Enhance)"
    }
  },
  "129:694": {
    "inputs": {
      "image": [
        "697:25",
        0
      ]
    },
    "class_type": "GetImageSize",
    "_meta": {
      "title": "Get Image Size"
    }
  },
  "129:704": {
    "inputs": {
      "seed": 0,
      "steps": 8,
      "cfg": 1,
      "sampler_name": "euler_ancestral",
      "scheduler": "linear_quadratic",
      "denoise": 1,
      "model": [
        "129:195",
        0
      ],
      "positive": [
        "129:115",
        0
      ],
      "negative": [
        "129:115",
        1
      ],
      "latent_image": [
        "129:119",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "KSampler"
    }
  }
};

/** From `template_ltx2_3_lora_video_outpainting`. */
export const VIDEO_OUTPAINT_BASE: ApiGraph = {
  "5060": {
    "inputs": {
      "video": "ltx2.3_video_outpainting_input.mp4",
      "force_rate": 0,
      "custom_width": 0,
      "custom_height": 0,
      "frame_load_cap": 0,
      "skip_first_frames": 0,
      "select_every_nth": 1,
      "format": "AnimateDiff"
    },
    "class_type": "VHS_LoadVideo",
    "_meta": {
      "title": "Load Video (Upload) 🎥🅥🅗🅢"
    }
  },
  "5152": {
    "inputs": {
      "frame_rate": [
        "5151:5137",
        5
      ],
      "loop_count": 0,
      "filename_prefix": "outpaint_output",
      "format": "video/h264-mp4",
      "pix_fmt": "yuv420p",
      "crf": 13,
      "save_metadata": true,
      "trim_to_audio": false,
      "pingpong": false,
      "save_output": true,
      "images": [
        "5151:5143",
        0
      ],
      "audio": [
        "5060",
        2
      ]
    },
    "class_type": "VHS_VideoCombine",
    "_meta": {
      "title": "video_output"
    }
  },
  "5151:5097": {
    "inputs": {
      "value": 9
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "target_aspect_w"
    }
  },
  "5151:5098": {
    "inputs": {
      "value": 16
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "target_aspect_h"
    }
  },
  "5151:5110": {
    "inputs": {
      "frame_rate": [
        "5151:5137",
        5
      ],
      "positive": [
        "5151:5138",
        0
      ],
      "negative": [
        "5151:5131",
        0
      ]
    },
    "class_type": "LTXVConditioning",
    "_meta": {
      "title": "LTXVConditioning"
    }
  },
  "5151:5111": {
    "inputs": {
      "video_latent": [
        "5151:5142",
        2
      ],
      "audio_latent": [
        "5151:5121",
        0
      ]
    },
    "class_type": "LTXVConcatAVLatent",
    "_meta": {
      "title": "Concat AV Latent"
    }
  },
  "5151:5112": {
    "inputs": {
      "width": [
        "5151:5126",
        0
      ],
      "height": [
        "5151:5126",
        1
      ],
      "length": [
        "5151:5126",
        2
      ],
      "batch_size": 1
    },
    "class_type": "EmptyLTXVLatentVideo",
    "_meta": {
      "title": "Empty LTXV Latent Video"
    }
  },
  "5151:5113": {
    "inputs": {
      "positive": [
        "5151:5142",
        0
      ],
      "negative": [
        "5151:5142",
        1
      ],
      "latent": [
        "5151:5114",
        0
      ]
    },
    "class_type": "LTXVCropGuides",
    "_meta": {
      "title": "LTXVCropGuides"
    }
  },
  "5151:5114": {
    "inputs": {
      "av_latent": [
        "5151:5122",
        0
      ]
    },
    "class_type": "LTXVSeparateAVLatent",
    "_meta": {
      "title": "Separate AV Latent"
    }
  },
  "5151:5115": {
    "inputs": {
      "a": [
        "5151:5137",
        5
      ]
    },
    "class_type": "CM_FloatToInt",
    "_meta": {
      "title": "FloatToInt"
    }
  },
  "5151:5116": {
    "inputs": {
      "cfg": 1,
      "model": [
        "5151:5146",
        0
      ],
      "positive": [
        "5151:5142",
        0
      ],
      "negative": [
        "5151:5142",
        1
      ]
    },
    "class_type": "CFGGuider",
    "_meta": {
      "title": "CFG Guider"
    }
  },
  "5151:5117": {
    "inputs": {
      "noise_seed": 617176731516609
    },
    "class_type": "RandomNoise",
    "_meta": {
      "title": "RandomNoise"
    }
  },
  "5151:5118": {
    "inputs": {
      "sigmas": "1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0"
    },
    "class_type": "ManualSigmas",
    "_meta": {
      "title": "ManualSigmas"
    }
  },
  "5151:5119": {
    "inputs": {
      "sampler_name": "euler_ancestral"
    },
    "class_type": "KSamplerSelect",
    "_meta": {
      "title": "KSamplerSelect"
    }
  },
  "5151:5120": {
    "inputs": {
      "img_compression": 18,
      "image": [
        "5151:5136",
        0
      ]
    },
    "class_type": "LTXVPreprocess",
    "_meta": {
      "title": "LTXV Preprocess"
    }
  },
  "5151:5121": {
    "inputs": {
      "frames_number": [
        "5060",
        1
      ],
      "frame_rate": [
        "5151:5115",
        0
      ],
      "batch_size": 1,
      "audio_vae": [
        "5151:5132",
        0
      ]
    },
    "class_type": "LTXVEmptyLatentAudio",
    "_meta": {
      "title": "Empty LTXV Latent Audio"
    }
  },
  "5151:5122": {
    "inputs": {
      "noise": [
        "5151:5117",
        0
      ],
      "guider": [
        "5151:5116",
        0
      ],
      "sampler": [
        "5151:5119",
        0
      ],
      "sigmas": [
        "5151:5118",
        0
      ],
      "latent_image": [
        "5151:5111",
        0
      ]
    },
    "class_type": "SamplerCustomAdvanced",
    "_meta": {
      "title": "SamplerCustomAdvanced"
    }
  },
  "5151:5126": {
    "inputs": {
      "image": [
        "5151:5130",
        0
      ]
    },
    "class_type": "GetImageSize",
    "_meta": {
      "title": "Get Image Size"
    }
  },
  "5151:5127": {
    "inputs": {
      "value": true
    },
    "class_type": "PrimitiveBoolean",
    "_meta": {
      "title": "bypass_i2v"
    }
  },
  "5151:5129": {
    "inputs": {
      "resize_type": "scale by multiplier",
      "resize_type.multiplier": 0.5,
      "scale_method": "lanczos",
      "input": [
        "5151:5139",
        0
      ]
    },
    "class_type": "ResizeImageMaskNode",
    "_meta": {
      "title": "Resize Image/Mask"
    }
  },
  "5151:5130": {
    "inputs": {
      "resize_type": "scale to multiple",
      "resize_type.multiple": 32,
      "scale_method": "area",
      "input": [
        "5151:5129",
        0
      ]
    },
    "class_type": "ResizeImageMaskNode",
    "_meta": {
      "title": "Resize Image/Mask"
    }
  },
  "5151:5131": {
    "inputs": {
      "text": "pc game, console game, video game, ugly, 3d render, photo, still, static, slow",
      "clip": [
        "5151:5135",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Negative Prompt)"
    }
  },
  "5151:5132": {
    "inputs": {
      "ckpt_name": "ltx-2.3-22b-dev-fp8.safetensors"
    },
    "class_type": "LTXVAudioVAELoader",
    "_meta": {
      "title": "Load LTXV Audio VAE"
    }
  },
  "5151:5133": {
    "inputs": {
      "ckpt_name": "ltx-2.3-22b-dev-fp8.safetensors"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": {
      "title": "Load Checkpoint"
    }
  },
  "5151:5134": {
    "inputs": {
      "lora_name": "ltx-2.3-22b-distilled-lora-384.safetensors",
      "strength_model": 0.5,
      "model": [
        "5151:5133",
        0
      ]
    },
    "class_type": "LoraLoaderModelOnly",
    "_meta": {
      "title": "Load LoRA"
    }
  },
  "5151:5135": {
    "inputs": {
      "text_encoder": "gemma_3_12B_it.safetensors",
      "ckpt_name": "ltx-2.3-22b-dev-fp8.safetensors",
      "device": "default"
    },
    "class_type": "LTXAVTextEncoderLoader",
    "_meta": {
      "title": "Load LTXV Audio Text Encoder"
    }
  },
  "5151:5136": {
    "inputs": {
      "resize_type": "match size",
      "resize_type.crop": "center",
      "scale_method": "area",
      "input": [
        "5151:first",
        0
      ],
      "resize_type.match": [
        "5151:5130",
        0
      ]
    },
    "class_type": "ResizeImageMaskNode",
    "_meta": {
      "title": "Resize Image/Mask"
    }
  },
  "5151:5137": {
    "inputs": {
      "video_info": [
        "5060",
        3
      ]
    },
    "class_type": "VHS_VideoInfo",
    "_meta": {
      "title": "Video Info 🎥🅥🅗🅢"
    }
  },
  "5151:5138": {
    "inputs": {
      "text": "",
      "clip": [
        "5151:5135",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Positive Prompt)"
    }
  },
  "5151:5139": {
    "inputs": {
      "left": 0,
      "right": 0,
      "top": 0,
      "bottom": 0,
      "extra_padding": 0,
      "pad_mode": "color",
      "color": "0, 0, 0",
      "image": [
        "5060",
        0
      ],
      "target_width": [
        "5151:5149",
        1
      ],
      "target_height": [
        "5151:5150",
        1
      ]
    },
    "class_type": "ImagePadKJ",
    "_meta": {
      "title": "ImagePad KJ"
    }
  },
  "5151:5141": {
    "inputs": {
      "strength": 0.7,
      "bypass": [
        "5151:5127",
        0
      ],
      "vae": [
        "5151:5133",
        2
      ],
      "image": [
        "5151:5120",
        0
      ],
      "latent": [
        "5151:5112",
        0
      ]
    },
    "class_type": "LTXVImgToVideoConditionOnly",
    "_meta": {
      "title": "🅛🅣🅧 LTXV Img To Video Condition Only"
    }
  },
  "5151:5142": {
    "inputs": {
      "frame_idx": 0,
      "strength": 1,
      "latent_downscale_factor": 1,
      "crop": "disabled",
      "use_tiled_encode": false,
      "tile_size": 256,
      "tile_overlap": 64,
      "use_streaming": false,
      "tile_frames": 97,
      "positive": [
        "5151:5110",
        0
      ],
      "negative": [
        "5151:5110",
        1
      ],
      "vae": [
        "5151:5133",
        2
      ],
      "latent": [
        "5151:5141",
        0
      ],
      "image": [
        "5151:5144",
        0
      ]
    },
    "class_type": "LTXAddVideoICLoRAGuide",
    "_meta": {
      "title": "🅛🅣🅧 Add Video IC-LoRA Guide"
    }
  },
  "5151:5143": {
    "inputs": {
      "image": [
        "5151:5154",
        0
      ],
      "exposure": 0,
      "contrast": 1,
      "brightness": 0,
      "saturation": 1,
      "gamma": 0.5,
      "lift_r": 0,
      "lift_g": 0,
      "lift_b": 0,
      "gain_r": 1,
      "gain_g": 1,
      "gain_b": 1,
      "luma_space": "Rec.709 / sRGB",
      "clamp_output": false
    },
    "_meta": {
      "title": ""
    },
    "class_type": "Float32ColorCorrect"
  },
  "5151:5144": {
    "inputs": {
      "image": [
        "5151:5130",
        0
      ],
      "exposure": 0,
      "contrast": 1,
      "brightness": 0,
      "saturation": 1,
      "gamma": 2,
      "lift_r": 0,
      "lift_g": 0,
      "lift_b": 0,
      "gain_r": 1,
      "gain_g": 1,
      "gain_b": 1,
      "luma_space": "Rec.709 / sRGB",
      "clamp_output": false
    },
    "_meta": {
      "title": ""
    },
    "class_type": "Float32ColorCorrect"
  },
  "5151:5146": {
    "inputs": {
      "lora_name": "ltx-2.3-22b-ic-lora-outpaint.safetensors",
      "strength_model": 1,
      "model": [
        "5151:5134",
        0
      ]
    },
    "class_type": "LoraLoaderModelOnly",
    "_meta": {
      "title": "Load LoRA"
    }
  },
  "5151:5148": {
    "inputs": {
      "expression": "a / b",
      "values.a": [
        "5151:5097",
        0
      ],
      "values.b": [
        "5151:5098",
        0
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "ratio"
    }
  },
  "5151:5149": {
    "inputs": {
      "expression": "max(a, b * c)",
      "values.a": [
        "5151:5137",
        3
      ],
      "values.b": [
        "5151:5137",
        4
      ],
      "values.c": [
        "5151:5148",
        0
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "target_w"
    }
  },
  "5151:5150": {
    "inputs": {
      "expression": "max(b, a / c)",
      "values.a": [
        "5151:5137",
        3
      ],
      "values.b": [
        "5151:5137",
        4
      ],
      "values.c": [
        "5151:5148",
        0
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "target_h"
    }
  },
  "5151:5154": {
    "inputs": {
      "samples": [
        "5151:5113",
        2
      ],
      "vae": [
        "5151:5133",
        2
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE Decode"
    }
  },
  "5151:first": {
    "inputs": {
      "batch_index": 0,
      "length": 1,
      "image": [
        "5060",
        0
      ]
    },
    "class_type": "ImageFromBatch",
    "_meta": {
      "title": "First frame of the clip"
    }
  }
};

/** From `template_ltx2_3_obscura_remova_lora_remove_object_from_video`. */
export const VIDEO_REMOVE_BASE: ApiGraph = {
  "39": {
    "inputs": {
      "file": "input_playing_the_piano.mp4"
    },
    "class_type": "LoadVideo",
    "_meta": {
      "title": "Load Video"
    }
  },
  "53": {
    "inputs": {
      "filename_prefix": "video",
      "format": "auto",
      "format.codec": "auto",
      "codec": "auto",
      "video": [
        "54:36",
        0
      ]
    },
    "class_type": "SaveVideo",
    "_meta": {
      "title": "Save Video"
    }
  },
  "54:1": {
    "inputs": {
      "vae_name": "LTX23_video_vae_bf16.safetensors",
      "device": "main_device",
      "weight_dtype": "bf16"
    },
    "class_type": "VAELoaderKJ",
    "_meta": {
      "title": "VAELoader KJ"
    }
  },
  "54:2": {
    "inputs": {
      "vae_name": "LTX23_audio_vae_bf16.safetensors",
      "device": "main_device",
      "weight_dtype": "bf16"
    },
    "class_type": "VAELoaderKJ",
    "_meta": {
      "title": "VAELoader KJ"
    }
  },
  "54:3": {
    "inputs": {
      "images": [
        "54:38",
        0
      ]
    },
    "class_type": "VHS_GetImageCount",
    "_meta": {
      "title": "Get Image Count 🎥🅥🅗🅢"
    }
  },
  "54:4": {
    "inputs": {
      "clip_name1": "gemma_3_12B_it_fp4_mixed.safetensors",
      "clip_name2": "ltx-2.3_text_projection_bf16.safetensors",
      "type": "ltxv",
      "device": "default"
    },
    "class_type": "DualCLIPLoader",
    "_meta": {
      "title": "Load CLIP (Dual)"
    }
  },
  "54:5": {
    "inputs": {
      "unet_name": "ltx-2.3-22b-dev_transformer_only_bf16.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "Load Diffusion Model"
    }
  },
  "54:6": {
    "inputs": {
      "image": [
        "54:25",
        0
      ]
    },
    "class_type": "GetImageSize",
    "_meta": {
      "title": "Get Image Size"
    }
  },
  "54:9": {
    "inputs": {
      "text": "Remove the crystal glass from the foreground.",
      "clip": [
        "54:4",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "54:10": {
    "inputs": {
      "width": [
        "54:6",
        0
      ],
      "height": [
        "54:6",
        1
      ],
      "length": [
        "54:45",
        1
      ],
      "batch_size": 1
    },
    "class_type": "EmptyLTXVLatentVideo",
    "_meta": {
      "title": "Empty LTXV Latent Video"
    }
  },
  "54:11": {
    "inputs": {
      "frame_rate": [
        "54:49",
        0
      ],
      "positive": [
        "54:9",
        0
      ],
      "negative": [
        "54:22",
        0
      ]
    },
    "class_type": "LTXVConditioning",
    "_meta": {
      "title": "LTXVConditioning"
    }
  },
  "54:12": {
    "inputs": {
      "frame_idx": 0,
      "strength": 1,
      "latent_downscale_factor": 1,
      "crop": "disabled",
      "use_tiled_encode": false,
      "tile_size": 256,
      "tile_overlap": 64,
      "use_streaming": false,
      "tile_frames": 97,
      "positive": [
        "54:11",
        0
      ],
      "negative": [
        "54:11",
        1
      ],
      "vae": [
        "54:1",
        0
      ],
      "latent": [
        "54:10",
        0
      ],
      "image": [
        "54:41",
        0
      ]
    },
    "class_type": "LTXAddVideoICLoRAGuide",
    "_meta": {
      "title": "🅛🅣🅧 Add Video IC-LoRA Guide"
    }
  },
  "54:14": {
    "inputs": {
      "lora_name": "ltx-2.3-22b-distilled-lora-384-1.1.safetensors",
      "strength_model": 0.4,
      "model": [
        "54:15",
        0
      ]
    },
    "class_type": "LoraLoaderModelOnly",
    "_meta": {
      "title": "Load LoRA"
    }
  },
  "54:15": {
    "inputs": {
      "lora_name": "ltx23-obscura_remova.safetensors",
      "strength_model": 2,
      "model": [
        "54:5",
        0
      ]
    },
    "class_type": "LoraLoaderModelOnly",
    "_meta": {
      "title": "Load LoRA"
    }
  },
  "54:16": {
    "inputs": {
      "samples": [
        "54:17",
        2
      ],
      "vae": [
        "54:1",
        0
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE Decode"
    }
  },
  "54:17": {
    "inputs": {
      "positive": [
        "54:12",
        0
      ],
      "negative": [
        "54:12",
        1
      ],
      "latent": [
        "54:18",
        0
      ]
    },
    "class_type": "LTXVCropGuides",
    "_meta": {
      "title": "LTXVCropGuides"
    }
  },
  "54:18": {
    "inputs": {
      "av_latent": [
        "54:19",
        0
      ]
    },
    "class_type": "LTXVSeparateAVLatent",
    "_meta": {
      "title": "Separate AV Latent"
    }
  },
  "54:19": {
    "inputs": {
      "seed": 1086065193067454,
      "steps": 8,
      "cfg": 1,
      "sampler_name": "euler_ancestral_cfg_pp",
      "scheduler": "linear_quadratic",
      "denoise": 1,
      "model": [
        "54:14",
        0
      ],
      "positive": [
        "54:12",
        0
      ],
      "negative": [
        "54:12",
        1
      ],
      "latent_image": [
        "54:20",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "KSampler"
    }
  },
  "54:20": {
    "inputs": {
      "video_latent": [
        "54:12",
        2
      ],
      "audio_latent": [
        "54:21",
        0
      ]
    },
    "class_type": "LTXVConcatAVLatent",
    "_meta": {
      "title": "Concat AV Latent"
    }
  },
  "54:21": {
    "inputs": {
      "frames_number": [
        "54:45",
        1
      ],
      "frame_rate": [
        "54:50",
        0
      ],
      "batch_size": 1,
      "audio_vae": [
        "54:2",
        0
      ]
    },
    "class_type": "LTXVEmptyLatentAudio",
    "_meta": {
      "title": "Empty LTXV Latent Audio"
    }
  },
  "54:22": {
    "inputs": {
      "text": "blurry, low resolution, ugly, garbled mess, compression artifacts, glitch, stop motion, still image, pixelated, robotic voice, oversaturated",
      "clip": [
        "54:4",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "54:25": {
    "inputs": {
      "batch_index": 0,
      "length": 1,
      "image": [
        "54:41",
        0
      ]
    },
    "class_type": "ImageFromBatch",
    "_meta": {
      "title": "Get Image from Batch"
    }
  },
  "54:36": {
    "inputs": {
      "fps": [
        "54:49",
        0
      ],
      "bit_depth": "auto",
      "color_space": "sRGB",
      "codec": "none",
      "images": [
        "54:16",
        0
      ],
      "audio": [
        "54:38",
        1
      ]
    },
    "class_type": "CreateVideo",
    "_meta": {
      "title": "Create Video"
    }
  },
  "54:38": {
    "inputs": {
      "video": [
        "39",
        0
      ]
    },
    "class_type": "GetVideoComponents",
    "_meta": {
      "title": "Get Video Components"
    }
  },
  "54:41": {
    "inputs": {
      "resize_type": "scale dimensions",
      "resize_type.width": 1280,
      "resize_type.height": 704,
      "resize_type.crop": "disabled",
      "scale_method": "area",
      "input": [
        "54:38",
        0
      ]
    },
    "class_type": "ResizeImageMaskNode",
    "_meta": {
      "title": "Resize Image/Mask (s1 size)"
    }
  },
  "54:45": {
    "inputs": {
      "expression": "(int((a - 1) / 8)) * 8 + 1",
      "values.a": [
        "54:3",
        0
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "Math Expression"
    }
  },
  "54:49": {
    "inputs": {
      "value": [
        "54:50",
        0
      ]
    },
    "class_type": "ComfyNumberConvert",
    "_meta": {
      "title": "Convert Number"
    }
  },
  "54:50": {
    "inputs": {
      "value": 25
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "fps"
    }
  }
};
