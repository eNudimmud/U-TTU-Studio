# Studio Agent integration — phase 1

This branch exports a **read-only** capability snapshot from the Studio's existing public tool catalogue, not a separate tool registry.

- `src/lib/agent/capabilities.ts` derives `suite-detourer` availability from `outilParId("ret-detourer")`, `outilEtat`, `outilsPublics`, and `gesteParId`.
- The returned quote is a **hint** from the Studio registry, not a live quote or authorization to spend credits.
- No new UI, external model API, Comfy call, or visitor asset transfer is included.
- The companion [Studio Agent](https://github.com/eNudimmud/Uttu-studio-AGENT) must use the same contract, without introducing a second registry.
- Next: a UI integration that passes the selected project's asset as an opaque ID, navigates through the existing `EtEnsuite` / tool-hub workflow, and requires Studio-side quote + explicit confirmation.
- Never pass Firebase/Comfy credentials to the model, and never modify U*TTU Core or its canonical Vault.
