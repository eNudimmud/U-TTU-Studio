# ANIME Studio — structure, root cause, and open-weights inventory

This note explains what changed in this PR, why, and exactly what the "Générer" button
did before and does now. It is written for the next person who touches this code, not
for the studio itself — none of this wording appears in the product.

## 1. Hackathon rules, first

Comfy "Open Source Higgsfield" contest: open-weights only, Comfy-only (no other render
host), and a bonus for "Built with MiniMax H3". This PR:

- Adds no new partner (paid-API) node. `templatePartenaire()` in
  `src/lib/workflows/registre.ts` already marks every `api_*` template (and the three
  no-prefix partner templates) as partner; nothing here changes that list.
- Touches no secret. `BLOB_READ_WRITE_TOKEN`, Mapillary and Comfy keys are never read,
  printed, or committed by this change.
- Sends no render. Every change in this PR is either copy, routing, or a pure prompt-text
  helper (§4) — confirmed by `npm test` (see `tests/anime-look.test.ts`).
- MiniMax H3 is already used for reference-true acting shots in the non-anime path
  (`video_minimax_h3_i2v` and friends, see `models-per-workflow` entries for `prise`). The
  anime acting path (§3) uses Wan 2.2 14B + AniSora instead, because that is the open-weights
  template the registry already measured for this look; MiniMax H3 attribution in the anime
  path specifically is listed as a follow-up in §5, not claimed here.

## 2. What "Générer" (13 credits) actually did, and does now

**Before.** `src/components/look/bible-page.tsx` rendered a button labelled with a credit
count next to a caption that read (EN) *"Concept art — your project is rendered on Comfy
with the open anime pipeline."* Tracing the click handler: it called `confirmerLook()`,
which only writes `.uttu/look.json` (a style *choice*, not a render) — a free, local
operation. **No Comfy job was ever submitted by this button.** The "13 credits" figure and
the "rendered on Comfy" caption described a render that never happened; the page both
overstated the cost (a real number, attached to a no-op) and misstated the result (claimed
a render when none occurred).

Root cause of *why* nothing downstream used the look either, once chosen:

1. `src/lib/workflows/registre.ts` gates every anime-specific row behind
   `FiltreGestes.anime25d`.
2. `filtreOutils()` in `src/lib/studio-prefs.ts` builds that filter object but never sets
   `anime25d` — it only derives `openWeightsOnly` and `nanoBanana`. So `anime25d` is always
   `undefined`, and every anime row in the registry is permanently invisible to
   `gesteVisible()`.
3. Even where visible, `gesteOuvert()` requires `geste.still !== null` to let the picker
   actually run a card — and every anime-specific row in the registry has `still: null`
   (see the comment at the top of `registre.ts`: *"A null `still` means the studio has no
   graph for it yet"*). So the cards were designed as placeholders, not yet wired to a
   runnable graph.
4. The one function that *was* fully built and tested to translate a chosen look into
   template/cost overrides, `consulterLook()` in `src/lib/look/resolve.ts`, is never called
   from any live render path (`studio-session.tsx`'s `createCast`/`createDecor`, or the take
   engine) — only from its own tests and from `agent.ts`'s `proposerLook` (a suggestion, not
   a render path).
5. Even if wired, `stillEngine()` / `stillGraph()` in `src/lib/creation/still.ts` has no
   graph builder for `image_krea2_turbo_int8_image_style_reference` or
   `image_qwen_image_2_1_image_edit` (the two templates the anime registry rows actually
   name) — an unrecognized template name silently falls back to FLUX.3 Klein. Wiring
   `consulterLook()` in without first building those two graphs would have made the studio
   *label* a Klein render as "Qwen Image 2.1 Edit, Anime 2.5D" — a worse, silent
   mislabel, not a fix.

**Now.** Three changes, each scoped to stay honest without submitting an untested paid job:

- The Bible's button is renamed **"Apply this look to the project"**, with the caption
  *"Free. Nothing is rendered — this only sets how characters and backgrounds you make next
  will look."* It calls the same free `confirmerLook()` write — now the label matches the
  action exactly. See `src/components/look/bible-page.tsx` (`applyLook`) and
  `src/lib/look/bible-copy.ts` (`apply`/`applyNote`/`applied`).
- The caption under the key-visual concept art reads *"Concept art — shows the direction
  only. Nothing here was rendered by this project."* — `"rendu sur Comfy"` /
  `"rendered on Comfy with the open anime pipeline"` is removed everywhere it appeared
  (`src/lib/look/copy.ts`, all four locales; pinned by the regex test in
  `tests/anime-look.test.ts`, which already forbids "free"/"gratuit"/"kostenlos"/"gratis" in
  this copy and now also forbids the "rendered on Comfy" phrasing).
- Once applied, the look now **genuinely changes what the next render produces**, on the
  real, already-working Klein/Nano pipeline: `animeLookPromptSuffix()`
  (`src/lib/look/resolve.ts`) turns the chosen preset's locked style
  (line/shading/palette/depth + the on-twos/threes timing) into plain English and appends
  it to the prompt sent by `createCast`/`createDecor` in
  `src/components/app/studio-session.tsx`. A project with no look is unaffected — this is
  purely additive and a no-op (`animeLookPromptSuffix(null) === ""`). This is the fix for
  "it must be rendered IN the studio": the chosen look now shows up in the actual images
  Cast and Set produce, through the pipeline that already renders and is already quoted
  correctly, rather than through an unbuilt dedicated anime graph.
- Finish was already correct and is unchanged: `src/components/app/film/film-finish.tsx`
  reads the project look directly (`useProjectLook()`) and, when it is Anime 2.5D, passes
  `animeFinish: true` into `runOutil()`, which runs the real `grapheFinition()` Real-ESRGAN
  anime graph (`src/lib/look/finish-graph.ts`) — a complete VHS_LoadVideo → upscale →
  optional color-transfer → VHS_VideoCombine graph. This is the one anime-specific stage
  that was already rendering correctly end-to-end before this PR.

## 3. Two sections, one shared shape

Cast · Set · Shoot · Edit · Finish stays the shared shape of both sections. ANIME Studio
(`/anime`, `/anime/bible`) is a project-level look (`.uttu/look.json`, kind `"anime25d"`)
that the same five steps pick up: Cast makes model sheets, Set makes backgrounds, Shoot
places a character into a shot, Finish sharpens with the anime-specific Real-ESRGAN pass.
CINEMA keeps its own tools and models in its own, separately built PR. The join point
between the two is `src/components/app/section-switch.tsx` — a small, generic
`SectionSwitch` component that takes a `sections: Record<"cinema" | "anime", {href,
label}>` map, so the parallel CINEMA PR only has to fill in its own `cinema` entry without
touching this component or the rest of `project-chain.tsx`.

## 4. Naming

| Old, confusing | New | Why |
|---|---|---|
| "Look" (nav) | "ANIME Studio" | Names the section, not a vague photo-editing word |
| "Standard" (nav) | "Cinema" | Names the other section by what it is |
| Lantern imagery (`heroAlt`, `finalTitle`) | Removed; "key visual", "shot" | The lantern had no function in the product; it only confused |
| "Rythme anime" | "Animation timing — on twos" (`timing`/`timingNote`) | Names the real production concept (limited animation, redrawing every 2nd frame) in plain English, used across all locales |
| "Style frame" / "Cadre de style" | "Key visual" | Real production term for the single reference image that sets a project's whole look |
| "Characters" / "Personnages" (Bible step) | "Model sheets (settei)" | Real term for a turnaround reference sheet |
| "Places" / "Lieux" (Bible step) | "Backgrounds (layout)" | Real terms: background art + the layout stage that composes it with characters |
| "Shots" / "Plans" (Bible step) | "Sakuga (shots)" | Names the production term for a standout animated shot |
| "Finish" / "Finition" (Bible step) | "Finish (compositing)" | Names the real final-assembly stage the upscale pass belongs to |

Per the brief, production terms (key visual, settei/model sheet, layout, genga, douga, cel
shading, 2.5D, compositing, "on twos/threes", smear frames, impact frames, sakuga) are used
in English across every locale, and are only *explained* — one line, plain language — on
the new dedicated guide page `/guide/anime`, never as a chip or panel inside the studio
workspace itself.

## 5. Open-weights Comfy template inventory for anime (exhaustive, by category)

All templates below are already declared open-weights in `TEMPLATES_OFFICIELS`
(`src/lib/workflows/registre.ts`) — none is an `api_*` partner node.

| Category | Template | Registry row(s) | Status |
|---|---|---|---|
| Key visual / style reference | `image_krea2_turbo_int8_image_style_reference` | `anime-style-frame`, `anime-decor` | Registered, `still: null` — no `stillGraph()` builder yet (§2.5) |
| Character / model sheet | `image_qwen_image_2_1_image_edit` | `anime-sheet` | Registered, `still: null` — no graph builder yet |
| Character / model sheet (fallback, >2 refs) | `image_flux3_klein_image_edit` | `anime-sheet-klein` | Registered; Klein *is* wired in `stillGraph()` (`"klein"` branch) — closest to runnable today |
| Backgrounds | `image_krea2_turbo_int8_image_style_reference` | `anime-decor` | Same as key visual, above |
| Backgrounds from a photo | `image_qwen_image_2_1_image_edit` | `anime-decor-photo` | No graph builder yet |
| Shots — first frame | `image_qwen_image_2_1_image_edit` | `anime-first-frame` | No graph builder yet |
| Shots — acting | `video_wan2_2_14B_i2v` (+ AniSora high/low weights) | `anime-prise-jeu` | Registered; not yet wired to a video graph builder |
| Shots — camera move / wide | `video_ltx2_5_i2v` | `anime-prise-camera` | Template is already measured and running for the non-anime LTX path; anime row reuses it but is not yet routed through `consulterLook()` |
| Lineart / colour (closest existing fit) | `image_qwen_Image_2512_controlnet` | `outil-img-croquis` (generic tool, not anime-specific) | **Live today**, but as a generic sketch-to-image tool, not anime-labelled or anime-routed |
| Interpolation (closest existing fit) | `utility_video_frame_interpolation` | `suite-fluidifier` (generic "Et ensuite ?" tool) | **Live today**, generic, not anime-specific |
| Lip-sync | — | — | **Gap.** The only lip-sync template in the catalog is `api_sync_so_lip_sync_video`, a partner (paid-API) node — explicitly excluded under this hackathon's open-weights-only rule. No open-weights lip-sync template was found. Documented here rather than silently omitted. |
| Upscale / enhance (anime-specific) | `core_realesrgan_anime` | `anime-finish` | **Live today**, end-to-end, via `grapheFinition()` (§2, last bullet) |
| Upscale / enhance (generic, also usable on anime takes) | `utility_seedvr2_3b_int8_upscale_video` | `suite-finaliser-video` | Live, generic |

**Bottom line.** Two of the ten categories (Finish/upscale, and interpolation/lineart via
the generic tools) are genuinely live today. The others are registered in the registry with
correct template names and credit estimates, but have no `stillGraph()` builder and are
never reached by a live render path — turning them on without first building and testing
those graphs against a live Comfy account would risk mislabeling (§2.5) or an untested paid
submission, which this PR's security constraints explicitly rule out. This PR's render fix
(`animeLookPromptSuffix`, §2) is deliberately the smallest change that makes the chosen look
visibly affect output today, on infrastructure that is already correct, while this table
gives the next PR an exact, checked starting point for each remaining graph.

## 6. Left out of this PR, on purpose

- No new `stillGraph()` builders for `image_krea2_turbo_int8_image_style_reference` or
  `image_qwen_image_2_1_image_edit` — building and testing these against a live Comfy
  account is out of scope for a text/structure/ergonomics pass under a no-paid-generation
  constraint.
- No video graph builder for `video_wan2_2_14B_i2v` (AniSora acting) or re-routing
  `video_ltx2_5_i2v` through `consulterLook()` for the anime camera-move row.
- No open-weights lip-sync option — none exists in the current catalog (§5).
- No MiniMax H3 usage specifically inside the anime path (it is already used elsewhere in
  the studio, for reference-true shots in the non-anime path) — noted as a possible future
  "Built with MiniMax H3" bonus angle, not implemented here, since it would need its own
  tested graph wiring for the anime style.
