# Repérage → décor · depth lock (test evidence)

## Cause (PR #143)
Klein `ReferenceMultiLatent` locks **appearance** to image 0. Putting a street photo first made the result photoreal but **copied the street-level framing**, losing the elevated 3D viewpoint (JD’s rule: the 3D view is the required base).

## Goal
Keep the exact 3D composition (cathedral spire placement, elevated rooftops) and fill photoreal materials/light. Photos only for style — never for camera.

## What we tried (Comfy Cloud, ≤ 25 crédits — real cost = gpu_s × 0.27325)

| Run | Approach | Framing vs 3D | Photoreal | gpu_s | ≈ crédits | Verdict |
|---|---|---|---|---|---|---|
| 0aa60e2d | **InstantX Union + Lotus depth** on JD frame crop | PASS (spire + elevated) | PASS | 15.85 | 4,33 | **Ship** |
| b7cfb663 | InstantX + Lotus on clean 1536×864 colour capture | PASS | PASS | 13.89 | 3,80 | **Ship** |
| 704a0fef | Qwen Image 2.1 edit, InstantX result + street photo as style | PASS framing | PARTIAL (people leaked from street photo) | 10.84 | 2,96 | Defer 2nd pass |
| **Total** | | | | | **≈ 11,09 / 25** | |

Skipped Magnific / heavier upscalers (~23 crédits alone) — over remaining budget.

## Fix shipped
`cadre-decor` now builds the InstantX + Lotus API graph (`image_qwen_image_instantx_controlnet`):
- image = colour 3D frame only;
- Lotus estimates depth; InstantX ControlNet locks structure;
- Qwen Image Lightning (4 steps) fills photoreal;
- street photos colour the **prompt** only in v1 (not uploaded — a 2nd edit pass leaked people).

Quote: **≈ 5 crédits** (ceiling 8), flat for 0–3 photos. `ComfyProgress` unchanged.

## Limits
- Style from street photos is prompt-only in v1; materials can miss the exact Mapillary look.
- Lotus re-estimates depth from the colour massing (native renderer depth exists but is unused this pass).
- Cropped frames that still show UI chrome can bake faint header glyphs — prefer the clean engine capture (`capture-photo-couleur`).

## Side-by-side
- `before-cadre-3d.png` / `before-cadre-clean.jpg` — 3D views used as structure.
- `after-run1-side-by-side.png`, `after-run2-side-by-side.png` — InstantX winners.
- `after-run3-side-by-side.png` — style pass rejected for people leak.
