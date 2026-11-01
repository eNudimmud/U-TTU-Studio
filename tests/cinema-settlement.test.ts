// CE2: settlement and the paid take's receipt. A result lands once, in the project and shot it was
// sent from, with the storyboard page closed. Failure list of CINEMA_LOTS CE2: crash before/after
// POST, lost answer, polling timeout, two tabs, reload, account changed, archived shot, project
// unavailable, interrupted download, duplicate result, crash between each write, quota / partial file.
// Every ambiguous recovery: at most one POST, zero cancels. Fully mocked: no Comfy call, no spend.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { VaultEntry, VaultStore } from "../src/lib/coffre/store.ts";
import { lireRegistre, registreJson, registreVide, ajouterPlan, nouveauPlan, ajouterPrise, REGISTRE_FILE } from "../src/lib/film/registre.ts";
import { PENDING_RENDER_KEY, readPending, type PendingRender } from "../src/lib/render/recovery.ts";
import { RenderError } from "../src/lib/render/client.ts";
import { cheminJson, lireStoryboard, planVide, storyboardJson, storyboardVide, trouverPlan } from "../src/lib/storyboard/storyboard.ts";
import { cinemaMetaPath, emptyMeta, metaJson, noLock, parseMeta } from "../src/lib/cinema/journal.ts";
import {
  cinemaReceiptOf, earlierVersionTakes, pollShotJob, resumeShotJobs, settleShotJob, submitShotJob, takeIdOf,
  type ProviderOutput, type SettlementPorts, type ShotJobDeps, type ShotJobReceipt, type ShotSubmission,
} from "../src/lib/cinema/settlement.ts";
import { readLedger } from "../src/lib/cinema/spend-ledger.ts";
import { CinemaError, type ObservedCost, type Quote, type ShotSnapshot, type SpendApproval, type StorageLike } from "../src/lib/cinema/types.ts";

const ACCOUNT = "comfy-user-7f3a";
const JOB = "job-0000-aaaa-1111";
const NOW = "2026-11-01T12:00:00.000Z";

function memoryVault(): VaultStore & { map: Map<string, VaultEntry>; puts: string[]; failPut: ((path: string, n: number) => boolean) | null } {
  const map = new Map<string, VaultEntry>();
  const vault = {
    map, puts: [] as string[], failPut: null as ((path: string, n: number) => boolean) | null,
    list: async () => [...map.values()],
    get: async (path: string) => map.get(path) ?? null,
    put: async (entry: VaultEntry) => {
      if (vault.failPut?.(entry.path, vault.puts.length)) throw new Error("QuotaExceededError");
      vault.puts.push(entry.path);
      map.set(entry.path, { ...entry });
    },
    remove: async (path: string) => { map.delete(path); },
  };
  return vault;
}

function memoryStorage(): StorageLike & { map: Map<string, string>; failKey: string | null } {
  const map = new Map<string, string>();
  const s = {
    map, failKey: null as string | null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { if (s.failKey === k) throw new Error("quota"); map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
  };
  return s;
}

const snapshot = (revision = 1): ShotSnapshot => ({
  schemaVersion: 1, scope: { projectId: "demo", storyboardId: "b1" }, shotId: "s1", revision, planFilmId: "sb-b1-s1",
  creative: { titre: "", action: "walks in", refs: [], cadrage: null, camera: null, duree: 5, format: "paysage", rendu: "fidele", dialogue: { type: "aucun", qui: "", texte: "" } as never, son: { musique: "", ambiance: "" }, raccord: false, promptManuel: null },
  bindings: [], digest: "d".repeat(64),
});

const quote = (estimated: number | null = 4): Quote => ({
  id: "q1", snapshotDigest: "d".repeat(64), workflowDigest: "w".repeat(64), estimatedCredits: estimated, uncertaintyCredits: estimated === null ? null : 1,
  basis: estimated === null ? "unavailable" : "measured_similar_job", createdAt: NOW, expiresAt: "2026-11-01T12:15:00.000Z",
});

const approval = (id = "a1"): SpendApproval => ({
  id, trancheId: "t1", operationId: "op1", quoteId: "q1", snapshotDigest: "d".repeat(64), workflowDigest: "w".repeat(64),
  authorizedCeilingCredits: 10, actor: "user", approvedAt: NOW, consumedByAttemptId: null,
});

const succeeded = (rev = 1): ShotJobReceipt => ({
  schemaVersion: 2, operationId: "op1", attemptId: "att-1", accountScope: ACCOUNT, snapshot: snapshot(rev), quote: quote(), approval: { ...approval(), consumedByAttemptId: "att-1" },
  state: "succeeded", providerJobId: JOB, submittedAt: NOW, updatedAt: NOW, outputs: [], settlement: "none",
});

const COST: ObservedCost = { credits: 3, provenance: "billing_job", unit: "credits", readAt: NOW };
const OUT: ProviderOutput[] = [{ index: 0, filename: "uttu_00001.mp4", kind: "video" }];

async function project(vault: ReturnType<typeof memoryVault>, opts: { keptTake?: boolean; shot?: boolean } = {}) {
  let sb = storyboardVide({ id: "b1", titre: "Demo", idee: "", now: NOW });
  sb = { ...sb, sequences: [{ id: "q1", titre: "", resume: "", plans: [...(opts.shot === false ? [] : [planVide("s1")]), planVide("s2")] }] };
  await vault.put({ path: `Projets/demo/${cheminJson("b1")}`, text: storyboardJson(sb), updatedAt: 0 });
  let reg = ajouterPlan(registreVide(), nouveauPlan(registreVide(), "sb-b1-s1"));
  if (opts.keptTake) reg = ajouterPrise(reg, "sb-b1-s1", { id: "old-kept", fichier: "Projets/demo/Prises/old-kept.mp4" });
  await vault.put({ path: `Projets/demo/${REGISTRE_FILE}`, text: registreJson(reg), updatedAt: 0 });
  vault.puts.length = 0;
}

function ports(vault: VaultStore, over: Partial<SettlementPorts> = {}): SettlementPorts & { downloads: number } {
  const p = {
    downloads: 0, vault, lock: noLock, now: () => NOW,
    projectAvailable: async (id: string) => id === "demo",
    download: async () => { p.downloads++; return new Blob([new Uint8Array([1, 2, 3, 4])], { type: "video/mp4" }); },
    ...over,
  };
  return p;
}

const registreOf = async (vault: VaultStore) => lireRegistre((await vault.get(`Projets/demo/${REGISTRE_FILE}`))?.text);
const metaOf = async (vault: VaultStore) => parseMeta((await vault.get(`Projets/demo/${cinemaMetaPath("b1")}`))?.text ?? null, "b1");
const mediaCount = (vault: ReturnType<typeof memoryVault>) => [...vault.map.keys()].filter(k => /\/Prises\/c-.*\.mp4$/.test(k)).length;

describe("CE2 settlement", () => {
  it("asset → take → projections → settled, in the receipt's project and shot", async () => {
    const vault = memoryVault();
    await project(vault);
    const result = await settleShotJob({ receipt: succeeded(), outputs: OUT, cost: COST, currentAccountScope: ACCOUNT }, ports(vault));
    assert.equal(result.outcome, "settled");
    assert.equal(result.receipt.state, "settled");
    assert.equal(result.receipt.settlement, "projections_saved");
    const takeId = await takeIdOf(ACCOUNT, JOB, 0);
    assert.deepEqual(result.takeIds, [takeId]);
    const plan = (await registreOf(vault)).plans.find(p => p.id === "sb-b1-s1")!;
    assert.deepEqual(plan.prises, [{ id: takeId, fichier: `Projets/demo/Prises/${takeId}.mp4`, garde: true }]);
    const meta = await metaOf(vault);
    assert.equal(meta.takes[takeId].cost.provenance, "billing_job");
    assert.equal(meta.takes[takeId].fromEarlierRevision, false);
    const sb = lireStoryboard((await vault.get(`Projets/demo/${cheminJson("b1")}`))?.text)!;
    assert.equal(trouverPlan(sb, "s1")!.plan.planFilmId, "sb-b1-s1");
    assert.equal(mediaCount(vault), 1);
    assert.ok([...vault.map.keys()].every(k => k.startsWith("Projets/demo/")), "nothing written outside its project");
  });

  it("a duplicate result, a second tab or a replay: one take, one media, one download", async () => {
    const vault = memoryVault();
    await project(vault);
    const p = ports(vault);
    await settleShotJob({ receipt: succeeded(), outputs: OUT, cost: COST, currentAccountScope: ACCOUNT }, p);
    const again = await settleShotJob({ receipt: succeeded(), outputs: OUT, cost: COST, currentAccountScope: ACCOUNT }, p);
    assert.equal(again.outcome, "settled");
    assert.equal(again.diagnostics[0].code, "ALREADY_SETTLED");
    assert.equal(p.downloads, 1);
    assert.equal((await registreOf(vault)).plans[0].prises.length, 1);
    assert.equal(mediaCount(vault), 1);
  });

  it("a crash between each write, then a replay, ends exactly like a clean run", async () => {
    const clean = memoryVault();
    await project(clean);
    await settleShotJob({ receipt: succeeded(), outputs: OUT, cost: COST, currentAccountScope: ACCOUNT }, ports(clean));
    const writes = clean.puts.length;
    assert.ok(writes >= 5);
    for (let crashAt = 0; crashAt < writes; crashAt++) {
      const vault = memoryVault();
      await project(vault);
      vault.failPut = (_path, n) => n === crashAt;
      const first = await settleShotJob({ receipt: succeeded(), outputs: OUT, cost: COST, currentAccountScope: ACCOUNT }, ports(vault));
      assert.equal(first.outcome, "result_pending", `crash at write ${crashAt}`);
      vault.failPut = null;
      const p = ports(vault);
      const second = await settleShotJob({ receipt: first.receipt, outputs: OUT, cost: COST, currentAccountScope: ACCOUNT }, p);
      assert.equal(second.outcome, "settled", `replay after crash ${crashAt}`);
      assert.equal((await registreOf(vault)).plans[0].prises.length, 1);
      assert.equal(mediaCount(vault), 1);
      assert.deepEqual(Object.keys((await metaOf(vault)).takes), Object.keys((await metaOf(clean)).takes));
      assert.deepEqual(second.diagnostics.filter(d => d.code === "REVISION_CONFLICT"), []);
    }
  });

  it("an interrupted download leaves the result pending; the retry settles it once", async () => {
    const vault = memoryVault();
    await project(vault);
    const broken = await settleShotJob({ receipt: succeeded(), outputs: OUT, cost: COST, currentAccountScope: ACCOUNT }, ports(vault, { download: async () => { throw new Error("aborted"); } }));
    assert.equal(broken.outcome, "result_pending");
    assert.equal(broken.receipt.state, "result_pending");
    assert.equal(vault.puts.length, 0);
    const ok = await settleShotJob({ receipt: broken.receipt, outputs: OUT, cost: COST, currentAccountScope: ACCOUNT }, ports(vault));
    assert.equal(ok.outcome, "settled");
  });

  it("quota, or a partial media file of our own, is fetched again and written whole", async () => {
    const vault = memoryVault();
    await project(vault);
    vault.failPut = path => path.endsWith(".mp4");
    assert.equal((await settleShotJob({ receipt: succeeded(), outputs: OUT, cost: COST, currentAccountScope: ACCOUNT }, ports(vault))).outcome, "result_pending");
    vault.failPut = null;
    const takeId = await takeIdOf(ACCOUNT, JOB, 0);
    await vault.put({ path: `Projets/demo/Prises/${takeId}.mp4`, blob: new Blob([]), updatedAt: 0 });
    const p = ports(vault);
    assert.equal((await settleShotJob({ receipt: succeeded(), outputs: OUT, cost: COST, currentAccountScope: ACCOUNT }, p)).outcome, "settled");
    assert.equal(p.downloads, 1);
    assert.equal(vault.map.get(`Projets/demo/Prises/${takeId}.mp4`)!.blob!.size, 4);
    const empty = await settleShotJob({ receipt: { ...succeeded(), providerJobId: "job-empty-0000" }, outputs: OUT, cost: COST, currentAccountScope: ACCOUNT }, ports(vault, { download: async () => new Blob([]) }));
    assert.equal(empty.outcome, "result_pending");
  });

  it("project unavailable: result_pending, nothing written to the open project", async () => {
    const vault = memoryVault();
    await project(vault);
    const p = ports(vault, { projectAvailable: async () => false });
    const result = await settleShotJob({ receipt: succeeded(), outputs: OUT, cost: COST, currentAccountScope: ACCOUNT }, p);
    assert.equal(result.outcome, "result_pending");
    assert.equal(result.diagnostics[0].code, "PROJECT_UNAVAILABLE");
    assert.equal(p.downloads, 0);
    assert.equal(vault.puts.length, 0);
  });

  it("account changed: the result stays pending on its own account, no download", async () => {
    const vault = memoryVault();
    await project(vault);
    const p = ports(vault);
    const result = await settleShotJob({ receipt: succeeded(), outputs: OUT, cost: COST, currentAccountScope: "comfy-user-other" }, p);
    assert.equal(result.outcome, "result_pending");
    assert.equal(result.diagnostics[0].code, "ACCOUNT_CHANGED");
    assert.equal(p.downloads, 0);
  });

  it("archived shot: the take is kept in history, the shot is not brought back", async () => {
    const vault = memoryVault();
    await project(vault, { shot: false });
    const before = (await vault.get(`Projets/demo/${cheminJson("b1")}`))!.text;
    const result = await settleShotJob({ receipt: succeeded(), outputs: OUT, cost: COST, currentAccountScope: ACCOUNT }, ports(vault));
    assert.equal(result.outcome, "settled");
    assert.ok(result.diagnostics.some(d => d.code === "SHOT_ARCHIVED"));
    assert.equal((await vault.get(`Projets/demo/${cheminJson("b1")}`))!.text, before);
    assert.equal((await registreOf(vault)).plans[0].prises.length, 1);
  });

  it("a late result is a variant of its source revision and never replaces the kept take", async () => {
    const vault = memoryVault();
    await project(vault, { keptTake: true });
    await vault.put({ path: `Projets/demo/${cinemaMetaPath("b1")}`, text: metaJson({ ...emptyMeta("b1"), revisions: { s1: 3 } }), updatedAt: 0 });
    const result = await settleShotJob({ receipt: succeeded(1), outputs: OUT, cost: COST, currentAccountScope: ACCOUNT }, ports(vault));
    assert.equal(result.fromEarlierRevision, true);
    const prises = (await registreOf(vault)).plans[0].prises;
    assert.deepEqual(prises.map(p => [p.id, p.garde]), [["old-kept", true], [result.takeIds[0], false]]);
    const earlier = earlierVersionTakes(await metaOf(vault), "s1");
    assert.deepEqual(earlier.map(e => e.takeId), result.takeIds);
    assert.equal(earlier[0].provenance.revision, 1);
  });

  it("refuses to settle a job that has not succeeded", async () => {
    const vault = memoryVault();
    await project(vault);
    const result = await settleShotJob({ receipt: { ...succeeded(), state: "running" }, outputs: OUT, cost: COST, currentAccountScope: ACCOUNT }, ports(vault));
    assert.equal(result.outcome, "result_pending");
    assert.equal(result.receipt.state, "running");
    assert.equal(vault.puts.length, 0);
  });
});

// ---------------------------------------------------------------- submit / resume

const BASE: PendingRender = {
  version: 1, kind: "take", project: "demo", id: "sb-b1-s1", name: "Plan 1", prompt: "", at: NOW, account: "fp", refs: [], template: "ltx",
  quote: 4, balanceBefore: 100, jobId: null,
};
const GRAPH = { "1": { class_type: "SaveVideo", inputs: {} } };

function client(behaviour: "ok" | "lost" | "refused" = "ok") {
  const calls: string[] = [];
  const c = new Proxy({
    submit: async () => { calls.push("submit"); if (behaviour === "lost") throw new RenderError("network", "timeout"); if (behaviour === "refused") throw new RenderError("credits", "no credits"); return JOB; },
    status: async () => { calls.push("status"); return "in_progress"; },
  }, { get: (target, key) => { if (!(key in target)) calls.push(`other:${String(key)}`); return (target as Record<string | symbol, unknown>)[key]; } });
  return { c, calls };
}

const submission = (): ShotSubmission => ({ base: BASE, operationId: "op1", accountScope: ACCOUNT, snapshot: snapshot(), quote: quote(), graph: GRAPH });
const deps = (storage: StorageLike, c: ShotJobDeps["client"]): ShotJobDeps => ({ storage, client: c, now: () => new Date(NOW), uuid: () => "att-1", trancheCapCredits: 300, balanceCredits: 100 });

describe("CE2 paid take: at most one POST, never a cancel", () => {
  it("persists reserve and receipt before the POST, binds the job after", async () => {
    const storage = memoryStorage();
    const { c, calls } = client();
    let seenAtPost: string | null = null;
    const wrapped = { ...c, submit: async (...args: unknown[]) => { seenAtPost = storage.getItem(PENDING_RENDER_KEY); return (c.submit as (...a: unknown[]) => Promise<string>)(...args); } };
    const receipt = await submitShotJob(submission(), approval(), deps(storage, wrapped));
    assert.equal(JSON.parse(seenAtPost!).cinema.state, "submitting");
    assert.equal(receipt.state, "queued");
    assert.equal(readPending(storage)?.jobId, JOB, "the legacy receipt is the one authority");
    assert.equal(cinemaReceiptOf(readPending(storage))?.providerJobId, JOB);
    assert.equal(readLedger(storage).reservations[0].state, "reserved");
    assert.deepEqual(calls, ["submit"]);
    assert.ok(!JSON.stringify([...storage.map.values()]).match(/comfyui-|api[_-]?key/i));
  });

  it("crash before POST (receipt not writable): nothing sent, reserve released", async () => {
    const storage = memoryStorage();
    storage.failKey = PENDING_RENDER_KEY;
    const { c, calls } = client();
    await assert.rejects(submitShotJob(submission(), approval(), deps(storage, c)), (e: unknown) => e instanceof CinemaError && e.code === "STORAGE_UNAVAILABLE");
    assert.deepEqual(calls, []);
    assert.equal(readLedger(storage).reservations[0].state, "released");
  });

  it("lost answer: submission_unknown, reserve kept, no retry, a second submit is refused", async () => {
    const storage = memoryStorage();
    const { c, calls } = client("lost");
    const receipt = await submitShotJob(submission(), approval(), deps(storage, c));
    assert.equal(receipt.state, "submission_unknown");
    assert.equal(readLedger(storage).reservations[0].state, "uncertain");
    await assert.rejects(submitShotJob(submission(), approval("a2"), deps(storage, c)), (e: unknown) => e instanceof CinemaError && e.code === "BUDGET_RESERVED");
    assert.equal(await pollShotJob(storage, c, new Date(NOW)).then(r => r?.state), "submission_unknown");
    assert.deepEqual(calls, ["submit"]);
  });

  it("refused by the provider: failed, reserve released, one POST", async () => {
    const storage = memoryStorage();
    const { c, calls } = client("refused");
    assert.equal((await submitShotJob(submission(), approval(), deps(storage, c))).state, "failed");
    assert.equal(readLedger(storage).reservations[0].state, "released");
    assert.deepEqual(calls, ["submit"]);
  });

  it("crash after POST (tab closed while submitting): reload reads submission_unknown and keeps the reserve", async () => {
    const storage = memoryStorage();
    const { c, calls } = client();
    // The POST left, then the tab died before the answer was written.
    const wrapped = { ...c, submit: async () => { await c.submit(); storage.failKey = PENDING_RENDER_KEY; throw new Error("tab closed"); } };
    await submitShotJob(submission(), approval(), deps(storage, wrapped)).catch(() => null);
    storage.failKey = null;
    // Force the stored receipt back to what a dead tab leaves: `submitting`.
    const stored = JSON.parse(storage.getItem(PENDING_RENDER_KEY)!);
    storage.setItem(PENDING_RENDER_KEY, JSON.stringify({ ...stored, cinema: { ...stored.cinema, state: "submitting" } }));
    const ledger = readLedger(storage);
    storage.setItem("u-ttu-spend-ledger", JSON.stringify({ ...ledger, reservations: ledger.reservations.map(r => ({ ...r, state: "reserved" })) }));
    const { receipt } = resumeShotJobs(storage, new Date(NOW));
    assert.equal(receipt?.state, "submission_unknown");
    assert.equal(readLedger(storage).reservations[0].state, "uncertain");
    await assert.rejects(submitShotJob(submission(), approval("a2"), deps(storage, c)));
    assert.deepEqual(calls, ["submit"]);
  });

  it("a reserve without any receipt never reached the POST and is released on reload", async () => {
    const storage = memoryStorage();
    storage.setItem("u-ttu-spend-ledger", JSON.stringify({ schemaVersion: 1, consumedApprovals: ["a1"], reservations: [{ attemptId: "att-0", operationId: "op1", approvalId: "a1", trancheId: "t1", accountScope: ACCOUNT, reservedCredits: 5, basis: "estimate", state: "reserved", observed: null, createdAt: NOW, updatedAt: NOW }] }));
    assert.deepEqual(resumeShotJobs(storage, new Date(NOW)).released, ["att-0"]);
    assert.equal(readLedger(storage).consumedApprovals.includes("a1"), true, "the approval stays consumed");
  });

  it("polling timeout keeps the state; two tabs cannot submit twice", async () => {
    const storage = memoryStorage();
    const { c, calls } = client();
    await submitShotJob(submission(), approval(), deps(storage, c));
    const timeout = { status: async () => { calls.push("status"); throw new RenderError("timeout", "slow"); } };
    assert.equal((await pollShotJob(storage, timeout, new Date(NOW)))?.state, "queued");
    assert.equal((await pollShotJob(storage, c, new Date(NOW)))?.state, "running");
    // Second tab, same storage, its own approval.
    await assert.rejects(submitShotJob(submission(), approval("a2"), deps(storage, c)), (e: unknown) => e instanceof CinemaError && e.code === "BUDGET_RESERVED");
    assert.equal(calls.filter(x => x === "submit").length, 1);
    assert.equal(calls.filter(x => x.startsWith("other:")).length, 0, "no cancel or any other call");
  });

  it("the same approval is consumed once", async () => {
    const storage = memoryStorage();
    const { c } = client("refused");
    await submitShotJob(submission(), approval(), deps(storage, c));
    // The failed receipt is still open: busy first. Once the visitor clears it, the approval is still spent.
    await assert.rejects(submitShotJob(submission(), approval(), deps(storage, c)), (e: unknown) => e instanceof CinemaError && e.code === "BUDGET_RESERVED");
    storage.removeItem(PENDING_RENDER_KEY);
    await assert.rejects(submitShotJob(submission(), approval(), deps(storage, c)), (e: unknown) => e instanceof CinemaError && e.code === "APPROVAL_REQUIRED");
  });
});
