# Submission package — Comfy « Open Source Higgsfield » (draft)

**Status: draft, docs only.** Nothing has been submitted, posted or rendered. JD fills and sends the form himself. Researched on Sun 1 Nov 2026, 03:40–05:00 (Europe/Zurich).

- Deadline: **Tue 3 Nov 2026, 9:00 PT = 18:00 Zurich (UTC+1)**. Internal: code freeze 10:00, package ready 16:00.
- Contest page: <https://comfy.org/open-source-higgsfield/> (machine-readable copy: <https://comfy.org/open-source-higgsfield.md>)
- Submission form: <https://form.typeform.com/to/V1dSQrkS> · sign-up form: <https://form.typeform.com/to/Ayn9Cwfj>
- Announcement post: <https://blog.comfy.org/p/higgsfield-promised-to-open-source>
- Previous drafts (30 Oct deadline, now outdated): `/workspace/concours/soumission/` on the agent box, not in the repo.

> Third-party pages (comfyui-wiki, thesignal.blog, thereelstack) still say « 30 Oct / winners 6 Nov ». The official page says **3 Nov 9am PT, winners 10 Nov**. Trust the official page.

## 1. What the rules require (official page + form, read 1 Nov 2026)

| # | Requirement | Source | Where it lives for us |
|---|---|---|---|
| R1 | Working creative app built **with ComfyUI** (form asks which parts: Comfy API, Comfy Router, Comfy SDK, Comfy Cloud Agent, Comfy MCP) | page « How to enter », form | Comfy Cloud API from the browser via the same-origin relay; Comfy Router for Uttu's Comfy mode |
| R2 | **Public GitHub repo with an open-source license and setup instructions** | page Q&A « Does my repo need a license? », form | <https://github.com/eNudimmud/U-TTU-Studio>, MIT, README « Run locally » |
| R3 | **Demo video < 2 minutes**, « show us your build in action **and how you built it** ». Judged on the work, not the editing | form, page Q&A | see §6 — **the V11 clip is 2:30, too long** |
| R4 | **Social post** linking the demo, tagging **#OpenSourceHiggsfield** (X, IG, Reddit, TikTok…) | form | JD posts (not drafted by agents without JD's text approval) |
| R5 | Live link to try it — optional, strongly encouraged, not public, « expect 5–10 runs for judging » | form | <https://u-ttu-studio.vercel.app/studio> (judges bring their own Comfy account: say so) |
| R6 | One-line description ≤ 100 characters | form | §2 |
| R7 | « List all generative models used » + « Other tools or techniques » | form | §3, §5 |
| R8 | Pick categories; « Is your stack fully open? » (Yes = every model, node and dependency open-weights/open-source, **no closed API model in the critical path**; rented GPUs still count) | form | §4 |
| R9 | Agreements: repo public + OSS license; lawful, SFW, **no unlicensed IP or real people's likeness**; Comfy, Runpod, LTX, BFL and MiniMax may feature the entry (Creator Feature Terms); **« This is my only submission »** | form | §7 |
| R10 | Most Innovative: **the demo video must explain why it is innovative** | page | §6 |
| R11 | Open Weights Only: **no partner nodes or closed-source APIs, open-weights models only** | page | §4 |
| R12 | Bonuses (one main + one bonus possible): LTX = LTX core video model; FLUX = **FLUX 3** core model; MiniMax H3 = H3 core model | page | §4 |

No published scoring rubric beyond the category descriptions and « we're judging the work, not your video editing ».

## 2. Pitch (English)

**One-liner (≤ 100 chars, 96):** `Describe a scene, Uttu storyboards it, Comfy films it. Open-source AI film studio on your phone.`

> *Alternative (75):* `An open-source AI film studio on ComfyUI: intention, storyboard, shot, cut.`

**Short pitch (for « Anything else »):**

> U*TTU Studio is an open-source film studio on ComfyUI that hides the graph. You describe what you want to shoot; Uttu, the studio agent, turns it into a storyboard; each shot is filmed by an official Comfy workflow, then cut and exported in the browser. Your characters (CAST) and places (SET) are named references — `@Enki`, `@Fizz`, `@Blanche Of Castille`, up to three photos each — so identities stay consistent from shot to shot.
> Every render runs on the visitor's own Comfy account through the documented Comfy Cloud API; the studio holds no key and sells nothing. Every paid button shows « ≈ X credits (estimated) » and waits for a confirmation; the studio never cancels a running job, and Finalize only enhances an existing take — it never regenerates.
> Open by default: « Studio models only » hides partner tools, and every gesture ships as an exported Comfy workflow in `workflows/` that `scripts/run-local.mjs` can send to your own ComfyUI.

**Why it is innovative (to say in the video, R10):** the Comfy graph disappears behind a conversation and a living storyboard; named multi-reference casting keeps several characters distinct in one shot; a quote-before-credit contract on every gesture; phone-first (390 px) with 44 px touch targets.

## 3. Models — licenses and open-weights status

Verdict for the contest: the Open Weights Only category asks for **open-weights models** and **no partner nodes / closed APIs**. It does not require an OSI license. All models below publish their weights, so they are eligible as models; the license column matters for the « fully open? » answer and for commercial use after the contest.

| Model (file used by the studio) | License | Open weights | Open Weights Only eligible | Commercial use | Source |
|---|---|---|---|---|---|
| **MiniMax H3** — `minimax_h3_*_ref2va/fl2va`, turbo LoRAs | MiniMax H3 Community License (custom) | **Yes** (HF, ungated) | **Yes** (as a local/Cloud-run model, *not* the `api_minimax_h3_max_r2v` partner node) | Yes below US$20M revenue, with conditions; **territory excludes EU, UK, South Korea, USA** (separate license needed there); « MiniMax H3 » must be shown prominently in a commercial UI | [model card](https://huggingface.co/MiniMaxAI/MiniMax-H3) · [LICENSE](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE) · [Comfy H3 page](https://comfy.org/minimax-h3/) · [Comfy license FAQ](https://comfy.org/minimax/license/) |
| **FastH3** (FastVideo distillation) — `fasth3_omniref_8step_pruned_int8_convrot` | MiniMax H3 Community License (inherited, base = MiniMax-H3) | Yes | Yes | Same as H3 | [FastVideo/FastH3-Omni-Comfy](https://huggingface.co/FastVideo/FastH3-Omni-Comfy) · [FastVideo-FastH3-8-Step-V2](https://huggingface.co/FastVideo/FastVideo-FastH3-8-Step-V2) |
| Pika H3 Flex (LoRA on H3 Ref2VA) | MiniMax H3 Community License | Yes | Yes | Same as H3 | [Pika-Labs/Pika-H3-Flex](https://huggingface.co/Pika-Labs/Pika-H3-Flex) |
| **LTX-2.5** (dev/distilled) | LTX-2.x Community License (custom) | Yes (HF, auto-gated) | Yes | Free below US$10M annual revenue; paid license above | [Lightricks/LTX-2.5](https://huggingface.co/Lightricks/LTX-2.5) · [LICENSE-2_x](https://github.com/Lightricks/LTX-2/blob/main/LICENSE-2_x) |
| LTX-2.3 (IC-LoRA, outpainting, remove, lips) | LTX-2 Community License | Yes | Yes | Same threshold | [Lightricks/LTX-2.3](https://huggingface.co/Lightricks/LTX-2.3) · [LICENSE-2](https://github.com/Lightricks/LTX-2/blob/main/LICENSE-2) |
| **Wan 2.2** I2V 14B, Wan 2.2 Animate | Apache-2.0 | Yes | Yes | Yes | [Wan2.2-I2V-A14B](https://huggingface.co/Wan-AI/Wan2.2-I2V-A14B) · [Wan2.2-Animate-14B](https://huggingface.co/Wan-AI/Wan2.2-Animate-14B) |
| **« Klein » in the studio = FLUX 3 Image Klein** — `flux3-image-klein-base-*` | FLUX Kommunity License | Yes | Yes (*not* the `api_bfl_flux3_*` partner node) | Outputs commercial if < US$5M revenue, with output filtering + AI disclosure; commercial fine-tunes need a BFL license | [HF flux-3-image-klein-base](https://huggingface.co/black-forest-labs/flux-3-image-klein-base) · [Comfy Klein page](https://comfy.org/flux-3-image-klein/) |
| **FLUX.2 [klein] 9B** — `flux-2-klein-9b` (`suite-elargir`) | FLUX Non-Commercial License | Yes (gated) | Yes | **Non-commercial** (4B variant is Apache-2.0) | [FLUX.2-klein-9B](https://huggingface.co/black-forest-labs/FLUX.2-klein-9B) · [FLUX.2-klein-4B](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B) |
| **FLUX.2 [dev]** — `flux2_dev_fp8mixed` (#209 bubble) | FLUX Non-Commercial License | Yes (gated) | Yes | **Non-commercial** for the model | [FLUX.2-dev](https://huggingface.co/black-forest-labs/FLUX.2-dev) |
| **Qwen-Image-Edit 2509 / 2511** (+ Lightning LoRAs) | Apache-2.0 | Yes | Yes | Yes | [Qwen-Image-Edit-2511](https://huggingface.co/Qwen/Qwen-Image-Edit-2511) · [2509](https://huggingface.co/Qwen/Qwen-Image-Edit-2509) · [Lightning](https://huggingface.co/lightx2v/Qwen-Image-Lightning) |
| Qwen-Image 2512 | Apache-2.0 | Yes | Yes | Yes | [Qwen-Image-2512](https://huggingface.co/Qwen/Qwen-Image-2512) |
| Qwen-Image 2.1 (`outil-img-qwen`, `outil-img-refs`) | Qwen Research License | Yes | Yes | **Non-commercial**; « Built with Qwen » in docs | [Qwen-Image-2.1](https://huggingface.co/Qwen/Qwen-Image-2.1) · [Comfy page](https://comfy.org/qwen-image-2.1/) |
| **SeedVR2** 3B/7B (Finalize, upscale) | Apache-2.0 | Yes | Yes | Yes | [ByteDance-Seed/SeedVR2-3B](https://huggingface.co/ByteDance-Seed/SeedVR2-3B) |
| Others in open tools | TRELLIS.2 MIT · ACE-Step 1.5 MIT · Chatterbox MIT · LivePortrait MIT · BiRefNet MIT · Hunyuan3D 2.1 Tencent Community (also excludes EU/UK/KR) · Stable Audio 3 Stability Community | Yes | Yes | varies | HF model cards (same names) |
| NVIDIA RTX Video (`montage-finaliser`, `utility_nvidia_rtx_video_enhance`) | NVIDIA proprietary SDK | **No (not an open-weights model)** | **Risk** — hide in open-weights mode or argue it is a local filter | — | to verify |
| Uttu « Comfy mode » — `openai/gpt-5-nano` via Comfy Router (`src/lib/agent/uttu-comfy.ts`) | proprietary | **No** | **No — closed API in the P0 path** | — | code |

### H3 / FastH3 verdict

- **Open weights: yes.** Weights are public on Hugging Face under a custom community license; FastH3 and Pika H3 Flex inherit it.
- **Open Weights Only category: eligible**, as long as the studio runs the H3 weights (local or Comfy Cloud) and never the `api_minimax_h3_max_r2v` partner node — already hidden in « Studio models only ». H3-Context-IR is a hosted MiniMax service and must **not** be used (the studio writes its own structured prompt — fine).
- **Not « open source » in the OSI sense**: territory clause excludes EU/UK/South Korea/USA, revenue cap US$20M, attribution « MiniMax H3 » in the UI, safeguards duty for third-party hosted generation. JD is in Switzerland (outside the excluded list). Comfy states that Comfy Cloud subscriptions include commercial rights to outputs; a local commercial use in the excluded territories needs the commercial license ([comfy.org/minimax/license](https://comfy.org/minimax/license/)).
- **H3 bonus**: « H3 must be the core model in the workflow ». Our video bubble uses H3 with references by default → plausible. **LTX bonus**: LTX-2.5 text→video + LTX-2.3 camera/VFX → plausible. **FLUX bonus**: requires **FLUX 3**; our default image engine *is* FLUX 3 Image Klein → plausible. One bonus can be won per entry; JD picks which to tick (all three can be ticked in the form).

## 4. Categories and « Is your stack fully open? »

| Option | Recommendation | Why |
|---|---|---|
| Best Overall | automatic | — |
| Most Innovative | tick | video must say *why* (§2) |
| Most Viral | optional | the reel helps, but the demo must show the app |
| **Open Weights Only** | tick **only if the two gaps G1–G2 below are closed** | partner tools are hidden in « Studio models only », but Uttu's Comfy mode calls GPT-5 Nano, and RTX Video is not open weights |
| VFX Built with LTX / Built with FLUX 3 / Built with H3 | tick the ones whose model is the core of the demo shots | decide once the demo models are fixed |
| « Is your stack fully open? » | **« No »** today; « Yes » only after G1–G2 + demo rendered with open models only | definition excludes any closed API in the critical path |

## 5. How to run (for judges)

1. **Try it online (no install):** <https://u-ttu-studio.vercel.app/studio>. Open the Credits menu → connect your **own** Comfy account (sign-in or API key, kept in your browser only). Every paid button shows « ≈ X credits (estimated) » and asks for confirmation.
2. **Run the app locally:** Node ≥ 22, `npm ci && npm run dev` → <http://localhost:3000/studio>.
3. **Run a studio gesture on your own ComfyUI (open weights, no Comfy Cloud credits):**
   `node scripts/run-local.mjs workflows/prise/prise-plan.api.json --text "…" --image …` — the script refuses graphs with partner nodes unless `--allow-partner`.
4. Open-weights mode in the app: « Studio models only » hides every partner tool.

## 6. P0 journey and workflows per feature

**P0 journey:** Intention → Uttu Agent → Storyboard → Workflow → Comfy generation → result attached to its shot → Export. Acceptance criteria per step: [`DEMO-P0.md`](DEMO-P0.md) (PR #215). Architecture of the agent step is owned by Work Astra (#214).

Workflow files: [`workflows/index.json`](../../workflows/index.json) — **104 workflows, 65 open-weights, 39 partner** (partner ones hidden in open-weights mode). Each entry = the official Comfy template + the exact API graph the studio sends.

| Feature | Open-weights workflows (id → Comfy template) | Partner (hidden in open mode) |
|---|---|---|
| Bubble « What are we shooting? » | `creation-image-texte`, `creation-image` → `image_flux3_klein_t2i/_image_edit` (Klein default; Qwen edit and FLUX.2 dev via #209) · `creation-video-refs` → `video_minimax_h3_r2v` · `creation-video-texte` → `video_ltx2_5_t2v` | — |
| CAST (characters) | `cast-photos`, `cast-texte`, `cast-tenue` (FLUX 3 Klein) · `cast-expressions` (LivePortrait) · `cast-agrandir` (SeedVR2) · `cast-angle` (8 angles, Qwen multi-angle) | cast-planche, cast-refs (FLUX 3 API), Nano, relight, Hunyuan3D API |
| SET / DÉCOR (places) | `decor-texte`, `decor-photo`, `decor-heure` (Klein) · `decor-angles` · `decor-volume` (TRELLIS.2) · `decor-3d-apparence` | Nano, any-aspect NB2, FLUX 3 API |
| SHOOT / PRISE | `prise-plan`, `prise-plan-cadre` (LTX-2.5 i2v) · `prise-plan-h3`, `prise-image`, `prise-prolonger` (H3) · `prise-raccord` (LTX-2.5 FLF2V) · `prise-camera`, `prise-previs` (LTX-2.3 IC-LoRA) · `prise-mouvement` (Wan Animate 2) · `prise-levres` (LTX-2.3 ia2v) · `prise-elargir`, `prise-effacer` (LTX-2.3 LoRAs) · `prise-volume-*` (Hunyuan3D 2.1, TRELLIS.2) | Vidu |
| Edit / Retouch (suite) | `suite-modifier` (Klein edit) · `suite-elargir` (FLUX.2 klein 9B) · `suite-detourer` (BiRefNet) · `suite-animer`, `suite-prolonger` (H3) · `suite-parler` (LTX-2.3) | — |
| Finalize (enhance only) | `suite-finaliser-image/-video`, `mont-agrandir` (SeedVR2) · `suite-fluidifier`, `mont-fluide` (frame interpolation) · ⚠ `montage-finaliser` (NVIDIA RTX, see G2) | VCube, Wavespeed, Magnific |
| MONTAGE / Export | `mont-levres` (LTX-2.3); cut and MP4 export run in the browser (no model) | ElevenLabs, Sonilo |
| Sound (open) | Chatterbox TTS, ACE-Step 1.5, Stable Audio 3, MelBandRoformer | ElevenLabs, Mirelo, Sonilo |
| Uttu agent | local mode: built-in knowledge, no model call · ⚠ « Comfy mode »: GPT-5 Nano via Comfy Router (G1) | — |

## 7. Demo video plan (< 2:00)

The AAA clip **V11** (`/workspace/clip-aaa/v11/UTTU_V11_master.mp4`, 1920×1080, **2:30**) is **not altered**. It is a sizzle reel; the form wants « your build in action and how you built it » in under 2 minutes. Proposal: a **new 1:55 edit** that uses V11 only as bookends.

| Time | Content | Source |
|---|---|---|
| 0:00–0:12 | Hook: 8–10 s from V11 (phone + studio), title « U*TTU Studio — from imagination to cinema » | V11 excerpt (copy, master untouched) |
| 0:12–0:25 | Intention: type the scene in the bubble with `@Enki`, `@Fizz`, `@Blanche Of Castille` (English UI, 390 px phone) | screen capture, 0 credit |
| 0:25–0:45 | Uttu → storyboard of 3 shots; the quote « ≈ X credits (estimated) » on each | screen capture |
| 0:45–1:15 | 3 rendered shots (DEMO-P0): wide on the ship, Enki + Fizz without identity mix, targeted edit | JD's paid renders on the preview (budget cap 300) |
| 1:15–1:30 | Cut + export in MONTAGE | screen capture |
| 1:30–1:48 | **How it's built + why it's innovative**: `workflows/` (one gesture = one official Comfy template + API graph), Comfy Cloud API via relay, `run-local.mjs`, « Studio models only », model list | GitHub + terminal |
| 1:48–1:55 | End card: repo URL, MIT, #OpenSourceHiggsfield | V11 end card |

Rules for the edit: never show keys, balances or account pages; Uttu only from her 7 official refs; never any other name for her; no partner-model shots if Open Weights Only is ticked; keep the studio capture inside the clip phone as is.

## 8. Checklist against the rules — gaps

| # | Item | Status | Gap / action | Owner |
|---|---|---|---|---|
| C1 | Public repo + MIT LICENSE | ✅ | — | — |
| C2 | Setup instructions | ✅ README « Run locally » | add a 5-line « For judges » section (EN) pointing to §5 | Cursor, after JD's ok |
| C3 | Workflow files | ✅ 104 in `workflows/` | — | — |
| C4 | Demo video < 2:00 with « how it was built » | ❌ | V11 is 2:30 and shows no build/process; new 1:55 edit (§7) needs the 3 demo shots | JD (renders) + Cursor (edit) |
| C5 | Social post #OpenSourceHiggsfield | ❌ | JD posts after the video is online | JD |
| C6 | Live link | ✅ preview/prod | say « bring your own Comfy account, 5–10 runs ≈ X credits (estimated) » in « Anything else » | — |
| C7 | One-liner ≤ 100 | ✅ draft §2 | JD picks | JD |
| C8 | Models list | ✅ §3 | final list = models actually used in the demo | — |
| **G1** | Open Weights Only: Uttu Comfy mode uses **GPT-5 Nano** (closed) | ❌ | in open-weights mode use Uttu local mode (no model call), or an open-weights LLM if Comfy Router offers one — **architecture decision for Astra (#214)** | Astra → JD |
| **G2** | Open Weights Only: `montage-finaliser` = NVIDIA RTX Video (not open weights) | ⚠ | hide in « Studio models only » (SeedVR2 covers Finalize) | Astra/JD decision, Cursor implements |
| G3 | H3 license notice | ⚠ | UI shows « MiniMax H3 » next to the model (README/messages); add the license names + territory note to README Credits | Cursor (docs) |
| G4 | Non-commercial models (FLUX.2 dev, FLUX.2 klein 9B, Qwen-Image 2.1) | ⚠ | fine for the contest; say so in README so users know | Cursor (docs) |
| G5 | Export quality | ⚠ | browser export is 960×540 @ 12 fps, 60 s max; demo master 1080p decision pending (JD, 01.11) | JD |
| G6 | Agreements: no unlicensed IP | ⚠ | V11 rush R43 shows a fast-food-like brand (flagged « ⚠ marque » in the rushes inventory) — keep it out of the demo edit | JD |
| G7 | Agreements: « only submission » | ⚠ | do not submit Higgsfield-reperage separately | JD |
| G8 | Identity mix (#212) | in progress | #217 merged order pending; real check = JD's paid test | JD |
| G9 | Agent creates the storyboard (#214) | open | Astra | Astra |
| G10 | « 44 tools » messaging in V11/README vs vision « not a catalogue » | ⚠ | pitch leads with the journey, not the tool count | JD |

## 9. Form answers (prepared, JD sends)

| Field | Draft |
|---|---|
| Country | Switzerland |
| Project name | U*TTU Studio |
| One-line | §2 |
| GitHub | https://github.com/eNudimmud/U-TTU-Studio |
| Demo video | *(after the edit)* |
| Live link | https://u-ttu-studio.vercel.app/studio |
| Social post | *(JD)* |
| Parts of ComfyUI | Comfy API (Comfy Cloud API: upload, prompt, job status, view); Comfy Router (only if Uttu Comfy mode stays) |
| Models | final list from §3 restricted to what the demo uses |
| Other tools | Next.js + React on Vercel, three.js previs, Panoramax (CC BY-SA) + OSM/Photon scouting, IndexedDB vault with ZIP export, in-browser MP4 export, i18n EN/FR/DE/ES, Playwright + 859 unit tests on main (1 Nov) |
| Categories | §4 |
| Fully open? | §4 |
| Anything else | short pitch §2 + « bring your own Comfy account; each paid step shows ≈ X credits (estimated) first » |
