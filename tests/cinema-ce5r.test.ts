// CE5-R (#222 §7): budget and resume beyond Astra's probes. Fully mocked: no network, no spend.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { VaultEntry, VaultStore } from "../src/lib/coffre/store.ts";
import { createCinemaController, intentContextPath, type CinemaClient, type ControllerPorts, type PrepareIntentRequest, type PrepareShotRequest, shotApproval } from "../src/lib/cinema/controller.ts";
import { INTENT_RECEIPT_KEY, userApproval } from "../src/lib/cinema/intent-job.ts";
import { cinemaMetaPath, emptyMeta, metaJson, noLock, parseMeta, projectFiles } from "../src/lib/cinema/journal.ts";
import { readLedger } from "../src/lib/cinema/spend-ledger.ts";
import { cheminJson, lireStoryboard, planVide, storyboardJson, storyboardVide, tousLesPlans } from "../src/lib/storyboard/storyboard.ts";
import { RenderError } from "../src/lib/render/client.ts";
import { PENDING_RENDER_KEY, type PendingRender } from "../src/lib/render/recovery.ts";
import type { StorageLike, WorkflowManifest } from "../src/lib/cinema/types.ts";

const P = "demo";
const scope = { projectId: P, storyboardId: "b1" };
const NOW = new Date("2026-11-01T12:00:00Z");

function memory(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: k => { map.delete(k); } };
}
function memoryVault(): VaultStore & { map: Map<string, VaultEntry> } {
  const map = new Map<string, VaultEntry>();
  return { map, list: async () => [...map.values()], get: async p => map.get(p) ?? null, put: async e => { map.set(e.path, { ...e }); }, remove: async p => { map.delete(p); } };
}

async function seedBoard(vault: VaultStore) {
  const sb = storyboardVide({ id: "b1", titre: "Demo", idee: "idée", now: "2026-10-01T00:00:00.000Z" });
  const plan = (id: string, action: string) => ({ ...planVide(id), titre: id, action, refs: [{ role: "qui" as const, nom: "Sujet A", id: "r-a" }] });
  const board = { ...sb, sequences: [{ id: "q1", titre: "A", resume: "", plans: [plan("s1", "un"), plan("s2", "deux")] }] };
  const files = projectFiles(vault, P);
  await files.put({ path: cheminJson("b1"), text: storyboardJson(board), updatedAt: 0 });
  await files.put({ path: cinemaMetaPath("b1"), text: metaJson(emptyMeta("b1")), updatedAt: 0 });
}

const answerFor = (shotId: string, expectedRevision = 0) => JSON.stringify({
  creativeGoal: "serrer", expectedResult: "plan serré", rationale: "", unresolved: [],
  operations: [{ kind: "shot.patch", target: { ...scope, shotId, expectedRevision }, patch: { cadrage: "serre" } }],
});

function fakeClient(over: { user?: () => unknown; submit?: () => Promise<string>; text?: string } = {}) {
  const calls: string[] = [];
  const client: CinemaClient = {
    async user() { calls.push("user"); return over.user ? over.user() : { id: "acct-1" }; },
    async submit() { calls.push("submit"); return over.submit ? over.submit() : "job-0123456789"; },
    async status() { calls.push("status"); return "success"; },
    async job() { calls.push("job"); return { status: "success", outputs: { "3": { text: [over.text ?? answerFor("s2")] } } }; },
  } as CinemaClient;
  return { client, calls };
}

const exclusive = { request: async (_n: string, _o: unknown, fn: (lock: unknown) => Promise<unknown>) => fn({}) };

let seq = 0;
function setup(over: Partial<ControllerPorts> = {}, client = fakeClient()) {
  const storage = memory();
  const vault = memoryVault();
  const ports: ControllerPorts = {
    storage, vault, lock: noLock, paidLocks: exclusive, sessionId: "tab-1", client: () => client.client,
    now: () => NOW, uuid: () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, seed: () => 7,
    trancheCapCredits: 10, campaign: { capCredits: 300, priorCredits: 0 }, balance: async () => null,
    projectAvailable: async () => true, openWeightsMode: true, purpose: "qualification", ...over,
  };
  return { ports, storage, vault, client, controller: createCinemaController(ports) };
}

const intentRequest = (over: Partial<PrepareIntentRequest> = {}): PrepareIntentRequest => ({
  scope, locale: "fr", selectedShotId: "s2", userText: "serre ce plan", locks: {},
  references: [{ referenceId: "r-a", category: "cast", name: "Sujet A", locked: false }], capabilities: [], ...over,
});
const approve = (prep: Parameters<typeof userApproval>[0], ceiling = 3) => userApproval(prep, ceiling, { id: `ap-${++seq}`, trancheId: "t-1" }, NOW);

async function board(vault: VaultStore) {
  const files = projectFiles(vault, P);
  return { sb: lireStoryboard((await files.get(cheminJson("b1")))!.text!)!, meta: parseMeta((await files.get(cinemaMetaPath("b1")))!.text!, "b1") };
}


import { acknowledgeOverrun, campaignHeld, closeWithUnknownCost, emptyLedger, markUncertain, recordCost, release, reserve, type SpendLedger } from "../src/lib/cinema/spend-ledger.ts";
import { journalPath } from "../src/lib/cinema/journal.ts";
import { CinemaError, type Quote, type SpendApproval } from "../src/lib/cinema/types.ts";

const cost = (credits: number | null, provenance: "billing_job" | "gpu_estimate" | "unknown", readAt = NOW.toISOString()) => ({ credits, provenance, unit: "credits" as const, readAt });
const quote: Quote = { id: "q", snapshotDigest: "s", workflowDigest: "w", estimatedCredits: null, uncertaintyCredits: null, basis: "unavailable", createdAt: NOW.toISOString(), expiresAt: "2026-11-01T13:00:00Z" };
const appr = (id = "ap"): SpendApproval => ({ id, trancheId: "t", operationId: "op", quoteId: "q", snapshotDigest: "s", workflowDigest: "w", authorizedCeilingCredits: 3, actor: "user", approvedAt: NOW.toISOString(), consumedByAttemptId: null });
const hold = (ledger: SpendLedger, attemptId = "a1", id = "ap", consumedByCaller = false) =>
  reserve({ ledger, quote, approval: appr(id), attemptId, accountScope: "acc", trancheCapCredits: 50, balanceCredits: null, now: NOW, busy: false, consumedByCaller }).ledger;
const isCode = (c: string) => (e: unknown) => e instanceof CinemaError && e.code === c;

describe("CE5-R · cost proof hierarchy", () => {
  it("billing_job > gpu_estimate > unknown; never downgraded; the same proof is idempotent", () => {
    let l = recordCost(hold(emptyLedger()), "a1", cost(2, "gpu_estimate"), NOW);
    assert.equal(campaignHeld(l), 3, "before an invoice, at least the reserve");
    l = recordCost(l, "a1", cost(5, "gpu_estimate"), NOW);
    assert.equal(campaignHeld(l), 5, "the more conservative estimate");
    l = recordCost(l, "a1", cost(1, "billing_job"), NOW);
    assert.equal(campaignHeld(l), 1, "the invoice of the job prevails");
    assert.deepEqual(recordCost(l, "a1", cost(9, "gpu_estimate"), NOW), l, "an estimate never replaces an invoice");
    assert.deepEqual(recordCost(l, "a1", cost(null, "unknown"), NOW), l, "unknown never erases a known cost");
    assert.deepEqual(recordCost(l, "a1", cost(1, "billing_job"), NOW), l, "idempotent");
    const older = recordCost(l, "a1", cost(7, "billing_job", "2026-11-01T11:00:00Z"), NOW);
    assert.equal(campaignHeld(older), 1, "an older invoice read does not replace a newer one");
  });
  it("an invoice above the reserve counts in full and blocks the next operation until acknowledged", () => {
    const billed = recordCost(hold(emptyLedger()), "a1", cost(12, "billing_job"), NOW);
    assert.equal(campaignHeld(billed), 12, "never capped");
    assert.equal(billed.reservations[0]!.overrun?.credits, 9);
    assert.throws(() => hold(billed, "a2", "ap2"), isCode("BUDGET_RESERVED"));
    const seen = acknowledgeOverrun(billed, "a1", NOW);
    assert.equal(campaignHeld(seen), 12);
    assert.equal(hold(seen, "a2", "ap2").reservations.length, 2);
  });
  it("an invoice on a released reserve still counts: it proves a spend", () => {
    const released = release(hold(emptyLedger()), "a1", "never_sent", NOW);
    assert.equal(campaignHeld(released), 0);
    assert.equal(campaignHeld(recordCost(released, "a1", cost(2, "billing_job"), NOW)), 2);
  });
});

describe("CE5-R · closeWithUnknownCost and consumedByCaller", () => {
  it("an unbound uncertain POST is never closed; once bound to a job it may close, the reserve still counted", () => {
    const uncertain = markUncertain(hold(emptyLedger()), "a1", NOW);
    assert.equal(closeWithUnknownCost(uncertain, "a1", NOW).reservations[0]!.state, "uncertain");
    const bound = closeWithUnknownCost(uncertain, "a1", NOW, { terminal: true, boundJobId: "job-1" });
    assert.equal(bound.reservations[0]!.state, "settled");
    assert.equal(campaignHeld(bound), 3);
  });
  it("consumedByCaller binds to one attempt: the approval must be consumed and unused by any other reserve", () => {
    assert.throws(() => hold(emptyLedger(), "a1", "ap", true), isCode("APPROVAL_REQUIRED"), "not consumed: no bypass");
    const consumed = { ...emptyLedger(), consumedApprovals: ["ap"] };
    const once = closeWithUnknownCost(hold(consumed, "a1", "ap", true), "a1", NOW);
    assert.throws(() => hold(once, "a2", "ap", true), isCode("APPROVAL_REQUIRED"), "a second attempt never reuses it");
  });
});

describe("CE5-R · resume", () => {
  it("a failed intent after reload: the reserve is kept at startup, then closed as unknown cost (counted)", async () => {
    const t = setup(); await seedBoard(t.vault);
    const p = await t.controller.prepareIntent(intentRequest());
    await t.controller.submitIntent(p.data!, approve(p.data!.preparation));
    const receipt = JSON.parse(t.storage.getItem(INTENT_RECEIPT_KEY)!);
    t.storage.setItem(INTENT_RECEIPT_KEY, JSON.stringify({ ...receipt, state: "failed" }));
    const held = campaignHeld(readLedger(t.storage));
    await t.controller.resumeResults({ projectIds: [P] });
    assert.equal(readLedger(t.storage).reservations[0]!.state, "reserved");
    assert.equal((await t.controller.resumeIntent({ locks: {} })).code, "INTENT_FAILED");
    assert.equal(readLedger(t.storage).reservations[0]!.state, "settled");
    assert.equal(campaignHeld(readLedger(t.storage)), held, "never zero");
  });
  it("another account never reads nor applies the answer", async () => {
    let id = "acct-1";
    const client = fakeClient({ user: () => ({ id }) });
    const t = setup({}, client); await seedBoard(t.vault);
    const p = await t.controller.prepareIntent(intentRequest());
    await t.controller.submitIntent(p.data!, approve(p.data!.preparation));
    id = "acct-2";
    const out = await t.controller.resumeIntent({ locks: {} });
    assert.equal(out.code, "ACCOUNT_UNAVAILABLE");
    assert.equal(client.calls.includes("status"), false, "no read for another account");
    assert.equal((await board(t.vault)).meta.revisions.s2, undefined);
  });
  it("a conflict stays pending and visible on every resume; a rolled-back journal is not re-applied", async () => {
    const t = setup(); await seedBoard(t.vault);
    const p = await t.controller.prepareIntent(intentRequest());
    await t.controller.submitIntent(p.data!, approve(p.data!.preparation));
    const operationId = p.data!.preparation.operationId;
    const put = (state: string) => projectFiles(t.vault, P).put({ path: journalPath(operationId), updatedAt: NOW.getTime(), text: JSON.stringify({
      schemaVersion: 1, operationId, scope, state, targets: [], payload: { before: [], after: [] },
      conflicts: [cheminJson("b1")], createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
    }) });
    await put("conflict");
    for (let i = 0; i < 2; i++) {
      const out = await t.controller.resumeIntent({ locks: {} });
      assert.equal(out.code, "REVISION_CONFLICT");
      assert.deepEqual(out.diagnostics.map(d => d.detail), [cheminJson("b1")]);
    }
    assert.equal(JSON.parse(t.storage.getItem(INTENT_RECEIPT_KEY)!).state, "succeeded", "answer kept");
    assert.equal(readLedger(t.storage).reservations[0]!.state, "settled", "job over: reserve closed, still counted");
    await put("rolled_back");
    const undone = await t.controller.resumeIntent({ locks: {} });
    assert.equal(undone.code, "UNDONE");
    assert.equal((await board(t.vault)).meta.revisions.s2, undefined, "nothing re-applied");
  });
});
