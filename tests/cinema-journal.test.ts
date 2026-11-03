// CE2: the project journal. Journal before targets, before/after hashes, crash between two writes
// finished on open, an unknown write kept side by side (never overwritten), undo as an inverse
// transaction, migration backed up / idempotent / refusing a future schema. In-memory vault only.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { VaultEntry, VaultStore } from "../src/lib/coffre/store.ts";
import { sha256Text } from "../src/lib/cinema/digest.ts";
import { saveBoard } from "../src/lib/cinema/board-writer.ts";
import {
  CINEMA_META_VERSION, JOURNAL_KEEP, RECEIPT_GUARD_PATH, backupPath, browserProjectLock, cinemaMetaPath, conflictPath, emptyMeta, journalPath, metaJson, migrateFile,
  noLock, parseMeta, projectFiles, readJournal, recoverJournals, restoreBackup, runTransaction, undoTransaction,
} from "../src/lib/cinema/journal.ts";
import { CinemaError } from "../src/lib/cinema/types.ts";
import { cheminJson, storyboardJson, storyboardVide, type Storyboard } from "../src/lib/storyboard/storyboard.ts";

export function memoryVault(): VaultStore & { map: Map<string, VaultEntry>; puts: string[]; failPut: ((path: string, n: number) => boolean) | null } {
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

const scope = { projectId: "demo", storyboardId: "b1" };
const clock = () => "2026-11-01T12:00:00.000Z";
const text = async (store: VaultStore, path: string) => (await store.get(path))?.text ?? null;
const rejectsCode = (promise: Promise<unknown>, code: string) => assert.rejects(promise, (error: unknown) => error instanceof CinemaError && error.code === code);

describe("CE2 journal", () => {
  it("writes the journal first, then the targets, with before/after hashes", async () => {
    const vault = memoryVault();
    await vault.put({ path: "a.json", text: "A0", updatedAt: 0 });
    vault.puts.length = 0;
    const entry = await runTransaction(vault, noLock, { operationId: "op-1", scope, writes: [{ path: "a.json", text: "A1" }, { path: "b.md", text: "B1" }], now: clock });
    assert.equal(vault.puts[0], journalPath("op-1"));
    assert.deepEqual(vault.puts.slice(1, 3), ["a.json", "b.md"]);
    assert.equal(entry.state, "applied");
    assert.deepEqual(entry.targets, [
      { path: "a.json", before: await sha256Text("A0"), after: await sha256Text("A1") },
      { path: "b.md", before: null, after: await sha256Text("B1") },
    ]);
    assert.equal((await readJournal(vault, "op-1"))?.state, "applied");
  });

  it("replaying the same operation does not write the targets again", async () => {
    const vault = memoryVault();
    await runTransaction(vault, noLock, { operationId: "op-1", scope, writes: [{ path: "a.json", text: "A1" }], now: clock });
    await vault.put({ path: "a.json", text: "edited later", updatedAt: 1 });
    const again = await runTransaction(vault, noLock, { operationId: "op-1", scope, writes: [{ path: "a.json", text: "A1" }], now: clock });
    assert.equal(again.state, "applied");
    assert.equal(await text(vault, "a.json"), "edited later");
  });

  it("a crash between two writes is finished on open, without any component", async () => {
    const vault = memoryVault();
    await vault.put({ path: "a.json", text: "A0", updatedAt: 0 });
    vault.failPut = path => path === "b.json";
    await rejectsCode(runTransaction(vault, noLock, { operationId: "op-2", scope, writes: [{ path: "a.json", text: "A1" }, { path: "b.json", text: "B1" }], now: clock }), "STORAGE_UNAVAILABLE");
    assert.equal((await readJournal(vault, "op-2"))?.state, "prepared");
    vault.failPut = null;
    const done = await recoverJournals(vault, noLock, "demo", clock);
    assert.equal(done[0].state, "applied");
    assert.equal(await text(vault, "a.json"), "A1");
    assert.equal(await text(vault, "b.json"), "B1");
    assert.deepEqual(await recoverJournals(vault, noLock, "demo", clock), []);
  });

  it("an unknown concurrent write is a conflict: both versions kept, nothing overwritten", async () => {
    const vault = memoryVault();
    await vault.put({ path: "a.json", text: "A0", updatedAt: 0 });
    vault.failPut = path => path === "a.json";
    await assert.rejects(runTransaction(vault, noLock, { operationId: "op-3", scope, writes: [{ path: "a.json", text: "A1" }], now: clock }));
    vault.failPut = null;
    await vault.put({ path: "a.json", text: "someone else", updatedAt: 2 });
    const [entry] = await recoverJournals(vault, noLock, "demo", clock);
    assert.equal(entry.state, "conflict");
    assert.deepEqual(entry.conflicts, ["a.json"]);
    assert.equal(await text(vault, "a.json"), "someone else");
    assert.equal(await text(vault, conflictPath("a.json", "op-3")), "A1");
  });

  it("undo is an inverse transaction, refused when the file changed since", async () => {
    const vault = memoryVault();
    await vault.put({ path: "a.json", text: "A0", updatedAt: 0 });
    await runTransaction(vault, noLock, { operationId: "op-4", scope, writes: [{ path: "a.json", text: "A1" }, { path: "new.json", text: "N" }], now: clock });
    const undo = await undoTransaction(vault, noLock, "op-4", "op-4u", clock);
    assert.equal(undo.inverseOf, "op-4");
    assert.equal(await text(vault, "a.json"), "A0");
    assert.equal(await text(vault, "new.json"), "N", "a created metadata file is never deleted by undo");
    assert.equal((await readJournal(vault, "op-4"))?.state, "rolled_back");

    await runTransaction(vault, noLock, { operationId: "op-5", scope, writes: [{ path: "a.json", text: "A2" }], now: clock });
    await vault.put({ path: "a.json", text: "hand edit", updatedAt: 3 });
    await rejectsCode(undoTransaction(vault, noLock, "op-5", "op-5u", clock), "REVISION_CONFLICT");
    assert.equal(await text(vault, "a.json"), "hand edit");
  });

  it("never writes or restores media", async () => {
    const vault = memoryVault();
    await rejectsCode(runTransaction(vault, noLock, { operationId: "op-6", scope, writes: [{ path: "Prises/x.mp4", text: "" }], now: clock }), "STORAGE_UNAVAILABLE");
    await rejectsCode(runTransaction(vault, noLock, { operationId: "op-7", scope, writes: [{ path: "../other/a.json", text: "" }], now: clock }), "STORAGE_UNAVAILABLE");
    assert.equal(vault.map.size, 0);
  });

  it("25 saves keep the 20 newest applied journals and every unapplied one", async () => {
    const vault = memoryVault();
    const board = storyboardVide({ id: "b1", titre: "Demo", idee: "idée", now: "2026-10-01T00:00:00.000Z" });
    const plant = async (operationId: string, state: string, storyboardId = "b1") => {
      await vault.put({
        path: journalPath(operationId), updatedAt: 0, text: JSON.stringify({
          schemaVersion: 1, operationId, scope: { projectId: "p", storyboardId }, state,
          targets: [], payload: { before: [], after: [] },
          createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
        }),
      });
    };
    await plant("keep-conflict", "conflict");
    await plant("keep-prepared", "prepared");
    await plant("keep-rolled", "rolled_back");
    await plant("other-board", "applied", "b2");
    let tick = 0;
    const now = () => {
      tick += 1;
      return `2026-11-02T00:${String(Math.floor(tick / 60)).padStart(2, "0")}:${String(tick % 60).padStart(2, "0")}.000Z`;
    };
    let current: Storyboard | null = null;
    for (let i = 1; i <= 25; i++) {
      const operationId = `s${String(i).padStart(2, "0")}`;
      const saved = await saveBoard(vault, noLock, { projectId: "p", operationId, base: current, mine: { ...board, titre: `v${i}` }, now });
      current = saved.board;
    }
    const journals = [...vault.map.values()]
      .filter(entry => /\.uttu\/op-[\w.-]+\.json$/.test(entry.path))
      .map(entry => JSON.parse(entry.text!));
    const onBoard = journals.filter(entry => entry.scope.storyboardId === "b1");
    const applied = onBoard.filter(entry => entry.state === "applied").map(entry => entry.operationId).sort();
    assert.equal(JOURNAL_KEEP, 20);
    assert.equal(applied.length, JOURNAL_KEEP);
    assert.deepEqual(applied, Array.from({ length: 20 }, (_, i) => `s${String(i + 6).padStart(2, "0")}`));
    assert.deepEqual(onBoard.filter(entry => entry.state !== "applied").map(entry => entry.operationId).sort(), ["keep-conflict", "keep-prepared", "keep-rolled"]);
    assert.equal(journals.find(entry => entry.operationId === "other-board")?.state, "applied");
    assert.equal((await vault.get(cheminJson("b1")))?.text, storyboardJson(current!), "the board file itself is not purged");
  });

  it("a journal named by an open receipt survives the purge", async () => {
    const vault = memoryVault();
    const board = storyboardVide({ id: "b1", titre: "Demo", idee: "idée", now: "2026-10-01T00:00:00.000Z" });
    await vault.put({
      path: RECEIPT_GUARD_PATH, updatedAt: 0,
      text: JSON.stringify({ schemaVersion: 1, operationIds: ["s01"] }),
    });
    let tick = 0;
    const now = () => {
      tick += 1;
      return `2026-11-02T00:${String(Math.floor(tick / 60)).padStart(2, "0")}:${String(tick % 60).padStart(2, "0")}.000Z`;
    };
    let current: Storyboard | null = null;
    for (let i = 1; i <= 25; i++) {
      const saved = await saveBoard(vault, noLock, { projectId: "p", operationId: `s${String(i).padStart(2, "0")}`, base: current, mine: { ...board, titre: `v${i}` }, now });
      current = saved.board;
    }
    const applied = [...vault.map.values()]
      .filter(entry => /\.uttu\/op-[\w.-]+\.json$/.test(entry.path))
      .map(entry => JSON.parse(entry.text!).operationId as string)
      .sort();
    assert.equal(applied.includes("s01"), true, "the open receipt's journal is kept");
    assert.equal(applied.includes("s02"), false, "an older applied journal with no receipt is purged");
    assert.equal(applied.length, 21);
  });

  it("runs under the project lock when the browser has one", async () => {
    const names: string[] = [];
    const { lock, exclusive } = browserProjectLock({ request: async (name, _options, fn) => { names.push(name); return fn(); } });
    assert.equal(exclusive, true);
    await runTransaction(memoryVault(), lock, { operationId: "op-8", scope, writes: [{ path: "a.json", text: "A" }], now: clock });
    assert.deepEqual(names, ["u-ttu-project-demo"]);
    assert.equal(browserProjectLock(undefined).exclusive, false);
  });
});

describe("CE2 cinema sidecar and migration", () => {
  it("keeps unknown fields and refuses a future schema", () => {
    const meta = parseMeta(JSON.stringify({ ...emptyMeta("b1"), futureNote: { keep: true } }), "b1");
    assert.deepEqual(JSON.parse(metaJson(meta)).futureNote, { keep: true });
    assert.throws(() => parseMeta(JSON.stringify({ schemaVersion: CINEMA_META_VERSION + 1 }), "b1"), /plus récente/);
    assert.throws(() => parseMeta("{not json", "b1"), /illisibles/);
    assert.equal(cinemaMetaPath("b1"), ".uttu/cinema-b1.json");
  });

  it("migration: backed up and read back first, ids and unknown fields preserved, idempotent, rollback restores", async () => {
    const vault = memoryVault();
    const path = ".uttu/cinema-b1.json";
    const original = JSON.stringify({ schemaVersion: 0, boardId: "b1", takes: { "c-1": { shotId: "s1" } }, extra: [1, 2] });
    await vault.put({ path, text: original, updatedAt: 0 });
    const migration = { path, currentVersion: 1, migrate: () => ({ settled: [], revisions: {}, archived: [] }) };
    assert.equal(await migrateFile(vault, noLock, "demo", migration, clock), "migrated");
    assert.equal(await text(vault, backupPath(path, 0)), original);
    const migrated = JSON.parse((await text(vault, path))!);
    assert.deepEqual(migrated.takes, { "c-1": { shotId: "s1" } });
    assert.deepEqual(migrated.extra, [1, 2]);
    assert.equal(migrated.schemaVersion, 1);
    assert.equal(await migrateFile(vault, noLock, "demo", migration, clock), "current");
    await restoreBackup(vault, noLock, "demo", path, 0, clock);
    assert.equal(await text(vault, path), original);
  });

  it("migration refuses a future schema and an unverified backup", async () => {
    const vault = memoryVault();
    await vault.put({ path: "x.json", text: JSON.stringify({ schemaVersion: 9 }), updatedAt: 0 });
    await rejectsCode(migrateFile(vault, noLock, "demo", { path: "x.json", currentVersion: 1, migrate: () => ({}) }, clock), "STORAGE_UNAVAILABLE");
    await vault.put({ path: "y.json", text: JSON.stringify({ schemaVersion: 0 }), updatedAt: 0 });
    vault.failPut = p => p.includes("backup");
    await rejectsCode(migrateFile(vault, noLock, "demo", { path: "y.json", currentVersion: 1, migrate: () => ({}) }, clock), "STORAGE_UNAVAILABLE");
    assert.equal(JSON.parse((await text(vault, "y.json"))!).schemaVersion, 0, "no change without a backup");
  });

  it("project files are scoped to their project", async () => {
    const vault = memoryVault();
    const demo = projectFiles(vault, "demo");
    await demo.put({ path: ".uttu/a.json", text: "x", updatedAt: 0 });
    assert.ok(vault.map.has("Projets/demo/.uttu/a.json"));
    assert.equal((await projectFiles(vault, "other").list()).length, 0);
    assert.throws(() => projectFiles(vault, "../x"));
    await assert.rejects(demo.get("../other/a.json"));
  });
});
