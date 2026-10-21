# U*TTU Studio Agent — continuity / next work

## Current checkpoint — 2026-10-21 (supersedes older status sections below)

- Studio PR #121 remains draft. Its original head `2270e8e` passed Actions run `39471129593`. New changes require a fresh full browser run.
- Agent PR #1 was already merged before this session. Continued work on the requested branch is now draft PR [#2](https://github.com/eNudimmud/Uttu-studio-AGENT/pull/2), commit `335cc3abff58990f91a7606ddb9ca90f97655d1b`; Actions `39582974289` passed (17 tests and typecheck).
- The Studio vendors the four exact kernel sources with SHA-256 integrity checks in `src/lib/agent/kernel/source.json`. Production planning, bounded project conversation history, clarifications, dependencies, restoration and an optional allowlisted Jev interpreter are implemented in that independent kernel.
- The global assistant discovers catalogue operations plus explicit native adapters for CAST, DÉCOR, real-location scouting, shot drafts, PRISE, timeline, export, backup, projects and recovery. Preparing forms never submits a paid generation. The existing module owns its quote and explicit confirmation. A prepared step requires new saved evidence and user approval; shot drafts, timeline handoff and ZIP initiation have their own local receipts.
- Conversation/plan/selection and prepared handoff persist as project files. Interrupted jobs retain the existing durable render receipt. Remote cancellation has a separate confirmation and keeps the receipt until status is reconciled. U*TTU Core identity and repository are unchanged; no authenticated Core connection or exportable LoRA training is invented.
- The additive hybrid media index stores stable local/remote identities, provenance, project organization, availability and optional cache. Read-only Comfy inventory import, explicit availability checks, resumable pagination, demand downloads, account isolation, classification and portable manifests are wired into Mon studio and the assistant. Source references now populate asset relations, and recovery preserves previously resolved Cloud UUIDs and user classification. See [HYBRID_MEDIA.md](HYBRID_MEDIA.md) for the verified APIs and architecture decision.
- Comfy is not a guaranteed permanent archive. IndexedDB is the local cache/session/project state; Obsidian remains an optional export. There is no automatic cross-device metadata backend: the minimal versioned-manifest proposal requires a hosting/budget decision before implementation. Current transfer uses manifest + local-media ZIP.
- Verification checkpoint: 416 Studio tests, 415 passed, one existing skip; TypeScript and the Next 16.3.8 production build passed locally. Dependency audit: zero reported vulnerabilities after pinned security updates. Actions `39585345450` passed build/typecheck/unit tests and 104 browser cases, including the hybrid library on desktop/mobile; the new full-film case exposed input hydration and selection timing issues. Actions `39625667190` reached a downloaded MP4 with mocked generation and exposed an export-dialog test omission. Follow-up fixes preserve immediate selection feedback with rollback on save failure, and close the export dialog before continuing. Check the latest PR checks for their final browser verdict; earlier successes are not a substitute for that run. Chromium is denied by the local workspace socket policy. GitHub reported a full artifact quota; optional attachment upload is separated from strict test/build gates.
- Local conversational matching supports French/English catalogue intents; unknown requests ask for clarification. Jev is off by default, uses a separate in-memory BYOK key and explicit consent for each potentially billable request. No provider call was made here, so real-model quality and real-account Cloud permissions remain unvalidated.
- Do not merge or deploy until final CI and review. Physical Android, a real connected Comfy account, optional model quality and the chosen metadata backend remain separate release checks.

## Project identity
- Companion repository: https://github.com/eNudimmud/Uttu-studio-AGENT (PR #1).
- Studio repository: https://github.com/eNudimmud/U-TTU-Studio (PR #121).
- U*TTU Core and its Hermes/Comfy knowledge are **separate and unchanged**. Canonical Vault is separate from visitor assets.
- Mobile-first; browser-local Studio project/coffre; user's own Comfy credits. No paid calls without explicit approval.

## Implemented on this branch
- `src/lib/agent/capabilities.ts`: Studio-authoritative read-only snapshot for BiRefNet (`suite-detourer` → public tool `ret-detourer`). Reads the existing Studio tool catalogue, readiness and visitor preferences.
- `src/components/app/studio-agent-inline.tsx`: small contextual assistant, no LLM/API calls, no direct execution.
- `src/components/app/et-ensuite.tsx`: mounts assistant inside the existing image/video continuation panel and reuses `rememberSource` before navigating to the actual tool hub.
- `tests/agent-capabilities.test.ts`: contract tests.
- GitHub PR remains draft until CI passes and browser behavior is verified.

## Important implementation limitations
- The initial UI only handles the background-removal intent. It is not yet connected to the independent package's `planStudioRequest`; its local intent matcher is temporary.
- UI source handoff uses existing `rememberSource` / sessionStorage; it does not upload to Comfy or guarantee asset availability across navigation. Browser-local blob URLs are intentionally not persisted; Studio must recover the source via its own vault path.
- Quote is shown by the real tool hub, not the agent. The snapshot's quote metadata is not authorization to spend.
- UI currently appears in « Et ensuite ? » for images and video; only image cutout is eligible.
- CI status must be checked; no real BiRefNet generation has been executed.

## Next actions, in order
1. Confirm CI status and fix typecheck/build/test errors.
2. Test Android-sized navigation: source preserved after opening `ret-detourer`, quote visible, confirmation required, no double submission.
3. Eliminate duplicated intent matching: import/publish the agent kernel in a controlled way (workspace, vendored package, or pinned release), without forcing network fetches at runtime.
4. Add accessible, localized French/English UI strings consistent with Studio i18n and visual language; avoid a generic chat overlay.
5. Expand capabilities one by one only after verifying public UI availability, source/outputs and actual quote/execution paths.
6. Evaluate Jev and Gemini only after collecting intent tests; model calls must be server-side, metered, opt-in and without Comfy tokens.
7. Preserve explicit user confirmation, source versioning and canonical project status.

## Non-negotiable
Do not merge or claim end-to-end validation until tests and browser flows are actually verified. Never spend Comfy credits or alter U*TTU Core.

## Progress update — 2026-10-20
- Pure Studio intent router: `src/lib/agent/intent.ts`; pure decision contract: `src/lib/agent/decision.ts`.
- Studio and standalone agent share a mirrored intent conformance corpus (`tests/agent-conformance.test.ts` and `tests/conformance.test.ts`). These are **mirrored tests**, not a shared runtime package.
- `StudioAgentInline` gates the tool link on `decision.kind === "propose"`; React input IDs are generated with `useId`.
- `src/lib/agent/source.ts` guards temporary preview URLs; `rememberSource` uses `safeHandoffUrl` for all « Et ensuite ? » actions. A vault path is retained when present. **Vault rehydration is not yet proven**.
- CI for commit `f44f397` completed successfully; newer commits require separate verification. No real Android browser E2E or paid Comfy generation has been performed.
- Next: inspect actual Studio tool intake/rehydration, prove persistent source path resolves, then pin and import agent planner without duplication; keep draft PRs.

## Release readiness checkpoint — 2026-10-20
- The tool hub now calls `resolveStudioHandoff(saved, media)`: a vault path resolves through the Studio session's hydrated `media` index; no path is mistaken for a URL. Missing vault assets remain pending until hydration.
- Agent repository now exposes a package entry point on its feature branch; its package and CI packaging verification must pass before consuming a pinned commit from the Studio.
- **Not done:** dependency pin and lockfile, Studio import of independent planner, Android browser E2E, user-facing localization, complete end-to-end BiRefNet run.
- **Do not merge yet.** Confirm both CI pipelines, then pin the package with a reproducible lockfile, remove duplicated planner code, and validate tool confirmation and asset persistence on a mobile browser.

## Four-gate validation tracker — 2026-10-20
1. **Pinned package + lockfile — OPEN.** Agent package now has exports and npm-pack CI, but the Studio has not installed a SHA-pinned dependency; avoid claiming integration until the Studio lockfile and Next transpilation are validated.
2. **Remove duplicated planner — OPEN.** Studio still uses `decideStudioRequest` and `routeStudioIntent`; conformance fixtures match, but runtime import is not yet shared.
3. **Android browser E2E — OPEN.** Playwright mobile viewport exists in the Studio config, but no agent-specific browser test has completed; physical Android has not been tested.
4. **Source + quote + confirmation — PARTIAL.** Source handoff uses the existing vault `media` map and `resolveStudioHandoff`; the assistant now requires the source to resolve before proposing. The actual tool hub owns quoting and consent, but no complete browser/generation test has yet demonstrated this path.

Never merge or deploy based on these partial checks alone. CI run 39468124684 was still running when this tracker was written.

## Scope correction: full-Studio agent (2026-10-20)
The BiRefNet cutout flow is only an integration smoke test, **not the product scope**.

Implemented: `src/lib/agent/studio-map.ts` derives a read-only, status-aware inventory from `OUTILS` and `REGISTRE`, spanning CAST, DÉCOR, PRISE, MONTAGE and cross-cutting tools. It exposes required media, output kind, prompt requirement, template and quote hints where available. Tests ensure coverage and prohibit marking unwired tools ready.

Remaining work before claiming a full Studio agent:
- Expose **non-generation** capabilities: LoRA training and character identity, map/street-view location scouting, timeline editing, local vault and project persistence, exports, job recovery and settings. These need separate typed adapters, not fake Comfy templates.
- Implement multi-turn conversational planning and clarification with explicit selected project/assets and user-approved plan steps. Keep the existing Comfy-specialist U*TTU agent separate.
- Implement safe navigation/selection adapters for each area, validate required inputs and capabilities at execution time, and preserve explicit quote + consent gates.
- Extend Android E2E coverage across CAST → DÉCOR → PRISE → MONTAGE → export and project reopen; check privacy, retries, billing and cancellation.
- Confirm CI and physical-device testing before release. No live paid generation without approval.
