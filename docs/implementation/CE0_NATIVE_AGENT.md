# CE0 — Native agent and submit guard

Batch CE0 of [CINEMA_LOTS](CINEMA_LOTS.md) (Astra, PR #222 @ c99fc3c). Base `main` 77094dd.
Status: **code and mocked tests only. No Cloud run happened.** The agent workflow is a
`candidate`. Nobody may call it an operational open-weights agent before JD's qualification run.

## Paid routes and the common guard

| # | Route | Where | What could leave | Guard (contest mode) | Test |
|---|---|---|---|---|---|
| 1 | Comfy Cloud `POST /api/prompt` | `createRenderClient().submit` (`src/lib/render/client.ts`). Every studio graph goes through it: bubble, shot/take, tools, finishing, and the new intent job. | A partner node, closed weights, a closed model named in an input, or a restricted licence | `graphVerdict` (`src/lib/cinema/workflow-policy.ts`) runs before any network call. A refusal is `RenderError("invalid", reasons)`. Nothing is sent. | `tests/cinema-workflow-policy.test.ts` « route 1 » |
| 2 | Comfy Router `POST /v2/models/openai/gpt-5-nano` | `/studio-agent/chat` → `handleUttuChat` (`src/lib/agent/uttu-comfy.ts`) | Hosted GPT-5 Nano | `routeAllowed` returns `403 {error:"ineligible"}` before the credential, the body or any fetch is read | « route 2 » |
| 3 | Proxied Comfy editor (`comfy-proxy.ts`, `comfy-media.ts`, `run-gate.ts`) | The visitor's own graph, run inside Comfy's UI | Anything the visitor loads | Not covered by CE0. The run gate shows the balance and waits for the visitor's tap. **Question for Astra** below. | — |

The guard reads the graph itself, not a label:

- API prompts, also when wrapped as `{prompt}`;
- UI workflows (`nodes[]`, `widgets_values`);
- `definitions.subgraphs`, recursively;
- `extra.groupNodes`.

The guard refuses four things:

- **Partner nodes.** The list is a superset of every `partnerNodes` in `workflows/index.json` (tested), plus the #220 vendor classes and the hosted LLM nodes.
- **Closed native weights.** `RTXVideoSuperResolution`: SeedVR2 already replaces it in the contest mode (#220).
- **Closed model ids** in node inputs, for example `openai/gpt-5-nano`.
- **Restricted licences.** `hunyuan_3d*`, per `LICENCE_RESTREINTE` (JD, 01 Nov).

A model file with no checked licence is reported in `unknownLicences`, not refused. See « Licences found unknown » below.

Graphs checked by the tests in contest mode:

- the agent graph;
- bubble: Klein, Qwen, FLUX.2 and video;
- the old Nano bubble engine, which is refused;
- LTX and H3 takes;
- all 31 public tools, which are accepted;
- 24 partner tools that build with the fixture (out of 28), which are refused;
- the RTX finishing graph, which is refused;
- every `api_file` and `template_file` in `workflows/index.json`.

Out of 193 files that exist, only two native templates are refused, both on purpose:

- `montage-finaliser`: RTX;
- `prise-volume-perso`: Hunyuan3D.

## Intent workflow (pinned)

File: `workflows/cinema/intent-qwen3vl.api.json`. The `INTENT_GRAPH_TEMPLATE` constant must stay identical to it (tested).

Graph sha256 (canonical sorted-key JSON, data slots empty): `88c980ce2f120b5f487ffbbf0818f7c00947bc800e37e23540b905039769e157` (CE5: system prompt now carries the full answer schema from `intent-schema.ts`; previous pin `d0f28211…` on CE0).

| Node | Class | Inputs |
|---|---|---|
| 1 | `CLIPLoader` | `clip_name: qwen3vl_8b_fp8_scaled.safetensors`, `type: stable_diffusion`, `device: default` |
| 2 | `TextGenerate` | `prompt` = fenced CONTEXT + REQUEST (data), `system_prompt` = instructions, `max_length: 1600`, `sampling_mode: on`, temperature 0.2, top_k 40, top_p 0.9, min_p 0.05, repetition 1.05, presence 0, `seed` = per request, `thinking: false`, `use_default_template: true` |
| 3 | `PreviewAny` | `source: [2, 0]`. History output `outputs["3"].text[0]` |

**Model.** `qwen3vl_8b_fp8_scaled.safetensors`, Apache-2.0.

- Repackaged by `Comfy-Org/Qwen3-VL`. Its model card lists `base_model: Qwen/Qwen3-VL-8B-Instruct`, which is the conversational model.
- Listed in the Comfy Cloud model catalogue (read 1 Nov, read-only).
- No image input and no `LoadImage`.

**Base template.** `llm_qwen3vl_text_gen`, read on Comfy Cloud on 1 Nov. Differences from the template:

| Change | Why |
|---|---|
| 4B → 8B | ADR-02 / #214 |
| CLIP `type` `ideogram4` → `stable_diffusion` | See « CLIP type » below |
| No LoadImage | Text-only profile |
| Low temperature, fixed seed | Reproducible JSON |
| Bounded lengths | Context 6000 chars, request 1200 chars, output read ≤ 16000 chars |
| Instructions in `system_prompt` | The data cannot pose as instructions. Look-alike markers in the data are neutralised. |

**CLIP type.** In ComfyUI `comfy/sd.py` (master 6d35280, lines 2044–2085), four types load the 8B file as a *conditioning* encoder, each with its own template: `ideogram4`, `joyimage`, `boogu` and `qwen_image`. Every other type reaches the generic Qwen3-VL chat path. The template's 4B + `ideogram4` pair also reaches that generic path, because `ideogram4` is only special for 8B. **The qualification run must confirm this.**

**Manifest.** `INTENT_MANIFEST`:

- `qualification: "candidate"`, `runIds: []`;
- `selectableForDemo` is false;
- `assertRunnable(…, "demo")` throws `WORKFLOW_UNQUALIFIED`;
- only `purpose: "qualification"` (the user-authorized test) may run it.

**Quote.** Unknown: `basis: "unavailable"`, `estimatedCredits: null`, never 0.

- Cursor's study (#214) gives a hypothesis of « ≈ 1–3 crédits estimés » per message.
- `estimate_credits` on Comfy Cloud prices only partner nodes and excludes GPU time, so it cannot price this native job.
- The quote becomes `measured_similar_job` after JD's run (billed job read from the event feed, never a balance difference).

## Intent job

`src/lib/cinema/intent-job.ts`, storage key `u-ttu-intent-op`. The take receipt `u-ttu-operation` (v1) is untouched.

1. `prepareIntent` is pure: no network, no storage. It produces:
   - `IntentJobSnapshot`: scope, selection, revisions, request, context digest, workflow digest;
   - the graph;
   - a `Quote`.
2. The UI creates `userApproval` on the visitor's tap. Its `actor` is always `"user"`.
3. `submitApprovedIntent` checks the approval: actor, unconsumed, same quote, same snapshot and workflow digest, not expired, ceiling.
   - Then it checks the manifest, the policy, the graph against the pinned template, and that no other operation is pending.
   - Then it writes the receipt (`submitting`, approval consumed) and reads it back.
   - Only then does it make **one** POST.
   - If the write fails, nothing is sent (`STORAGE_UNAVAILABLE`).
   - auth, credits, subscription or invalid → `failed / PROVIDER_REFUSED`.
   - Any other failure → `submission_unknown`, no retry.
4. `pollIntent` makes GET calls only (status, then the history once).
   - Text → `succeeded`, with `text`, `sha256` and `truncated`.
   - No text → `failed / OUTPUT_INVALID`.
   - A read failure keeps the state and backs off: 2, 4, 8, 15, then 30 s.
   - `advance` never moves a terminal state backwards.
5. Reload: `readIntentReceipt` returns the same receipt. A receipt found in `submitting` reads as `submission_unknown`.
6. `bindUnknownIntent(jobId)` binds a job the visitor found in the Comfy history, with a GET only. `declareUnknownAbsent(…, true)` closes it, and only the visitor can do that.
7. `settleIntent` runs after CE3 has stored and validated the proposal. The text is never added to the edit as a media item.

**Secrets.**

- The receipt holds `accountScope`, an opaque account id. It never holds the key or a hash of the key (tested).
- `assertNoSecretFields` refuses to store a credential-looking field or a signed URL.
- The key still travels only in the existing transport (`extra_data` of the one POST, through the same-origin relay).

## Cloud qualification test, ready for JD (not run)

- **Who:** JD, on his account, from the preview. No key goes through Cursor or the agent.
- **Inputs:** `intentGraph({ userText, contextText, seed: 1 })`. Suggested requests:
  1. FR: « Crée trois plans : Sujet A arrive sur le quai, attend, puis part. »
  2. EN: « Make shot 2 a close-up, keep everything else. »
- **Runs:**
  - at most 2;
  - 1 run first, and stop if it fails;
  - ≈ 1–3 crédits estimés per run (unmeasured hypothesis);
  - tranche ceiling proposed at 10 crédits estimés, inside the 300 cap.
- **Stop criteria:** stop after the first failure, at the first non-text output, or if the model is missing.
  - Model missing on Cloud → report `INTENT_MODEL_UNAVAILABLE` in #214, without blocking CE1/CE2.
  - CLIP type rejected or wrong template → report it, then try `ideogram4` once, only with JD's approval.
- **Pass criteria:**
  - `outputs["3"].text[0]` is one JSON object;
  - CE3's `parseIntent` returns `valid` or `needs_clarification` with zero invented ids;
  - the billed cost is read from the job's event feed;
  - the run id goes into `INTENT_MANIFEST.evidence`, in a separate commit, before any `validated`.

## Licences found unknown (reported, not refused)

The guard lists model files it has no checked licence for. Some of them sit in *visible* contest templates and deserve a check by Astra or JD:

- `flux2_dev_fp8mixed` in `creation-image-flux2` (FLUX.2 dev);
- `flux1-dev*` in `decor-3d-apparence` (FLUX.1 dev; its licence is the FLUX.1 [dev] Non-Commercial License);
- `flux3-image-klein-base-int8-convrot`;
- `pixal3d_int8_convrot`, `wan_animate_2_int8_convrot`, `stable_audio_3_medium`, `acestep_v1.5_xl_turbo`.

CE0 changes no visibility. The table `OPEN_MODEL_LICENCES` grows only with a checked source.

## Hand-offs

- **CE4/CE5:** add `uttu.comfy.errors.ineligible` (4 locales) and the code in `ERROR_CODES` of `uttu-free.tsx`. Until then the client shows the « network » text for this refusal. Replace the Comfy-mode chat with the intent job in the contest mode (CE5 owns `studio-session.tsx`).
- **CE2:** unify `u-ttu-intent-op` with the operation journal. Note that `renderCredentialScope` (client.ts) is a SHA-256 of the key, which CONTRACTS forbids as `accountScope`. CE0 does not use it.
- **CE3:** `contextText` here is a minimal canonical JSON. CE3's `context.ts` replaces it, and `parseIntent` consumes `receipt.text`.
