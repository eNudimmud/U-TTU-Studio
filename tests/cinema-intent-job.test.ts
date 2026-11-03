// CE0: the agent's text job. Persist before POST, one POST per approval, text read from the
// history (PreviewAny), reload resumes the same receipt, no cancel, no key in any serialization.
// Fully mocked: no Comfy call, no spend.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  INTENT_RECEIPT_KEY, advance, bindUnknownIntent, declareUnknownAbsent, forgetIntent, pollIntent, prepareIntent,
  readIntentReceipt, readIntentText, settleIntent, submitApprovedIntent, userApproval, type IntentClient, type IntentJobDeps,
} from "../src/lib/cinema/intent-job.ts";
import { INTENT_OUTPUT_MAX_CHARS, contextText } from "../src/lib/cinema/intent-workflow.ts";
import { CinemaError, type IntentContext, type StorageLike } from "../src/lib/cinema/types.ts";
import { RenderError, createRenderClient } from "../src/lib/render/client.ts";
import { PENDING_RENDER_KEY } from "../src/lib/render/recovery.ts";
import { sha256Text } from "../src/lib/cinema/digest.ts";
import { readLedger, release, reserve, writeLedger } from "../src/lib/cinema/spend-ledger.ts";

const KEY = "comfyui-0000-test-only-not-a-real-key";
const ACCOUNT = "comfy-user-7f3a"; // opaque account id, as Comfy's /api/user returns

function memory(): StorageLike & { map: Map<string, string>; failWrites: boolean } {
  const map = new Map<string, string>();
  const store = {
    map, failWrites: false,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { if (store.failWrites) throw new Error("quota"); map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
  };
  return store;
}

const CONTEXT: IntentContext = {
  scope: { projectId: "p-1", storyboardId: "sb-1" }, locale: "fr", selectedShotId: "shot-2", storyboardRevision: 4,
  shots: [
    { shotId: "shot-1", revision: 2, index: 0, titre: "Arrivée", action: "Sujet A arrive", archived: false, lockedFields: [] },
    { shotId: "shot-2", revision: 1, index: 1, titre: "Quai", action: "Sujet A attend", archived: false, lockedFields: ["refs"] },
  ],
  references: [{ referenceId: "ref-a", category: "cast", name: "Sujet A", locked: true }],
  capabilities: [], narrative: "Un quai de gare la nuit.",
};

let n = 0;
function deps(client: IntentClient, storage = memory()): IntentJobDeps & { storage: ReturnType<typeof memory> } {
  return { storage, client, now: () => new Date("2026-11-01T12:00:00Z"), uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, openWeightsMode: true };
}

function fakeClient(script: { submit?: () => Promise<string>; status?: string[]; outputs?: Record<string, unknown> }) {
  const calls: string[] = [];
  const statuses = [...(script.status ?? [])];
  const client: IntentClient = {
    async submit() { calls.push("submit"); return script.submit ? script.submit() : "job-0123456789"; },
    async status(id) { calls.push(`status:${id}`); const s = statuses.shift(); if (s === "THROW") throw new RenderError("network", "x"); return s ?? "success"; },
    async job(id) { calls.push(`job:${id}`); return { status: "success", outputs: script.outputs }; },
  };
  return { client, calls };
}

async function prepared(d: IntentJobDeps) {
  const prep = await prepareIntent({ context: CONTEXT, contextText: contextText(CONTEXT), userText: "Ajoute un plan où Sujet A part", accountScope: ACCOUNT, seed: 7 }, d);
  const approval = userApproval(prep, 3, { id: `ap-${++n}`, trancheId: "t-1" }, d.now()); // one approval per decision
  return { prep, approval };
}

const PROPOSAL = JSON.stringify({ creativeGoal: "départ", expectedResult: "un plan", operations: [], rationale: "", unresolved: [] });

describe("intent job: preparation and approval", () => {
  it("prepares without network or storage; an unknown quote stays unknown, never zero", async () => {
    const { client, calls } = fakeClient({});
    const d = deps(client);
    const { prep } = await prepared(d);
    assert.equal(prep.quote.estimatedCredits, null);
    assert.equal(prep.quote.basis, "unavailable");
    assert.equal(prep.snapshot.kind, "intent");
    assert.deepEqual(prep.snapshot.shotRevisions, { "shot-1": 2, "shot-2": 1 });
    assert.equal(prep.snapshot.contextDigest, await sha256Text(contextText(CONTEXT)));
    assert.deepEqual(calls, []);
    assert.equal(d.storage.map.size, 0);
  });

  it("refuses a missing, consumed, foreign or expired approval, and a model-made one", async () => {
    const { client, calls } = fakeClient({});
    const d = deps(client);
    const { prep, approval } = await prepared(d);
    const bad = [
      { ...approval, actor: "model" as never },
      { ...approval, consumedByAttemptId: "a-0" },
      { ...approval, quoteId: "other" },
      { ...approval, snapshotDigest: "0".repeat(64) },
      { ...approval, authorizedCeilingCredits: 0 },
    ];
    for (const candidate of bad) {
      await assert.rejects(() => submitApprovedIntent(prep, candidate, d, { purpose: "qualification" }), (e: unknown) => e instanceof CinemaError && e.code === "APPROVAL_REQUIRED");
    }
    const late = { ...d, now: () => new Date("2026-11-01T13:00:00Z") };
    await assert.rejects(() => submitApprovedIntent(prep, approval, late, { purpose: "qualification" }), /fresh user approval/);
    assert.deepEqual(calls, []);
  });

  it("a candidate workflow does not run on the demo path", async () => {
    const { client, calls } = fakeClient({});
    const d = deps(client);
    const { prep, approval } = await prepared(d);
    await assert.rejects(() => submitApprovedIntent(prep, approval, d, { purpose: "demo" }), (e: unknown) => e instanceof CinemaError && e.code === "WORKFLOW_UNQUALIFIED");
    assert.deepEqual(calls, []);
  });
});

describe("intent job: submit", () => {
  it("writes the receipt (approval consumed) before the POST, then records the job id", async () => {
    let seenAtPost: string | null = null;
    const storage = memory();
    const { client } = fakeClient({ submit: async () => { seenAtPost = storage.getItem(INTENT_RECEIPT_KEY); return "job-0123456789"; } });
    const d = deps(client, storage);
    const { prep, approval } = await prepared(d);
    const receipt = await submitApprovedIntent(prep, approval, d, { purpose: "qualification" });
    assert.ok(seenAtPost, "receipt written before POST");
    const before = JSON.parse(seenAtPost!);
    assert.equal(before.state, "submitting");
    assert.equal(before.approval.consumedByAttemptId, before.attemptId);
    assert.equal(receipt.state, "queued");
    assert.equal(receipt.providerJobId, "job-0123456789");
    assert.equal(readIntentReceipt(storage)?.providerJobId, "job-0123456789");
  });

  it("releases the hold as never_sent when the receipt cannot be saved, and never calls the client", async () => {
    const storage = memory();
    const realSet = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      if (key === INTENT_RECEIPT_KEY) throw new Error("quota");
      realSet(key, value);
    };
    const { client, calls } = fakeClient({});
    const d = deps(client, storage);
    const order: string[] = [];
    d.budget = {
      check() { order.push("check"); },
      hold(approval, quote, attemptId) {
        order.push(`hold:${attemptId}`);
        const held = reserve({
          ledger: readLedger(storage), quote, approval, attemptId, accountScope: ACCOUNT,
          trancheCapCredits: 50, balanceCredits: null, now: d.now(), busy: false, consumedByCaller: true,
        });
        writeLedger(storage, held.ledger);
      },
      refused(attemptId) {
        order.push(`refused:${attemptId}`);
        writeLedger(storage, release(readLedger(storage), attemptId, "never_sent", d.now()));
      },
      uncertain() { order.push("uncertain"); },
    };
    const { prep, approval } = await prepared(d);
    await assert.rejects(
      () => submitApprovedIntent(prep, approval, d, { purpose: "qualification" }),
      (e: unknown) => e instanceof CinemaError && e.code === "STORAGE_UNAVAILABLE",
    );
    assert.deepEqual(calls, [], "the client is never called");
    assert.equal(storage.getItem(INTENT_RECEIPT_KEY), null);
    assert.equal(readLedger(storage).reservations[0]?.state, "released");
    assert.deepEqual(order.map(step => step.split(":")[0]), ["check", "hold", "refused"]);
    assert.equal(order[2], `refused:${order[1].slice("hold:".length)}`);
  });

  it("does not POST when the receipt cannot be saved", async () => {
    const { client, calls } = fakeClient({});
    const d = deps(client);
    d.storage.failWrites = true;
    const { prep, approval } = await prepared(d);
    await assert.rejects(() => submitApprovedIntent(prep, approval, d, { purpose: "qualification" }), (e: unknown) => e instanceof CinemaError && e.code === "STORAGE_UNAVAILABLE");
    assert.deepEqual(calls, []);
  });

  it("a lost POST answer is submission_unknown and is not retried, even with the same approval", async () => {
    const { client, calls } = fakeClient({ submit: async () => { throw new RenderError("network", "lost"); } });
    const d = deps(client);
    const { prep, approval } = await prepared(d);
    const receipt = await submitApprovedIntent(prep, approval, d, { purpose: "qualification" });
    assert.equal(receipt.state, "submission_unknown");
    assert.equal(receipt.error?.code, "SUBMISSION_UNKNOWN");
    assert.deepEqual(calls, ["submit"]);
    await assert.rejects(() => submitApprovedIntent(prep, approval, d, { purpose: "qualification" }), CinemaError);
    const fresh = await prepared(d);
    await assert.rejects(() => submitApprovedIntent(fresh.prep, fresh.approval, d, { purpose: "qualification" }), (e: unknown) => e instanceof CinemaError && e.code === "BUDGET_RESERVED");
    assert.deepEqual(calls, ["submit"], "exactly one POST");
    // The visitor finds the job in the Comfy history: bound with a GET, never a new POST.
    const bound = await bindUnknownIntent("job-found-in-history", d);
    assert.equal(bound.state, "queued");
    assert.deepEqual(calls, ["submit", "job:job-found-in-history"]);
  });

  it("an explicit refusal (credits, auth, invalid graph) fails without retry", async () => {
    for (const code of ["credits", "auth", "subscription", "invalid"] as const) {
      const { client, calls } = fakeClient({ submit: async () => { throw new RenderError(code, "no"); } });
      const d = deps(client);
      const { prep, approval } = await prepared(d);
      const receipt = await submitApprovedIntent(prep, approval, d, { purpose: "qualification" });
      assert.equal(receipt.state, "failed", code);
      assert.equal(receipt.error?.code, "PROVIDER_REFUSED");
      assert.deepEqual(calls, ["submit"]);
    }
  });

  it("only the visitor can declare an uncertain job absent; then a new approval may run", async () => {
    const { client } = fakeClient({ submit: async () => { throw new TypeError("fetch failed"); } });
    const d = deps(client);
    const { prep, approval } = await prepared(d);
    await submitApprovedIntent(prep, approval, d, { purpose: "qualification" });
    assert.throws(() => declareUnknownAbsent(d, false), (e: unknown) => e instanceof CinemaError && e.code === "APPROVAL_REQUIRED");
    assert.equal(declareUnknownAbsent(d, true).state, "failed");
    assert.equal(forgetIntent(d.storage), true);
  });

  it("one submission at a time with the historical take receipt", async () => {
    const { client, calls } = fakeClient({});
    const d = deps(client);
    d.storage.setItem(PENDING_RENDER_KEY, JSON.stringify({ v: 1 }));
    const { prep, approval } = await prepared(d);
    await assert.rejects(() => submitApprovedIntent(prep, approval, d, { purpose: "qualification" }), (e: unknown) => e instanceof CinemaError && e.code === "BUDGET_RESERVED");
    assert.deepEqual(calls, []);
  });
});

describe("intent job: history text and reload", () => {
  it("reads valid text, refuses absent text, flags truncated text", async () => {
    const valid = await readIntentText({ "3": { text: [PROPOSAL] } });
    assert.equal(valid?.text, PROPOSAL);
    assert.equal(valid?.truncated, false);
    assert.equal((await readIntentText({ "3": { text: ["```json\n" + PROPOSAL + "\n```"] } }))?.truncated, false);
    assert.equal(await readIntentText({}), null);
    assert.equal(await readIntentText({ "3": { text: [] } }), null);
    assert.equal(await readIntentText({ "3": { images: [{ filename: "x.png" }] } }), null, "a media output is not text");
    assert.equal((await readIntentText({ "3": { text: ['{"creativeGoal": "dép'] } }))?.truncated, true, "model stopped mid-JSON");
    const long = await readIntentText({ "3": { text: ["{" + "x".repeat(INTENT_OUTPUT_MAX_CHARS + 10) + "}"] } });
    assert.equal(long?.truncated, true);
    assert.equal(long?.text.length, INTENT_OUTPUT_MAX_CHARS);
  });

  it("polls to succeeded with the text, never as a media item; absent text fails as OUTPUT_INVALID", async () => {
    const ok = fakeClient({ status: ["in_progress", "success"], outputs: { "3": { text: [PROPOSAL] } } });
    const d = deps(ok.client);
    const { prep, approval } = await prepared(d);
    await submitApprovedIntent(prep, approval, d, { purpose: "qualification" });
    assert.equal((await pollIntent(d))?.receipt.state, "running");
    const done = await pollIntent(d);
    assert.equal(done?.receipt.state, "succeeded");
    assert.equal(done?.receipt.text?.text, PROPOSAL);
    assert.deepEqual(done?.receipt.outputs.map(o => o.kind), ["text"]);
    assert.equal(settleIntent(d).state, "settled");

    const empty = fakeClient({ status: ["success"], outputs: { "3": {} } });
    const e = deps(empty.client);
    const second = await prepared(e);
    await submitApprovedIntent(second.prep, second.approval, e, { purpose: "qualification" });
    const failed = await pollIntent(e);
    assert.equal(failed?.receipt.state, "failed");
    assert.equal(failed?.receipt.error?.code, "OUTPUT_INVALID");
  });

  it("a failed status read keeps the state and backs off; never cancels, never resubmits", async () => {
    const { client, calls } = fakeClient({ status: ["THROW", "THROW", "success"], outputs: { "3": { text: [PROPOSAL] } } });
    const d = deps(client);
    const { prep, approval } = await prepared(d);
    await submitApprovedIntent(prep, approval, d, { purpose: "qualification" });
    const first = await pollIntent(d, 0);
    assert.equal(first?.receipt.state, "queued");
    assert.equal(first?.retryAfterMs, 2000);
    assert.equal((await pollIntent(d, 3))?.retryAfterMs, 15000);
    assert.equal((await pollIntent(d, 4))?.receipt.state, "succeeded");
    assert.equal(calls.filter(c => c === "submit").length, 1);
    assert.equal(calls.some(c => /cancel|interrupt|delete/i.test(c)), false);
  });

  it("reload resumes the same receipt; a reload during submitting reads as submission_unknown", async () => {
    const storage = memory();
    const { client } = fakeClient({ submit: async () => { throw new Error("tab closed"); } });
    const d = deps(client, storage);
    const { prep, approval } = await prepared(d);
    const original = await submitApprovedIntent(prep, approval, d, { purpose: "qualification" });
    const reloaded = readIntentReceipt(storage);
    assert.equal(reloaded?.attemptId, original.attemptId);
    assert.equal(reloaded?.operationId, original.operationId);
    // Simulated crash between the write and the answer.
    storage.setItem(INTENT_RECEIPT_KEY, JSON.stringify({ ...original, state: "submitting" }));
    assert.equal(readIntentReceipt(storage)?.state, "submission_unknown");
    storage.setItem(INTENT_RECEIPT_KEY, JSON.stringify({ ...original, schemaVersion: 9 }));
    assert.throws(() => readIntentReceipt(storage), (e: unknown) => e instanceof CinemaError && e.code === "STORAGE_UNAVAILABLE");
  });

  it("a stale poll never undoes a terminal state", () => {
    assert.equal(advance("failed", "running"), "failed");
    assert.equal(advance("settled", "queued"), "settled");
    assert.equal(advance("succeeded", "running"), "succeeded");
    assert.equal(advance("running", "queued"), "running");
    assert.equal(advance("queued", "running"), "running");
  });
});

describe("intent job: secrets", () => {
  it("neither the key nor a hash of it appears in any serialization; the graph carries no credential", async () => {
    const posted: string[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      posted.push(String(init.body ?? ""));
      return new Response(JSON.stringify({ prompt_id: "job-0123456789" }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    const real = createRenderClient({ auth: { kind: "key", key: KEY }, fetch: fetchImpl, openWeightsMode: true });
    const d = deps({ submit: real.submit, status: real.status, job: real.job });
    const { prep, approval } = await prepared(d);
    await submitApprovedIntent(prep, approval, d, { purpose: "qualification" });
    const hash = await sha256Text(KEY);
    const serialized = [...d.storage.map.values(), JSON.stringify(prep), JSON.stringify(prep.graph)].join("\n");
    assert.equal(serialized.includes(KEY), false);
    assert.equal(serialized.includes(hash), false);
    assert.equal(readIntentReceipt(d.storage)?.accountScope, ACCOUNT);
    // The key travels only in the transport's extra_data of the one POST, as before.
    assert.equal(posted.length, 1);
    assert.equal(JSON.parse(posted[0]).prompt["2"].inputs.prompt.includes(KEY), false);
  });

  it("refuses to store an object that carries a credential field", async () => {
    const { client } = fakeClient({});
    const d = deps(client);
    const { prep, approval } = await prepared(d);
    const tainted = { ...prep, snapshot: { ...prep.snapshot, scope: { ...prep.snapshot.scope, api_key: KEY } as never } };
    await assert.rejects(() => submitApprovedIntent(tainted, { ...approval }, d, { purpose: "qualification" }), (e: unknown) => e instanceof CinemaError && e.code === "STORAGE_UNAVAILABLE");
    assert.equal(d.storage.map.size, 0);
  });
});

// Astra review (#224, probes R4/R5 of 857f116): kept as written, without weakening.
describe("intent job: approval integrity (Astra R4/R5)", () => {
  const ok = JSON.stringify({ creativeGoal: "test", expectedResult: "test", operations: [], rationale: "", unresolved: [] });

  it("R4: a terminal intent must not allow reusing the same approval (one POST, ever)", async () => {
    const { client, calls } = fakeClient({ status: ["success"], outputs: { "3": { text: [ok] } } });
    const d = deps(client);
    const { prep, approval } = await prepared(d);
    await submitApprovedIntent(prep, approval, d, { purpose: "qualification" });
    await pollIntent(d);
    settleIntent(d);
    await assert.rejects(() => submitApprovedIntent(prep, approval, d, { purpose: "qualification" }), (e: unknown) => e instanceof CinemaError && e.code === "APPROVAL_REQUIRED");
    // Forgetting the receipt (or a reload) does not revive the approval either.
    assert.equal(forgetIntent(d.storage), true);
    const reloaded = { ...d, storage: d.storage };
    await assert.rejects(() => submitApprovedIntent(prep, approval, reloaded, { purpose: "qualification" }), (e: unknown) => e instanceof CinemaError && e.code === "APPROVAL_REQUIRED");
    assert.equal(calls.filter(c => c === "submit").length, 1);
  });

  it("R4: the consumption lives in the common spend ledger and keeps its other fields", async () => {
    const { client } = fakeClient({});
    const d = deps(client);
    d.storage.setItem("u-ttu-spend-ledger", JSON.stringify({ schemaVersion: 1, consumedApprovals: ["older"], reservations: [{ attemptId: "x" }] }));
    const { prep, approval } = await prepared(d);
    await submitApprovedIntent(prep, approval, d, { purpose: "qualification" });
    const ledger = JSON.parse(d.storage.getItem("u-ttu-spend-ledger")!);
    assert.deepEqual(ledger.consumedApprovals, ["older", approval.id]);
    assert.deepEqual(ledger.reservations, [{ attemptId: "x" }]);
  });

  it("R4: an unreadable spend ledger sends nothing", async () => {
    const { client, calls } = fakeClient({});
    const d = deps(client);
    d.storage.setItem("u-ttu-spend-ledger", "{not json");
    const { prep, approval } = await prepared(d);
    await assert.rejects(() => submitApprovedIntent(prep, approval, d, { purpose: "qualification" }), (e: unknown) => e instanceof CinemaError && e.code === "STORAGE_UNAVAILABLE");
    assert.equal(calls.length, 0);
  });

  it("R5: mutating the intent graph after approval must be refused", async () => {
    const { client, calls } = fakeClient({});
    const d = deps(client);
    const { prep, approval } = await prepared(d);
    prep.graph["2"].inputs.prompt = "A completely different unapproved request";
    prep.graph["2"].inputs["sampling_mode.seed"] = 999;
    await assert.rejects(() => submitApprovedIntent(prep, approval, d, { purpose: "qualification" }));
    assert.equal(calls.length, 0);
  });

  for (const [name, mutate] of [
    ["seed only", (p: Awaited<ReturnType<typeof prepared>>["prep"]) => { p.graph["2"].inputs["sampling_mode.seed"] = 8; }],
    ["prompt only", (p: Awaited<ReturnType<typeof prepared>>["prep"]) => { p.graph["2"].inputs.prompt += " "; }],
    ["account", (p: Awaited<ReturnType<typeof prepared>>["prep"]) => { p.accountScope = "comfy-user-other"; }],
    ["snapshot field", (p: Awaited<ReturnType<typeof prepared>>["prep"]) => { (p.snapshot as { storyboardRevision: number }).storyboardRevision = 99; }],
  ] as const) {
    it(`R5: a change after the quote (${name}) is refused with zero POST and keeps the approval unconsumed`, async () => {
      const { client, calls } = fakeClient({});
      const d = deps(client);
      const { prep, approval } = await prepared(d);
      mutate(prep);
      await assert.rejects(() => submitApprovedIntent(prep, approval, d, { purpose: "qualification" }), (e: unknown) => e instanceof CinemaError && e.code === "APPROVAL_REQUIRED");
      assert.equal(calls.length, 0);
      assert.equal(d.storage.getItem(INTENT_RECEIPT_KEY), null);
    });
  }
});
