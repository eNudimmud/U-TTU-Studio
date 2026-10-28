// Generated from the official Comfy templates (api format read from Comfy Cloud, 2026-10-18).
// Preview and comparison nodes removed; one save node kept. Do not edit by hand.

import type { ApiGraph } from "../render/take-graph.ts";
import { GENJUTSU_BASE } from "./genjutsu-base.ts";

export const OUTIL_BASES: Record<string, ApiGraph> = {
 api_higgsfield_genjutsu_motion_transfer: GENJUTSU_BASE,
 "image_qwen_image_2_1_t2i": {
  "13": {
   "inputs": {
    "aspect_ratio": "1:1 (Square)",
    "megapixels": 1,
    "multiple": 8,
    "preview": ""
   },
   "class_type": "ResolutionSelector",
   "_meta": {
    "title": "Resolution Selector"
   }
  },
  "461": {
   "inputs": {
    "filename_prefix": "Qwen_image_2.1",
    "format": "png",
    "format.bit_depth": "8-bit",
    "format.input_color_space": "sRGB",
    "images": [
     "459:457",
     0
    ]
   },
   "class_type": "SaveImageAdvanced",
   "_meta": {
    "title": "Save Image (Advanced)"
   }
  },
  "459:451": {
   "inputs": {
    "unet_name": "qwen_image_2.1_int8_convrot.safetensors",
    "weight_dtype": "default"
   },
   "class_type": "UNETLoader",
   "_meta": {
    "title": "Load Diffusion Model"
   }
  },
  "459:452": {
   "inputs": {
    "negative_prompt": "",
    "resolution": 1024,
    "clip": [
     "459:453",
     0
    ],
    "prompt": [
     "459:472",
     0
    ]
   },
   "class_type": "TextEncodeQwenImage21",
   "_meta": {
    "title": "Text Encode Qwen Image 2.1"
   }
  },
  "459:453": {
   "inputs": {
    "clip_name": "qwen3vl_8b_int8_convrot.safetensors",
    "type": "qwen_image",
    "device": "default"
   },
   "class_type": "CLIPLoader",
   "_meta": {
    "title": "Load CLIP"
   }
  },
  "459:454": {
   "inputs": {
    "vae_name": "qwen_image_2.1_vae_bf16.safetensors"
   },
   "class_type": "VAELoader",
   "_meta": {
    "title": "Load VAE"
   }
  },
  "459:456": {
   "inputs": {
    "width": [
     "13",
     0
    ],
    "height": [
     "13",
     1
    ],
    "batch_size": 1
   },
   "class_type": "EmptyLatentImage",
   "_meta": {
    "title": "Empty Latent Image"
   }
  },
  "459:457": {
   "inputs": {
    "samples": [
     "459:458",
     0
    ],
    "vae": [
     "459:454",
     0
    ]
   },
   "class_type": "VAEDecode",
   "_meta": {
    "title": "VAE Decode"
   }
  },
  "459:458": {
   "inputs": {
    "seed": 447606998181262,
    "steps": 25,
    "cfg": 1,
    "sampler_name": "euler",
    "scheduler": "simple",
    "denoise": 1,
    "model": [
     "459:480",
     0
    ],
    "positive": [
     "459:452",
     0
    ],
    "negative": [
     "459:452",
     1
    ],
    "latent_image": [
     "459:456",
     0
    ]
   },
   "class_type": "KSampler",
   "_meta": {
    "title": "KSampler"
   }
  },
  "459:471": {
   "inputs": {
    "prompt": "Greyscale fashion editorial portrait of an avant-garde woman tilted upwards in profile, captured with striking high-contrast chiaroscuro lighting. She wears oversized, thick-rimmed circular black sunglasses with matte dark lenses, concealing her upward gaze. Her attire merges high couture with tactical abstraction: a high-necked structural dress tailored from heavyweight fabric featuring a disrupted optical camouflage pattern—interlocking oversized polka dots, pixelated stippling, and organic contour blotches in stark monochrome that mimic military disruptive patterns in a refined runway style. Around her shoulders, asymmetric pleated webbing and tailored cargo straps are integrated seamlessly into the garment’s architecture. In her gloved hand, she clutches a structured matte-leather geometric handbag accented with subtle tactical buckles, utility stitching, and dark brushed-metal hardware. Her skin texture is rendered with hyper-detailed clarity, sculpted by intense, razor-sharp studio key light and deep graphite shadows. The striking background is a vivid mixed-media graphic collage, composed of flat vibrant lime green planes, stark black and white overlapping circles, segmented semi-circles with bold zebra striping, dense micro-halftone dot matrices, and vector topographic contour lines. The clash between monochromatic disruptive camo elements on her clothing and the saturated, retro-futuristic pop-art backdrop creates an intense visual dissonance, emphasizing sharp silhouettes, paper cut-out edges, dynamic compositional balance, and clean graphic novel textures. Absolutely no text, no typography, no letters, no words, no numbers, no logos, no watermark, no captions, pure imagery only.",
    "max_length": 4096,
    "sampling_mode": "on",
    "sampling_mode.temperature": 1,
    "sampling_mode.top_k": 20,
    "sampling_mode.top_p": 0.95,
    "sampling_mode.min_p": 0,
    "sampling_mode.repetition_penalty": 1,
    "sampling_mode.seed": 447606998181262,
    "sampling_mode.presence_penalty": 1.5,
    "thinking": false,
    "use_default_template": true,
    "mtp": "auto",
    "clip": [
     "459:473",
     0
    ],
    "system_prompt": [
     "459:475",
     0
    ]
   },
   "class_type": "TextGenerate",
   "_meta": {
    "title": "Generate Text"
   }
  },
  "459:472": {
   "inputs": {
    "preview_markdown": "",
    "preview_text": "",
    "previewMode": "",
    "source": [
     "459:474",
     0
    ]
   },
   "class_type": "PreviewAny",
   "_meta": {
    "title": "Preview as Text"
   }
  },
  "459:473": {
   "inputs": {
    "clip_name": "qwen3.5_9b_qwen_image_2.1_pe_t2i.int8_convrot.safetensors",
    "type": "stable_diffusion",
    "device": "default"
   },
   "class_type": "CLIPLoader",
   "_meta": {
    "title": "Load CLIP"
   }
  },
  "459:474": {
   "inputs": {
    "switch": false,
    "on_true": [
     "459:471",
     0
    ],
    "on_false": "Greyscale fashion editorial portrait of an avant-garde woman tilted upwards in profile, captured with striking high-contrast chiaroscuro lighting. She wears oversized, thick-rimmed circular black sunglasses with matte dark lenses, concealing her upward gaze. Her attire merges high couture with tactical abstraction: a high-necked structural dress tailored from heavyweight fabric featuring a disrupted optical camouflage pattern—interlocking oversized polka dots, pixelated stippling, and organic contour blotches in stark monochrome that mimic military disruptive patterns in a refined runway style. Around her shoulders, asymmetric pleated webbing and tailored cargo straps are integrated seamlessly into the garment’s architecture. In her gloved hand, she clutches a structured matte-leather geometric handbag accented with subtle tactical buckles, utility stitching, and dark brushed-metal hardware. Her skin texture is rendered with hyper-detailed clarity, sculpted by intense, razor-sharp studio key light and deep graphite shadows. The striking background is a vivid mixed-media graphic collage, composed of flat vibrant lime green planes, stark black and white overlapping circles, segmented semi-circles with bold zebra striping, dense micro-halftone dot matrices, and vector topographic contour lines. The clash between monochromatic disruptive camo elements on her clothing and the saturated, retro-futuristic pop-art backdrop creates an intense visual dissonance, emphasizing sharp silhouettes, paper cut-out edges, dynamic compositional balance, and clean graphic novel textures. Absolutely no text, no typography, no letters, no words, no numbers, no logos, no watermark, no captions, pure imagery only."
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "If/Else Switch"
   }
  },
  "459:475": {
   "inputs": {
    "value": "# Image Prompt Rewriting Expert\n\nYou turn a user's image request into one long English paragraph that describes the\nfinished image as if you were looking at it, plus the aspect ratio it should be\nrendered at. You are not talking to the user and not talking to a renderer: you are\nan observer reporting what is in the frame.\n\nWork through the eight steps below in order. Each step commits one decision; later\nsteps never revise an earlier one.\n\n## Step 1 — Read the brief and split it in two\n\nList what the user has fixed and what they have left open.\n\nFixed, and it must survive into your description unchanged: every string of text\nthey want shown, every named object, every count, every stated colour, every stated\nposition, and the aspect ratio if they gave one. Copy their text strings character\nfor character, in their own script, including punctuation and spacing.\n\nA third thing they may give you is an instruction about the job rather than about the\npicture — \"use double quotes\", \"no hard-edged blocks\", \"4K, no noise\", \"make sure the\ntext is sharp\". That is not content. Obey it silently where it applies and never echo\nit: the description states what is in the frame, never what must be done.\n\nOpen, and you must decide it: everything they did not mention. A three-word request\nand a three-hundred-word request both become a description of the same size, so a\nshort brief means you are inventing most of the frame, not writing less.\n\n## Step 2 — Fix the frame\n\nDecide the orientation from the subject, then pick the ratio.\n\nIf the user states a ratio, use it. Otherwise: `3:2` for anything horizontal and\n`2:3` for anything vertical — these are the two defaults and cover most images.\nUse `1:1` for a square badge, icon, album cover or single centred emblem, `16:9`\nfor a wide cinematic or presentation frame, `1:2` or `9:16` for a phone screen or a\ntall standing banner. `3:4`, `2:1`, `21:9`, `4:3`, `9:21`, `4:5`, `3:1`, `5:4`,\n`1:3` exist but only when the subject or the user really calls for them.\n\nThe ratio lives only in the `wh_ratio` field. Never write a ratio, a resolution, or\na pixel count into the description itself.\n\n## Step 3 — Write the opening sentence\n\nOne sentence, around twenty words. Name the medium, the style, the subject, and the\nbackground or palette; usually name the orientation too:\n\n`The image is a ⟨vertical / wide / square / tall⟩ ⟨style⟩ ⟨photograph · poster · illustration · scene · portrait · infographic · close-up · graphic · page · card · sheet · logo⟩ of ⟨subject⟩, ⟨the background and its palette⟩.`\n\n`This is a …` or a bare `A vertical realistic photograph of …` work equally well. The\nmedium noun is the one part that is never omitted.\n\nThe style word goes here — realistic, photorealistic, minimalist, flat-vector,\ncinematic, watercolour, isometric, editorial, hand-drawn, 3D-rendered, retro. Name\nit once here; you may echo it in the closing sentence.\n\n## Step 4 — Inventory before you write\n\nBefore any more prose, settle two lists.\n\nEvery element that will appear, each with a place in the frame: upper-left,\nacross the top, on the far right, in the lower-third, in the centre, in front of,\nbehind, tucked into the corner. You will need eight to fourteen such positional\nphrases, about ten typically, and they must reach the corners, the edges and the\ncentre — not cluster in the middle.\n\nEvery piece of text that will be legible in the image, in reading order.\n\n## Step 5 — Walk the frame\n\nNow describe it in order. Which order depends on how the frame is filled.\n\n**If the frame is divided into regions** — a poster, a page, an interface, a layout, a\nwide scene with several things in it — walk the regions:\n\n1. The background and the surface it sits on — this comes immediately after the\n   opening sentence, not at the end.\n2. The top band: headline, header bar, sky, ceiling, whatever occupies the top edge.\n3. Down and across the body of the frame: left side, then centre, then right side.\n   Give each region one or two sentences.\n4. The bottom band: footer, foreground, ground plane, base row.\n\n**If one subject fills the frame** — a portrait, a close-up, a single object — walk\nthe subject instead: the background and how far it falls off, then the subject's pose\nand where it is placed in the frame, then head and face, then body and each garment or\nsurface, then what is held or touching it, then whatever little is left at the edges.\nKeep using positional phrases inside the subject — in the upper-left of the frame,\nbehind the left shoulder, along the lower edge — so the frame stays locatable.\n\nRoughly a third of your sentences should open on the positional phrase itself —\n\"On the right side of the frame, …\", \"In the upper-left corner, …\", \"Across the\nlower third, …\" — so the reader always knows where they are looking.\n\nKeep it to one paragraph. Break to a new paragraph only when the image is genuinely\nbuilt from stacked regions — panels, cards, sections, slides — and then one\nparagraph per region, each opening on where that region sits.\n\n## Step 6 — Set every piece of text\n\nSkip this step if nothing in the image is meant to be read — a third of images have\nno legible text at all, and inventing signage for them is a mistake.\n\nOtherwise, for each string from your Step 4 list, in reading order, name where it sits,\nwhat it looks like, and what it says: `a bold black headline across the top reads \"…\"`.\n\nPut the string in straight double quotes, in its own script — Chinese, Russian,\nKorean, Japanese and Arabic text stays in Chinese, Russian, Korean, Japanese and\nArabic. Give its weight, colour, case and relative size. Describe a line break as a\nsecond line rather than putting a real newline inside the string. If a mark is not meant\nto be read — distant signage, a label behind glass, dense body copy — call it\nblurred, indistinct, or too small to read rather than inventing letters. If the image contains a chart\nor a table, its axes, tick labels, legend entries, series and cell values are text\ntoo: write them out.\n\n## Step 7 — Give the lighting its own sentence\n\nEvery image has light in it, and the description always accounts for it: the source,\nits direction, its quality, and the shadows and highlights it leaves. Soft diffused\ndaylight from a window on the left, hard overhead studio light, warm low sun, flat\neven ambient light for a diagram.\n\nOnce the contents are placed, give it a sentence of its own — `The lighting is …` —\nor, if the light is what makes a particular surface look the way it does, fold it into\nthat surface's sentence. Either way it is stated explicitly, not left implied.\n\n## Step 8 — Close with the whole frame\n\nEnd on a single sentence that steps back:\n\n`The overall composition ⟨is / uses / feels⟩ …`\n\n`The composition is …`, `The overall design …`, `The overall mood …`, `The overall\npalette …` and `The image has …` are the same move. Cover balance and symmetry, the\npalette, the style, and the mood in that one sentence. Write exactly one such\nsentence — do not follow it with a second summary.\n\n## Throughout\n\n**Size.** The description runs about twenty sentences and four to five hundred words,\nroughly twenty-five words a sentence. That is the same size whether the brief was three\nwords or three hundred: a dense frame with many regions and a lot of text runs longer, a\nsingle quiet subject runs shorter, but a thin brief never buys a thin description.\n\n**Observe, don't instruct.** Present tense, third person, declarative. No \"you\", no\n\"create\", no \"make sure\", no \"the AI should\". No quality boosters — no \"masterpiece\",\n\"8K\", \"highly detailed\", \"award-winning\".\n\n**Hedge what you cannot be certain of.** An observer describing a picture says\n\"appears to be\", \"likely\", \"suggesting\", and offers a pair — \"a notebook\nor a tablet\", \"wood or dark laminate\" — when the thing is genuinely ambiguous. Do\nthis often; it is the natural register here. Be flatly definite only about what the\nuser fixed.\n\n**Name colours with a modifier, almost never bare.** Deep navy, muted olive, pale\ncream, warm terracotta, soft dusty rose, blue-grey, off-white, charcoal, brownish-\ngreen. Hex codes only if the user gave them.\n\n**Give the material, not just the noun.** Brushed metal, matte plastic, glossy\nceramic, coarse linen, weathered wood, frosted glass, grain, scuffs, condensation,\nvisible brush strokes, paper fibre.\n\n**Enumerate; never summarise.** \"Several items\" and \"various decorations\" are not\ndescriptions. Say what each thing is. Write small counts as words — three, five,\ntwelve — and if something is partly hidden, say so and describe the visible part.\n\n**People get their observable surface.** Build, posture, where they are looking,\nexpression, hair, skin tone, and each garment with its colour and material. Age is a\nlife stage or a decade — a child, a teenager, a young adult, middle-aged, elderly,\nin her thirties — never a number of years. If a face is turned away or cropped, say\nthat instead of describing it.\n\n**Objects by class, not by brand.** A silver laptop, a mirrorless camera, a compact\nhatchback — unless the user named the brand. Photographic and design vocabulary is\nwelcome: shallow depth of field, bokeh, backlit, close-up, negative space,\ngrid, drop shadow.\n\n**Everything holds together physically.** Shadows fall away from the light, reflections\nmatch what is in front of the surface, scale is consistent between neighbouring\nobjects, and a surface reacts to what sits on it. If the user asked for something\nimpossible, describe it as the image shows it and let the rest of the scene stay\ncoherent around it.\n\n## Language\n\nThe description is always in English, whatever language the request arrives in. The\nonly exception is text shown inside the image, which stays in its own script.\n\n## Output format\n\n- Return the description and nothing else: one continuous paragraph of English, in a single line\nstarting on the very first character of your reply.\n- No JSON, no braces, no key names, no labels, no headings, no markdown, no code fences, and no quotation marks around the paragraph.\n- No preamble, no acknowledgement, no explanation, no summary, no notes, no closing remarks, no questions.\n- No ratio, no resolution, no pixel count, no timestamps.\n\nYour whole reply is used as the image prompt, so every extra word you add becomes part of the image.\n"
   },
   "class_type": "PrimitiveStringMultiline",
   "_meta": {
    "title": "Text (System Prompt)"
   }
  },
  "459:480": {
   "inputs": {
    "device": "auto",
    "dtype": "default",
    "model": [
     "459:451",
     0
    ]
   },
   "class_type": "QwenImage21Cache",
   "_meta": {
    "title": "Qwen Image 2.1 Cache"
   }
  }
 },
 "api_bfl_flux3_t2i": {
  "1": {
   "inputs": {
    "prompt": "close-up of a race car driver inside a silver vintage sports car, driver wearing a red helmet with a white cross, intense focused expression, car exterior with vivid blue and red racing stripes and a solid white circular graphic on the door, viewed through the side window, intense golden hour sunlight, glowing lens flare reflecting off the glass, shallow depth of field, cinematic automotive photography, warm rich color palette, blurred abstract background Absolutely no text, no typography, no letters, no words, no numbers, no logos, no watermark, no captions, pure imagery only.",
    "aspect_ratio": "auto",
    "resolution": "1K",
    "grounding": true,
    "safety_tolerance": 4,
    "seed": 396545587
   },
   "class_type": "Flux3ImageNode",
   "_meta": {
    "title": "Flux 3 Image"
   }
  },
  "2": {
   "inputs": {
    "filename_prefix": "FLUX_3_Image",
    "format": "png",
    "format.bit_depth": "8-bit",
    "format.input_color_space": "sRGB",
    "images": [
     "1",
     0
    ]
   },
   "class_type": "SaveImageAdvanced",
   "_meta": {
    "title": "Save Image (Advanced)"
   }
  }
 },
 "api_ideogram_v4_5_t2i": {
  "1": {
   "inputs": {
    "model": "ideogram-4.5",
    "model.prompt": "A square 1:1 magazine poster cover in a refined classical art collage style. Background is warm ivory textured paper with subtle grain, speckles, and a vintage print feel. At the center stands a blindfolded classical Greek marble statue bust of a serene woman with softly waved hair and flowing draped fabric over her shoulders, rendered in a black-and-white halftone dot print effect with fine engraved-line detailing and high contrast. Behind her, two fainter mirrored marble goddess heads peek out from layered torn paper pieces in deep midnight navy and muted antique gold, with rough ripped edges and delicate dripping paint streaks that melt downward. The large, elegant high-contrast serif headline \"Ideogram 4.5\" dominates the top of the layout. \"Ideogram\" is set in charcoal black and \"4.5\" in metallic antique gold, with the statue's head slightly overlapping the letters to create depth. Above the headline, small centered serif text reads \"HER VOICE WAS CARVED IN STONE / ONLY THE LIGHT REMEMBERS WHAT SHE SPOKE\". A vertical gold caption on the left reads \"A VISUAL ARTWORK\", and a vertical caption on the right reads \"DESIGNED BY IDEOGRAM 4.5\". At the lower left, a navy block holds large cream serif text reading \"ETERNAL MUSE\". Small four-pointed gold star sparkles sit in the corners. The composition is balanced and symmetrical, like a museum exhibition poster, and evokes an editorial luxury magazine cover. The palette is ivory, charcoal, navy, and gold only, with no red tones. The mood is timeless, poetic, and artistic, with soft studio lighting, crisp typography, and high detail.",
    "model.size": "auto",
    "model.quality": "medium",
    "model.magic_prompt": "auto",
    "model.seed": 388697105
   },
   "class_type": "IdeogramTextToImageApi",
   "_meta": {
    "title": "Ideogram 4.5 Text to Image"
   }
  },
  "5": {
   "inputs": {
    "filename_prefix": "Ideogram4.5_t2i",
    "format": "png",
    "format.bit_depth": "8-bit",
    "format.input_color_space": "sRGB",
    "images": [
     "1",
     0
    ]
   },
   "class_type": "SaveImageAdvanced",
   "_meta": {
    "title": "Save Image (Advanced)"
   }
  }
 },
 "api_openai_gpt_image_2_t2i": {
  "269": {
   "inputs": {
    "filename_prefix": "gpt-image-2",
    "images": [
     "271",
     0
    ]
   },
   "class_type": "SaveImage",
   "_meta": {
    "title": "Save Image"
   }
  },
  "271": {
   "inputs": {
    "prompt": "An extreme close-up, high-contrast portrait of a woman's face, partially obscured by deep black shadows. The word 'GPT IMAGE 2' is projected onto her face in brilliant, glowing orange neon light, with the text cutting directly across her eye and eyelashes. The image is designed as a futuristic poster with a vertical sidebar on the right containing graphic UI elements, technical symbols, a barcode, and minimalist typography. The overall color palette is dominated by intense red and black, capturing a moody, cinematic, and emotionally raw cyberpunk aesthetic, with professional graphic design overlays. The side bar text is promoting that it's Live in ComfyUI",
    "model": "gpt-image-2",
    "model.size": "auto",
    "model.custom_width": 1024,
    "model.custom_height": 1024,
    "model.background": "auto",
    "model.quality": "low",
    "n": 1,
    "seed": 0
   },
   "class_type": "OpenAIGPTImageNodeV2",
   "_meta": {
    "title": "OpenAI GPT Image 2.5"
   }
  }
 },
 "api_bytedance_seedream_5_0_pro_t2i": {
  "2": {
   "inputs": {
    "filename_prefix": "Seedream5.0_Pro_T2I",
    "format": "png",
    "format.bit_depth": "8-bit",
    "format.input_color_space": "sRGB",
    "images": [
     "3",
     0
    ]
   },
   "class_type": "SaveImageAdvanced",
   "_meta": {
    "title": "Save Image (Advanced)"
   }
  },
  "3": {
   "inputs": {
    "prompt": "A sci-fi cyberpunk graphic design poster. In the center, a striking portrait of a female android with glossy, liquid chrome skin. A vivid swirling streak of neon orange, yellow, and pink liquid paint brush stroke horizontally covers her eyes, soft smudged color overlay with smooth flowing pigment texture, no cracks or broken facial surfaces. The background is a dark, textured charcoal gray. Behind the central figure, large bold white futuristic typography reads \"Seedream 5.0 Pro\" with a subtle digital glitch and halftone texture. The composition is decorated with technical HUD elements, thin white lines, geometric wireframe diagrams, barcodes, and small sci-fi text boxes. Semi-transparent glassy spheres with grid textures overlap the foreground, creating depth. The overall mood is high-tech, dystopian, and avant-garde.",
    "model": "seedream 5.0 pro",
    "model.size_preset": "(1K) 1024x1024 (1:1)",
    "model.width": 2048,
    "model.height": 2048,
    "model.prompt_optimization": "standard",
    "model.seed": 42,
    "model.watermark": false,
    "model.thinking": true
   },
   "class_type": "ByteDanceSeedreamNodeV3",
   "_meta": {
    "title": "ByteDance Seedream 4.5 & 5.0"
   }
  }
 },
 "api_nano_banana_2_1_t2i": {
  "1": {
   "inputs": {
    "prompt": "Create an original high-fashion experimental poster for the image model Nano Banana 2.1. Square composition, pure black background.\nPlace one large, unmistakable ripe yellow banana at the center. Show its complete curved silhouette from stem to tip, with a natural peel, subtle brown details, and realistic texture. The banana is the hero object and occupies much of the frame.\nSurround it with only a few oversized transparent glass lenses and polished liquid-chrome forms. Use striking refractions and sharp reflections, but keep the banana’s entire shape easy to recognize. Dramatic studio lighting, deep blacks, bright highlights, premium 3D fashion-campaign finish.\nMake the typography bold, graphic, and impossible to miss. Use solid bright-white letterforms with substantial weight, clean edges, and strong contrast against the black background. Avoid thin, delicate, outlined, or hairline fonts.\n“NANO” sits across the upper area in oversized, heavy geometric capitals. Space the letters deliberately and vary their placement slightly for an editorial rhythm.\n“BANANA” is the dominant typographic statement across the middle: very large, extra-bold condensed italic sans-serif, with tightly controlled spacing and a confident forward slant. Give it the impact of a luxury fashion masthead. Let it cross the composition, but position it so the banana remains visually clear; use selective layering where the banana passes in front of a small portion of the letters. Every letter must still be readable.\n“2.1” appears once, large and heavy in the lower right. Align it precisely with the poster’s edges to anchor the composition.\nThe three elements must immediately read together as NANO BANANA 2.1. Create hierarchy through contrasting scale, weight, spacing, and alignment. Let one or two glass elements overlap small areas of the typography without obscuring any word.\nAdd only two small editorial labels, each appearing once: “IMAGE” and “IMAGINATION”. Set them in crisp, legible type beside a few thin white rules and precise graphic markers. No repeated small text or filler writing.\nPalette: pure black, bright white, banana yellow, transparent glass, and restrained chrome. Contemporary, glossy, bold, fashion-forward, and visually striking. Render all specified text exactly. No quotation marks, extra words, logos, or watermarks.",
    "model": "Gemini Nano Banana 2.1",
    "model.aspect_ratio": "auto",
    "model.resolution": "1K",
    "model.thinking_level": "MEDIUM",
    "seed": 806403384898350,
    "response_modalities": "IMAGE",
    "system_prompt": "You are an expert image-generation engine. You must ALWAYS produce an image.\nInterpret all user input—regardless of format, intent, or abstraction—as literal visual directives for image composition.\nIf a prompt is conversational or lacks specific visual details, you must creatively invent a concrete visual scenario that depicts the concept.\nPrioritize generating the visual representation above any text, formatting, or conversational requests.",
    "temperature": 1,
    "top_p": 0.95
   },
   "class_type": "GeminiNanoBanana2V2",
   "_meta": {
    "title": "Nano Banana 2.1"
   }
  },
  "3": {
   "inputs": {
    "filename_prefix": "Nano_Banana_2.1",
    "format": "png",
    "format.bit_depth": "8-bit",
    "format.input_color_space": "sRGB",
    "images": [
     "1",
     0
    ]
   },
   "class_type": "SaveImageAdvanced",
   "_meta": {
    "title": "Save Image (Advanced)"
   }
  }
 },
 "image_qwen_image_2_1_image_edit": {
  "461": {
   "inputs": {
    "filename_prefix": "Qwen_image_2.1",
    "format": "png",
    "format.bit_depth": "8-bit",
    "format.input_color_space": "sRGB",
    "images": [
     "459:457",
     0
    ]
   },
   "class_type": "SaveImageAdvanced",
   "_meta": {
    "title": "Save Image (Advanced)"
   }
  },
  "470": {
   "inputs": {
    "image": "portrait_model_denim.png"
   },
   "class_type": "LoadImage",
   "_meta": {
    "title": "Load Image"
   }
  },
  "475": {
   "inputs": {
    "image": "clothing_light_blue_denim_shirt.png"
   },
   "class_type": "LoadImage",
   "_meta": {
    "title": "Load Image"
   }
  },
  "459:451": {
   "inputs": {
    "unet_name": "qwen_image_2.1_int8_convrot.safetensors",
    "weight_dtype": "default"
   },
   "class_type": "UNETLoader",
   "_meta": {
    "title": "Load Diffusion Model"
   }
  },
  "459:453": {
   "inputs": {
    "clip_name": "qwen3vl_8b_int8_convrot.safetensors",
    "type": "qwen_image",
    "device": "default"
   },
   "class_type": "CLIPLoader",
   "_meta": {
    "title": "Load CLIP"
   }
  },
  "459:454": {
   "inputs": {
    "vae_name": "qwen_image_2.1_vae_bf16.safetensors"
   },
   "class_type": "VAELoader",
   "_meta": {
    "title": "Load VAE"
   }
  },
  "459:456": {
   "inputs": {
    "width": 1024,
    "height": 1024,
    "batch_size": 1
   },
   "class_type": "EmptyLatentImage",
   "_meta": {
    "title": "Empty Latent Image"
   }
  },
  "459:457": {
   "inputs": {
    "samples": [
     "459:458",
     0
    ],
    "vae": [
     "459:454",
     0
    ]
   },
   "class_type": "VAEDecode",
   "_meta": {
    "title": "VAE Decode"
   }
  },
  "459:458": {
   "inputs": {
    "seed": 891836227295375,
    "steps": 25,
    "cfg": 1,
    "sampler_name": "euler",
    "scheduler": "simple",
    "denoise": 1,
    "model": [
     "459:469",
     0
    ],
    "positive": [
     "459:474",
     0
    ],
    "negative": [
     "459:474",
     1
    ],
    "latent_image": [
     "459:468",
     0
    ]
   },
   "class_type": "KSampler",
   "_meta": {
    "title": "KSampler"
   }
  },
  "459:468": {
   "inputs": {
    "switch": false,
    "on_false": [
     "459:474",
     2
    ],
    "on_true": [
     "459:456",
     0
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "If/Else Switch"
   }
  },
  "459:469": {
   "inputs": {
    "device": "auto",
    "dtype": "default",
    "model": [
     "459:451",
     0
    ]
   },
   "class_type": "QwenImage21Cache",
   "_meta": {
    "title": "Qwen Image 2.1 Cache"
   }
  },
  "459:474": {
   "inputs": {
    "negative_prompt": "",
    "resolution": 0,
    "images.image_1": [
     "470",
     0
    ],
    "images.image_2": [
     "475",
     0
    ],
    "clip": [
     "459:453",
     0
    ],
    "vae": [
     "459:454",
     0
    ],
    "prompt": [
     "459:480",
     0
    ]
   },
   "class_type": "TextEncodeQwenImage21",
   "_meta": {
    "title": "Text Encode Qwen Image 2.1"
   }
  },
  "459:477": {
   "inputs": {
    "clip_name": "qwen3.5_9b_qwen_image_2.1_pe_i2i.int8_convrot.safetensors",
    "type": "qwen_image",
    "device": "default"
   },
   "class_type": "CLIPLoader",
   "_meta": {
    "title": "Load CLIP"
   }
  },
  "459:479": {
   "inputs": {
    "value": "# Edit Prompt Enhancer — General (v2, 精简版)\n\n**FIRST — there are TWO separate language decisions. Do NOT conflate them.**\n\n**(A) Language of the rewritten prompt's DESCRIPTIVE prose — every word OUTSIDE double quotes (the description you write for the diffusion model, NOT the text painted into the image). This decision is final and non-negotiable:**\n- User instruction is in Chinese → write the description in Chinese.\n- User instruction is in English → write the description in English.\n- User instruction is in ANY other language (Japanese, Korean, French, Spanish, Thai, etc.) → write the description in English.\n\n**(B) Language of the TEXT THAT WILL BE RENDERED INTO THE OUTPUT IMAGE — the content INSIDE double quotes. Decide it in this strict priority order:**\n1. If the user's instruction gives the exact text to write, OR names a target language for the text (e.g. \"改成'夏日特惠'\", \"把标题写成英文\", \"add a Japanese title\", \"write the caption in Thai\") → render exactly that text / in exactly that specified language.\n2. Otherwise, if the input image already contains text → render in the DOMINANT language of the image's existing text — even when the instruction is written in a different language.\n3. Otherwise (the image contains no text AND the instruction names no target language) → render in the language of the user's instruction itself — including Japanese, Korean, Thai, Arabic, French, etc. Do NOT force it to English.\nWorked example: image is mostly Thai, instruction is in English asking to add/redesign a title without giving the exact words or a language → the rendered (quoted) text must be **Thai** (the image's dominant language), while the surrounding description (A) is still written in English.\n\nTwo reinforcements on decision (B): all rendered (quoted) text must be **monolingual** — do not mix Chinese and English inside the quotes and do not emit a bilingual pair unless the user explicitly asks for one. And **genre never overrides input language**: a \"spec sheet / cinematic data-document / storyboard / technical parameter\" look is achieved through layout and typography, NOT by switching rendered labels to English — every header, label, and caption stays in the decided language (standardized units and user-given proper nouns may remain Latin).\n\nYou are an expert at clarifying image editing instructions. Given a user's vague or ambiguous edit instruction and the input image(s), rewrite it into a precise, unambiguous, actionable editing directive. An input image is ALWAYS present — this is always an image-editing task, never text-to-image from nothing.\n\n## Core Objective\n\nRewrite the instruction so a downstream image-editing model can execute it without guessing — anchored on what the input image(s) actually show, faithful to the user's intent, inventing nothing.\n\n**How much you build is intent-branched.** When the user wants *this picture changed* (a local object/attribute/background edit, a text or UI edit, a quality or style change, a viewpoint/canvas transform), clarify and constrain: say exactly what changes, and let everything else stand. When the user wants *a new picture of this subject* (placing a subject in a new scene, compositing across images, a photo-shoot or poster or infographic built from a reference), construct actively: design the scene, lighting, composition and layout to a professional standard. Scale the elaboration to what was asked — a plain placement stays restrained, a styled shoot or a publication-grade poster is built out fully.\n\n## The Governing Principle — Attribute Disentanglement at Full Strength\n\n**Edit exactly the attribute(s) the user named, push each to a strong and unmistakable degree, and hold everything else at input fidelity.**\n\nBoth halves matter, and the two failure modes are symmetric:\n\n- **Leakage** — touching what the user did not name (a sharpen that re-grades color, an upscale that reframes, a style change that drifts a face, an outfit swap that drops an accessory, a background change that \"helpfully\" cleans up something unmentioned).\n- **Under-editing** — an output a viewer could mistake for the unedited input, because the requested change was applied faintly.\n\nPreservation locks **content, never edit strength**. Recognizability is bought by naming what stays fixed, not by holding the effect back.\n\n## What to Anchor, What to Decide\n\n**Anchor on the image.** Every spatial, tonal and contextual claim comes from what is visibly there. If you are unsure a detail exists, leave it out — a preserved element described at a higher level of abstraction is always safer than an invented specific.\n\n**Say what stays, without repainting it.** Name the untargeted content by type, position and role rather than describing its appearance, and prefer one blanket preservation clause over walking the frame. A preservation description reads to the model as a generation instruction: the more concretely you describe something you meant to keep, the more likely it drifts. Describe appearance concretely only for what you are actually changing, or when it is the only way to disambiguate between similar objects.\n\n**Identity is the hardest invariant.** A person's facial identity and the personal accessories that make them recognizable; a product's exact design, markings and count; and the input's rendering medium (photograph, anime, illustration, sketch, 3D render, painting) all survive every edit unless the user explicitly targets them. When identity comes from a reference image, point at that image rather than describing features in words — verbal descriptions make the model regenerate and degrade the likeness.\n\n**Resolve ambiguity, then commit.** Turn vague intent, imprecise spatial reference and unparameterized style words into something concrete and observable. Translate abstract quality language into the visual properties it implies. Where the instruction offers alternatives or contradicts itself, pick the most reasonable reading and state it as a decision. Keep the user's own action verb, spatial relations and described state intact, and treat anything they asked to preserve as absolute. Preserve creative or physically impossible intent rather than correcting it.\n\n**Only what was asked.** Do not add operations the user did not request, and do not clean up unmentioned defects, overlays or clutter however prominent they look. When an edit removes, moves or reveals something, say enough about the newly exposed region that the result stays physically coherent.\n\n**Text in the image is literal.** Whenever readable text will appear in the output, commit to the exact characters — every element, quoted, nothing summarized or abbreviated away. Text you cannot commit to should not be added at all. Match the typography and language the input establishes unless the user asks otherwise. When the operation extends the canvas outward, name it as outpainting explicitly.\n\n**Write it as an instruction.** Lead with the operation, not a description of the finished picture, and write from the perspective of someone holding only the input image(s).\n\n## Thinking Process\n\nBefore emitting the final prompt, reason through: what the image(s) actually contain (including a complete reading of any text present); what the user is asking for and which attributes that names; what must therefore stay fixed; and finally the composed directive. Close with a check that every visible element is either the target of the edit or covered by what stays fixed, that the requested change is unmistakable, that nothing outside the target was touched, and that every quoted string obeys language decision (B).\n\n## Image Reference Rules\n\nFor Multi-Image Input (N >= 2), the rewritten instruction MUST use `<image1>`, `<image2>`, ... to refer to each input image. Do not use natural language references like \"图1\", \"第一张图\", \"the first image\", or \"image A\". This tagging format is mandatory and non-negotiable. For single-image input (N = 1), do NOT use tags — refer to the image naturally (\"图像\", \"图片中\", \"the image\").\n\nState each image's role explicitly — which one is the canvas whose composition and untargeted content survive, and which supply material to transfer — and say what is taken from each. For scene generation with no canvas (合影/合照 and the like), all images serve as identity sources. Describe every referenced image individually; never compress several into a range or a group to avoid describing them one by one.\n\n## Output Format\nOutput ONLY the rewritten editing instruction itself: one single continuous paragraph of plain text.\n\nFormatting rules:\n- The entire rewritten prompt must be a single continuous paragraph with NO line breaks or newline characters.\n- The response must contain nothing except the instruction itself: no object or array wrapper, no field names or key-value pairs, no headings, labels, or prefaces, no greetings, explanations, or commentary, no markdown, and no code fences. Begin with the first word of the instruction and end with its last word.\n- Do not wrap the whole instruction in quotes: double quotes are reserved for text that will be RENDERED in the image (next rule).\n- All text that should appear as visible, readable content in the output image must be enclosed in double quotes (\"\"). Descriptive or structural language that does not appear as rendered text should NOT be quoted.\n- **Never include any resolution or aspect ratio information** (e.g., \"2:3\", \"16:9\", \"1920x1080\", \"2K\", \"4K\"). Output size is decided downstream, not by you.\n- Write it out in full — no ellipsis, no truncation.\n- State requirements affirmatively (\"保持背景与输入图完全一致\") rather than as prohibitions (\"禁止改变背景\"). Standard preservation phrasing \"保持/保留[X]不变\" is fine.\n- Be precise and decisive: no hedging, no unresolved alternatives, no vague degree words left unresolved.\n- The descriptive prose (outside double quotes) follows language decision (A); the text rendered inside the image (inside double quotes) follows language decision (B). Retain proper nouns and domain-specific terms in their original language, placed in English double quotes.\n- **Language-purge self-check (do this last)**: re-scan every double-quoted string — the text that will be RENDERED in the image — and enforce language decision (B). No quoted string may mix Chinese and English, form a bilingual pair, or carry a parenthetical translation gloss unless the user explicitly asked. Standardized units and user-given proper nouns may remain Latin.\n\nThe user's edit instruction to rewrite is:"
   },
   "class_type": "PrimitiveStringMultiline",
   "_meta": {
    "title": "Text (System Prompt)"
   }
  },
  "459:480": {
   "inputs": {
    "preview_markdown": "",
    "preview_text": "",
    "previewMode": "",
    "source": [
     "459:484",
     0
    ]
   },
   "class_type": "PreviewAny",
   "_meta": {
    "title": "Preview as Text"
   }
  },
  "459:484": {
   "inputs": {
    "switch": false,
    "on_true": [
     "459:500",
     0
    ],
    "on_false": "Replace costumes for the character"
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "If/Else Switch"
   }
  },
  "459:485": {
   "inputs": {
    "images.image0": [
     "470",
     0
    ],
    "images.image1": [
     "475",
     0
    ]
   },
   "class_type": "BatchImagesNode",
   "_meta": {
    "title": "Batch Images"
   }
  },
  "459:500": {
   "inputs": {
    "prompt": "Replace costumes for the character",
    "max_length": 4096,
    "sampling_mode": "on",
    "sampling_mode.temperature": 1,
    "sampling_mode.top_k": 20,
    "sampling_mode.top_p": 0.95,
    "sampling_mode.min_p": 0,
    "sampling_mode.repetition_penalty": 1,
    "sampling_mode.seed": 891836227295375,
    "sampling_mode.presence_penalty": 0,
    "thinking": false,
    "use_default_template": true,
    "mtp": "auto",
    "clip": [
     "459:477",
     0
    ],
    "image": [
     "459:485",
     0
    ],
    "system_prompt": [
     "459:479",
     0
    ]
   },
   "class_type": "TextGenerate",
   "_meta": {
    "title": "Generate Text"
   }
  }
 },
 "video_ltx2_5_t2v": {
  "75": {
   "inputs": {
    "filename_prefix": "video/LTX_2.5_t2v",
    "format": "auto",
    "format.codec": "auto",
    "video": [
     "405:370",
     0
    ]
   },
   "class_type": "SaveVideo",
   "_meta": {
    "title": "Save Video"
   }
  },
  "409": {
   "inputs": {
    "aspect_ratio": "16:9 (Widescreen)",
    "megapixels": 0.9,
    "multiple": 32,
    "preview": ""
   },
   "class_type": "ResolutionSelector",
   "_meta": {
    "title": "Resolution Selector"
   }
  },
  "405:370": {
   "inputs": {
    "bit_depth": 8,
    "images": [
     "405:374",
     0
    ],
    "audio": [
     "405:358",
     0
    ],
    "fps": [
     "405:359",
     0
    ]
   },
   "class_type": "CreateVideo",
   "_meta": {
    "title": "Create Video"
   }
  },
  "405:340": {
   "inputs": {
    "video_latent": [
     "405:348",
     0
    ],
    "audio_latent": [
     "405:367",
     1
    ]
   },
   "class_type": "LTXVConcatAVLatent",
   "_meta": {
    "title": "Concat AV Latent"
   }
  },
  "405:395": {
   "inputs": {
    "sigmas": "0.85, 0.7250, 0.4219, 0.0"
   },
   "class_type": "ManualSigmas",
   "_meta": {
    "title": "ManualSigmas"
   }
  },
  "405:348": {
   "inputs": {
    "samples": [
     "405:367",
     0
    ],
    "upscale_model": [
     "405:371",
     0
    ],
    "vae": [
     "405:385",
     0
    ]
   },
   "class_type": "LTXVLatentUpsampler",
   "_meta": {
    "title": "LTXVLatentUpsampler"
   }
  },
  "405:358": {
   "inputs": {
    "samples": [
     "405:369",
     1
    ],
    "audio_vae": [
     "405:386",
     0
    ]
   },
   "class_type": "LTXVAudioVAEDecode",
   "_meta": {
    "title": "LTXV Audio VAE Decode"
   }
  },
  "405:341": {
   "inputs": {
    "sampler_name": "euler_ancestral"
   },
   "class_type": "KSamplerSelect",
   "_meta": {
    "title": "KSamplerSelect"
   }
  },
  "405:391": {
   "inputs": {
    "video_cfg": 1,
    "audio_cfg": 1,
    "model": [
     "405:384",
     0
    ],
    "positive": [
     "405:365",
     0
    ],
    "negative": [
     "405:365",
     1
    ]
   },
   "class_type": "LTXVDualCFGGuider",
   "_meta": {
    "title": "LTXV Dual CFG Guider"
   }
  },
  "405:368": {
   "inputs": {
    "noise": [
     "405:338",
     0
    ],
    "guider": [
     "405:391",
     0
    ],
    "sampler": [
     "405:341",
     0
    ],
    "sigmas": [
     "405:395",
     0
    ],
    "latent_image": [
     "405:340",
     0
    ]
   },
   "class_type": "SamplerCustomAdvanced",
   "_meta": {
    "title": "SamplerCustomAdvanced"
   }
  },
  "405:338": {
   "inputs": {
    "noise_seed": 42
   },
   "class_type": "RandomNoise",
   "_meta": {
    "title": "RandomNoise"
   }
  },
  "405:367": {
   "inputs": {
    "av_latent": [
     "405:344",
     0
    ]
   },
   "class_type": "LTXVSeparateAVLatent",
   "_meta": {
    "title": "Separate AV Latent"
   }
  },
  "405:369": {
   "inputs": {
    "av_latent": [
     "405:368",
     0
    ]
   },
   "class_type": "LTXVSeparateAVLatent",
   "_meta": {
    "title": "Separate AV Latent"
   }
  },
  "405:374": {
   "inputs": {
    "tile_size": 512,
    "overlap": 64,
    "temporal_size": 64,
    "temporal_overlap": 16,
    "samples": [
     "405:369",
     0
    ],
    "vae": [
     "405:385",
     0
    ]
   },
   "class_type": "VAEDecodeTiled",
   "_meta": {
    "title": "VAE Decode (Tiled)"
   }
  },
  "405:344": {
   "inputs": {
    "noise": [
     "405:339",
     0
    ],
    "guider": [
     "405:388",
     0
    ],
    "sampler": [
     "405:352",
     0
    ],
    "sigmas": [
     "405:404",
     0
    ],
    "latent_image": [
     "405:377",
     0
    ]
   },
   "class_type": "SamplerCustomAdvanced",
   "_meta": {
    "title": "SamplerCustomAdvanced"
   }
  },
  "405:404": {
   "inputs": {
    "sigmas": "1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0"
   },
   "class_type": "ManualSigmas",
   "_meta": {
    "title": "ManualSigmas"
   }
  },
  "405:388": {
   "inputs": {
    "video_cfg": 1,
    "audio_cfg": 1,
    "model": [
     "405:384",
     0
    ],
    "positive": [
     "405:365",
     0
    ],
    "negative": [
     "405:365",
     1
    ]
   },
   "class_type": "LTXVDualCFGGuider",
   "_meta": {
    "title": "LTXV Dual CFG Guider"
   }
  },
  "405:352": {
   "inputs": {
    "sampler_name": "euler_ancestral"
   },
   "class_type": "KSamplerSelect",
   "_meta": {
    "title": "KSamplerSelect"
   }
  },
  "405:339": {
   "inputs": {
    "noise_seed": 558811532553686
   },
   "class_type": "RandomNoise",
   "_meta": {
    "title": "RandomNoise"
   }
  },
  "405:365": {
   "inputs": {
    "positive": [
     "405:364",
     0
    ],
    "negative": [
     "405:373",
     0
    ],
    "frame_rate": [
     "405:359",
     0
    ]
   },
   "class_type": "LTXVConditioning",
   "_meta": {
    "title": "LTXVConditioning"
   }
  },
  "405:377": {
   "inputs": {
    "video_latent": [
     "405:356",
     0
    ],
    "audio_latent": [
     "405:366",
     0
    ]
   },
   "class_type": "LTXVConcatAVLatent",
   "_meta": {
    "title": "Concat AV Latent"
   }
  },
  "405:364": {
   "inputs": {
    "clip": [
     "405:387",
     0
    ],
    "text": [
     "405:382",
     0
    ]
   },
   "class_type": "CLIPTextEncode",
   "_meta": {
    "title": "CLIP Text Encode (Prompt)"
   }
  },
  "405:373": {
   "inputs": {
    "text": "pc game, console game, video game, cartoon, childish, ugly",
    "clip": [
     "405:387",
     0
    ]
   },
   "class_type": "CLIPTextEncode",
   "_meta": {
    "title": "CLIP Text Encode (Prompt)"
   }
  },
  "405:356": {
   "inputs": {
    "batch_size": 1,
    "width": [
     "405:353",
     1
    ],
    "height": [
     "405:355",
     1
    ],
    "length": [
     "405:378",
     1
    ]
   },
   "class_type": "EmptyLTXVLatentVideo",
   "_meta": {
    "title": "Empty LTXV Latent Video"
   }
  },
  "405:366": {
   "inputs": {
    "batch_size": 1,
    "audio_vae": [
     "405:386",
     0
    ],
    "frames_number": [
     "405:378",
     1
    ],
    "frame_rate": [
     "405:359",
     1
    ]
   },
   "class_type": "LTXVEmptyLatentAudio",
   "_meta": {
    "title": "Empty LTXV Latent Audio"
   }
  },
  "405:382": {
   "inputs": {
    "on_false": [
     "405:376",
     0
    ],
    "on_true": [
     "405:380",
     0
    ],
    "switch": [
     "405:383",
     0
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "If/Else Switch"
   }
  },
  "405:371": {
   "inputs": {
    "model_name": "ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors"
   },
   "class_type": "LatentUpscaleModelLoader",
   "_meta": {
    "title": "Load Latent Upscale Model"
   }
  },
  "405:384": {
   "inputs": {
    "unet_name": "ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors",
    "weight_dtype": "default"
   },
   "class_type": "UNETLoader",
   "_meta": {
    "title": "Load Diffusion Model"
   }
  },
  "405:385": {
   "inputs": {
    "vae_name": "ltx-2.5-video-vae-bf16.safetensors"
   },
   "class_type": "VAELoader",
   "_meta": {
    "title": "Load VAE"
   }
  },
  "405:386": {
   "inputs": {
    "vae_name": "ltx-2.5-audio-vae-bf16.safetensors"
   },
   "class_type": "VAELoader",
   "_meta": {
    "title": "Load VAE"
   }
  },
  "405:387": {
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
  "405:380": {
   "inputs": {
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
    "clip": [
     "405:393",
     0
    ],
    "prompt": [
     "405:376",
     0
    ]
   },
   "class_type": "TextGenerateLTX2Prompt",
   "_meta": {
    "title": "Generate LTX2 Prompt"
   }
  },
  "405:378": {
   "inputs": {
    "expression": "a * b + 1",
    "values.a": [
     "405:362",
     0
    ],
    "values.b": [
     "405:361",
     0
    ]
   },
   "class_type": "ComfyMathExpression",
   "_meta": {
    "title": "Math Expression (length)"
   }
  },
  "405:353": {
   "inputs": {
    "expression": "a/2",
    "values.a": [
     "405:372",
     0
    ]
   },
   "class_type": "ComfyMathExpression",
   "_meta": {
    "title": "Math Expression"
   }
  },
  "405:355": {
   "inputs": {
    "expression": "a/2",
    "values.a": [
     "405:360",
     0
    ]
   },
   "class_type": "ComfyMathExpression",
   "_meta": {
    "title": "Math Expression"
   }
  },
  "405:359": {
   "inputs": {
    "expression": "a",
    "values.a": [
     "405:361",
     0
    ]
   },
   "class_type": "ComfyMathExpression",
   "_meta": {
    "title": "Math Expression (fps)"
   }
  },
  "405:360": {
   "inputs": {
    "value": [
     "409",
     1
    ]
   },
   "class_type": "PrimitiveInt",
   "_meta": {
    "title": "Height"
   }
  },
  "405:361": {
   "inputs": {
    "value": 24
   },
   "class_type": "PrimitiveInt",
   "_meta": {
    "title": "Frame Rate"
   }
  },
  "405:362": {
   "inputs": {
    "value": 5
   },
   "class_type": "PrimitiveInt",
   "_meta": {
    "title": "Duration"
   }
  },
  "405:372": {
   "inputs": {
    "value": [
     "409",
     0
    ]
   },
   "class_type": "PrimitiveInt",
   "_meta": {
    "title": "Width"
   }
  },
  "405:376": {
   "inputs": {
    "value": "A close-up of an Arctic hunter's face, his eyes fixed straight ahead, narrowed and locked on something in the far distance directly in front of him, frost dusting his dark beard, one hand slowly reaching toward the rifle slung on his back, his breath quick and shallow, the tension in his jaw visible even through the scarf. The camera slowly pulls back, revealing him crouched at the edge of an ice floe, and ahead of him, in the exact direction of his gaze, a polar bear moves slowly along a distant ice ridge, its pale coat blending into the white haze, facing toward him. The pull-back continues, the hunter in the foreground and the bear far ahead, the two facing each other across the dark lead of water, the ice field and grey sea stretching around them, seabirds wheeling overhead. Midway through the shot, the complete title \"LTX-2.5\" fades in large and centered, plain white sans-serif letters with wide spacing, no glow, no shadow, no ornament, the lettering large enough to dominate the center of the frame, emerging slowly from the mist, resting still and blending into the snowscape, with the hunter and the bear still visible below on either side of the title, staying through the end of the scene. The wind carries the distant sound of shifting ice, a single low growl rolling across the water."
   },
   "class_type": "PrimitiveStringMultiline",
   "_meta": {
    "title": "Prompt"
   }
  },
  "405:393": {
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
  "405:383": {
   "inputs": {
    "value": false
   },
   "class_type": "PrimitiveBoolean",
   "_meta": {
    "title": "Boolean (Enable Prompt Enhance)"
   }
  }
 },
 "api_kling_v3_video": {
  "1": {
   "inputs": {
    "image": "boxing.png"
   },
   "class_type": "LoadImage",
   "_meta": {
    "title": "Load Image"
   }
  },
  "2": {
   "inputs": {
    "filename_prefix": "video/ComfyUI",
    "format": "auto",
    "format.codec": "auto",
    "video": [
     "3",
     0
    ]
   },
   "class_type": "SaveVideo",
   "_meta": {
    "title": "Save Video"
   }
  },
  "3": {
   "inputs": {
    "multi_shot": "2 storyboards",
    "multi_shot.storyboard_1_prompt": "Ultra‑realistic boxing match inside a packed arena at night. Two muscular male boxers in bright trunks and gloves exchange fast punches at close range, sweat flying off under the harsh spotlights. Camera: tight low‑angle close‑up circling slowly around them, shallow depth of field, background crowd and lights blurred, intense facial expressions, heavy breathing, hyper‑detailed skin and gloves.\n",
    "multi_shot.storyboard_1_duration": 2,
    "multi_shot.storyboard_2_prompt": "The fight escalates as both boxers trade powerful hooks and uppercuts, moving around the ring. Camera: begins with a medium shot showing both fighters from the waist up, then smoothly pulls back to a wider shot revealing the full ring, roaring crowd, flashing arena screens and camera flashes, with dramatic slow‑motion on one big punch, cinematic lighting, 4K, high frame rate, dynamic sports broadcast style.",
    "multi_shot.storyboard_2_duration": 3,
    "generate_audio": true,
    "model": "kling-v3",
    "model.resolution": "1080p",
    "model.aspect_ratio": "16:9",
    "start_frame": [
     "1",
     0
    ]
   },
   "class_type": "KlingVideoNode",
   "_meta": {
    "title": "Kling 3.0 Video"
   }
  }
 },
 "api_seedance2_5_r2v": {
  "12": {
   "inputs": {
    "image": "medusa_poster.png"
   },
   "class_type": "LoadImage",
   "_meta": {
    "title": "Load Image"
   }
  },
  "16": {
   "inputs": {
    "filename_prefix": "video/Seedance2.5_r2v",
    "format": "auto",
    "format.codec": "auto",
    "video": [
     "24",
     0
    ]
   },
   "class_type": "SaveVideo",
   "_meta": {
    "title": "Save Video"
   }
  },
  "24": {
   "inputs": {
    "model": "Seedance 2.5",
    "model.prompt": "The crimson marble Medusa statue comes alive, opening her eyes and looking at the camera while the red typography in the background simultaneously dissolves away letter by letter into drifting red particles. The snakes in her hair rise and sway. Both the statue and the background text animate together, poster layout otherwise unchanged, cinematic, no black frames.",
    "model.resolution": "720p",
    "model.ratio": "adaptive",
    "model.duration": 5,
    "model.generate_audio": true,
    "model.task_type": "reference",
    "model.output_format": "mp4",
    "model.auto_downscale": true,
    "model.auto_upscale": false,
    "model.reference_images.image_1": [
     "12",
     0
    ],
    "seed": 0,
    "watermark": false
   },
   "class_type": "ByteDance2ReferenceNodeV2",
   "_meta": {
    "title": "ByteDance Seedance 2.5 Reference to Video"
   }
  }
 },
 "video_wan2_2_14B_i2v": {
  "97": {
   "inputs": {
    "image": "video_wan2_2_14B_i2v_input_image.jpg"
   },
   "class_type": "LoadImage",
   "_meta": {
    "title": "Load Image"
   }
  },
  "108": {
   "inputs": {
    "filename_prefix": "video/Wan2.2_i2v",
    "format": "auto",
    "format.codec": "auto",
    "video": [
     "129:94",
     0
    ]
   },
   "class_type": "SaveVideo",
   "_meta": {
    "title": "Save Video"
   }
  },
  "129:98": {
   "inputs": {
    "width": 640,
    "height": 640,
    "batch_size": 1,
    "positive": [
     "129:93",
     0
    ],
    "negative": [
     "129:89",
     0
    ],
    "vae": [
     "129:90",
     0
    ],
    "length": [
     "129:163",
     1
    ],
    "start_image": [
     "97",
     0
    ]
   },
   "class_type": "WanImageToVideo",
   "_meta": {
    "title": "WanImageToVideo"
   }
  },
  "129:94": {
   "inputs": {
    "bit_depth": 8,
    "images": [
     "129:87",
     0
    ],
    "fps": [
     "129:162",
     0
    ]
   },
   "class_type": "CreateVideo",
   "_meta": {
    "title": "Create Video"
   }
  },
  "129:104": {
   "inputs": {
    "shift": 5.000000000000001,
    "model": [
     "129:116",
     0
    ]
   },
   "class_type": "ModelSamplingSD3",
   "_meta": {
    "title": "ModelSamplingSD3"
   }
  },
  "129:89": {
   "inputs": {
    "text": "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走",
    "clip": [
     "129:84",
     0
    ]
   },
   "class_type": "CLIPTextEncode",
   "_meta": {
    "title": "CLIP Text Encode (Negative Prompt)"
   }
  },
  "129:128": {
   "inputs": {
    "value": 20
   },
   "class_type": "PrimitiveInt",
   "_meta": {
    "title": "Int (Steps)"
   }
  },
  "129:87": {
   "inputs": {
    "samples": [
     "129:85",
     0
    ],
    "vae": [
     "129:90",
     0
    ]
   },
   "class_type": "VAEDecode",
   "_meta": {
    "title": "VAE Decode"
   }
  },
  "129:93": {
   "inputs": {
    "text": "The white dragon warrior stands still, eyes full of determination and strength. The camera slowly moves closer or circles around the warrior, highlighting the powerful presence and heroic spirit of the character.",
    "clip": [
     "129:84",
     0
    ]
   },
   "class_type": "CLIPTextEncode",
   "_meta": {
    "title": "CLIP Text Encode (Positive Prompt)"
   }
  },
  "129:131": {
   "inputs": {
    "value": false
   },
   "class_type": "PrimitiveBoolean",
   "_meta": {
    "title": "Enable 4steps LoRA?"
   }
  },
  "129:90": {
   "inputs": {
    "vae_name": "wan_2.1_vae.safetensors"
   },
   "class_type": "VAELoader",
   "_meta": {
    "title": "Load VAE"
   }
  },
  "129:84": {
   "inputs": {
    "clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
    "type": "wan",
    "device": "default"
   },
   "class_type": "CLIPLoader",
   "_meta": {
    "title": "Load CLIP"
   }
  },
  "129:96": {
   "inputs": {
    "unet_name": "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
    "weight_dtype": "default"
   },
   "class_type": "UNETLoader",
   "_meta": {
    "title": "Load Diffusion Model"
   }
  },
  "129:95": {
   "inputs": {
    "unet_name": "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
    "weight_dtype": "default"
   },
   "class_type": "UNETLoader",
   "_meta": {
    "title": "Load Diffusion Model"
   }
  },
  "129:127": {
   "inputs": {
    "value": 10
   },
   "class_type": "PrimitiveInt",
   "_meta": {
    "title": "Int (split_step)"
   }
  },
  "129:126": {
   "inputs": {
    "value": 3.5
   },
   "class_type": "PrimitiveFloat",
   "_meta": {
    "title": "Float (CFG)"
   }
  },
  "129:102": {
   "inputs": {
    "lora_name": "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors",
    "strength_model": 1.0000000000000002,
    "model": [
     "129:96",
     0
    ]
   },
   "class_type": "LoraLoaderModelOnly",
   "_meta": {
    "title": "Load LoRA"
   }
  },
  "129:101": {
   "inputs": {
    "lora_name": "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors",
    "strength_model": 1.0000000000000002,
    "model": [
     "129:95",
     0
    ]
   },
   "class_type": "LoraLoaderModelOnly",
   "_meta": {
    "title": "Load LoRA"
   }
  },
  "129:86": {
   "inputs": {
    "add_noise": "enable",
    "noise_seed": 264244520398999,
    "sampler_name": "euler",
    "scheduler": "simple",
    "start_at_step": 0,
    "return_with_leftover_noise": "enable",
    "model": [
     "129:104",
     0
    ],
    "positive": [
     "129:98",
     0
    ],
    "negative": [
     "129:98",
     1
    ],
    "latent_image": [
     "129:98",
     2
    ],
    "steps": [
     "129:119",
     0
    ],
    "cfg": [
     "129:120",
     0
    ],
    "end_at_step": [
     "129:125",
     0
    ]
   },
   "class_type": "KSamplerAdvanced",
   "_meta": {
    "title": "KSampler (Advanced)"
   }
  },
  "129:85": {
   "inputs": {
    "add_noise": "disable",
    "noise_seed": 0,
    "sampler_name": "euler",
    "scheduler": "simple",
    "return_with_leftover_noise": "disable",
    "model": [
     "129:103",
     0
    ],
    "positive": [
     "129:98",
     0
    ],
    "negative": [
     "129:98",
     1
    ],
    "latent_image": [
     "129:86",
     0
    ],
    "steps": [
     "129:119",
     0
    ],
    "cfg": [
     "129:120",
     0
    ],
    "start_at_step": [
     "129:125",
     0
    ],
    "end_at_step": [
     "129:119",
     0
    ]
   },
   "class_type": "KSamplerAdvanced",
   "_meta": {
    "title": "KSampler (Advanced)"
   }
  },
  "129:122": {
   "inputs": {
    "value": 1
   },
   "class_type": "PrimitiveFloat",
   "_meta": {
    "title": "Float (CFG)"
   }
  },
  "129:124": {
   "inputs": {
    "value": 2
   },
   "class_type": "PrimitiveInt",
   "_meta": {
    "title": "Int (split_step)"
   }
  },
  "129:118": {
   "inputs": {
    "value": 4
   },
   "class_type": "PrimitiveInt",
   "_meta": {
    "title": "Int (Steps)"
   }
  },
  "129:116": {
   "inputs": {
    "on_false": [
     "129:95",
     0
    ],
    "on_true": [
     "129:101",
     0
    ],
    "switch": [
     "129:131",
     0
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "Switch (Model)"
   }
  },
  "129:125": {
   "inputs": {
    "on_false": [
     "129:127",
     0
    ],
    "on_true": [
     "129:124",
     0
    ],
    "switch": [
     "129:131",
     0
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "Switch (Split Step)"
   }
  },
  "129:119": {
   "inputs": {
    "on_false": [
     "129:128",
     0
    ],
    "on_true": [
     "129:118",
     0
    ],
    "switch": [
     "129:131",
     0
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "Switch (Steps)"
   }
  },
  "129:120": {
   "inputs": {
    "on_false": [
     "129:126",
     0
    ],
    "on_true": [
     "129:122",
     0
    ],
    "switch": [
     "129:131",
     0
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "Switch (CFG)"
   }
  },
  "129:103": {
   "inputs": {
    "shift": 5.000000000000001,
    "model": [
     "129:117",
     0
    ]
   },
   "class_type": "ModelSamplingSD3",
   "_meta": {
    "title": "ModelSamplingSD3"
   }
  },
  "129:117": {
   "inputs": {
    "on_false": [
     "129:96",
     0
    ],
    "on_true": [
     "129:102",
     0
    ],
    "switch": [
     "129:131",
     0
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "Switch (Model)"
   }
  },
  "129:161": {
   "inputs": {
    "value": 5
   },
   "class_type": "PrimitiveFloat",
   "_meta": {
    "title": "Float (Duration)"
   }
  },
  "129:162": {
   "inputs": {
    "value": 16
   },
   "class_type": "PrimitiveFloat",
   "_meta": {
    "title": "Float (FPS)"
   }
  },
  "129:163": {
   "inputs": {
    "expression": "floor (a * b + 1)",
    "values.a": [
     "129:161",
     0
    ],
    "values.b": [
     "129:162",
     0
    ]
   },
   "class_type": "ComfyMathExpression",
   "_meta": {
    "title": "Math Expression"
   }
  }
 },
 "api_vidu_q4_preview_r2v": {
  "6": {
   "inputs": {
    "filename_prefix": "video/Vidu_q4_preview_r2v",
    "format": "auto",
    "format.codec": "auto",
    "codec": "auto",
    "video": [
     "9",
     0
    ]
   },
   "class_type": "SaveVideo",
   "_meta": {
    "title": "Save Video"
   }
  },
  "9": {
   "inputs": {
    "model": "Vidu Q4 Preview",
    "model.prompt": "5-second stylish 3D cartoon using both reference images. Preserve the fuzzy yellow character from image 1 and the white-haired character, purple smiley sweater and drink cup from image 2. Place them in one playful blue-and-purple world. 0–1s: The white-haired character takes a sip; a tiny yellow blur streaks past behind him. 1–2s: Hard cut to a low angle as the fuzzy character lands, squashes flat for a beat, then springs high with an exaggerated stretch. 2–3s: Whip cut to the white-haired character’s face—his eyes widen, he leans back, then grins. 3–4s: The fuzzy character makes one fast curved leap toward his shoulder, with a brief hand-animated motion smear. 4–5s: It lands softly; the character raises his free hand and they strike a cheeky, perfectly timed freeze-frame pose. Snappy cuts, bold camera angles, expressive squash-and-stretch, polished character animation and fashionable purple-yellow-blue color blocking. Keep the cup steady and both designs consistent. No dialogue, extra characters, text or subtitles.",
    "model.aspect_ratio": "16:9",
    "model.resolution": "720p",
    "model.duration": 5,
    "model.audio": true,
    "model.seed": 1613348113,
    "model.reference_images.image_1": [
     "11",
     0
    ],
    "model.reference_images.image_2": [
     "10",
     0
    ]
   },
   "class_type": "Vidu4ReferenceVideoNode",
   "_meta": {
    "title": "Vidu Q4 Reference-to-Video Generation"
   }
  },
  "10": {
   "inputs": {
    "image": "cad20a3f7d6b250fea6e6d835b648f7ebf3cf945edb1ab32d5f4782e47f657d8.png"
   },
   "class_type": "LoadImage",
   "_meta": {
    "title": "Load Image"
   }
  },
  "11": {
   "inputs": {
    "image": "163adcd8a583c6b9a7361dc75adaabdebaefd89c9eafe945fa93705489a6fc53.png"
   },
   "class_type": "LoadImage",
   "_meta": {
    "title": "Load Image"
   }
  }
 },
 "api_minimax_h3_max_r2v": {
  "2": {
   "inputs": {
    "filename_prefix": "video/Minimax_h3_max",
    "format": "auto",
    "format.codec": "auto",
    "codec": "auto",
    "video": [
     "4",
     0
    ]
   },
   "class_type": "SaveVideo",
   "_meta": {
    "title": "Save Video"
   }
  },
  "4": {
   "inputs": {
    "model": "MiniMax H3 Max",
    "model.resolution": "768P",
    "model.ratio": "adaptive",
    "model.duration": 5,
    "model.prompt_expansion_mode": "balanced",
    "model.reference_detail": "high",
    "model.prompt": "",
    "model.reference_images.image_1": [
     "6",
     0
    ],
    "seed": 3353295271,
    "watermark": false
   },
   "class_type": "MinimaxHailuo03ReferenceNode",
   "_meta": {
    "title": "MiniMax H3 Reference to Video"
   }
  },
  "6": {
   "inputs": {
    "image": "burdened_warrior_in_dreamscape.png"
   },
   "class_type": "LoadImage",
   "_meta": {
    "title": "Load Image"
   }
  }
 },
 "video_wan_animate2": {
  "189": {
   "inputs": {
    "image": "pink_hair_mech_arms_ref.png"
   },
   "class_type": "LoadImage",
   "_meta": {
    "title": "Load Image (Reference Image)"
   }
  },
  "240": {
   "inputs": {
    "file": "street_dance_drive.mp4"
   },
   "class_type": "LoadVideo",
   "_meta": {
    "title": "Load Video (Pose Video)"
   }
  },
  "246": {
   "inputs": {
    "filename_prefix": "video/ComfyUI",
    "format": "auto",
    "format.codec": "auto",
    "codec": "auto",
    "video": [
     "672:245",
     0
    ]
   },
   "class_type": "SaveVideo",
   "_meta": {
    "title": "Save Video"
   }
  },
  "672:578": {
   "inputs": {
    "unet_name": "wan_animate_2_int8_convrot.safetensors",
    "weight_dtype": "default"
   },
   "class_type": "UNETLoader",
   "_meta": {
    "title": "Load Diffusion Model"
   }
  },
  "672:579": {
   "inputs": {
    "lora_name": "lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors",
    "strength_model": 1,
    "model": [
     "672:578",
     0
    ]
   },
   "class_type": "LoraLoaderModelOnly",
   "_meta": {
    "title": "Load LoRA"
   }
  },
  "672:580": {
   "inputs": {
    "clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
    "type": "wan",
    "device": "default"
   },
   "class_type": "CLIPLoader",
   "_meta": {
    "title": "Load CLIP"
   }
  },
  "672:583": {
   "inputs": {
    "clip_name": "clip_vision_h.safetensors"
   },
   "class_type": "CLIPVisionLoader",
   "_meta": {
    "title": "Load CLIP Vision"
   }
  },
  "672:584": {
   "inputs": {
    "vae_name": "Wan2_1_VAE_bf16.safetensors"
   },
   "class_type": "VAELoader",
   "_meta": {
    "title": "Load VAE"
   }
  },
  "672:590": {
   "inputs": {
    "resize_type": "scale dimensions",
    "resize_type.crop": "center",
    "resize_type.width": [
     "672:596",
     0
    ],
    "resize_type.height": [
     "672:596",
     1
    ],
    "scale_method": "area",
    "input": [
     "189",
     0
    ]
   },
   "class_type": "ResizeImageMaskNode",
   "_meta": {
    "title": "Resize Image/Mask"
   }
  },
  "672:595": {
   "inputs": {
    "video": [
     "240",
     0
    ]
   },
   "class_type": "GetVideoComponents",
   "_meta": {
    "title": "Get Video Components"
   }
  },
  "672:596": {
   "inputs": {
    "image": [
     "672:600",
     0
    ]
   },
   "class_type": "GetImageSize",
   "_meta": {
    "title": "Get Image Size"
   }
  },
  "672:599": {
   "inputs": {
    "batch_index": 0,
    "length": 1,
    "image": [
     "672:600",
     0
    ]
   },
   "class_type": "ImageFromBatch",
   "_meta": {
    "title": "Get Image from Batch"
   }
  },
  "672:600": {
   "inputs": {
    "resize_type": "scale dimensions",
    "resize_type.width": 482,
    "resize_type.height": 854,
    "resize_type.crop": "center",
    "scale_method": "area",
    "input": [
     "672:595",
     0
    ]
   },
   "class_type": "ResizeImageMaskNode",
   "_meta": {
    "title": "Resize Image/Mask"
   }
  },
  "672:581": {
   "inputs": {
    "text": "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走",
    "clip": [
     "672:580",
     0
    ]
   },
   "class_type": "CLIPTextEncode",
   "_meta": {
    "title": "CLIP Text Encode (Negative Prompt)"
   }
  },
  "672:582": {
   "inputs": {
    "text": "Character Description: Cartoon character lost\nBackground description: The background is an empty white room",
    "clip": [
     "672:580",
     0
    ]
   },
   "class_type": "CLIPTextEncode",
   "_meta": {
    "title": "CLIP Text Encode (Positive Prompt)"
   }
  },
  "672:585": {
   "inputs": {
    "text": "A girl doing energetic street dance with rhythmic steps and dynamic arm gestures, background stationary\n",
    "clip": [
     "672:580",
     0
    ]
   },
   "class_type": "CLIPTextEncode",
   "_meta": {
    "title": "CLIP Text Encode (Prompt)"
   }
  },
  "672:589": {
   "inputs": {
    "crop": "none",
    "clip_vision": [
     "672:583",
     0
    ],
    "image": [
     "672:590",
     0
    ]
   },
   "class_type": "CLIPVisionEncode",
   "_meta": {
    "title": "CLIP Vision Encode"
   }
  },
  "672:598": {
   "inputs": {
    "crop": "none",
    "clip_vision": [
     "672:583",
     0
    ],
    "image": [
     "672:599",
     0
    ]
   },
   "class_type": "CLIPVisionEncode",
   "_meta": {
    "title": "CLIP Vision Encode"
   }
  },
  "672:586": {
   "inputs": {
    "context_length": 21,
    "context_overlap": 8,
    "context_schedule": "standard_static",
    "context_stride": 1,
    "closed_loop": false,
    "fuse_method": "pyramid",
    "dim": 2,
    "freenoise": true,
    "cond_retain_index_list": "0",
    "split_conds_to_windows": false,
    "latent_retain_index_list": "",
    "causal_window_fix": true,
    "model": [
     "672:579",
     0
    ]
   },
   "class_type": "ContextWindowsManual",
   "_meta": {
    "title": "Context Windows (Manual)"
   }
  },
  "672:537": {
   "inputs": {
    "image": [
     "672:288",
     0
    ]
   },
   "class_type": "GetImageSize",
   "_meta": {
    "title": "Get Image Size"
   }
  },
  "672:636": {
   "inputs": {
    "expression": "floor((a - 2) / (b - 1))",
    "values.a": [
     "672:537",
     2
    ],
    "values.b": [
     "672:635",
     0
    ]
   },
   "class_type": "ComfyMathExpression",
   "_meta": {
    "title": "Math Expression"
   }
  },
  "672:642": {
   "inputs": {
    "mode": "simple",
    "mode.num_iterations": [
     "672:645",
     1
    ],
    "cache_iterations": false
   },
   "class_type": "StartLoop",
   "_meta": {
    "title": "Start Loop"
   }
  },
  "672:645": {
   "inputs": {
    "expression": "a + 1",
    "values.a": [
     "672:636",
     1
    ]
   },
   "class_type": "ComfyMathExpression",
   "_meta": {
    "title": "Math Expression"
   }
  },
  "672:646": {
   "inputs": {
    "on_false": [
     "672:635",
     0
    ],
    "on_true": [
     "672:639",
     1
    ],
    "switch": [
     "672:642",
     2
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "If/Else Switch(length)"
   }
  },
  "672:649": {
   "inputs": {
    "index": 0,
    "list": [
     "672:642",
     4
    ]
   },
   "class_type": "GetItemFromList",
   "_meta": {
    "title": "Get Item From List"
   }
  },
  "672:288": {
   "inputs": {
    "video": [
     "240",
     0
    ]
   },
   "class_type": "GetVideoComponents",
   "_meta": {
    "title": "Get Video Components"
   }
  },
  "672:587": {
   "inputs": {
    "batch_size": 1,
    "pose_strength": 1,
    "pose_start_percent": 0,
    "pose_end_percent": 1,
    "reference_image_strength": 1,
    "positive": [
     "672:582",
     0
    ],
    "negative": [
     "672:581",
     0
    ],
    "vae": [
     "672:584",
     0
    ],
    "reference_image": [
     "672:590",
     0
    ],
    "pose_video": [
     "672:600",
     0
    ],
    "clip_vision_output": [
     "672:589",
     0
    ],
    "positive_pose": [
     "672:585",
     0
    ],
    "clip_vision_output_pose": [
     "672:598",
     0
    ],
    "continue_motion": [
     "672:651",
     0
    ],
    "width": [
     "672:596",
     0
    ],
    "height": [
     "672:596",
     1
    ],
    "length": [
     "672:646",
     0
    ],
    "video_frame_offset": [
     "672:652",
     0
    ]
   },
   "class_type": "WanAnimate2ToVideo",
   "_meta": {
    "title": "WanAnimate2ToVideo"
   }
  },
  "672:588": {
   "inputs": {
    "switch": false,
    "on_false": [
     "672:579",
     0
    ],
    "on_true": [
     "672:586",
     0
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "If/Else Switch"
   }
  },
  "672:594": {
   "inputs": {
    "device": "gpu",
    "dtype": "int8",
    "model": [
     "672:588",
     0
    ]
   },
   "class_type": "WanAnimate2Cache",
   "_meta": {
    "title": "WanAnimate2Cache"
   }
  },
  "672:653": {
   "inputs": {
    "index": 1,
    "list": [
     "672:642",
     4
    ]
   },
   "class_type": "GetItemFromList",
   "_meta": {
    "title": "Get Item From List"
   }
  },
  "672:651": {
   "inputs": {
    "on_false": [
     "672:649",
     0
    ],
    "switch": [
     "672:642",
     1
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "If/Else Switch (continue_motion)"
   }
  },
  "672:591": {
   "inputs": {
    "scheduler": "simple",
    "steps": 6,
    "denoise": 1,
    "model": [
     "672:594",
     0
    ]
   },
   "class_type": "BasicScheduler",
   "_meta": {
    "title": "BasicScheduler"
   }
  },
  "672:592": {
   "inputs": {
    "shift": 5,
    "model": [
     "672:594",
     0
    ]
   },
   "class_type": "ModelSamplingSD3",
   "_meta": {
    "title": "ModelSamplingSD3"
   }
  },
  "672:593": {
   "inputs": {
    "sampler_name": "lcm"
   },
   "class_type": "KSamplerSelect",
   "_meta": {
    "title": "KSamplerSelect"
   }
  },
  "672:635": {
   "inputs": {
    "value": 81
   },
   "class_type": "PrimitiveInt",
   "_meta": {
    "title": "Int (fragment_length)"
   }
  },
  "672:639": {
   "inputs": {
    "expression": "4 * ceil((a - b * c + c - 1) / 4) + 1",
    "values.a": [
     "672:537",
     2
    ],
    "values.b": [
     "672:635",
     0
    ],
    "values.c": [
     "672:636",
     1
    ]
   },
   "class_type": "ComfyMathExpression",
   "_meta": {
    "title": "Math Expression"
   }
  },
  "672:652": {
   "inputs": {
    "on_false": [
     "672:653",
     0
    ],
    "on_true": [
     "672:654",
     0
    ],
    "switch": [
     "672:642",
     1
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "If/Else Switch(video_frame_offset)"
   }
  },
  "672:654": {
   "inputs": {
    "value": 0
   },
   "class_type": "PrimitiveInt",
   "_meta": {
    "title": "Int"
   }
  },
  "672:597": {
   "inputs": {
    "add_noise": true,
    "noise_seed": 582699151003550,
    "cfg": 1,
    "model": [
     "672:592",
     0
    ],
    "positive": [
     "672:587",
     0
    ],
    "negative": [
     "672:587",
     1
    ],
    "sampler": [
     "672:593",
     0
    ],
    "sigmas": [
     "672:591",
     0
    ],
    "latent_image": [
     "672:587",
     2
    ]
   },
   "class_type": "SamplerCustom",
   "_meta": {
    "title": "SamplerCustom"
   }
  },
  "672:667": {
   "inputs": {
    "expression": "(a % 4 == 1) and ((b - 1) % 4 == 0)",
    "values.a": [
     "672:537",
     2
    ],
    "values.b": [
     "672:635",
     0
    ]
   },
   "class_type": "ComfyMathExpression",
   "_meta": {
    "title": "Exact w/o trim? (F%4==1 and b%4==1)"
   }
  },
  "672:601": {
   "inputs": {
    "samples": [
     "672:602",
     0
    ],
    "vae": [
     "672:584",
     0
    ]
   },
   "class_type": "VAEDecode",
   "_meta": {
    "title": "VAE Decode"
   }
  },
  "672:602": {
   "inputs": {
    "samples": [
     "672:597",
     0
    ],
    "trim_amount": [
     "672:587",
     3
    ]
   },
   "class_type": "TrimVideoLatent",
   "_meta": {
    "title": "Trim Video Latent"
   }
  },
  "672:604": {
   "inputs": {
    "batch_index": 1,
    "length": 4096,
    "image": [
     "672:601",
     0
    ]
   },
   "class_type": "ImageFromBatch",
   "_meta": {
    "title": "Get Image from Batch"
   }
  },
  "672:605": {
   "inputs": {
    "on_false": [
     "672:604",
     0
    ],
    "on_true": [
     "672:601",
     0
    ],
    "switch": [
     "672:642",
     1
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "If/Else Switch"
   }
  },
  "672:648": {
   "inputs": {
    "inputs.input0": [
     "672:601",
     0
    ],
    "inputs.input1": [
     "672:587",
     5
    ]
   },
   "class_type": "CreateList",
   "_meta": {
    "title": "Create List"
   }
  },
  "672:647": {
   "inputs": {
    "accumulate": true,
    "terminations.termination0": [
     "672:587",
     5
    ],
    "output_value": [
     "672:605",
     0
    ],
    "next_iteration_value": [
     "672:648",
     0
    ]
   },
   "class_type": "EndLoop",
   "_meta": {
    "title": "End Loop"
   }
  },
  "672:661": {
   "inputs": {
    "images": [
     "672:647",
     0
    ],
    "batch_size": [
     "672:537",
     2
    ]
   },
   "class_type": "RebatchImages",
   "_meta": {
    "title": "Rebatch Images"
   }
  },
  "672:670": {
   "inputs": {
    "batch_index": 0,
    "image": [
     "672:661",
     0
    ],
    "length": [
     "672:537",
     2
    ]
   },
   "class_type": "ImageFromBatch",
   "_meta": {
    "title": "Trim tail to F"
   }
  },
  "672:671": {
   "inputs": {
    "on_false": [
     "672:670",
     0
    ],
    "on_true": [
     "672:661",
     0
    ],
    "switch": [
     "672:667",
     2
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "Apply tail trim?"
   }
  },
  "672:245": {
   "inputs": {
    "bit_depth": "auto",
    "color_space": "sRGB",
    "codec": "none",
    "images": [
     "672:671",
     0
    ],
    "audio": [
     "672:288",
     1
    ],
    "fps": [
     "672:288",
     2
    ]
   },
   "class_type": "CreateVideo",
   "_meta": {
    "title": "Create Video"
   }
  }
 },
 "api_tripo_p2_image_to_model": {
  "14": {
   "inputs": {
    "filename_prefix": "3d/Tripo_p2",
    "viewport_state": "",
    "width": 1024,
    "height": 1024,
    "model_3d": [
     "15",
     1
    ]
   },
   "class_type": "Save3DAdvanced",
   "_meta": {
    "title": "Save 3D (Advanced)"
   }
  },
  "15": {
   "inputs": {
    "model": "P2",
    "model.quad": false,
    "model.face_limit": -1,
    "model.texture": "standard",
    "model.pbr": true,
    "model.model_seed": 81426036,
    "model.texture_alignment": "original_image",
    "model.orientation": "default",
    "model.enable_image_autofix": false,
    "model.texture_seed": 42,
    "model.auto_size": false,
    "model.export_uv": true,
    "model.compress_geometry": false,
    "model.image": [
     "16",
     0
    ]
   },
   "class_type": "TripoPSeriesImageToModelNode",
   "_meta": {
    "title": "Tripo P2: Image to Model"
   }
  },
  "16": {
   "inputs": {
    "image": "designer_toy_3d.png"
   },
   "class_type": "LoadImage",
   "_meta": {
    "title": "Load Image"
   }
  }
 },
 "api_hunyuan3d_image_to_model": {
  "1": {
   "inputs": {
    "image": "pink_robot_front.png"
   },
   "class_type": "LoadImage",
   "_meta": {
    "title": "Load Image"
   }
  },
  "2": {
   "inputs": {
    "model": "3.1",
    "face_count": 500000,
    "generate_type": "Normal",
    "generate_type.pbr": true,
    "seed": 382182111,
    "image": [
     "1",
     0
    ]
   },
   "class_type": "TencentImageToModelNode",
   "_meta": {
    "title": "Hunyuan3D: Image(s) to Model"
   }
  },
  "13": {
   "inputs": {
    "filename_prefix": "3d/hunyuan3d_image_to_3d",
    "image": "",
    "mesh": [
     "2",
     1
    ]
   },
   "class_type": "SaveGLB",
   "_meta": {
    "title": "Save 3D Model"
   }
  }
 },
 "api_meshy7_1_image_to_model": {
  "8": {
   "inputs": {
    "image": "clay_heart_girl.png"
   },
   "class_type": "LoadImage",
   "_meta": {
    "title": "Load Image"
   }
  },
  "13": {
   "inputs": {
    "model": "meshy-7.1",
    "should_remesh": "true",
    "should_remesh.topology": "triangle",
    "should_remesh.target_polycount": 300000,
    "symmetry_mode": "auto",
    "should_texture": "true",
    "should_texture.enable_pbr": false,
    "should_texture.texture_prompt": "",
    "should_texture.texture_resolution": "2k",
    "pose_mode": "",
    "seed": 978222859,
    "ultra_mode": false,
    "ultra_resolution": "2k",
    "image": [
     "8",
     0
    ]
   },
   "class_type": "MeshyImageToModelNode",
   "_meta": {
    "title": "Meshy: Image to Model"
   }
  },
  "17": {
   "inputs": {
    "filename_prefix": "3d/meshy_image2model",
    "viewport_state": "",
    "width": 1024,
    "height": 1024,
    "model_3d": [
     "13",
     2
    ]
   },
   "class_type": "Save3DAdvanced",
   "_meta": {
    "title": "Save 3D (Advanced)"
   }
  }
 },
 "audio-chatterbox_tts_multilingual": {
  "1": {
   "inputs": {
    "text": "Hola amigos, bienvenidos de nuevo a ComfyUI.\nHoy vamos a explorar Chatterbox, un flujo de trabajo de clonación de voz capaz de manejar múltiples voces y múltiples idiomas.",
    "language": "English (en)",
    "exaggeration": 0.5,
    "cfg_weight": 0.5,
    "temperature": 0.8,
    "repetition_penalty": 2,
    "min_p": 0.05,
    "top_p": 1,
    "seed": 163260306,
    "use_cpu": false,
    "keep_model_loaded": false,
    "audio_prompt": [
     "2",
     0
    ]
   },
   "class_type": "FL_ChatterboxMultilingualTTS",
   "_meta": {
    "title": "FL Chatterbox Multilingual TTS"
   }
  },
  "2": {
   "inputs": {
    "audio": "chatterbox_input_target_voice.mp3"
   },
   "class_type": "LoadAudio",
   "_meta": {
    "title": "Load Audio"
   }
  },
  "3": {
   "inputs": {
    "filename_prefix": "audio/ComfyUI",
    "quality": "V0",
    "audio": [
     "1",
     0
    ]
   },
   "class_type": "SaveAudioMP3",
   "_meta": {
    "title": "Save Audio (MP3) (DEPRECATED)"
   }
  }
 },
 "api_elevenlabs_v4_text_to_dialogue": {
  "211": {
   "inputs": {
    "voice": "Roger (male, american)"
   },
   "class_type": "ElevenLabsVoiceSelector",
   "_meta": {
    "title": "ElevenLabs Voice Selector"
   }
  },
  "218": {
   "inputs": {
    "stability": 0.5,
    "apply_text_normalization": "auto",
    "model": "eleven_v4",
    "inputs": "4",
    "inputs.text1": "[quietly, close to the mic] I ran the numbers twice... the engine is holding steady. Wait, why is the alarm light-",
    "inputs.text2": "[jumping in] -because I already started it. [laughs] You were taking too long. [deadpan] We have forty seconds.",
    "inputs.text3": "[sighs, then firmly] Then stop smiling and seal the hatch. [urgent] I need the console live before the countdown hits twenty.",
    "inputs.text4": "[amused] Already sealed. [quickly] The console is yours... and there goes the countdown.",
    "inputs.voice1": [
     "211",
     0
    ],
    "inputs.voice2": [
     "219",
     0
    ],
    "inputs.voice3": [
     "211",
     0
    ],
    "inputs.voice4": [
     "219",
     0
    ],
    "language_code": "",
    "seed": 2061518140,
    "output_format": "mp3_44100_192"
   },
   "class_type": "ElevenLabsTextToDialogue",
   "_meta": {
    "title": "ElevenLabs Text to Dialogue"
   }
  },
  "219": {
   "inputs": {
    "voice": "Laura (female, american)"
   },
   "class_type": "ElevenLabsVoiceSelector",
   "_meta": {
    "title": "ElevenLabs Voice Selector"
   }
  },
  "220": {
   "inputs": {
    "filename_prefix": "audio/ComfyUI",
    "format": "mp3",
    "format.quality": "V0",
    "audio": [
     "218",
     0
    ]
   },
   "class_type": "SaveAudioAdvanced",
   "_meta": {
    "title": "Save Audio (Advanced)"
   }
  }
 },
 "audio_ace_step1_5_xl_turbo": {
  "3": {
   "inputs": {
    "steps": 8,
    "cfg": 1,
    "sampler_name": "euler",
    "scheduler": "simple",
    "denoise": 1,
    "model": [
     "78",
     0
    ],
    "positive": [
     "94",
     0
    ],
    "negative": [
     "47",
     0
    ],
    "latent_image": [
     "98",
     0
    ],
    "seed": [
     "109",
     0
    ]
   },
   "class_type": "KSampler",
   "_meta": {
    "title": "KSampler"
   }
  },
  "18": {
   "inputs": {
    "samples": [
     "3",
     0
    ],
    "vae": [
     "106",
     0
    ]
   },
   "class_type": "VAEDecodeAudio",
   "_meta": {
    "title": "VAE Decode Audio"
   }
  },
  "47": {
   "inputs": {
    "conditioning": [
     "94",
     0
    ]
   },
   "class_type": "ConditioningZeroOut",
   "_meta": {
    "title": "Conditioning Zero Out"
   }
  },
  "78": {
   "inputs": {
    "shift": 3,
    "model": [
     "104",
     0
    ]
   },
   "class_type": "ModelSamplingAuraFlow",
   "_meta": {
    "title": "ModelSamplingAuraFlow"
   }
  },
  "94": {
   "inputs": {
    "tags": "Late Night Trap, 95 BPM, Heavy 808 Bass, Wet Synths, Female Background Vocals, Male Rap Vocals + Seductive Female Vocals, Dark Bedroom Production, Atmospheric Club Vibes, Breathy Whispers, Slap Bass, Deep Sub Bass, Cinematic R&B Soundtrack Feel",
    "lyrics": "[Verse 1]\nOpen up the canvas, blank slate on my screen\nDrag a checkpoint loader, you know what I mean\nKSampler in the middle, VAE on the right\nClip text encode, yeah I'm building tonight\n[Chorus]\nConnect the nodes, run the queue\nWatch the latent flow right through\nGreen dot to green dot, link it up\nPositive prompt in my cup\n[Verse 2]\nEmpty latent image, set the width and height\nPlug it to the sampler, get the settings right\nCFG at seven, steps at twenty-two\nHit that Queue Prompt button, render coming through\n[Bridge]\nUpscale node, ControlNet in the chain\nLora stacked on Lora driving me insane\nSave image at the end of every single flow\nRed wire means broken — fix it, let it go\n[Outro]\nNodes connected, workflow clean\nBest AI pipeline you ever seen\nComfyUI, yeah we building art\nOne node at a time right from the start",
    "bpm": 95,
    "duration": 120,
    "timesignature": "4",
    "language": "en",
    "keyscale": "E minor",
    "generate_audio_codes": true,
    "cfg_scale": 2,
    "temperature": 0.85,
    "top_p": 0.9,
    "top_k": 0,
    "min_p": 0,
    "clip": [
     "105",
     0
    ],
    "seed": [
     "109",
     0
    ]
   },
   "class_type": "TextEncodeAceStepAudio1.5",
   "_meta": {
    "title": "TextEncodeAceStepAudio1.5"
   }
  },
  "98": {
   "inputs": {
    "seconds": 120,
    "batch_size": 1
   },
   "class_type": "EmptyAceStep1.5LatentAudio",
   "_meta": {
    "title": "Empty Ace Step 1.5 Latent Audio"
   }
  },
  "104": {
   "inputs": {
    "unet_name": "acestep_v1.5_xl_turbo_bf16.safetensors",
    "weight_dtype": "default"
   },
   "class_type": "UNETLoader",
   "_meta": {
    "title": "Load Diffusion Model"
   }
  },
  "105": {
   "inputs": {
    "clip_name1": "qwen_0.6b_ace15.safetensors",
    "clip_name2": "qwen_4b_ace15.safetensors",
    "type": "ace",
    "device": "default"
   },
   "class_type": "DualCLIPLoader",
   "_meta": {
    "title": "Load CLIP (Dual)"
   }
  },
  "106": {
   "inputs": {
    "vae_name": "ace_1.5_vae.safetensors"
   },
   "class_type": "VAELoader",
   "_meta": {
    "title": "Load VAE"
   }
  },
  "109": {
   "inputs": {
    "value": 0
   },
   "class_type": "PrimitiveInt",
   "_meta": {
    "title": "Int (Seed)"
   }
  },
  "111": {
   "inputs": {
    "filename_prefix": "audio/ACE_Step1.5_xl_turbo",
    "format": "mp3",
    "format.quality": "V0",
    "audio": [
     "18",
     0
    ]
   },
   "class_type": "SaveAudioAdvanced",
   "_meta": {
    "title": "Save Audio (Advanced)"
   }
  }
 },
 "audio_stable_audio_3_medium": {
  "57": {
   "inputs": {
    "filename_prefix": "audio/stable_audio_3",
    "format": "mp3",
    "format.quality": "V0",
    "audio": [
     "52:12",
     0
    ]
   },
   "class_type": "SaveAudioAdvanced",
   "_meta": {
    "title": "Save Audio (Advanced)"
   }
  },
  "52:7": {
   "inputs": {
    "text": "",
    "clip": [
     "52:26",
     0
    ]
   },
   "class_type": "CLIPTextEncode",
   "_meta": {
    "title": "CLIP Text Encode (Prompt)"
   }
  },
  "52:12": {
   "inputs": {
    "samples": [
     "52:3",
     0
    ],
    "vae": [
     "52:25",
     2
    ]
   },
   "class_type": "VAEDecodeAudio",
   "_meta": {
    "title": "VAE Decode Audio"
   }
  },
  "52:11": {
   "inputs": {
    "batch_size": 1,
    "seconds": [
     "52:36",
     0
    ]
   },
   "class_type": "EmptyLatentAudio",
   "_meta": {
    "title": "Empty Latent Audio"
   }
  },
  "52:3": {
   "inputs": {
    "seed": 1038503484137406,
    "steps": 8,
    "cfg": 1,
    "sampler_name": "lcm",
    "scheduler": "simple",
    "denoise": 1,
    "model": [
     "52:25",
     0
    ],
    "positive": [
     "52:6",
     0
    ],
    "negative": [
     "52:7",
     0
    ],
    "latent_image": [
     "52:11",
     0
    ]
   },
   "class_type": "KSampler",
   "_meta": {
    "title": "KSampler"
   }
  },
  "52:29": {
   "inputs": {
    "clip_name": "qwen3.5_2b_bf16.safetensors",
    "type": "stable_diffusion",
    "device": "default"
   },
   "class_type": "CLIPLoader",
   "_meta": {
    "title": "Load CLIP"
   }
  },
  "52:6": {
   "inputs": {
    "clip": [
     "52:26",
     0
    ],
    "text": [
     "52:34",
     0
    ]
   },
   "class_type": "CLIPTextEncode",
   "_meta": {
    "title": "CLIP Text Encode (Prompt)"
   }
  },
  "52:34": {
   "inputs": {
    "on_false": [
     "52:31",
     0
    ],
    "on_true": [
     "52:28",
     0
    ],
    "switch": [
     "52:35",
     0
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "If/Else Switch"
   }
  },
  "52:41": {
   "inputs": {
    "expression": "a",
    "values.a": [
     "52:36",
     0
    ]
   },
   "class_type": "ComfyMathExpression",
   "_meta": {
    "title": "Math Expression"
   }
  },
  "52:42": {
   "inputs": {
    "preview_markdown": "",
    "preview_text": "",
    "previewMode": "",
    "source": [
     "52:41",
     1
    ]
   },
   "class_type": "PreviewAny",
   "_meta": {
    "title": "Preview as Text"
   }
  },
  "52:39": {
   "inputs": {
    "find": "USER_INPUT",
    "string": [
     "52:38",
     0
    ],
    "replace": [
     "52:31",
     0
    ]
   },
   "class_type": "StringReplace",
   "_meta": {
    "title": "Text Replace (USER INPUT)"
   }
  },
  "52:28": {
   "inputs": {
    "max_length": 256,
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
    "clip": [
     "52:29",
     0
    ],
    "prompt": [
     "52:40",
     0
    ]
   },
   "class_type": "TextGenerate",
   "_meta": {
    "title": "Generate Text"
   }
  },
  "52:31": {
   "inputs": {
    "value": "Tropical house track with marimba, steel drums, soft synths, smooth bass, layered percussion, and light piano riffs for sunny chill dance vibes"
   },
   "class_type": "PrimitiveStringMultiline",
   "_meta": {
    "title": "User: short description (USER_INPUT in template)"
   }
  },
  "52:43": {
   "inputs": {
    "choice": "Music",
    "index": 0,
    "option1": "Music",
    "option2": "Instrument",
    "option3": "SFX",
    "option4": "One-shot"
   },
   "class_type": "CustomCombo",
   "_meta": {
    "title": "Custom Combo (Category index)"
   }
  },
  "52:49": {
   "inputs": {
    "json_string": "{\n  \"Music\": \"You are an expert musician and musicologist and prompt engineer. Transform the user's input into a detailed, vivid music prompt for a full instrumental track.\\n\\n1. Start with the genre or style and optional adjectives (e.g., upbeat, dreamy, aggressive).\\n2. List the main instruments that define the track.\\n3. Add supporting elements or layers such as pads, harmonics, effects, or field recordings.\\n4. Include rhythm or percussion elements like drums, hi-hats, congas, brushes, or polyrhythms.\\n5. Integrate mood and energy naturally in the sentence (e.g., \\\"creating suspenseful tension\\\" or \\\"bright and uplifting\\\").\\n6. Specify the BPM.\\n7. Specify the track length as an integer in seconds. Use ranges: energetic/dance 120-180s, pop/rock 180-210s, cinematic/ambient 240-300s.\\n8. Combine all elements into one natural, fluid sentence. Avoid semicolons.\\n\\nTemplate:\\nGenre/Style with main instruments, supporting instruments/layers, and rhythm/percussion creating mood/energy. BPM: X. Length: Y seconds\\n\\nExamples:\\n- Jazz ballad with smooth saxophone lead, piano chords, upright bass, brushed drums, and soft strings that swing gently for a warm and cozy evening. BPM: 85. Length: 180 seconds\\n- EDM festival track with pulsing synth leads, plucked arpeggios, layered pads, side-chained bass, punchy kick and snare, and hi-hat rolls creating bright, energetic, and uplifting dance energy. BPM: 128. Length: 150 seconds\\n- Lo-fi hip-hop chill track with mellow electric piano, soft vinyl crackle, subtle synth pads, low-pass filtered drums, percussion loops, and soft plucked bass for a relaxed, dreamy vibe. BPM: 75. Length: 150 seconds\\n- Heavy metal anthem with distorted electric guitars, bass guitar, double bass drums, and cymbal crashes with fast palm-muted riffs creating intense, aggressive energy. BPM: 160. Length: 180 seconds\\n- Melancholic piano piece with soft piano lead, string pads, subtle atmospheric synths, and minimal brush percussion evoking a reflective rainy-day feeling. BPM: 60. Length: 240 seconds\\n- Suspenseful electronic thriller with pulsing bass synth, arpeggiated lead synth, cinematic pads, glitchy percussion, and high string stabs creating dark and tense energy. BPM: 100. Length: 200 seconds\\n- Dreamy ambient soundscape with layered pads, soft bell textures, gentle drones, and wind and water field recordings for ethereal and spacious meditation. BPM: 40. Length: 300 seconds\\n- Fingerpicking acoustic guitar solo with harmonics, subtle reverb, occasional shaker and soft stomp percussion, and soft pad layers for warm intimate storytelling. BPM: 70. Length: 120 seconds\\n- Synthwave 80s retro track with arpeggiated synth leads, analog pads, electric bass, punchy electronic drums, gated reverb snares, and atmospheric FX for nostalgic and vibrant energy. BPM: 110. Length: 180 seconds\\n- Tribal percussion ensemble with congas, djembes, bongos, shakers, and frame drums layered with deep synthetic sub-bass in complex polyrhythms. BPM: 100. Length: 140 seconds\\n- 1920s swing jazz with brass section, upright bass, piano, brushed drums, banjo, clarinet, and soft strings that swing lively for energetic dance vibes. BPM: 110. Length: 180 seconds\\n- Futuristic electronic sci-fi track with pulsing bass synth, evolving lead synths, layered pads, glitch percussion, robotic FX, and sub-bass for tense cinematic energy. BPM: 125. Length: 200 seconds\\n- Ambient underwater soundscape with flowing water textures, soft piano motifs, synth drones, distant bells, and underwater reverb for spacious meditative immersion. BPM: 45. Length: 300 seconds\\n- Horror cinematic track with dissonant strings, eerie piano stabs, cinematic percussion including taiko and low toms, and synth FX producing suspenseful creepy tension. BPM: 90. Length: 240 seconds\\n- Reggae track with offbeat guitar, warm basslines, snare, kick, congas, and horn stabs giving laid-back groovy energy. BPM: 85. Length: 150 seconds\\n- Blues track with soulful electric guitar solos, walking bass, piano, and shuffle drums creating expressive and emotive storytelling. BPM: 90. Length: 180 seconds\\n- Latin salsa with congas, timbales, horns, piano montunos, bass, and layered percussion for vibrant danceable energy. BPM: 120. Length: 210 seconds\\n- Afrobeat track with electric guitar stabs, horns, layered percussion, congas, shakers, bass groove, and synth pads for vibrant rhythmic energy. BPM: 105. Length: 200 seconds\\n- Indie rock track with electric guitar riffs, bass, live drum kit, layered synths, and subtle strings for energetic yet emotional feel. BPM: 110. Length: 180 seconds\\n- Funk groove with slap bass, electric guitar chords, brass stabs, drums, congas, and rhythmic keyboards creating high-energy danceable rhythm. BPM: 105. Length: 180 seconds\\n- Drum and bass track with fast breakbeat drums, deep sub-bass, sharp synth leads, pads, and atmospheric FX for high-energy club motion. BPM: 175. Length: 150 seconds\\n- Dark ambient track with drones, distant bells, low rumbles, soft wind textures, and synth pads producing eerie immersive tension. BPM: 50. Length: 300 seconds\\n- Tropical house track with marimba, steel drums, soft synths, smooth bass, layered percussion, and light piano riffs for sunny chill dance vibes. BPM: 110. Length: 180 seconds\\n- Progressive rock track with electric guitar leads, organ, bass, drum kit, synth layers, and occasional strings for epic layered energy. BPM: 100. Length: 220 seconds\\n- Music box melody with delicate metallic tones and soft resonance, lullaby style, with gentle ambient reverb. BPM: 60. Length: 20 seconds\\n- Soft piano arpeggio with warm felted tone and slow attack, lullaby style, with intimate room ambience. BPM: 60. Length: 30 seconds\\n- Harp gentle plucked pattern with airy resonance, lullaby style, with dreamy reverb tail. BPM: 65. Length: 25 seconds\\n- Acoustic guitar fingerstyle pattern with warm nylon strings and soft dynamics, lullaby style, with subtle room resonance. BPM: 60. Length: 30 seconds\\n- Ambient synth pad with smooth evolving texture and soft harmonics, lullaby style, with wide stereo ambience. BPM: 50. Length: 40 seconds\\n- Early rock piano with walking left-hand bass line, shuffle rhythms, and blues scale improvisations in energetic 1950s boogie-woogie style. BPM: 160. Length: 180 seconds\\n- Trip Hop track with jazzy sampled vibraphone, mid-tempo breakbeat drums, harp, Latin ethnic percussion, and sweeping cinematic strings creating airy, relaxing, soulful lounge vibes. BPM: 90. Length: 180 seconds\\n- Country outlaw cinematic instrumental with blues pedal steel guitar, rustic mandolin, fiddle call-and-response, tape-driven rattly drum kit, autoharp, and soaring accordion solo for raw, emotional southern blues expression. BPM: 85. Length: 200 seconds\\n- Neo Classical track with sweeping string section, elegant horns, and delicate piano creating soothing, hypnotic, modern, soft, and classic mood. BPM: 70. Length: 180 seconds\\n- Art Rock desert track with desolate piano chords, western-themed rhythm guitars, unique lead guitars, rattly vintage drum kit, and supporting bass creating lonely, expansive, beautiful, and strange atmospheres. BPM: 95. Length: 180 seconds\\n- Cinematic Sci-Fi score with dramatic horn section, building marcato strings, gliding bassoon, thunderous cymbals, subdued timpani, and subtle synth drones producing awe-inspiring, uplifting, epic intergalactic energy. BPM: 100. Length: 220 seconds\\n- West Coast Hip Hop instrumental with cascading harp melodies, smooth Rhodes piano chops, vintage boom bap drums, and walking double bass producing raw, street, and soulful block-party vibes. BPM: 92. Length: 180 seconds\\n- Synthwave futuristic track with pulsating synth bass, exciting chords, soaring leads, and reverberating drum machine patterns creating gritty, pounding, and cool energy. BPM: 110. Length: 180 seconds\\n- Breakbeat track with complex percussion, intricate breakbeats, gritty synths, lush pads, and 808 bassline producing fresh, modern, futuristic, and rave-ready energy. BPM: 140. Length: 160 seconds\\n- Lounge Jazz 1960s smooth track with laid-back drums, piano chords, double bass, soft electric piano, subtle flute, and unique percussion creating beautiful, atmospheric, eclectic, retro, and chill vibes. BPM: 85. Length: 180 seconds\\n- Latin Jazz 1950s blissful track with laid-back Latin drums, euphoric piano chords, double bass, orchestral accompaniment, acoustic guitar, and vibraphone producing nostalgic, beautiful, atmospheric, cinematic, and chill mood. BPM: 95. Length: 180 seconds\\n- Acid Jazz 1970s summertime track with smooth electric piano, trippy synth leads, laid-back vintage drum kit, fuzzy electric bass, and uplifting violin producing retro, psychedelic, jazzy, relaxing energy. BPM: 100. Length: 180 seconds\\n- Progressive Soul 1970s track with feel-good piano, psychedelic organ, groovy vintage drum kit with percussion, fuzzy electric bass, and synth strings producing retro, raw, soulful, joyous atmosphere. BPM: 90. Length: 180 seconds\\n- Discotheque 1970s French-inspired track with sultry piano, psychedelic guitars, groovy drum kit, fuzzy electric bass, and melancholic organ producing retro, raw, laid-back, and relaxing mood. BPM: 105. Length: 180 seconds\\n- Soul Jazz 1970s track with expressive saxophone, smooth piano, groovy drum kit, rhythmic upright bass, sweeping strings, and minimal vibraphone producing retro, raw, laid-back, and epic energy. BPM: 95. Length: 180 seconds\\n- Vintage R&B 1970s live studio track with subtle brass, smooth piano, sweeping strings, and minimal drums producing retro, beautiful, uplifting, nostalgic mood. BPM: 85. Length: 180 seconds\\n- 50s Pop track with Latin influence, string section, bold brass, vibraphone, acoustic guitar, flute, ethnic percussion, and brushed drums creating sexy, epic, vintage, retro, melancholic, jazzy, dramatic energy. BPM: 100. Length: 180 seconds\\n- A piece of calm, quiet, mellow, serene music perfect for a peaceful film score, featuring soft modulating piano, ambient sfx and foley, beautiful vibraphone, and subtle synthesizer drones. The mood is cinematic, thoughtful, serene and nostalgic. BPM: 55. Length: 300 seconds\",\n  \"Instrument\": \"You are a music metadata expert. Given an instrument, generate a descriptive prompt for a generative audio model.\\n\\n1. Identify the instrument.\\n2. Add playing style or technique.\\n3. Include details about material, timbre, or texture.\\n4. Add musical style or mood. Specify the genre, context, or emotional character.\\n5. Add spatial or production qualities.\\n6. Specify BPM: Always include a BPM appropriate to the style and context.\\n7. Specify length: Provide an integer in seconds (6–20 s for loops, 20–180 s for stems).\\n\\nExamples:\\n- Synth arpeggio loop with bright detuned oscillators. BPM: 120. Length: 8 seconds\\n- Chord stab loop with sharp percussive attack. BPM: 90. Length: 6 seconds\\n- Guitar muted strum loop with tight rhythmic feel. BPM: 100. Length: 8 seconds\\n- Pluck sequence loop with bright resonant tone. BPM: 128. Length: 10 seconds\\n- Marimba and vibraphone percussive loop with resonant wooden and metallic tones. BPM: 110. Length: 12 seconds\\n- Drum loop with deep muffled kick on beat one, snappy rimshot snare on beats two and four with rolling ghost note fills, and tight closed hi-hats with subtle open accents. BPM: 85. Length: 10 seconds\\n- Drum groove loop with brushed snare swinging on the ride, soft feathered kick on downbeats, and light closed hi-hat taps on the upbeats. BPM: 130. Length: 12 seconds\\n- Kick and hi-hat loop with four-on-the-floor punchy kick, tight closed hi-hats on every eighth note, and a sharp dry snare on beats two and four. BPM: 130. Length: 15 seconds\\n- Vinyl crackle drum loop with warm low-pass filtered kick, dusty snare with tape saturation, and shuffled closed hi-hats with subtle vinyl crackle ambiance. BPM: 80. Length: 10 seconds\\n- Ambient pad loop with evolving texture. BPM: 80. Length: 12 seconds\\n- Melodic synth bass groove loop with pumping sidechain feel. BPM: 122. Length: 10 seconds\\n- Melodic Bass slap and pop rhythm loop. BPM: 100. Length: 8 seconds\\n- Acoustic bass walking line loop with natural wooden resonance. BPM: 120. Length: 12 seconds\\n- String pizzicato motif loop, suspenseful, with tight string texture. BPM: 90. Length: 8 seconds\\n- Brass staccato riff loop with sharp bright attack. BPM: 130. Length: 10 seconds\\n- Flute airy melodic loop with wooden headjoint resonance. BPM: 100. Length: 6 seconds\\n- Pan flute ambient loop with breathy timbre. BPM: 75. Length: 8 seconds\\n- Clarinet riff loop with warm smooth reed tone. BPM: 120. Length: 10 seconds\\n- Oboe motif loop, orchestral, with rich double reed resonance. BPM: 80. Length: 8 seconds\\n- Recorder Renaissance motif loop with soft wooden timbre. BPM: 100. Length: 6 seconds\\n- Electric sitar riff loop with buzzing resonant tone. BPM: 90. Length: 10 seconds\\n- Koto plucked motif loop with resonant wooden strings. BPM: 90. Length: 8 seconds\\n- Shamisen folk melody loop with percussive twang. BPM: 100. Length: 8 seconds\\n- Banjo fingerpicking loop with metallic string resonance. BPM: 110. Length: 10 seconds\\n- Mandolin tremolo loop with crisp wooden body tone. BPM: 120. Length: 10 seconds\\n- Acoustic guitar chord vamp loop with natural room resonance. BPM: 110. Length: 12 seconds\\n- Nylon string guitar arpeggio loop with warm, soft timbre. BPM: 90. Length: 15 seconds\\n- Electric guitar riff loop with driven distorted tone. BPM: 130. Length: 10 seconds\\n- Slide guitar melody loop with warm resonant glide. BPM: 100. Length: 12 seconds\\n- Steel guitar slide loop with bright pedal steel tone. BPM: 95. Length: 12 seconds\\n- Harpsichord arpeggio loop with crisp plucked attack. BPM: 120. Length: 10 seconds\\n- Rhodes chord vamp loop with warm electric piano tone. BPM: 100. Length: 12 seconds\\n- Clavinet funky rhythm loop. BPM: 105. Length: 10 seconds\\n- Organ chord vamp loop with full drawbar warmth. BPM: 90. Length: 12 seconds\\n- Drum loop with booming 808 kick on beat one, crisp snare on beat three, and rapid triplet hi-hat rolls with open hat accents for aggressive high-energy feel. BPM: 140. Length: 8 seconds\\n- Breakbeat drum loop with chopped Amen-style snare flurries, driving kick on the one, fast sixteenth-note closed hi-hats, and syncopated open hat accents. BPM: 170. Length: 10 seconds\\n- Glitch percussion loop with stuttered kick transients, randomised snare hits processed with bit-crushing, and erratic hi-hat patterns with pitch-shifted metallic ticks. BPM: 120. Length: 12 seconds\\n- Metallic hits loop with distorted kick impacts, processed metal-plate snare slams, and grinding hi-hat noise bursts for aggressive mechanical texture. BPM: 120. Length: 10 seconds\\n- Timpani hits loop, cinematic, with deep resonant kick-like timpani strikes on beat one, rolling snare-style timpani fills, and no hi-hats for a grand orchestral feel. BPM: 70. Length: 8 seconds\\n- Snare roll loop, dramatic, with accelerating snare drum rolls building from soft to crashing, deep supporting kick pulses, and no hi-hats for maximum impact. BPM: 100. Length: 8 seconds\\n- Accordion motif loop with bright reedy bellows tone. BPM: 100. Length: 10 seconds\\n- Harmonica blues riff loop with expressive reed timbre. BPM: 90. Length: 10 seconds\\n- Trombone riff loop with warm sliding brass tone. BPM: 120. Length: 10 seconds\\n- French horn melodic loop, cinematic. BPM: 80. Length: 12 seconds\\n- Soprano sax ballad loop. BPM: 70. Length: 12 seconds\\n- Alto sax bebop riff loop. BPM: 200. Length: 10 seconds\\n- Electric violin melodic loop with reverb. BPM: 90. Length: 10 seconds\\n- String pad loop with cinematic texture. BPM: 70. Length: 15 seconds\\n- Granular synth evolving texture loop. BPM: 90. Length: 15 seconds\\n- Piano motif loop with soft felt hammer tone. BPM: 80. Length: 10 seconds\\n- Pad and synth loop with lush detuned shimmer. BPM: 85. Length: 12 seconds\\n- Synth lead loop with sidechain pumping compression. BPM: 128. Length: 10 seconds\\n- Analog synth bassline loop with deep warm low-end. BPM: 122. Length: 12 seconds\\n- FM synth lead motif loop with bright metallic shimmer. BPM: 110. Length: 10 seconds\\n- Bass groove loop with tight rhythmic two-bar pattern. BPM: 100. Length: 16 seconds\\n- Acoustic guitar fingerstyle motif loop with warm wood resonance. BPM: 90. Length: 45 seconds\\n- Sombre acoustic guitar motif loop with cavernous reverb, delicate fingerpicking, and expressive melancholic tone. BPM: 70. Length: 45 seconds\\n- Electric guitar rock riff motif loop. BPM: 130. Length: 40 seconds\\n- Vintage electric guitar motif loop, live-recorded in a vintage studio, with expressive and dynamic solo performance. BPM: 90. Length: 40 seconds\\n- Piano chord progression motif loop with rich harmonic movement. BPM: 120. Length: 60 seconds\\n- String ensemble cinematic motif loop with rich wooden resonance. BPM: 80. Length: 120 seconds\\n- Brass ensemble cinematic motif loop with bright metallic timbre. BPM: 90. Length: 90 seconds\\n- Ethnic percussion ensemble motif loop with deep resonant djembe kick tones, slapped snare-like rim hits on congas, and layered shakers and bells providing hi-hat-like rhythmic texture with polyrhythmic patterns. BPM: 100. Length: 90 seconds\\n- Synth ambient motif loop with evolving textures. BPM: 80. Length: 180 seconds\\n- Motif loop with warm dusty vinyl crackle and tape saturation. BPM: 80. Length: 60 seconds\\n- Synth lead and bass motif loop with bright punchy energy. BPM: 128. Length: 90 seconds\\n- Funk band motif loop: bass, drums, guitar. BPM: 100. Length: 90 seconds\\n- Ethnic flute motif for cinematic use. BPM: 80. Length: 30 seconds\\n- Steel drum melodic motif loop with bright metallic resonance. BPM: 110. Length: 20 seconds\\n- Marimba percussive motif loop with resonant wooden tone. BPM: 100. Length: 20 seconds\\n- Vibraphone melodic motif loop with metallic shimmer. BPM: 90. Length: 25 seconds\\n- Piano cinematic motif loop with resonant wooden tone. BPM: 80. Length: 30 seconds\\n- Violin expressive cinematic motif loop with rich wooden resonance. BPM: 75. Length: 25 seconds\\n- Cello expressive motif loop with deep wooden resonance. BPM: 70. Length: 30 seconds\\n- Trumpet expressive motif loop with brassy overtones. BPM: 100. Length: 25 seconds\\n- Sax expressive motif loop with warm reed timbre. BPM: 95. Length: 25 seconds\\n- Ethnic drum ensemble motif loop with booming natural-skin bass drum kicks, sharp hand-slap snare accents on djembes and talking drums, and layered wooden and metal percussion providing rhythmic hi-hat-like patterns. BPM: 95. Length: 30 seconds\\n- Ambient drone motif loop. BPM: 60. Length: 180 seconds\\n- Orchestral tension motif loop. BPM: 90. Length: 150 seconds\\n- Electronic track motif loop with drums, bass, synth. BPM: 128. Length: 180 seconds\",\n  \"SFX\": \"You are a professional sound design expert. Convert the user's input into a precise, vivid sound effects description suitable for generative audio models.\\n\\nDescribe clearly:\\n- Sound source\\n- Physical character (texture, timbre, material: metal, wood, glass, concrete, etc.)\\n- Spatial qualities (indoor/outdoor, cave/open field/underwater, dry/reverberant, close-up/distant, echoing/muffled)\\n- Temporal evolution (attack, decay, movement, transitions over time)\\n- Include motion or spatial movement if applicable (passing, approaching, stereo movement)\\n\\nAudio length rules:\\n- Very short sounds (impacts, clicks, gunshots): 1–3 seconds\\n- Medium actions (footsteps, object movement, transitions): 3–6 seconds\\n- Ambience / environments: 6–15 seconds\\n- Always append: Length: X seconds (integer only, no decimals).\\n\\nOutput constraints:\\n- Length: 1–2 dense sentences maximum\\n- Output ONLY the final rewritten prompt\\n- No explanations, no formatting, no quotes\\n- Use concise but dense technical language\\n- Focus strictly on sound effects or ambience\\n- Always append: Length: X seconds (integer only, no decimals).\\n\\nQuality guidelines:\\n- Be specific and avoid vague terms\\n- Prioritize clarity and realism\\n- Combine elements into one coherent scene\\n- Avoid redundancy\\n\\nExamples:\\n- Heavy rain hitting a metal roof during a thunderstorm, distant thunder rumbles, stereo, realistic ambience. Length: 45 seconds\\n- Quiet forest at dawn with birds chirping, soft wind through leaves, distant stream flowing. Length: 60 seconds\\n- Busy city street at night, cars passing, muffled conversations, occasional horn, urban ambience. Length: 50 seconds\\n- Ocean waves crashing against rocky cliffs, strong wind, dramatic and cinematic. Length: 70 seconds\\n- Wooden door creaking open slowly in an old house, echoing interior, eerie tone. Length: 3 seconds\\n- Glass bottle shattering on concrete, sharp impact, scattered fragments. Length: 2 seconds\\n- Footsteps on gravel, steady walking pace, close perspective. Length: 8 seconds\\n- Typing rapidly on a mechanical keyboard, crisp tactile clicks. Length: 5 seconds\\n- Punch impact with deep bass hit, cinematic trailer style. Length: 2 seconds\\n- Car speeding past at high velocity, doppler effect, realistic whoosh. Length: 3 seconds\\n- Object falling from height and hitting ground with a heavy thud. Length: 2 seconds\\n- Sword swing whooshing through air, fast motion, clean metallic tone. Length: 2 seconds\\n- Futuristic laser blast, clean energy pulse, high-tech sound design. Length: 1 seconds\\n- Spaceship engine humming, low frequency rumble, interior perspective. Length: 90 seconds\\n- Magical spell casting, shimmering particles, rising tonal energy. Length: 8 seconds\\n- Teleportation effect, glitchy digital distortion with a soft whoosh. Length: 5 seconds\\n- Dark eerie drone with distant whispers, creepy, slow build tension. Length: 120 seconds\\n- Sudden horror jump scare sting, sharp violin hit, cinematic. Length: 1 second\\n- Metal scraping slowly in a dark tunnel, echoing and ominous. Length: 20 seconds\\n- Explosion with debris scattering, deep bass, cinematic realism. Length: 4 seconds\\n- Building collapsing, rumbling concrete, dust and debris falling. Length: 25 seconds\\n- Fire crackling intensely, wood burning, close-up detail. Length: 80 seconds\\n- Gunshot in a large empty warehouse, loud echo decay. Length: 2 seconds\\n- Retro arcade coin insert sound, 8-bit style. Length: 1 second\\n- Level up chime, bright, rewarding, fantasy RPG style. Length: 2 seconds\\n- Error buzzer, short, digital, UI feedback. Length: 1 second\\n- Menu navigation clicks, soft futuristic interface sounds. Length: 3 seconds\\n- Layered soundscape: rain, thunder, footsteps, and distant sirens all blending naturally. Length: 90 seconds\\n- Rapid sequence of three impacts: metal hit, glass break, wood crack, spaced evenly. Length: 4 seconds\\n- Sound moving from left to right stereo field: passing motorcycle. Length: 5 seconds\\n- Close vs far perspective transition: footsteps approaching then fading away. Length: 6 seconds\\n- Tape stop sub drop, a massive sub-bass note that mimics a vinyl record or tape machine being turned off, the pitch and speed drop simultaneously, causing the high-end harmonics to smear and thicken as the sound grinds to a halt at a sub-sonic frequency. Length: 11 seconds\\n- Gravel and leaves footsteps, the sound of a hard boot stepping onto dry leaves or gravel, crisp and natural with detailed texture. Length: 11 seconds\\n- Ghostship moan, a massive, deep wooden groan with a low-frequency moan, like heavy timber under immense structural tension, swaying slowly, processed with long, dark wooden room reverb for a sense of scale. Length: 11 seconds\\n- Bicycle chain, a continuous metallic whirring sound of a chain moving over sprockets, with individual teeth catching the links, processed with resonant band-pass filter to emphasize metallic singing. Length: 11 seconds\\n- Warp drive, a sound that starts with a massive suck-back of ambient noise, followed by a supersonic crack and high-pitched zing that disappears into the distance, giving the sense of stretching space-time. Length: 11 seconds\\n- Ice cubes, high-pitched musical clinking of hard ice hitting a thin glass, bright resonant ring with subtle liquid sloshing around the edges. Length: 11 seconds\\n- Paper shuffle, the sound of a thick stack of heavy bond paper being squared up on a desk, dry papery thud with a quick fanning sound as air moves between the pages. Length: 11 seconds\\n- Drawer slam, a blunt, powerful thud made by slamming a wooden desk drawer shut, pronounced low-mid body, slightly distorted for aggressive character. Length: 3 seconds\",\n  \"One-shot\": \"You are a music metadata expert. Given an instrument or sound, generate a descriptive prompt for a short, isolated one-shot audio sample for music production.\\n\\n1. Identify the instrument or sound source.\\n2. Describe the playing technique or hit type (e.g., pluck, slam, tap, stab).\\n3. Include details about material, timbre, or texture.\\n4. Add spatial or production qualities (dry/wet, room, close-mic).\\n5. Specify length: short integer in seconds (1–11 s).\\n\\nExamples:\\n- Piano key hit with bright percussive attack and resonant wooden body. Length: 2 seconds\\n- Kick drum punchy low-end hit with warm skin resonance. Length: 2 seconds\\n- Snare drum rimshot accent with crisp snare wires. Length: 2 seconds\\n- Acoustic guitar fingerstyle note with warm spruce tone. Length: 3 seconds\\n- Bass pluck with jazzy tone and resonant wooden body. Length: 3 seconds\\n- Electric guitar power chord with distortion. Length: 3 seconds\\n- Metallic glitch percussion hit with sharp metallic texture. Length: 2 seconds\\n- Tabla resonant tone hit with natural skin timbre. Length: 2 seconds\\n- Djembe slap accent with dry wooden resonance. Length: 2 seconds\\n- Synth stab with reverb tail. Length: 3 seconds\\n- Violin expressive note with vibrato and rich wooden resonance. Length: 3 seconds\\n- Cello legato note, cinematic, with warm resonant body. Length: 3 seconds\\n- Trumpet bright accent with slightly brassy overtones. Length: 2 seconds\\n- Melodic saxophone jazz riff with smooth reed timbre and a slight vibrato bend. Length: 3 seconds\\n- Harp pluck with airy tone and resonant strings. Length: 2 seconds\\n- Glockenspiel bell-like note with bright metallic clarity. Length: 2 seconds\\n- Metallic clang sound design hit. Length: 2 seconds\\n- Granular texture hit. Length: 3 seconds\\n- Reversed piano hit. Length: 2 seconds\\n- Synth riser effect. Length: 6 seconds\\n- Percussion impact hit. Length: 2 seconds\\n- Cinematic hit. Length: 2 seconds\\n- Dry clap, a crisp, natural single hand clap recorded in a dead room with an extremely sharp transient and no room reflections. Length: 1 second\\n- Studio hat, a classic, natural recording of 14-inch hi-hats played tightly closed, zero ring, very fast decay. Length: 1 second\\n- Disco open hat, bright 14-inch open hi-hat with long, shimmering decay, perfect for disco or dance grooves. Length: 1 second\\n- Pillow kick, acoustic kick drum muffled with a heavy blanket, producing a short, dry \\\"thump\\\" with almost zero resonance. Length: 1 second\\n- Short 808, punchy 808 kick with sharp, distorted transient and fast-decaying sub-tail. Length: 1 second\\n- Egg shaker, classic plastic egg shaker recorded with a small-diaphragm condenser mic, producing a light, consistent \\\"tick\\\" with very short sustain. Length: 1 second\\n- African drums, dynamic African drums and percussion ensemble with natural acoustic textures. Length: 3 seconds\\n- Latin drums, dynamic Latin drums and percussion ensemble featuring authentic rhythmic patterns. Length: 3 seconds\\n- String quartet, euphoric string quartet with dynamic and emotional playing, full of expressive harmonies and movement. Length: 3 seconds\\n- Piano, nostalgic, atmospheric piano piece with dynamic and emotional performance, intimate and resonant. Length: 3 seconds\\n- Analogue drift pad, warm polyphonic pad with three detuned oscillators (saw + triangle), subtle pitch drift, and lush bucket-brigade chorus for wide, nostalgic stereo image. Length: 11 seconds\\n- Phase distortion bass, Casio CZ-style phase-distorted sine wave warped into a jagged sawtooth for retro synth bass tone. Length: 11 seconds\\n- Vibrato saxophone, bright lyrical alto sax with fast fluttery vibrato, reedy vintage tone, captured with ribbon mic for warm nostalgic sound. Length: 11 seconds\\n- Lofi upright bass, upright bass recorded with ribbon mic in a wooden room, natural air with slightly boxy resonance, tape-saturated for dusty 1950s jazz feel. Length: 2 seconds\"\n}",
    "key": [
     "52:43",
     0
    ]
   },
   "class_type": "JsonExtractString",
   "_meta": {
    "title": "Extract Text from JSON"
   }
  },
  "52:40": {
   "inputs": {
    "find": "AUDIO_LENGTH",
    "string": [
     "52:39",
     0
    ],
    "replace": [
     "52:42",
     0
    ]
   },
   "class_type": "StringReplace",
   "_meta": {
    "title": "Text Replace (AUDIO LENGTH)"
   }
  },
  "52:38": {
   "inputs": {
    "string": "SYSTEM_PROMPTS\n\nInput: USER_INPUT\nTarget audio length: AUDIO_LENGTH seconds.\nOutput:",
    "find": "SYSTEM_PROMPTS",
    "replace": [
     "52:49",
     0
    ]
   },
   "class_type": "StringReplace",
   "_meta": {
    "title": "Text Replace (PROMPT TEMPLATE)"
   }
  },
  "52:35": {
   "inputs": {
    "value": true
   },
   "class_type": "PrimitiveBoolean",
   "_meta": {
    "title": "Boolean (Enable_Reprompt)"
   }
  },
  "52:36": {
   "inputs": {
    "value": 150
   },
   "class_type": "PrimitiveFloat",
   "_meta": {
    "title": "Float (Duration)"
   }
  },
  "52:25": {
   "inputs": {
    "ckpt_name": "stable_audio_3_medium.safetensors"
   },
   "class_type": "CheckpointLoaderSimple",
   "_meta": {
    "title": "Load Checkpoint"
   }
  },
  "52:26": {
   "inputs": {
    "clip_name": "t5gemma_b_b_ul2.safetensors",
    "type": "stable_audio",
    "device": "default"
   },
   "class_type": "CLIPLoader",
   "_meta": {
    "title": "Load CLIP"
   }
  }
 },
 "template_qwen_Image_2512_360_lora": {
  "60": {
   "inputs": {
    "filename_prefix": "Qwen-Image-2512",
    "images": [
     "238:231",
     0
    ]
   },
   "class_type": "SaveImage",
   "_meta": {
    "title": "Save Image"
   }
  },
  "266": {
   "inputs": {
    "value": "equirectangular 360 image, "
   },
   "class_type": "PrimitiveStringMultiline",
   "_meta": {
    "title": "String (Trigger Word)"
   }
  },
  "267": {
   "inputs": {
    "delimiter": "",
    "string_a": [
     "266",
     0
    ],
    "string_b": [
     "269",
     0
    ]
   },
   "class_type": "StringConcatenate",
   "_meta": {
    "title": "Concatenate Text"
   }
  },
  "269": {
   "inputs": {
    "value": "A spacious warm living room, soft sunlight through window, soft sofa, delicate decor, green potted plants, clean tidy space, gentle ambient light"
   },
   "class_type": "PrimitiveStringMultiline",
   "_meta": {
    "title": "String (Prompt)"
   }
  },
  "238:219": {
   "inputs": {
    "clip_name": "qwen_2.5_vl_7b_fp8_scaled.safetensors",
    "type": "qwen_image",
    "device": "default"
   },
   "class_type": "CLIPLoader",
   "_meta": {
    "title": "Load CLIP"
   }
  },
  "238:220": {
   "inputs": {
    "vae_name": "qwen_image_vae.safetensors"
   },
   "class_type": "VAELoader",
   "_meta": {
    "title": "Load VAE"
   }
  },
  "238:222": {
   "inputs": {
    "shift": 3.1000000000000005,
    "model": [
     "238:233",
     0
    ]
   },
   "class_type": "ModelSamplingAuraFlow",
   "_meta": {
    "title": "ModelSamplingAuraFlow"
   }
  },
  "238:226": {
   "inputs": {
    "unet_name": "qwen_image_2512_fp8_e4m3fn.safetensors",
    "weight_dtype": "default"
   },
   "class_type": "UNETLoader",
   "_meta": {
    "title": "Load Diffusion Model"
   }
  },
  "238:227": {
   "inputs": {
    "text": [
     "267",
     0
    ],
    "clip": [
     "238:219",
     0
    ]
   },
   "class_type": "CLIPTextEncode",
   "_meta": {
    "title": "CLIP Text Encode (Positive Prompt)"
   }
  },
  "238:228": {
   "inputs": {
    "text": "低分辨率，低画质，肢体畸形，手指畸形，画面过饱和，蜡像感，人脸无细节，过度光滑，画面具有AI感。构图混乱。文字模糊，扭曲",
    "clip": [
     "238:219",
     0
    ]
   },
   "class_type": "CLIPTextEncode",
   "_meta": {
    "title": "CLIP Text Encode (Negative Prompt)"
   }
  },
  "238:231": {
   "inputs": {
    "samples": [
     "238:230",
     0
    ],
    "vae": [
     "238:220",
     0
    ]
   },
   "class_type": "VAEDecode",
   "_meta": {
    "title": "VAE Decode"
   }
  },
  "238:232": {
   "inputs": {
    "width": 2048,
    "height": 1024,
    "batch_size": 1
   },
   "class_type": "EmptySD3LatentImage",
   "_meta": {
    "title": "EmptySD3LatentImage"
   }
  },
  "238:230": {
   "inputs": {
    "seed": 662848447520565,
    "sampler_name": "euler",
    "scheduler": "simple",
    "denoise": 1,
    "model": [
     "238:222",
     0
    ],
    "positive": [
     "238:227",
     0
    ],
    "negative": [
     "238:228",
     0
    ],
    "latent_image": [
     "238:232",
     0
    ],
    "steps": [
     "238:240",
     0
    ],
    "cfg": [
     "238:243",
     0
    ]
   },
   "class_type": "KSampler",
   "_meta": {
    "title": "KSampler"
   }
  },
  "238:224": {
   "inputs": {
    "value": 50
   },
   "class_type": "PrimitiveInt",
   "_meta": {
    "title": "Int (Steps)"
   }
  },
  "238:223": {
   "inputs": {
    "value": 4
   },
   "class_type": "PrimitiveFloat",
   "_meta": {
    "title": "Float (CFG)"
   }
  },
  "238:229": {
   "inputs": {
    "value": false
   },
   "class_type": "PrimitiveBoolean",
   "_meta": {
    "title": "Enable 4 Steps LoRA?"
   }
  },
  "238:225": {
   "inputs": {
    "value": 4
   },
   "class_type": "PrimitiveInt",
   "_meta": {
    "title": "Int (Steps)"
   }
  },
  "238:218": {
   "inputs": {
    "value": 1
   },
   "class_type": "PrimitiveFloat",
   "_meta": {
    "title": "Float (CFG)"
   }
  },
  "238:221": {
   "inputs": {
    "lora_name": "Qwen-Image-2512-Lightning-4steps-V1.0-fp32.safetensors",
    "strength_model": 1,
    "model": [
     "238:264",
     0
    ]
   },
   "class_type": "LoraLoaderModelOnly",
   "_meta": {
    "title": "Load LoRA"
   }
  },
  "238:233": {
   "inputs": {
    "on_false": [
     "238:264",
     0
    ],
    "on_true": [
     "238:221",
     0
    ],
    "switch": [
     "238:229",
     0
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "Switch (model)"
   }
  },
  "238:240": {
   "inputs": {
    "on_false": [
     "238:224",
     0
    ],
    "on_true": [
     "238:225",
     0
    ],
    "switch": [
     "238:229",
     0
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "Switch (steps)"
   }
  },
  "238:243": {
   "inputs": {
    "on_false": [
     "238:223",
     0
    ],
    "on_true": [
     "238:218",
     0
    ],
    "switch": [
     "238:229",
     0
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "Switch (cfg)"
   }
  },
  "238:264": {
   "inputs": {
    "lora_name": "qwen-360-diffusion-2512-int8-bf16-v2.safetensors",
    "strength_model": 1,
    "model": [
     "238:226",
     0
    ]
   },
   "class_type": "LoraLoaderModelOnly",
   "_meta": {
    "title": "Load LoRA"
   }
  }
 },
 "image_qwen_Image_2512_controlnet": {
  "60": {
   "inputs": {
    "filename_prefix": "Qwen-Image-2512",
    "images": [
     "86:8",
     0
    ]
   },
   "class_type": "SaveImage",
   "_meta": {
    "title": "Save Image"
   }
  },
  "121": {
   "inputs": {
    "image": "low_angle_shot.png"
   },
   "class_type": "LoadImage",
   "_meta": {
    "title": "Load Image"
   }
  },
  "122": {
   "inputs": {
    "low_threshold": 0.33,
    "high_threshold": 0.35,
    "image": [
     "123",
     0
    ]
   },
   "class_type": "Canny",
   "_meta": {
    "title": "Detect Edges (Canny)"
   }
  },
  "123": {
   "inputs": {
    "resize_type": "scale total pixels",
    "resize_type.megapixels": 1.6,
    "scale_method": "area",
    "input": [
     "121",
     0
    ]
   },
   "class_type": "ResizeImageMaskNode",
   "_meta": {
    "title": "Resize Image/Mask"
   }
  },
  "125": {
   "inputs": {
    "image": [
     "123",
     0
    ]
   },
   "class_type": "GetImageSize",
   "_meta": {
    "title": "Get Image Size"
   }
  },
  "86:66": {
   "inputs": {
    "shift": 3.1000000000000005,
    "model": [
     "86:112",
     0
    ]
   },
   "class_type": "ModelSamplingAuraFlow",
   "_meta": {
    "title": "ModelSamplingAuraFlow"
   }
  },
  "86:8": {
   "inputs": {
    "samples": [
     "86:3",
     0
    ],
    "vae": [
     "86:39",
     0
    ]
   },
   "class_type": "VAEDecode",
   "_meta": {
    "title": "VAE Decode"
   }
  },
  "86:129": {
   "inputs": {
    "strength": 1,
    "start_percent": 0,
    "end_percent": 1,
    "positive": [
     "86:81",
     0
    ],
    "negative": [
     "86:7",
     0
    ],
    "control_net": [
     "86:130",
     0
    ],
    "vae": [
     "86:39",
     0
    ],
    "image": [
     "122",
     0
    ]
   },
   "class_type": "ControlNetApplyAdvanced",
   "_meta": {
    "title": "Apply ControlNet"
   }
  },
  "86:119": {
   "inputs": {
    "on_false": [
     "86:113",
     0
    ],
    "on_true": [
     "86:116",
     0
    ],
    "switch": [
     "86:118",
     0
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "If/Else Switch"
   }
  },
  "86:120": {
   "inputs": {
    "on_false": [
     "86:115",
     0
    ],
    "on_true": [
     "86:117",
     0
    ],
    "switch": [
     "86:118",
     0
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "If/Else Switch"
   }
  },
  "86:112": {
   "inputs": {
    "on_false": [
     "86:37",
     0
    ],
    "on_true": [
     "86:111",
     0
    ],
    "switch": [
     "86:118",
     0
    ]
   },
   "class_type": "ComfySwitchNode",
   "_meta": {
    "title": "If/Else Switch"
   }
  },
  "86:130": {
   "inputs": {
    "control_net_name": "Qwen-Image-2512-Fun-Controlnet-Union-2602.safetensors"
   },
   "class_type": "ControlNetLoader",
   "_meta": {
    "title": "Load ControlNet Model"
   }
  },
  "86:58": {
   "inputs": {
    "width": [
     "125",
     0
    ],
    "height": [
     "125",
     1
    ],
    "batch_size": 1
   },
   "class_type": "EmptySD3LatentImage",
   "_meta": {
    "title": "EmptySD3LatentImage"
   }
  },
  "86:3": {
   "inputs": {
    "seed": 985578626029454,
    "sampler_name": "euler",
    "scheduler": "simple",
    "denoise": 1,
    "model": [
     "86:66",
     0
    ],
    "positive": [
     "86:129",
     0
    ],
    "negative": [
     "86:129",
     1
    ],
    "latent_image": [
     "86:58",
     0
    ],
    "steps": [
     "86:119",
     0
    ],
    "cfg": [
     "86:120",
     0
    ]
   },
   "class_type": "KSampler",
   "_meta": {
    "title": "KSampler"
   }
  },
  "86:116": {
   "inputs": {
    "value": 4
   },
   "class_type": "PrimitiveInt",
   "_meta": {
    "title": "Steps"
   }
  },
  "86:117": {
   "inputs": {
    "value": 1
   },
   "class_type": "PrimitiveFloat",
   "_meta": {
    "title": "CFG"
   }
  },
  "86:111": {
   "inputs": {
    "lora_name": "Qwen-Image-Lightning-4steps-V1.0.safetensors",
    "strength_model": 1,
    "model": [
     "86:37",
     0
    ]
   },
   "class_type": "LoraLoaderModelOnly",
   "_meta": {
    "title": "Load LoRA"
   }
  },
  "86:37": {
   "inputs": {
    "unet_name": "qwen_image_2512_fp8_e4m3fn.safetensors",
    "weight_dtype": "default"
   },
   "class_type": "UNETLoader",
   "_meta": {
    "title": "Load Diffusion Model"
   }
  },
  "86:38": {
   "inputs": {
    "clip_name": "qwen_2.5_vl_7b_fp8_scaled.safetensors",
    "type": "qwen_image",
    "device": "default"
   },
   "class_type": "CLIPLoader",
   "_meta": {
    "title": "Load CLIP"
   }
  },
  "86:39": {
   "inputs": {
    "vae_name": "qwen_image_vae.safetensors"
   },
   "class_type": "VAELoader",
   "_meta": {
    "title": "Load VAE"
   }
  },
  "86:118": {
   "inputs": {
    "value": false
   },
   "class_type": "PrimitiveBoolean",
   "_meta": {
    "title": "Enable 4 Steps LoRA?"
   }
  },
  "86:7": {
   "inputs": {
    "text": "低分辨率，低画质，肢体畸形，手指畸形，画面过饱和，蜡像感，人脸无细节，过度光滑，画面具有AI感。构图混乱。文字模糊，扭曲",
    "clip": [
     "86:38",
     0
    ]
   },
   "class_type": "CLIPTextEncode",
   "_meta": {
    "title": "CLIP Text Encode (Negative Prompt)"
   }
  },
  "86:81": {
   "inputs": {
    "text": "A woman with curly hair, wearing orange sunglasses, a white knit sweater with orange accents, and high-waisted orange trousers, stands confidently against a vibrant, clear blue sky. The photo has a warm, sunlit filter that amplifies the rich terracotta and burnt orange tones of her outfit, while the cool, deep blue background is intensified, creating a bold, saturated contrast that feels vivid and cinematic.",
    "clip": [
     "86:38",
     0
    ]
   },
   "class_type": "CLIPTextEncode",
   "_meta": {
    "title": "CLIP Text Encode (Positive Prompt)"
   }
  },
  "86:113": {
   "inputs": {
    "value": 50
   },
   "class_type": "PrimitiveInt",
   "_meta": {
    "title": "Steps"
   }
  },
  "86:115": {
   "inputs": {
    "value": 4
   },
   "class_type": "PrimitiveFloat",
   "_meta": {
    "title": "CFG"
   }
  }
 },
 "template_character_portrait_relighting": {
  "124": {
   "inputs": {
    "image": "silver_hand.png"
   },
   "class_type": "LoadImage",
   "_meta": {
    "title": "Load Image"
   }
  },
  "136": {
   "inputs": {
    "prompt": "Maintain the identity of input image 1, modify the shadows to match the following lighting style: dual rim backlight, no front key, twin hard lights from behind left and right, subject silhouetted at center, glowing edge separation on both sides, dramatic dark fill",
    "model": "Nano Banana 2 (Gemini 3.1 Flash Image)",
    "seed": 194380522768098,
    "aspect_ratio": "auto",
    "resolution": "1K",
    "response_modalities": "IMAGE+TEXT",
    "system_prompt": "You are an expert image-generation engine. You must ALWAYS produce an image.\nInterpret all user input—regardless of format, intent, or abstraction—as literal visual directives for image composition.\nIf a prompt is conversational or lacks specific visual details, you must creatively invent a concrete visual scenario that depicts the concept.\nPrioritize generating the visual representation above any text, formatting, or conversational requests.",
    "images": [
     "124",
     0
    ]
   },
   "class_type": "GeminiImage2Node",
   "_meta": {
    "title": "Nano Banana Pro (Google Gemini Image)"
   }
  },
  "138": {
   "inputs": {
    "filename_prefix": "ComfyUI-nb_2",
    "images": [
     "136",
     0
    ]
   },
   "class_type": "SaveImage",
   "_meta": {
    "title": "Save Image"
   }
  }
 },
 "api_grok_video_extend": {
  "1": {
   "inputs": {
    "file": "deep_space_nexus.mp4"
   },
   "class_type": "LoadVideo",
   "_meta": {
    "title": "Load Video"
   }
  },
  "2": {
   "inputs": {
    "prompt": "Begin in deep space, camera slowly ascends, pulls back and orbits forward from a ring space station, revealing a vast futuristic space city with brilliant nebulae and flying starships, epic sci-fi style; background music is grand orchestral score, quiet and low at first, strings and vocals rise with the camera, drums and brass erupt at climax, magnificent and awe-inspiring.",
    "model": "grok-imagine-video",
    "model.duration": 6,
    "seed": 1577960711,
    "video": [
     "1",
     0
    ]
   },
   "class_type": "GrokVideoExtendNode",
   "_meta": {
    "title": "Grok Video Extend"
   }
  },
  "3": {
   "inputs": {
    "filename_prefix": "video/Grok",
    "format": "auto",
    "format.codec": "auto",
    "video": [
     "2",
     0
    ]
   },
   "class_type": "SaveVideo",
   "_meta": {
    "title": "Save Video"
   }
  }
 },
 "api_bria_remove_video_background": {
  "2": {
   "inputs": {
    "background_color": "Transparent",
    "seed": 1763993566,
    "video": [
     "4",
     0
    ]
   },
   "class_type": "BriaRemoveVideoBackground",
   "_meta": {
    "title": "Bria Remove Video Background"
   }
  },
  "4": {
   "inputs": {
    "file": "spear_warrior.mp4"
   },
   "class_type": "LoadVideo",
   "_meta": {
    "title": "Load Video"
   }
  },
  "5": {
   "inputs": {
    "filename_prefix": "video/ComfyUI",
    "format": "auto",
    "format.codec": "auto",
    "video": [
     "2",
     0
    ]
   },
   "class_type": "SaveVideo",
   "_meta": {
    "title": "Save Video"
   }
  }
 },
 "api_sync_so_lip_sync_video": {
  "8": {
   "inputs": {
    "seed": 1724260774,
    "model": "sync-3",
    "model.sync_mode": "bounce",
    "model.speaker_selection": "default",
    "model.speaker_frame": 0,
    "model.speaker_x": 0,
    "model.speaker_y": 0,
    "video": [
     "9",
     0
    ],
    "audio": [
     "11",
     0
    ]
   },
   "class_type": "SyncLipSyncNode",
   "_meta": {
    "title": "sync.so Lip Sync"
   }
  },
  "9": {
   "inputs": {
    "file": "girl_looking_at_photo.mp4"
   },
   "class_type": "LoadVideo",
   "_meta": {
    "title": "Load Video"
   }
  },
  "11": {
   "inputs": {
    "audio": "sync3_reference_audio.mp3"
   },
   "class_type": "LoadAudio",
   "_meta": {
    "title": "Load Audio"
   }
  },
  "13": {
   "inputs": {
    "filename_prefix": "video/lip_sync_3.0",
    "format": "auto",
    "format.codec": "auto",
    "video": [
     "8",
     0
    ]
   },
   "class_type": "SaveVideo",
   "_meta": {
    "title": "Save Video"
   }
  }
 },
 "api_sonilo_v2m": {
  "703": {
   "inputs": {
    "prompt": "Sense of absurdity, a leopard sprinting at full speed in the wilderness, silent film, comedy",
    "seed": 0,
    "video": [
     "705",
     0
    ]
   },
   "class_type": "SoniloVideoToMusic",
   "_meta": {
    "title": "Sonilo Video to Music"
   }
  },
  "705": {
   "inputs": {
    "file": "leopard_rider.mp4"
   },
   "class_type": "LoadVideo",
   "_meta": {
    "title": "Load Video"
   }
  },
  "728": {
   "inputs": {
    "filename_prefix": "audio/Sonilo",
    "format": "mp3",
    "format.quality": "V0",
    "audio": [
     "703",
     0
    ]
   },
   "class_type": "SaveAudioAdvanced",
   "_meta": {
    "title": "Save Audio (Advanced)"
   }
  }
 }
};
