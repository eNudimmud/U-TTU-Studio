# U*TTU Studio Agent

The Studio orchestrator complements the existing U*TTU Core ComfyUI specialist. It does not replace Core's persona, knowledge or canonical vault. The original BiRefNet bridge remains an integration smoke test; it is not the scope of the global assistant.

## Responsibilities and boundaries

| Component | Source | Responsibility |
| --- | --- | --- |
| Capability registry | `studio-map.ts`, `registry.ts` | Discover real `OUTILS`/`REGISTRE` operations and explicit native preparation adapters; retain disabled states. |
| Context provider | `context.ts`, project media catalogue | Current project, opaque resource IDs, selected references and saved results; no arbitrary file access or Comfy credentials. |
| Conversation manager | pinned kernel `production.ts`, `assistant-panel.tsx` | Bounded history, clarifications, selection, dependencies and project-scoped restoration. |
| Production planner | pinned independent Agent kernel | Ordered plans, live capability validation, interruptions and explicit result approval. |
| Execution bridge | `execution.ts`, `use-agent-draft.ts` | Fill existing forms, prepare saved shot drafts, send selected takes and downloaded image/video/audio assets to the existing montage writer, initiate local backup and guide navigation. |
| Job supervision | existing render recovery and task registry | Follow the original job, recover after interruption, stop local monitoring and explicitly confirm remote cancellation. Never resubmit an ambiguous paid request. |
| Validation | kernel checks, module quotes/consent, media transport | Validate project/resources/catalogue, financial confirmation, account scope, stable media identities and download bounds. |

The four vendored kernel files are byte-for-byte copies of Agent commit `335cc3abff58990f91a7606ddb9ca90f97655d1b`. `kernel/source.json` records SHA-256 digests, checked by a unit test. Changes to these files start in the independent Agent repository, pass its tests, and are repinned here. No network dependency is fetched at runtime.

## Production flow

Open **Assistant du studio** through the Studio menu. Select or create a project, describe the intention, and choose its references. Local interpretation supports a conservative set of French/English catalogue intentions and asks for clarification when the request is unknown. A complete-film request proposes CAST → DÉCOR → shot drafts → PRISE → MONTAGE → export → backup → reopen.

Preparing a generation step fills the corresponding Studio form. The user still chooses its workflow/settings, reviews its real quote and explicitly confirms execution in that module. Preparation alone is never marked as a generated result. The user approves newly saved evidence before continuing. Native preparation of shot drafts, montage handoff and ZIP initiation produces local receipts; it is not evidence of a paid generation.

For real-location scouting the agent opens the existing repérage interface. The user searches the place and chooses available photography/3D capture there. Street imagery depends on provider coverage. Exportable LoRA training and an authenticated Core delegation endpoint remain **unavailable**. No invented workflow stands in for either capability.

## Persistence and hybrid library

The conversation and plan, one pending form handoff, and export receipts are project files under `.uttu/`. The hybrid media catalogue is additive; existing media and notes stay readable. The assistant searches names, characters, locations, current-week creations, approved versions and known missing remote media. It can propose a sequence classification and select an explicitly downloaded asset for reuse in existing modules.

Downloaded library media can be assembled on the native timeline after explicit preparation. Their durations are read from the local cache; a stable clip ID prevents duplicate insertion when a saved handoff is replayed. User trims and audio levels are preserved. The handoff is cleared only after the existing montage writer confirms persistence. A missing remote asset remains reusable when its local copy is available.

Generated outputs retain job/workflow provenance, source-asset relations and remote IDs when actually provided or resolved. A temporary signed URL is not an identity. Account identity, expiration, pagination, on-demand caching, source precedence and the storage roles (Comfy Cloud, Studio, IndexedDB, Obsidian) are specified in [HYBRID_MEDIA.md](HYBRID_MEDIA.md).

A ZIP contains the local vault, including conversation and project organization. Uncached remote files must be downloaded first for a complete media archive. The local MP4 export is downloaded by the browser; that final downloaded file is not automatically copied back into the vault. Remote availability and local project metadata have different authorities. There is currently no automatic cross-device project metadata service.

## Optional Jev interpretation

Jev uses TypeSafe System One typed choice questions over an allowlist of catalogue IDs, not executable text or workflow JSON. The route `/studio-agent/interpret` validates origin, request size, a separate TypeSafe key and an explicit per-request confirmation before calling the provider. The key stays in tab memory; it is not written to project files. The context contains the request, eight recent messages, project name, previous step states and selected resource names; it contains no Comfy credential or media bytes.

The model is off by default. Each potentially billable request needs consent. There is no automatic retry, and provider failure may still be charged. Confidence below the policy threshold or an unknown choice asks for clarification; this threshold is not a claim of calibrated model quality. Every proposed operation is checked again against current Studio preferences. No real provider call was made during this development session.

## Verification and remaining release checks

Run `npm test`, `npm run typecheck`, `npm run build` and `npx playwright test`. The CI runs full-agent and hybrid-library scenarios first, then the rest of the browser regression suite. Financial operations in these scenarios are mocked. Local rendering/export, IndexedDB and ZIP creation run in the actual browser. Mobile viewport coverage is not physical-Android certification.

See [QA.md](QA.md), [continuity](STUDIO_AGENT_CONTINUITY.md) and the latest checks on PR #121. A local socket restriction prevents Chromium launch in the coding workspace; GitHub Actions supplies the browser environment. The GitHub artifact quota can prevent attachment upload; this is reported separately from strict test/build gates. No paid call, merge or production deployment is authorized by a green test suite.
