# U*TTU Studio Agent — continuity

Current state, 22 Oct 2026. Older dated status logs were removed: they described draft branches that have since been merged (Studio #121, #124; Agent #2).

## What exists

- **Global assistant** (`src/components/app/assistant-panel.tsx`), opened from the top bar. It works on the current project, keeps its conversation and plan in `.uttu/agent-conversation.json`, and proposes ordered steps: CAST, DÉCOR, real-location scouting, shot drafts, PRISE, MONTAGE, export, backup, reopen and render recovery, plus every ready tool of the catalogue.
- **Kernel**: four files vendored from [Uttu-studio-AGENT](https://github.com/eNudimmud/Uttu-studio-AGENT) commit `56b9fe4`, SHA-256 pinned in `src/lib/agent/kernel/source.json` and checked by `tests/agent-kernel-integrity.test.ts`. Kernel changes start in the Agent repository and are repinned here.
- **Languages**: requests and replies in French, English, German and Spanish, tutoiement everywhere (`src/lib/agent/language.ts`, `tests/agent-language.test.ts`).
- **Inline assistant** in « Et ensuite ? » (`studio-agent-inline.tsx`): proposes the BiRefNet cutout tool for an image; translated in the four languages.
- **Hybrid media library**: see [HYBRID_MEDIA.md](HYBRID_MEDIA.md).

## Rules that hold

- Preparing a step never submits a paid generation. The module shows its quote; the visitor confirms there. A step completes only with new saved evidence approved by the visitor.
- **No cancellation**: a Comfy job, once sent, is never cancelled by the Studio or the assistant. Interrupted jobs keep their durable render receipt and can be recovered. `tests/no-comfy-cancel.test.ts` guards this.
- No language model is needed. The optional Jev semantic layer is disabled (`SEMANTIC_MODEL_ENABLED = false`); its route answers 404.
- Comfy Cloud stores renders; IndexedDB holds the local project; Obsidian is an optional export. No other backend.

## Known limits

- Local interpretation is keyword based. Unknown or negated requests get a clarification question instead of a guess.
- Exportable LoRA training is not wired (shown as unavailable).
- Mobile coverage is Playwright viewports (390 px, 844 × 390), not physical-device certification.
- No real paid Comfy generation is run by the test suites; Comfy is mocked.
