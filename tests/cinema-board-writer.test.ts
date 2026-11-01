import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pageCopyPath, rebaseBoard, saveBoard } from "../src/lib/cinema/board-writer.ts";
import { cinemaMetaPath, emptyMeta, journalPath, noLock, parseMeta, runComputedTransaction } from "../src/lib/cinema/journal.ts";
import { memoryVault } from "../src/lib/coffre/store.ts";
import { cheminJson, lireStoryboard, storyboardJson, majPlan, planVide, retirerPlan, storyboardVide, tousLesPlans, type Storyboard } from "../src/lib/storyboard/storyboard.ts";

function board(): Storyboard {
  const sb = storyboardVide({ id: "b1", titre: "Demo", idee: "idée", now: "2026-10-01T00:00:00.000Z" });
  const plan = (id: string, action: string) => ({ ...planVide(id), titre: id, action });
  return { ...sb, sequences: [{ id: "q1", titre: "A", resume: "", plans: [plan("s1", "un"), plan("s2", "deux")] }, { id: "q2", titre: "B", resume: "", plans: [plan("s3", "trois")] }] };
}
const order = (sb: Storyboard) => tousLesPlans(sb).map(p => p.id);
const shot = (sb: Storyboard, id: string) => tousLesPlans(sb).find(p => p.id === id)!;

describe("CE5 page writer: three-way save through the common revision", () => {
  it("a take linked by a settlement after the page read the file is kept when the page saves an edit", () => {
    const base = board();
    const disk = majPlan(base, "s2", { planFilmId: "pf-1" });
    const mine = majPlan(base, "s1", { action: "un, sous la pluie" });
    const out = rebaseBoard(base, mine, disk, emptyMeta("b1"));
    assert.equal(shot(out.board, "s2").planFilmId, "pf-1", "the settlement's link survives");
    assert.equal(shot(out.board, "s1").action, "un, sous la pluie");
    assert.deepEqual(out.invalidated, ["s1"], "only the edited shot's quotes are void");
    assert.equal(out.meta.revisions.s1, 1);
    assert.equal(out.meta.revisions.s2, undefined);
    assert.deepEqual(out.conflicts, []);
  });

  it("both changed the same field differently: the disk is kept and the clash is reported, never silently lost", () => {
    const base = board();
    const disk = majPlan(base, "s1", { action: "agent" });
    const mine = majPlan(base, "s1", { action: "page" });
    const out = rebaseBoard(base, mine, disk, emptyMeta("b1"));
    assert.equal(shot(out.board, "s1").action, "agent");
    assert.deepEqual(out.conflicts, ["s1.action"]);
  });

  it("a shot removed by the page is archived whole in the sidecar; a shot added elsewhere stays in place", () => {
    const base = board();
    const extra = { ...planVide("s9"), titre: "s9", action: "neuf" };
    const disk: Storyboard = { ...base, sequences: [{ ...base.sequences[0], plans: [base.sequences[0].plans[0], extra, base.sequences[0].plans[1]] }, base.sequences[1]] };
    const mine = retirerPlan(base, "s3");
    const out = rebaseBoard(base, mine, disk, emptyMeta("b1"));
    assert.deepEqual(order(out.board), ["s1", "s9", "s2"]);
    assert.ok(out.meta.archived.includes("s3"));
    assert.equal((out.meta.archivedShots as Record<string, { action: string }>).s3.action, "trois");
    assert.equal(out.meta.storyboardRevision, 1, "structure moved: the board revision moves");
  });

  it("a reorder by the page wins; the same text saved twice changes no revision (idempotent)", () => {
    const base = board();
    const mine: Storyboard = { ...base, sequences: [{ ...base.sequences[0], plans: [...base.sequences[0].plans].reverse() }, base.sequences[1]] };
    const once = rebaseBoard(base, mine, base, emptyMeta("b1"));
    assert.deepEqual(order(once.board), ["s2", "s1", "s3"]);
    const twice = rebaseBoard(once.board, once.board, once.board, once.meta);
    assert.equal(twice.meta, once.meta);
    assert.deepEqual(twice.invalidated, []);
  });

  it("a shot the page edited but another writer removed stays removed, and the clash is reported", () => {
    const base = board();
    const disk = retirerPlan(base, "s2");
    const mine = majPlan(base, "s2", { action: "page" });
    const out = rebaseBoard(base, mine, disk, emptyMeta("b1"));
    assert.deepEqual(order(out.board), ["s1", "s3"]);
    assert.deepEqual(out.conflicts, ["s2.removed"]);
  });

  it("a new board (no file yet) is written as the page has it", () => {
    const mine = board();
    const out = rebaseBoard(null, mine, null, emptyMeta("b1"));
    assert.equal(out.board, mine);
    assert.deepEqual(out.conflicts, []);
  });
});

describe("CE5 page writer: journaled save", () => {
  const now = () => "2026-11-01T12:00:00.000Z";
  it("writes board + sidecar in one journal, then drops the journal of a clean save; a settlement's link survives", async () => {
    const files = memoryVault();
    const base = board();
    await files.put({ path: cheminJson("b1"), text: storyboardJson(majPlan(base, "s2", { planFilmId: "pf-1" })), updatedAt: 1 });
    const saved = await saveBoard(files, noLock, { projectId: "p", operationId: "op-1", base, mine: majPlan(base, "s1", { action: "pluie" }), now });
    const onDisk = lireStoryboard((await files.get(cheminJson("b1")))!.text)!;
    assert.equal(shot(onDisk, "s2").planFilmId, "pf-1");
    assert.equal(shot(onDisk, "s1").action, "pluie");
    assert.equal(parseMeta((await files.get(cinemaMetaPath("b1")))?.text ?? null, "b1").revisions.s1, 1);
    assert.equal(await files.get(journalPath("op-1")), null);
    assert.deepEqual(saved.board, onDisk, "memory = files");
  });

  it("a clash keeps the page's version beside the file and keeps the journal", async () => {
    const files = memoryVault();
    const base = board();
    await files.put({ path: cheminJson("b1"), text: storyboardJson(majPlan(base, "s1", { action: "agent" })), updatedAt: 1 });
    const saved = await saveBoard(files, noLock, { projectId: "p", operationId: "op-2", base, mine: majPlan(base, "s1", { action: "page" }), now });
    assert.deepEqual(saved.conflicts, ["s1.action"]);
    assert.equal(saved.keptBeside, pageCopyPath("b1", "op-2"));
    assert.equal(shot(lireStoryboard((await files.get(saved.keptBeside!))!.text)!, "s1").action, "page");
    assert.ok(await files.get(journalPath("op-2")));
  });

  it("an unreadable board file is never rewritten", async () => {
    const files = memoryVault();
    await files.put({ path: cheminJson("b1"), text: "{oops", updatedAt: 1 });
    await assert.rejects(saveBoard(files, noLock, { projectId: "p", operationId: "op-3", base: null, mine: board(), now }), /illisible/);
    assert.equal((await files.get(cheminJson("b1")))!.text, "{oops");
  });

  it("a replay of the same save id after a crash finishes the stored journal, computes nothing new", async () => {
    const files = memoryVault();
    const base = board();
    await files.put({ path: cheminJson("b1"), text: storyboardJson(base), updatedAt: 1 });
    // A crash after the journal was written: simulate a journal left prepared by writing it through a failing store.
    const failing = { ...files, put: async (entry: { path: string }) => { if (entry.path === cheminJson("b1")) throw new Error("crash"); return files.put(entry as never); } };
    await assert.rejects(runComputedTransaction(failing, noLock, { operationId: "op-4", scope: { projectId: "p", storyboardId: "b1" }, now, compute: async () => [{ path: cheminJson("b1"), text: storyboardJson(majPlan(base, "s1", { action: "v1" })) }] }));
    const saved = await saveBoard(files, noLock, { projectId: "p", operationId: "op-4", base, mine: majPlan(base, "s1", { action: "v2" }), now });
    assert.equal(shot(saved.board, "s1").action, "v1", "the journaled write wins, not a second calculation");
  });
});
