# Submission package — Comfy « Open Source Higgsfield »

**Status: ready for JD's review. Docs only.** Nothing has been submitted, posted or rendered by an agent. JD fills and sends the form and the post himself.

- Deadline: **Tue 3 Nov 2026, 9:00 PT = 18:00 Zurich (UTC+1)**. Internal: code freeze 10:00, package ready 16:00.
- Contest page: <https://comfy.org/open-source-higgsfield/> · submission form: <https://form.typeform.com/to/V1dSQrkS>
- Entry: **Best Overall** + bonus **Built with MiniMax H3**. We do **not** enter *Open Weights Only*: partner models stay available in the studio.
- Code state described here: `main` at `9078df7` (PRs #238 StoryWeave, #240, #241 unified nav, #242 Guide, #243 landing). Unit tests 1157, 1156 pass, 1 skipped, typecheck clean (2 Nov 2026, 20:30 Zurich).
- Related: Cloud qualification log for JD's paid runs → [`QUALIFICATION_P0.md`](QUALIFICATION_P0.md). P0 acceptance criteria → [`DEMO-P0.md`](DEMO-P0.md).

## 1. What the rules require

| # | Requirement | Where it lives for us | Status |
|---|---|---|---|
| R1 | A working creative app built **with ComfyUI** | Comfy Cloud API from the browser through a same-origin relay; Comfy Router for Uttu's Comfy mode; 116 exported Comfy workflows | ✅ |
| R2 | Public GitHub repo, open-source licence, setup instructions | <https://github.com/eNudimmud/U-TTU-Studio> · [MIT](../../LICENSE) · README « Run locally » and « For the jury » | ✅ |
| R3 | Demo video **< 2 min**, « your build in action and how you built it » | new 1:55 edit, script in §7 (V11 is 2:30 and stays untouched) | ❌ to edit |
| R4 | Social post with the demo, tag **#OpenSourceHiggsfield** | drafts prepared, JD posts from @HelveticVault | ❌ JD |
| R5 | Live link (optional, 5–10 judge runs) | <https://u-ttu-studio.vercel.app/studio> — judges bring their own Comfy account | ✅ |
| R6 | One-line description ≤ 100 characters | §2 | ✅ |
| R7 | List of generative models + other tools | §3, §9 | ✅ |
| R8 | « Is your stack fully open? » | **No** (§4) | ✅ answer ready |
| R9 | Agreements: repo public + OSS licence, SFW, no unlicensed IP or real likeness, « only submission » | §8 | ⚠ JD ticks |
| R12 | H3 bonus: « H3 must be the core model in the workflow » | §5 | ✅ |

## 2. Pitch (English)

**One-liner (96 chars):** `Describe a scene, Uttu storyboards it, Comfy films it. Open-source AI film studio on your phone.`

*Alternative (75):* `An open-source AI film studio on ComfyUI: intention, storyboard, shot, cut.`

**Short pitch (« Anything else »):**

> U*TTU Studio is an open-source film studio on ComfyUI that hides the graph. You say what you want to shoot; Uttu, the studio agent, turns it into a storyboard; each shot is filmed by an official Comfy workflow on Comfy Cloud, then cut and exported in the browser.
> Your characters (Cast) and places (Set) are named references — a name and up to three pictures — so identities stay the same from shot to shot. MiniMax H3 is the engine that keeps them: reference-true video, the character true to herself in every shot.
> Every render runs on the visitor's own Comfy account through the documented Comfy Cloud API. The studio holds no key and sells nothing. Every paid button shows « ≈ X credits estimated » and waits for a confirmation. The studio never cancels a running job, and Finish only enhances a take — it never regenerates it.

**Why it matters (to say in the video):**
1. The Comfy graph disappears behind a conversation and a living storyboard — but every gesture is still a real, exported Comfy workflow you can open in ComfyUI.
2. Named multi-reference casting + MiniMax H3 keeps several characters distinct and consistent.
3. A quote before every credit, on every gesture.
4. Phone first: 390 px, 44 px touch targets, four screen sizes tested.

## 3. How it uses ComfyUI and Comfy Cloud

**The chain:** Intention → Uttu → Storyboard → Workflow → Comfy Cloud → shot → Export.

| Step | What happens | Code / route |
|---|---|---|
| Intention | The visitor types (or dictates) a scene in the studio bubble « What are we shooting? », or talks to Uttu in StoryWeave. Characters and places are named references | `/studio`, `/storyboard?storyboard=sw` |
| Uttu | The studio agent proposes shots, engine (LTX-2.5 or MiniMax H3), references and a quote. Local mode answers from built-in knowledge; Comfy mode phrases it through Comfy Router (≈ 0.2 credits estimated per message at most). Uttu launches nothing on its own | `src/lib/agent/`, `public/agent/knowledge.json` |
| Storyboard | StoryWeave: chat, panel (Script, Audio, Cast / Places / Props, Shots), shot sheets, four-track timeline. Every change is journaled and can be undone | `/storyboard?storyboard=sw` (preview behind a flag; `/storyboard` shows « coming soon ») |
| Workflow | Each gesture maps to one official Comfy template; the exact API graph the studio sends is committed next to it | `workflows/<tab>/<gesture>.json` + `.api.json`, `workflows/index.json` (116 workflows, 40 with partner nodes), `src/lib/workflows/registre.ts` |
| Comfy Cloud | Upload, prompt, job status, view, through the documented Comfy Cloud API and a same-origin relay that stores nothing. The visitor's session or key stays in their browser | `src/lib/comfy-proxy.ts` |
| Shot | The take lands on its shot. A missing reference blocks filming (`REFERENCE_MISSING`). Finish (SeedVR2, or Real-ESRGAN anime for the Anime 2.5D look) enhances, never regenerates | `/studio#prise`, `/studio#finaliser` |
| Export | Cut on four tracks (video, voice, music, text), MP4 export in the browser — no render. ZIP backup of the project | `/studio#montage`, `/mon-studio` |

The same graphs run on a visitor's own ComfyUI: `node scripts/run-local.mjs workflows/prise/prise-plan.api.json --text "…" --image …` (refuses partner nodes unless `--allow-partner`).

**Navigation that judges will see** (one global bar everywhere): Studio · Film · My studio · Guide · credits · Uttu. Project chain: Cast › Set › Shoot › Edit › Finish, plus the project Look (Anime 2.5D) and StoryWeave « Soon ». The Guide lives outside the studio at `/guide` and `/guide/tools`.

## 4. Categories and « Is your stack fully open? »

| Option | Answer | Why |
|---|---|---|
| Best Overall | ✅ (automatic) | — |
| **Built with MiniMax H3** | ✅ tick | H3 is the core model of the reference-true video (§5) |
| Most Innovative | optional — JD | if ticked, the video must say *why* (§2) |
| Open Weights Only | ❌ do not tick | partner models stay in the studio |
| Built with LTX / FLUX 3 | optional — JD | one bonus can be won per entry; H3 is the one we showcase |
| « Is your stack fully open? » | **No** | partner models are offered; Uttu's Comfy mode uses a closed model through Comfy Router |

## 5. MiniMax H3 showcase — reference-true video

What it shows: a character given by name and a few pictures stays herself — face, costume and place — from one shot to the next.

| Gesture | Comfy template | Quote | Where |
|---|---|---|---|
| Reference-true video (bubble, Video) | `video_minimax_h3_r2v` (`creation-video-refs`) | ≈ 4–6 credits estimated | `/studio#outils/vid-h3-refs`, landing « Built with MiniMax H3 » |
| Shoot with MiniMax H3 (second engine) | `video_minimax_h3_r2v` (`prise-plan-h3`) | ≈ 4–6 credits estimated | `/studio#prise` |
| Faithful keyframes | `video_minimax_h3_multiframe_reference` | ≈ 14 credits estimated | tools |
| Faithful to the place · FastH3 | `video_fasth3_ominiref_r2v` | ≈ 8–12 credits estimated | `/studio#outils/vid-fasth3` |
| Continue / animate a take | `video_minimax_h3_i2v`, `_i2v_continuation` | quote shown before launch | after a take |
| Character swap | open workflow on MiniMax H3 | quote at launch | **Soon** (landing only, not wired) |

Existing H3 takes made in U*TTU Studio by JD (paid, already spent, usable in the video): `clip-aaa/v9/gen/{H1_v2_tisseuse_U6,H2_invitation_U4,K1_levres_U5,K2_quai,K3_v2_softerror_U3,K4_asari_U7}_H3.mp4` (720p, 5.17 s) and their 1080p upscales `clip-aaa/v11/up/UP_{H1,H2,K1,K2,K3,K4}.mp4` on the agent box. Source refs are Uttu's official refs U3–U7.

The studio names « MiniMax H3 » on every label of these templates (checked by `tests/open-weights.test.ts`).

## 6. Models used

| Area | Open weights | Partner (offered, not required) |
|---|---|---|
| Image | FLUX 3 Image Klein (default), FLUX.2 klein 9B, FLUX.2 dev, Qwen-Image-Edit 2509/2511, Qwen-Image 2512 / 2.1 | FLUX 3 API, Nano Banana, GPT Image, Seedream, Ideogram |
| Video | **MiniMax H3**, FastH3, Pika H3 Flex · LTX-2.5, LTX-2.3 (IC-LoRA, outpainting, remove, lips) · Wan 2.2, Wan Animate 2 | MiniMax H3 Max, Kling, Seedance, Vidu |
| 3D | TRELLIS.2, Hunyuan3D 2.1, MoGe depth | Hunyuan3D API |
| Sound | Chatterbox, ACE-Step 1.5, Stable Audio 3, MelBandRoformer | ElevenLabs, Sonilo, Mirelo |
| Finish | SeedVR2 3B/7B, Real-ESRGAN anime, frame interpolation | NVIDIA RTX Video, Magnific |
| Agent | — | small language model through Comfy Router (Uttu Comfy mode) |

## 7. Demo video (< 2:00)

Script, shot list and captions: `/workspace/hackathon/DEMO-SCRIPT.md` on the agent box (copied into the PR description). Summary:

| Time | Beat | Source |
|---|---|---|
| 0:00–0:08 | Hook: an H3 shot of Uttu + title | `UP_K2` / V11 excerpt |
| 0:08–0:20 | Landing → Enter the studio | prod capture `/` |
| 0:20–0:38 | Intention in the bubble, Uttu, quote « ≈ X credits estimated » | `/studio` |
| 0:38–0:58 | StoryWeave: Uttu → storyboard, shot sheet, timeline | `/storyboard?storyboard=sw` |
| 0:58–1:20 | MiniMax H3 reference-true takes, same character across shots | existing H3 takes |
| 1:20–1:32 | Edit, Finish, export | `/studio#montage`, `/studio#finaliser` |
| 1:32–1:50 | How it's built: `workflows/`, Comfy Cloud API, `run-local.mjs`, Guide | GitHub + `/guide` |
| 1:50–1:58 | End card: repo, MIT, #OpenSourceHiggsfield | card |

Rules for the edit: never show keys, balances or account pages; Uttu only from her official refs; no unlicensed brand (V11 rush R43 stays out).

## 8. Checklist

| # | Item | Status | Owner |
|---|---|---|---|
| C1 | Public repo + MIT LICENSE | ✅ | — |
| C2 | Setup instructions in README (Run locally, For the jury) | ✅ updated in this PR | — |
| C3 | Workflow files | ✅ 116 in `workflows/` | — |
| C4 | Demo video < 2:00 | ❌ edit from the script; missing English captures listed in DEMO-SCRIPT | JD + agent |
| C5 | Social post #OpenSourceHiggsfield | ❌ drafts ready | JD |
| C6 | Live link | ✅ prod routes answer 200 (2 Nov, 20:25 Zurich) | — |
| C7 | Landing placeholders « to record on the English UI » (Edit timeline, 3D staging loop, character swap) | ⚠ visible on prod | JD: captures |
| C8 | Tool count shown (33 open-weights mode vs 44 with partners) | ⚠ `NEXT_PUBLIC_OPEN_WEIGHTS_MODE` is on by default; set `off` on Vercel to show partner tools | JD (Vercel) |
| C9 | No unlicensed IP in the video | ⚠ keep R43 out | JD |
| C10 | « This is my only submission » | ⚠ do not submit Higgsfield-reperage separately | JD |
| C11 | StoryWeave as default `/storyboard` | open — it stays behind `?storyboard=sw` until JD says yes | JD |

## 9. Form answers (prepared, JD sends)

| Field | Draft |
|---|---|
| Country | Switzerland |
| Project name | U*TTU Studio |
| One-line | §2 |
| GitHub | https://github.com/eNudimmud/U-TTU-Studio |
| Demo video | *(link after the edit)* |
| Live link | https://u-ttu-studio.vercel.app/studio |
| Social post | *(link after JD posts)* |
| Parts of ComfyUI | Comfy API (Comfy Cloud API: upload, prompt, job status, view); Comfy Router (Uttu Comfy mode); official Comfy templates exported in `workflows/` |
| Models | §6 (core: MiniMax H3, LTX-2.5, FLUX 3 Image Klein, SeedVR2) |
| Other tools | Next.js + React on Vercel, three.js previs, OpenStreetMap / Photon / Panoramax scouting, IndexedDB project vault with ZIP export, in-browser MP4 export, i18n EN/FR/DE/ES, Playwright e2e + 1157 unit tests |
| Categories | Best Overall + Built with MiniMax H3 (§4) |
| Fully open? | No |
| Anything else | short pitch §2 + « Bring your own Comfy account; each paid step shows ≈ X credits estimated first and waits for your confirmation. » |
