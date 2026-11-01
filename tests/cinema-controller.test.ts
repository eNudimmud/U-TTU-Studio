// CE5: the cinema controller composes CE0–CE3 through ports. Fully mocked: no Comfy call, no spend,
// no real picture. Covers single-use approval, refused mutation, lost POST, reload, account rotation vs
// change, campaign limit, journal idempotence, video only from the approved keyframe, explicit targets.
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

describe("controller: native agent", () => {
  it("prepare never POSTs; one approval = one POST; resume applies once with the saved context", async () => {
    const t = setup();
    await seedBoard(t.vault);
    const prepared = await t.controller.prepareIntent(intentRequest());
    assert.equal(prepared.code, "INTENT_PREPARED");
    assert.deepEqual(prepared.target, { projectId: P, storyboardId: "b1", shotId: "s2" });
    assert.ok(prepared.data!.context.selected, "the selected shot is in the context");
    assert.deepEqual(t.client.calls, ["user"]);
    const approval = approve(prepared.data!.preparation);
    const sent = await t.controller.submitIntent(prepared.data!, approval);
    assert.equal(sent.code, "INTENT_SUBMITTED");
    assert.equal(t.client.calls.filter(c => c === "submit").length, 1);
    assert.equal(readLedger(t.storage).reservations[0]!.state, "reserved");
    assert.ok(await projectFiles(t.vault, P).get(intentContextPath(prepared.data!.preparation.operationId)), "context saved before the POST");
    const again = await t.controller.submitIntent(prepared.data!, approval);
    assert.equal(again.ok, false);
    assert.equal(t.client.calls.filter(c => c === "submit").length, 1, "a used approval never POSTs again");

    const resumed = await t.controller.resumeIntent({ locks: {} });
    assert.equal(resumed.code, "INTENT_APPLIED", JSON.stringify(resumed));
    const after = await board(t.vault);
    assert.equal(tousLesPlans(after.sb).find(p => p.id === "s2")!.cadrage, "serre");
    assert.equal(tousLesPlans(after.sb).find(p => p.id === "s1")!.cadrage, null, "the other shot is untouched");
    assert.equal(after.meta.revisions.s2, 1);
    assert.equal(readLedger(t.storage).reservations[0]!.state, "settled", "unknown cost closed, still counted");
    const twice = await t.controller.resumeIntent({ locks: {} });
    assert.equal(twice.code, "NOTHING_TO_RESUME");
    assert.equal((await board(t.vault)).meta.revisions.s2, 1, "never applied twice");
  });

  it("a reload after the commit but before the settle finishes the same operation without recomputing", async () => {
    const t = setup();
    await seedBoard(t.vault);
    const prepared = (await t.controller.prepareIntent(intentRequest())).data!;
    await t.controller.submitIntent(prepared, approve(prepared.preparation));
    const receipt = t.storage.getItem(INTENT_RECEIPT_KEY)!;
    await t.controller.resumeIntent({ locks: {} });
    t.storage.setItem(INTENT_RECEIPT_KEY, receipt); // the tab died before settleIntent was saved
    const reloaded = createCinemaController(t.ports);
    const out = await reloaded.resumeIntent({ locks: {} });
    assert.equal(out.code, "INTENT_APPLIED");
    assert.equal((await board(t.vault)).meta.revisions.s2, 1);
  });

  it("a mutation refused at commit (lock) changes nothing", async () => {
    const t = setup();
    await seedBoard(t.vault);
    const prepared = (await t.controller.prepareIntent(intentRequest())).data!;
    await t.controller.submitIntent(prepared, approve(prepared.preparation));
    const out = await t.controller.resumeIntent({ locks: { s2: ["cadrage"] } });
    assert.equal(out.ok, false);
    assert.equal(out.code, "LOCK_CONFLICT");
    assert.equal((await board(t.vault)).meta.revisions.s2, undefined);
  });

  it("a lost POST stays uncertain: no second POST, the reserve is held", async () => {
    const lost = fakeClient({ submit: async () => { throw new RenderError("network", "x"); } });
    const t = setup({}, lost);
    await seedBoard(t.vault);
    const prepared = (await t.controller.prepareIntent(intentRequest())).data!;
    const sent = await t.controller.submitIntent(prepared, approve(prepared.preparation));
    assert.equal(sent.code, "SUBMISSION_UNKNOWN");
    assert.equal(readLedger(t.storage).reservations[0]!.state, "uncertain");
    const resumed = await t.controller.resumeIntent({ locks: {} });
    assert.equal(resumed.code, "INTENT_UNKNOWN");
    const next = (await t.controller.prepareIntent(intentRequest())).data!;
    const blocked = await t.controller.submitIntent(next, approve(next.preparation));
    assert.equal(blocked.ok, false);
    assert.equal(lost.calls.filter(c => c === "submit").length, 1);
  });

  it("no reliable exclusion between tabs, or no prior spend entered: no paid POST", async () => {
    for (const over of [{ paidLocks: null }, { campaign: { capCredits: 300, priorCredits: null } }, { campaign: { capCredits: 300, priorCredits: 299 } }] as Partial<ControllerPorts>[]) {
      const t = setup(over);
      await seedBoard(t.vault);
      const prepared = (await t.controller.prepareIntent(intentRequest())).data!;
      const out = await t.controller.submitIntent(prepared, approve(prepared.preparation));
      assert.equal(out.ok, false);
      assert.equal(out.code, "BUDGET_RESERVED", JSON.stringify(over));
      assert.equal(t.client.calls.includes("submit"), false);
    }
  });

  it("a key rotation on the same account keeps the quote; another account voids it", async () => {
    let id = "acct-1";
    const client = fakeClient({ user: () => ({ id }) });
    const t = setup({}, client);
    await seedBoard(t.vault);
    const prepared = (await t.controller.prepareIntent(intentRequest())).data!;
    id = "acct-2";
    const other = await t.controller.submitIntent(prepared, approve(prepared.preparation));
    assert.equal(other.code, "APPROVAL_REQUIRED");
    assert.equal(client.calls.includes("submit"), false);
    id = "acct-1"; // a new key, same account id
    assert.equal((await t.controller.submitIntent(prepared, approve(prepared.preparation))).code, "INTENT_SUBMITTED");
  });

  it("no account id = no scope, never a key-hash fallback", async () => {
    const t = setup({}, fakeClient({ user: () => ({ email: "x" }) }));
    await seedBoard(t.vault);
    assert.equal((await t.controller.prepareIntent(intentRequest())).code, "ACCOUNT_UNAVAILABLE");
  });

  it("the candidate agent graph does not run in the demo", async () => {
    const t = setup({ purpose: "demo" });
    await seedBoard(t.vault);
    assert.equal((await t.controller.prepareIntent(intentRequest())).code, "WORKFLOW_UNQUALIFIED");
  });
});

describe("controller: local commands", () => {
  it("a button goes through CE3; undo is refused once the shot changed again", async () => {
    const t = setup();
    await seedBoard(t.vault);
    const first = await t.controller.applyLocal(scope, [{ kind: "shot.patch", target: { ...scope, shotId: "s1", expectedRevision: 0 }, patch: { camera: "suit" } }], { locks: {} });
    assert.equal(first.code, "LOCAL_APPLIED");
    assert.deepEqual(first.target, { projectId: P, storyboardId: "b1", shotId: "s1" });
    const stale = await t.controller.applyLocal(scope, [{ kind: "shot.patch", target: { ...scope, shotId: "s1", expectedRevision: 0 }, patch: { camera: "fixe" } }], { locks: {} });
    assert.equal(stale.code, "REVISION_CONFLICT");
    await t.controller.applyLocal(scope, [{ kind: "shot.patch", target: { ...scope, shotId: "s1", expectedRevision: 1 }, patch: { duree: 8 } }], { locks: {} });
    const undo = await t.controller.undo(scope, first.data!.operationId);
    assert.equal(undo.code, "UNDO_REFUSED");
    assert.equal(tousLesPlans((await board(t.vault)).sb).find(p => p.id === "s1")!.duree, 8, "both versions kept, nothing rolled back");
  });
});

describe("controller: shots", () => {
  const manifest = (purpose: "keyframe" | "animation"): WorkflowManifest => ({
    id: `test-${purpose}`, version: "1", graphSha256: "a".repeat(64), compilerVersion: "ce1-1", purpose, provider: "comfy-cloud",
    models: [{ file: "m.safetensors", source: "https://example.invalid/m", license: "Apache-2.0" }], nodeTypes: ["LoadImage"],
    capabilities: { roles: ["identity"], maxImages: 4, maxBindings: 4, formats: ["paysage"], durations: [5], outputKinds: [purpose === "keyframe" ? "image" : "video"] },
    qualification: "candidate", evidence: { commit: "", checkedAt: "2026-11-01", runIds: [] },
  });
  const graphs: { pictures: readonly string[] }[] = [];
  const shotRequest = (output: "keyframe" | "video"): PrepareShotRequest => ({
    scope, shotId: "s1", output, planFilmId: "f1", manifest: manifest(output === "keyframe" ? "keyframe" : "animation"),
    catalogue: [{ projectId: P, category: "cast", referenceId: "r-a", name: "Sujet A", images: [{ assetId: `Projets/${P}/Cast/a-1.png`, sha256: "sha-a" }] }],
    pixels: { read: async () => new Blob(["synthetic"]), classify: async () => "clean" },
    capacity: { roles: ["identity", "environment", "object", "style", "framing"], maxImages: 4, maxBindings: 4 },
    labels: new Map(), tag: i => `Image ${i + 1}`, resolution: "540p",
    graphFor: input => { graphs.push({ pictures: input.pictures }); return { "1": { class_type: "LoadImage", inputs: {} } }; },
    estimate: { credits: 2, uncertainty: 1, basis: "measured_similar_job" },
  });

  it("video needs the keyframe approved for this revision and these bindings, and uses it alone", async () => {
    const t = setup();
    await seedBoard(t.vault);
    assert.equal((await t.controller.prepareShot(shotRequest("video"))).code, "KEYFRAME_REQUIRED");
    const key = await t.controller.prepareShot(shotRequest("keyframe"));
    assert.equal(key.code, "SHOT_PREPARED", JSON.stringify(key.diagnostics));
    assert.deepEqual(graphs.at(-1)!.pictures, [`Projets/${P}/Cast/a-1.png`]);
    const keyframeId = `Projets/${P}/Takes/s1-key.png`;
    assert.equal((await t.controller.approveKeyframe(scope, "s1", keyframeId, key.data!.submission.snapshot.bindings)).code, "KEYFRAME_APPROVED");
    const video = await t.controller.prepareShot(shotRequest("video"));
    assert.equal(video.code, "SHOT_PREPARED");
    assert.deepEqual(graphs.at(-1)!.pictures, [keyframeId], "the approved keyframe alone");
    assert.equal(video.data!.submission.snapshot.approvedKeyframeAssetId, keyframeId);
    await t.controller.applyLocal(scope, [{ kind: "shot.patch", target: { ...scope, shotId: "s1", expectedRevision: 0 }, patch: { camera: "suit" } }], { locks: {} });
    assert.equal((await t.controller.prepareShot(shotRequest("video"))).code, "KEYFRAME_REQUIRED", "a new revision voids the approval");
  });

  it("a shot changed after its quote is refused before any POST; the campaign limit applies to shots too", async () => {
    const t = setup();
    await seedBoard(t.vault);
    const prepared = (await t.controller.prepareShot(shotRequest("keyframe"))).data!;
    const approval = shotApproval(prepared, 5, { id: "ap-shot", trancheId: "t-1" }, NOW);
    const base = { version: 1, kind: "take", project: P, id: "s1" } as unknown as PendingRender;
    await t.controller.applyLocal(scope, [{ kind: "shot.patch", target: { ...scope, shotId: "s1", expectedRevision: 0 }, patch: { camera: "suit" } }], { locks: {} });
    const out = await t.controller.submitShot(prepared, approval, base);
    assert.equal(out.code, "REVISION_CONFLICT", JSON.stringify(out.diagnostics));
    assert.equal(t.client.calls.includes("submit"), false);
    assert.equal(t.storage.getItem(PENDING_RENDER_KEY), null);

    const capped = setup({ campaign: { capCredits: 300, priorCredits: 298 } });
    await seedBoard(capped.vault);
    const p2 = (await capped.controller.prepareShot(shotRequest("keyframe"))).data!;
    const a2 = shotApproval(p2, 5, { id: "ap-shot-2", trancheId: "t-1" }, NOW);
    assert.equal((await capped.controller.submitShot(p2, a2, base)).code, "BUDGET_RESERVED");
    assert.equal(capped.client.calls.includes("submit"), false);
  });

  it("an approved, unchanged shot is sent once, under the campaign limit", async () => {
    const t = setup();
    await seedBoard(t.vault);
    const prepared = (await t.controller.prepareShot(shotRequest("keyframe"))).data!;
    const approval = shotApproval(prepared, 5, { id: "ap-ok", trancheId: "t-1" }, NOW);
    const base = { version: 1, kind: "take", project: P, id: "s1" } as unknown as PendingRender;
    const out = await t.controller.submitShot(prepared, approval, base);
    assert.equal(out.code, "SHOT_SUBMITTED", JSON.stringify(out.diagnostics));
    assert.deepEqual(out.target, { projectId: P, storyboardId: "b1", shotId: "s1" });
    assert.equal(t.client.calls.filter(c => c === "submit").length, 1);
    assert.equal((await t.controller.submitShot(prepared, approval, base)).ok, false, "single use");
    assert.equal(t.client.calls.filter(c => c === "submit").length, 1);
  });

  it("resume on open recovers journals and keeps the open intent's reserve", async () => {
    const t = setup();
    await seedBoard(t.vault);
    const prepared = (await t.controller.prepareIntent(intentRequest())).data!;
    await t.controller.submitIntent(prepared, approve(prepared.preparation));
    const out = await t.controller.resumeResults({ projectIds: [P] });
    assert.equal(out.code, "NOTHING_TO_RESUME");
    assert.equal(readLedger(t.storage).reservations[0]!.state, "reserved", "the intent's reserve is not released by the shot resume");
  });
});
