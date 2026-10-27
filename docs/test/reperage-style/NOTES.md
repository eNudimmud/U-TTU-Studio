# Repérage → décor · style (fix evidence)

## Cause
Klein `ReferenceMultiLatent` locks **appearance** to image 0. Sending the grey colour capture as image 0 (plus street photos) keeps the clay/metallic look no matter how hard the prompt asks for a photograph. Prompt-only A/B confirmed this (JD + our run).

## What we tried (Comfy Cloud, ≤ 25 crédits)
| Run | Conditioning | Result | gpu_s | ≈ cr |
|---|---|---|---|---|
| b32cc6fc… | colour frame + photos, stronger transform prompt | still CG | 27.66 | 7.56 |
| 6a2ab8eb… | edges as image 0 + photos | layout OK, still CG | 27.44 | 7.50 |
| e657d3b8… | **street photo as image 0**, edges as image 1 (structure), more photos | **photoreal** | 32.28 | 8.82 |
| **Total** | | | | **≈ 23.9 / 25** |

## Fix shipped
When the visitor picks ≥ 1 street photo, `cadreImages` builds `[photo0, lines, …photos]` and `cadrePrompt({ layout: "photo-lines" })` asks Klein to take layout from the edge map and materials from the photos. Without photos, keep the colour frame as image 0 (frame-first).

Also: shared `ComfyProgress` (bar + % + elapsed / ≈ remaining) on every long wait (fil, ToolStage, repérage, outils, vidéo, PRISE, mesh, finaliser).

## Limits
Photo-first can drift from the exact 3D viewpoint when Mapillary refs don’t match the elevated frame — still photoreal, which was the “vraiment dégueulasse” clay bug. No more crédits left in the 25 budget for further A/B.
