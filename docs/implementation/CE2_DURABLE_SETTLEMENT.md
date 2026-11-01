# CE2 — Journal, reprise et coûts

Branch `fix/cinema-durable-settlement`, on CE0 (`feat/cinema-native-agent` @ 210d7fe). Headless: no
component, no message, no style. Fully mocked tests: no Comfy call, no spend.

## Files

| File | What |
|---|---|
| `src/lib/cinema/journal.ts` | `.uttu/op-<uuid>.json` journal (before/after SHA-256 per target, under the project lock), crash recovery on open, conflict = both versions kept, undo = inverse transaction, migration (backup read back, idempotent, future schema refused, unknown fields kept), `.uttu/cinema-<boardId>.json` sidecar, `projectFiles()` project-scoped view |
| `src/lib/cinema/settlement.ts` | `settleShotJob` (asset → registre take → projections → settled), `submitShotJob` / `resumeShotJobs` / `pollShotJob` for a paid take, `earlierVersionTakes` for CE4 |
| `src/lib/cinema/spend-ledger.ts` | reserve / uncertain / release / record cost, tranche cap, `observedCost` (billing_job · gpu_estimate · unknown), `submissionBusy`, `withPaidSession` |
| `tests/cinema-journal.test.ts` (11), `tests/cinema-settlement.test.ts` (18), `tests/cinema-spend.test.ts` (12) | failure list below |

## Contract checklist

- [x] Receipt v2 + immutable snapshot + single attempt + account/project. **Extends** the existing receipt: the v2 receipt rides as an additive `cinema` field on `u-ttu-operation` (PendingRender v1, `withCinemaReceipt` / `cinemaReceiptOf`). Older builds read it as before; one authority.
- [x] Additive metadata (`.uttu/cinema-<boardId>.json`: take provenance, dedup keys, shot revisions, archived shots); the registre `Prise` is unchanged (its reader drops unknown fields, so provenance lives in the sidecar).
- [x] Journal with before/after hashes, written before the targets, under the project lock.
- [x] Migration backed up and read back, idempotent, ids and unknown fields preserved, future schema refused; rollback = `restoreBackup` (metadata only).
- [x] One submission at a time across the take receipt, the intent receipt and the ledger.
- [x] Asset durable → idempotent take → projections → settled; every step replayable (asset path and take id derive from `(accountScope, providerJobId, outputIndex)`).
- [x] Late result = variant of its source revision (`fromEarlierRevision`), listed by `earlierVersionTakes` for « Result from an earlier version ».
- [x] Project unavailable = `result_pending`, nothing written anywhere; writes go through `projectFiles(vault, receipt.project)` so they cannot land in the open project.
- [x] Kept take never replaced (`ajouterPrise` only keeps the first take of an empty plan).
- [x] Archived/removed shot: take kept in registre + sidecar, storyboard untouched.
- [x] Approval consumed once; unknown cost reserves the full approved ceiling; uncertain attempt keeps its reserve (only `confirmed_absent` releases it).
- [x] Balance indicative: never a permission, a low balance is a non-blocking `BALANCE_LOW`, a rising balance is never a cost.
- [x] Cost per job with provenance; billing figures come from the #209 client (`jobCharge` → `JobCharge`, already in credits); not replaced.
- [x] No Web Locks: no claimed exclusion; a second live paid session is blocked by a marker (best effort, TTL 45 s).
- [x] No secret in fixtures, receipts or ledger (`assertNoSecretFields` on the receipt write; tests scan storage).

## Failure tests (CINEMA_LOTS CE2)

| Case | Test |
|---|---|
| crash before POST | receipt not writable → no POST, reserve released |
| crash after POST | tab dies while `submitting` → reload = `submission_unknown`, reserve kept, second submit refused |
| lost answer | `submission_unknown`, `uncertain` reserve, poll does nothing, 1 POST |
| polling timeout | state kept (`queued`), next poll `running` |
| two tabs | second submit `BUDGET_RESERVED`; settle twice = one take |
| reload | `resumeShotJobs` (no component) |
| account changed | `result_pending` / `ACCOUNT_CHANGED`, no download |
| archived shot | take kept, storyboard byte-identical |
| project unavailable | `result_pending`, zero writes |
| interrupted download | `result_pending`, zero writes, retry settles once |
| duplicate result | `ALREADY_SETTLED`, one download, one media |
| crash between each write | every write index crashed in turn, replay = clean run (one take, one media, same sidecar) |
| quota / partial file | quota → pending; empty own file re-fetched and written whole; empty output refused |
| unknown concurrent write | journal: conflict, both versions kept, undo refused |
| balance rising | `observedCost` without charge/GPU = unknown, reserve kept |
| estimate expired | `QUOTE_UNAVAILABLE` |
| uncertain attempt keeps reserve | `release(never_sent)` refused, tranche still holds it |

Every ambiguous recovery test asserts one `submit` at most and no other client call (a Proxy records any `cancel`).

## Deviations (reversible)

- `submitShotJob` / `resumeShotJobs` / `pollShotJob` live in `settlement.ts` (no extra file). CE5 wires them; the current film path keeps using `recovery.ts` until then.
- Extra diagnostic codes (strings, not new `CinemaErrorCode`s): `ACCOUNT_CHANGED`, `SHOT_ARCHIVED`, `ALREADY_SETTLED`, `BALANCE_LOW`.
- A refused POST (`auth`/`credits`/`subscription`/`invalid`) releases the reserve as never sent, as in CE0.
- The failed receipt stays in `u-ttu-operation` until the existing UI clears it (`clearTerminalPending`), so a new submit stays blocked meanwhile (conservative).
- Undo never deletes a file the operation created (metadata kept); it restores the files it changed.
- Only one provenance row carries the job cost when a job has several outputs (others `credits: null`), so a job is never counted twice.
- Shot revision comes from `sidecar.revisions[shotId]` (CE3 bumps it); absent = the snapshot revision (no variant).

## Risks

- `accountScope` must be the opaque Comfy user id. `renderCredentialScope` (CE0 finding) hashes the key: CE5 must pass the `/api/user` id, not that hash.
- Marker-based exclusion without Web Locks is best effort (storage is not atomic across tabs); documented, never claimed as a lock.
- A take file the visitor deletes by hand after settling is not fetched again (dedup key wins). Intended.

## Hand-offs

- CE3: write `revisions` and `archived` in the sidecar through `runTransaction`.
- CE4: `earlierVersionTakes(meta, shotId)` → « Result from an earlier version »; `costLabel` for « ≈ X crédits estimés ».
- CE5: call `resumeShotJobs` on open, `submitShotJob` behind `withPaidSession`, `settleShotJob` with `client.file` as `download` and `observedCost(client.jobCharge(...))`.
