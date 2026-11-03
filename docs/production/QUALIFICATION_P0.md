# Cloud qualification log — P0 (batch B8)

JD fills this page during his own paid tests on the preview. Agents never run these tests and never fill the « read » columns.

- Campaign cap: **300 credits** (CE5 §3), including the agent and the known earlier runs.
- Earlier spend in the code: `CAMPAIGN.priorCredits = 49`, as of `2026-11-01T17:00:00Z` (18:00 Zurich), in [`src/lib/cinema/campaign.ts`](../../src/lib/cinema/campaign.ts).
- Acceptance criteria per step: [`DEMO-P0.md`](DEMO-P0.md).
- **No secret, no account id, no key, no balance screenshot on this page.** A run id from the Comfy job list is fine.

## 1. Before each tranche: update `CAMPAIGN.priorCredits`

1. JD opens the account usage report (read only) and reads the spend since the campaign approval (31.10.2026 22:14 Zurich).
2. Convert to credits (Comfy rate: 211 credits per US$) and **round up**: it may over-count, never under-count.
3. Change one line in `campaign.ts`: `priorCredits` and `asOf` (the report's end time, in UTC with `Z`). Write the source in the comment above it.
4. Open a one-line PR; JD merges it before the tranche. Revert: `priorCredits: null` refuses every paid cinema submission again.
5. Spend made outside the app (other tools, other machines) is not seen by the in-app ledger: this step is the only place it is counted.

## 2. Rule for manifests

- A workflow manifest stays `qualification: "candidate"` until JD writes **« good »** in the verdict column for it.
- Only then may a PR set it to `"validated"`, with `evidence.commit` (the commit that ran) and `evidence.runIds` (the ids from §3). `intent-workflow.ts` refuses `validated` without both.
- A « bad » or « unclear » verdict keeps it `candidate`. Nothing is retried automatically: a new run is a new line and a new yes from JD.

## 3. Runs

Columns: tranche · date and time (Zurich) · workflow or profile (id from `workflows/index.json` or the cinema manifest) · commit · credits estimated (shown by the app before confirm) · credits read (balance before − after, or the job's billed amount) · run id · verdict (good / bad / unclear) · note.

| # | Tranche | Date · time (Zurich) | Workflow / profile | Commit | ≈ Estimated | Read | Run id | Verdict | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | |
| 2 | | | | | | | | | |
| 3 | | | | | | | | | |
| 4 | | | | | | | | | |
| 5 | | | | | | | | | |
| 6 | | | | | | | | | |

**Running total:** prior ≈ 49 + this page = … / 300.

## 4. Planned tranches (suggested, JD decides)

| Tranche | What | ≈ Credits estimated |
|---|---|---|
| T1 | Uttu text workflow (intent reading), 1 run | ≈ 3 |
| T2 | 3 demo shots from DEMO-P0 (H3 « faithful » for the two-character shot) | ≈ 15 (bound ≈ 24) |
| T3 | Anime 2.5D test (JD's own) | ≈ 34 |
| T4 | Finish one take (SeedVR2) | ≈ 28 per 5 s |

## 5. After the tranche

- Copy the totals into `campaign.ts` (§1) for the next tranche.
- For each « good » line, list the manifest and the run ids in the validating PR description.
