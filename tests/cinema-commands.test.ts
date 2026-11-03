// CE3: storyboard transactions. Indivisible create, isolated patch, lossless reorder, duplicate as a new
// identity, archive kept whole, prepare = no mutation, zero mutation on any failure, journaled commit,
// undo after save that never moves revisions backwards, quote invalidation. In-memory vault only.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { VaultEntry, VaultStore } from "../src/lib/coffre/store.ts";
import { applyEnvelope, commitIntent, undoIntent, type ApplyEnv, type BoardState } from "../src/lib/cinema/commands.ts";
import { cinemaMetaPath, emptyMeta, metaJson, noLock, parseMeta, readJournal } from "../src/lib/cinema/journal.ts";
import { parseIntent } from "../src/lib/cinema/intent.ts";
import { buildIntentContext } from "../src/lib/cinema/context.ts";
import { cheminJson, lireStoryboard, planVide, storyboardJson, storyboardVide, tousLesPlans, type Storyboard } from "../src/lib/storyboard/storyboard.ts";
import { CinemaError, type IntentEnvelope, type Operation } from "../src/lib/cinema/types.ts";

function memoryVault(): VaultStore & { map: Map<string, VaultEntry>; puts: string[] } {
  const map = new Map<string, VaultEntry>();
  const vault = {
    map, puts: [] as string[],
    list: async () => [...map.values()],
    get: async (path: string) => map.get(path) ?? null,
    put: async (entry: VaultEntry) => { vault.puts.push(entry.path); map.set(entry.path, { ...entry }); },
    remove: async (path: string) => { map.delete(path); },
  };
  return vault;
}

const NOW = "2026-11-01T12:00:00.000Z";
const scope = { projectId: "demo", storyboardId: "b1" };
const target = (shotId: string, expectedRevision = 0) => ({ ...scope, shotId, expectedRevision });
const envelope = (operations: Operation[], operationId = "op-1"): IntentEnvelope => ({ schemaVersion: 1, operationId, source: "conversation", userText: "", creativeGoal: "", expectedResult: "", operations, rationale: "", unresolved: [] });
const ids = (...list: string[]) => { let i = 0; return () => list[i++] ?? `n-${i}`; };
const env = (over: Partial<ApplyEnv> = {}): ApplyEnv => ({ newShotId: ids("n1", "n2", "n3"), now: NOW, locks: {}, ...over });

function board(): Storyboard {
  const sb = storyboardVide({ id: "b1", titre: "Demo", idee: "idée", now: "2026-10-01T00:00:00.000Z" });
  const plan = (id: string, action: string) => ({ ...planVide(id), titre: id, action, refs: [{ role: "qui" as const, nom: "Enki", id: "r-enki" }] });
  return { ...sb, sequences: [{ id: "q1", titre: "A", resume: "", plans: [plan("s1", "un"), plan("s2", "deux")] }, { id: "q2", titre: "B", resume: "", plans: [plan("s3", "trois")] }] };
}
const state = (): BoardState => ({ storyboard: board(), meta: emptyMeta("b1") });
const order = (sb: Storyboard) => tousLesPlans(sb).map(p => p.id);
const throwsCode = (fn: () => unknown, code: string) => assert.throws(fn, (e: unknown) => e instanceof CinemaError && e.code === code);

describe("CE3 applyEnvelope", () => {
  it("three shots = one indivisible create, ids from the app, no inherited reference", () => {
    const before = state();
    const out = applyEnvelope(before, envelope([{ kind: "storyboard.create", scope, shots: [1, 2, 3].map(n => ({ titre: `${n}`, action: "x", refs: [], cadrage: null, camera: null, duree: 5, format: "paysage", rendu: "fidele", dialogue: { type: "aucune", qui: null, texte: "" }, son: { musique: "", ambiance: "" }, promptManuel: null, raccord: false })) }]), env());
    assert.deepEqual(out.created, ["n1", "n2", "n3"]);
    assert.deepEqual(order(out.state.storyboard), ["s1", "s2", "s3", "n1", "n2", "n3"]);
    assert.ok(tousLesPlans(out.state.storyboard).slice(3).every(p => p.refs.length === 0 && p.planFilmId === null));
    assert.equal(out.state.meta.storyboardRevision, 1);
    assert.deepEqual(order(before.storyboard), ["s1", "s2", "s3"], "the input state is untouched");
    throwsCode(() => applyEnvelope(state(), envelope([{ kind: "storyboard.create", scope, shots: [{ action: "a" }, { action: "b" }] as never }]), env({ newShotId: ids("n1", "s2") })), "REVISION_CONFLICT");
  });

  it("a patch touches only its shot (shots 1 and 3 identical) and voids its quotes", () => {
    const before = state();
    const out = applyEnvelope(before, envelope([{ kind: "shot.patch", target: target("s2"), patch: { camera: "suit" } }]), env());
    const [a, b, c] = tousLesPlans(out.state.storyboard);
    const [a0, b0, c0] = tousLesPlans(before.storyboard);
    assert.deepEqual(a, a0);
    assert.deepEqual(c, c0);
    assert.deepEqual({ ...b, camera: b0.camera }, b0, "only the camera changed, the character stays");
    assert.equal(b.camera, "suit");
    assert.deepEqual(out.invalidated, ["s2"]);
    assert.equal(out.state.meta.revisions.s2, 1, "the revision bump changes the snapshot digest of any quote");
    assert.equal(out.state.meta.revisions.s1, undefined);
  });

  it("locks and revisions are re-checked at apply time", () => {
    throwsCode(() => applyEnvelope(state(), envelope([{ kind: "shot.patch", target: target("s2"), patch: { refs: [] } }]), env({ locks: { s2: ["refs"] } })), "LOCK_CONFLICT");
    throwsCode(() => applyEnvelope(state(), envelope([{ kind: "shot.patch", target: target("s2", 3), patch: { camera: "fixe" } }]), env()), "REVISION_CONFLICT");
    throwsCode(() => applyEnvelope(state(), envelope([{ kind: "shot.archive", target: { ...target("s2"), storyboardId: "b2" } }]), env()), "REVISION_CONFLICT");
  });

  it("reorder: a lossless permutation; each scene keeps its count; anything else refused", () => {
    const out = applyEnvelope(state(), envelope([{ kind: "storyboard.reorder", scope, expectedRevision: 0, shotIds: ["s1", "s3", "s2"] }]), env());
    assert.deepEqual(order(out.state.storyboard), ["s1", "s3", "s2"]);
    assert.deepEqual(out.state.storyboard.sequences.map(s => s.plans.length), [2, 1]);
    assert.deepEqual(tousLesPlans(out.state.storyboard).map(p => p.action).sort(), ["deux", "trois", "un"]);
    throwsCode(() => applyEnvelope(state(), envelope([{ kind: "storyboard.reorder", scope, expectedRevision: 0, shotIds: ["s1", "s1", "s2"] }]), env()), "REVISION_CONFLICT");
  });

  it("duplicate is a new identity next to its source, without take", () => {
    const sb = board();
    sb.sequences[0].plans[0].planFilmId = "film-1";
    const out = applyEnvelope({ storyboard: sb, meta: emptyMeta("b1") }, envelope([{ kind: "shot.duplicate", target: target("s1") }]), env());
    assert.deepEqual(order(out.state.storyboard), ["s1", "n1", "s2", "s3"]);
    assert.equal(tousLesPlans(out.state.storyboard)[1].planFilmId, null);
  });

  it("archive takes the shot off the board and keeps it whole in the sidecar", () => {
    const out = applyEnvelope(state(), envelope([{ kind: "shot.archive", target: target("s2") }]), env());
    assert.deepEqual(order(out.state.storyboard), ["s1", "s3"]);
    assert.deepEqual(out.state.meta.archived, ["s2"]);
    assert.equal((out.state.meta.archivedShots?.s2 as { action: string }).action, "deux");
  });

  it("prepare changes nothing; finishing without an existing source take is refused", () => {
    const before = state();
    const out = applyEnvelope(before, envelope([{ kind: "shot.prepare", target: target("s1"), output: "keyframe" }]), env());
    assert.equal(out.state, before);
    assert.deepEqual(out.prepared, [{ kind: "shot.prepare", shotId: "s1", revision: 0, output: "keyframe" }]);
    throwsCode(() => applyEnvelope(state(), envelope([{ kind: "take.finish.prepare", target: target("s1"), sourceTakeId: "c-x", recipeId: "upscale" }]), env({ takeIds: { s1: [] } })), "REVISION_CONFLICT");
  });

  it("a failing operation inside a proposal = zero mutation for the whole proposal", () => {
    const before = state();
    const snapshot = JSON.stringify(before);
    throwsCode(() => applyEnvelope(before, envelope([
      { kind: "shot.patch", target: target("s1"), patch: { action: "changé" } },
      { kind: "shot.patch", target: target("s9"), patch: { action: "?" } },
    ]), env()), "REVISION_CONFLICT");
    assert.equal(JSON.stringify(before), snapshot);
  });
});

describe("CE3 commitIntent / undoIntent", () => {
  async function seeded() {
    const vault = memoryVault();
    await vault.put({ path: cheminJson("b1"), text: storyboardJson(board()), updatedAt: 0 });
    vault.puts.length = 0;
    return vault;
  }
  const readBoard = async (vault: VaultStore) => lireStoryboard((await vault.get(cheminJson("b1")))!.text)!;
  const readMeta = async (vault: VaultStore) => parseMeta((await vault.get(cinemaMetaPath("b1")))?.text ?? null, "b1");

  it("commit writes board + sidecar in one journaled transaction; replay is idempotent", async () => {
    const vault = await seeded();
    const env1 = { ...env(), now: NOW };
    const out = await commitIntent(vault, noLock, envelope([{ kind: "shot.patch", target: target("s2"), patch: { camera: "suit" } }]), env1);
    assert.equal(out.journal?.state, "applied");
    assert.equal(vault.puts[0], ".uttu/op-op-1.json", "journal first");
    assert.equal(tousLesPlans(await readBoard(vault))[1].camera, "suit");
    assert.equal((await readMeta(vault)).revisions.s2, 1);
    await assert.rejects(commitIntent(vault, noLock, envelope([{ kind: "shot.patch", target: target("s2"), patch: { camera: "suit" } }]), env1), (e: unknown) => e instanceof CinemaError && e.code === "REVISION_CONFLICT", "a stale replay never applies twice");
  });

  it("stale revision or lock at commit = nothing written", async () => {
    const vault = await seeded();
    await vault.put({ path: cinemaMetaPath("b1"), text: metaJson({ ...emptyMeta("b1"), revisions: { s2: 2 } }), updatedAt: 0 });
    vault.puts.length = 0;
    await assert.rejects(commitIntent(vault, noLock, envelope([{ kind: "shot.patch", target: target("s2", 1), patch: { camera: "suit" } }]), { ...env(), now: NOW }));
    await assert.rejects(commitIntent(vault, noLock, envelope([{ kind: "shot.patch", target: target("s2", 2), patch: { refs: [] } }]), { ...env({ locks: { s2: ["refs"] } }), now: NOW }));
    assert.deepEqual(vault.puts, []);
  });

  it("prepare-only proposals write nothing", async () => {
    const vault = await seeded();
    const out = await commitIntent(vault, noLock, envelope([{ kind: "shot.prepare", target: target("s1"), output: "video" }]), { ...env(), now: NOW });
    assert.equal(out.journal, null);
    assert.deepEqual(vault.puts, []);
  });

  it("undo after save restores the board, revisions only move forward, refused once the board changed", async () => {
    const vault = await seeded();
    const original = (await vault.get(cheminJson("b1")))!.text;
    await commitIntent(vault, noLock, envelope([{ kind: "shot.archive", target: target("s2") }], "op-a"), { ...env(), now: NOW });
    assert.deepEqual(order(await readBoard(vault)), ["s1", "s3"]);
    const undo = await undoIntent(vault, noLock, "op-a", "op-a-undo", NOW);
    assert.equal(undo.state, "applied");
    assert.equal((await vault.get(cheminJson("b1")))!.text, original);
    const meta = await readMeta(vault);
    assert.deepEqual(meta.archived, []);
    assert.equal(meta.revisions.s2, 2, "after undo the shot has a new revision: no old quote is valid again");
    assert.equal(meta.storyboardRevision, 2);
    assert.equal((await readJournal(vault, "op-a"))?.state, "rolled_back");

    await commitIntent(vault, noLock, envelope([{ kind: "shot.patch", target: target("s1"), patch: { action: "nouveau" } }], "op-b"), { ...env(), now: NOW });
    await vault.put({ path: cheminJson("b1"), text: storyboardJson({ ...(await readBoard(vault)), titre: "changé à la main" }), updatedAt: 1 });
    await assert.rejects(undoIntent(vault, noLock, "op-b", "op-b-undo", NOW), (e: unknown) => e instanceof CinemaError && e.code === "REVISION_CONFLICT");
    assert.equal((await readBoard(vault)).titre, "changé à la main", "the manual edit is never overwritten");
  });

  it("end to end: an invalid model reply leaves the vault untouched; a valid one goes through context → parse → commit", async () => {
    const vault = await seeded();
    const sb = await readBoard(vault);
    const { context } = buildIntentContext({ scope, locale: "en", storyboard: sb, meta: emptyMeta("b1"), selectedShotId: "s3", locks: {}, references: [], capabilities: [], maxChars: 6000 });
    const bad = parseIntent('{"creativeGoal":"g","expectedResult":"r","operations":[{"kind":"shot.archive","target":', context, { operationId: "op-x", source: "conversation", userText: "archive this shot" });
    assert.equal(bad.status, "invalid");
    assert.deepEqual(vault.puts, []);
    const good = parseIntent(JSON.stringify({ creativeGoal: "g", expectedResult: "r", operations: [{ kind: "shot.archive", target: target("s3") }], rationale: "", unresolved: [] }), context, { operationId: "op-y", source: "conversation", userText: "archive this shot" });
    assert.equal(good.status, "valid");
    if (good.status !== "valid") return;
    await commitIntent(vault, noLock, good.envelope, { ...env(), now: NOW });
    assert.deepEqual(order(await readBoard(vault)), ["s1", "s2"]);
  });
});
