# U*TTU Studio Agent — continuity / next work

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
