import { test } from "node:test";
import assert from "node:assert/strict";
import type { VaultEntry, VaultStore } from "../src/lib/coffre/store.ts";
import { createCinemaController, type CinemaClient, type ControllerPorts } from "../src/lib/cinema/controller.ts";
import { parseIntent } from "../src/lib/cinema/intent.ts";
import { cinemaMetaPath, emptyMeta, metaJson, noLock, parseMeta, projectFiles } from "../src/lib/cinema/journal.ts";
import type { IntentContext, IntentEnvelope, Operation } from "../src/lib/cinema/types.ts";
import { answerOf, agentChange, agentReading, boardFromProposal, confirmProposal, proposalsOf, U11_AGENT_CEILING, U11_AUTO_RETRY, withQuotableDurations } from "../src/lib/storyboard/u11-agent.ts";
import { cheminJson, lireStoryboard, planVide, storyboardJson, storyboardVide, tousLesPlans, type Storyboard } from "../src/lib/storyboard/storyboard.ts";

const context = (over: Partial<IntentContext> = {}): IntentContext => ({
  scope: { projectId: "atelier", storyboardId: "board-1" },
  locale: "en",
  selectedShotId: null,
  storyboardRevision: 0,
  shots: [],
  references: [
    { referenceId: "a", category: "cast", name: "Léa", locked: false },
    { referenceId: "b", category: "cast", name: "Noé", locked: false },
    { referenceId: "port", category: "decor", name: "Le port", locked: false },
    { referenceId: "marche", category: "decor", name: "Le marché", locked: false },
  ],
  capabilities: [],
  narrative: "",
  ...over,
});

function envelope(raw: unknown, ctx = context()): IntentEnvelope {
  const parsed = parseIntent(JSON.stringify(raw), ctx, { operationId: "op-1", source: "conversation", userText: "write" });
  assert.notEqual(parsed.status, "invalid");
  if (parsed.status === "invalid") throw new Error("invalid");
  return parsed.envelope;
}

test("the reading estimate is the documented ceiling and is never zero", () => {
  assert.equal(U11_AGENT_CEILING, 3);
  assert.ok(U11_AGENT_CEILING > 0);
});

test("a request carries the story and the library, in any language, without special names", () => {
  const en = agentReading("Two people meet at the harbour, then cross a market.", [
    { id: "a", category: "cast", name: "Léa", description: "a sailor" },
    { id: "port", category: "decor", name: "Le port", description: "night water" },
  ]);
  assert.match(en.userText, /harbour/);
  assert.match(en.scenario, /cast a Léa — a sailor/);
  assert.match(en.scenario, /decor port Le port/);
  const fr = agentReading("Léa et Noé se retrouvent au port, puis ils traversent le marché.", []);
  assert.match(fr.userText, /traversent le marché/);
  assert.ok(agentChange("Resserre le dernier plan.").length > 10);
  assert.ok(!agentChange("hello").includes("Enki"));
});

test("a French story with two places and no dialogue becomes those shots, and an unknown name stays a question", () => {
  const ctx = context();
  const raw = {
    creativeGoal: "La traversée",
    expectedResult: "Two shots",
    operations: [{
      kind: "storyboard.create",
      scope: ctx.scope,
      shots: [
        { titre: "Léa sur le quai", action: "Léa arrive au port.", refs: [{ role: "qui", referenceId: "a", name: "Léa" }, { role: "ou", referenceId: "port", name: "Le port" }, { role: "qui", name: "Sacha" }], duree: 8 },
        { titre: "Le marché, sans un mot", action: "Ils traversent le marché en silence.", refs: [{ role: "ou", referenceId: "marche", name: "Le marché" }], duree: 10, dialogue: { type: "aucune", qui: null, texte: "" } },
      ],
    }],
    rationale: "",
    unresolved: [],
  };
  const parsed = parseIntent(JSON.stringify(raw), ctx, { operationId: "op-1", source: "conversation", userText: "écris" });
  assert.equal(parsed.status, "needs_clarification");
  const answer = answerOf(parsed.status, parsed.envelope);
  assert.equal(answer.status, "ready");
  if (answer.status !== "ready") return;
  assert.deepEqual(answer.proposals.map(item => item.name), ["Sacha"]);
  assert.equal(answer.proposals[0]!.role, "qui");
});

test("applying a proposal keeps library ids and does not invent the unresolved name", () => {
  const ctx = context();
  const parsed = parseIntent(JSON.stringify({
    creativeGoal: "La traversée",
    expectedResult: "ok",
    operations: [{
      kind: "storyboard.create",
      scope: ctx.scope,
      shots: [
        { titre: "Léa sur le quai", action: "Léa arrive au port.", refs: [{ role: "qui", referenceId: "a", name: "Léa" }, { role: "ou", referenceId: "port", name: "Le port" }, { role: "qui", name: "Sacha" }] },
        { titre: "Le marché", action: "Noé traverse le marché.", refs: [{ role: "qui", referenceId: "b", name: "Noé" }, { role: "ou", referenceId: "marche", name: "Le marché" }], dialogue: { type: "aucune", qui: null, texte: "" } },
      ],
    }],
    rationale: "",
    unresolved: [],
  }), ctx, { operationId: "op-1", source: "conversation", userText: "écris" });
  assert.equal(parsed.status, "needs_clarification");
  const empty = boardFromProposal({
    version: 1, id: "board-1", titre: "x", idee: "Léa et Noé au port puis au marché.", logline: "", scenario: "", format: "paysage", dureeCible: 30, musique: "", sequences: [], archive: false, creeLe: "t", majLe: "t",
  }, parsed.envelope, "t2");
  const plans = tousLesPlans(empty);
  assert.equal(plans.length, 2);
  assert.equal(empty.titre, "La traversée");
  assert.deepEqual(plans[0]!.refs.map(ref => ref.nom), ["Léa", "Le port"]);
  assert.ok(plans.every(plan => !plan.refs.some(ref => ref.nom === "Sacha")));
  assert.equal(plans[1]!.refs.find(ref => ref.role === "ou")!.id, "marche");
  const proposals = proposalsOf(parsed.envelope.unresolved);
  const confirmed = confirmProposal(empty, proposals[0]!, "t3");
  assert.ok(tousLesPlans(confirmed)[0]!.refs.some(ref => ref.nom === "Sacha" && ref.id === null && ref.role === "qui"));
  const priced = withQuotableDurations(empty, duree => duree === 5);
  assert.ok(tousLesPlans(priced).every(plan => plan.duree === 5));
});

test("a modification is not applied by rebuilding the board", () => {
  const ctx = context({
    shots: [
      { shotId: "p1", revision: 0, index: 0, titre: "Shot 1", action: "one", archived: false, lockedFields: [] },
      { shotId: "p2", revision: 0, index: 1, titre: "Shot 2", action: "two", archived: false, lockedFields: [] },
    ],
    storyboardRevision: 0,
  });
  const board = {
    version: 1, id: "board-1", titre: "Board", idee: "x", logline: "", scenario: "", format: "paysage" as const, dureeCible: 30 as const, musique: "", archive: false, creeLe: "t", majLe: "t",
    sequences: [{ id: "s1", titre: "", resume: "", plans: [
      { id: "p1", titre: "Shot 1", action: "one", refs: [], cadrage: "large" as const, camera: "fixe" as const, duree: 5 as const, format: "paysage" as const, rendu: "fidele" as const, dialogue: { type: "aucune" as const, qui: null, texte: "", source: "visiteur" as const, propositions: [] }, son: { musique: "", ambiance: "" }, promptManuel: null, raccord: false, planFilmId: null, etat: "a-tourner" as const },
      { id: "p2", titre: "Shot 2", action: "two", refs: [], cadrage: "moyen" as const, camera: "fixe" as const, duree: 5 as const, format: "paysage" as const, rendu: "fidele" as const, dialogue: { type: "aucune" as const, qui: null, texte: "", source: "visiteur" as const, propositions: [] }, son: { musique: "", ambiance: "" }, promptManuel: null, raccord: false, planFilmId: null, etat: "a-tourner" as const },
    ] }],
  };
  const patch = envelope({
    creativeGoal: "Board",
    expectedResult: "closer",
    operations: [{ kind: "shot.patch", target: { ...ctx.scope, shotId: "p1", expectedRevision: 0 }, patch: { cadrage: "serre" } }],
    rationale: "",
    unresolved: [],
  }, ctx);
  const before = JSON.stringify(board);
  assert.throws(() => boardFromProposal(board, patch, "t2"), /shell create only/);
  assert.equal(JSON.stringify(board), before, "the board bytes are untouched");
  assert.equal(answerOf("invalid", null).status, "invalid");
  assert.equal(U11_AUTO_RETRY, false, "a bad answer is not sent again by itself");
});

const PROJECT = "atelier";
const scope = { projectId: PROJECT, storyboardId: "board-1" };

function memoryVault(): VaultStore & { map: Map<string, VaultEntry> } {
  const map = new Map<string, VaultEntry>();
  return { map, list: async () => [...map.values()], get: async path => map.get(path) ?? null, put: async entry => { map.set(entry.path, { ...entry }); }, remove: async path => { map.delete(path); } };
}

function threeShots(): Storyboard {
  const sb = storyboardVide({ id: "board-1", titre: "Board", idee: "three shots", now: "2026-11-01T00:00:00.000Z" });
  const plan = (id: string, action: string) => ({ ...planVide(id), titre: id, action });
  return { ...sb, sequences: [{ id: "seq", titre: "", resume: "", plans: [plan("p1", "one"), plan("p2", "two"), plan("p3", "three")] }] };
}

async function mustText(files: VaultStore, path: string): Promise<string> {
  const text = (await files.get(path))?.text;
  assert.equal(typeof text, "string");
  return text!;
}

function planBytes(text: string, id: string): string {
  const board = lireStoryboard(text);
  const plan = board ? tousLesPlans(board).find(item => item.id === id) : null;
  return JSON.stringify(plan);
}

function portsFor(vault: VaultStore, calls: string[]): ControllerPorts {
  let n = 0;
  const client = {
    async user() { calls.push("user"); return { id: "acct" }; },
    async submit() { calls.push("submit"); return "job"; },
    async status() { calls.push("status"); return "success"; },
    async job() { calls.push("job"); return { status: "success", outputs: {} }; },
  } as CinemaClient;
  return {
    storage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
    vault, lock: noLock, paidLocks: null, sessionId: "tab", client: () => client,
    now: () => new Date("2026-11-02T00:00:00.000Z"),
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    seed: () => 1, trancheCapCredits: 3, campaign: { capCredits: 300, priorCredits: 0 },
    balance: async () => null, projectAvailable: async () => true, purpose: "qualification",
  };
}

async function seeded() {
  const vault = memoryVault();
  const files = projectFiles(vault, PROJECT);
  const board = threeShots();
  const text = storyboardJson(board);
  await files.put({ path: cheminJson(board.id), text, updatedAt: 0 });
  await files.put({ path: cinemaMetaPath(board.id), text: metaJson(emptyMeta(board.id)), updatedAt: 0 });
  const calls: string[] = [];
  return { vault, files, text, calls, cinema: createCinemaController(portsFor(vault, calls)) };
}

const patch = (shotId: string, expectedRevision: number, field: "cadrage" | "camera", value: string): Operation => ({
  kind: "shot.patch",
  target: { ...scope, shotId, expectedRevision },
  patch: { [field]: value },
});

test("editing shot 2 leaves shots 1 and 3 byte-identical, and a stale revision writes nothing", async () => {
  const { files, text, calls, cinema } = await seeded();
  const out = await cinema.applyLocal(scope, [patch("p2", 0, "cadrage", "serre")], { locks: {}, userText: "tighten shot 2" });
  assert.equal(out.code, "LOCAL_APPLIED");
  const next = await mustText(files, cheminJson("board-1"));
  assert.equal(planBytes(next, "p1"), planBytes(text, "p1"));
  assert.equal(planBytes(next, "p3"), planBytes(text, "p3"));
  assert.notEqual(planBytes(next, "p2"), planBytes(text, "p2"));
  assert.equal(JSON.parse(planBytes(next, "p2")).cadrage, "serre");
  const stale = await cinema.applyLocal(scope, [patch("p2", 0, "camera", "suit")], { locks: {} });
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "REVISION_CONFLICT");
  assert.equal(await mustText(files, cheminJson("board-1")), next, "a conflict is shown by the caller and nothing is written");
  assert.deepEqual(calls, [], "applyLocal never POSTs");
});

test("a locked shot is refused and the board bytes stay", async () => {
  const { files, text, calls, cinema } = await seeded();
  const out = await cinema.applyLocal(scope, [patch("p2", 0, "cadrage", "serre")], { locks: { p2: ["cadrage"] }, userText: "tighten the locked shot" });
  assert.equal(out.ok, false);
  assert.equal(out.code, "LOCK_CONFLICT");
  assert.equal(await mustText(files, cheminJson("board-1")), text);
  assert.equal(parseMeta(await mustText(files, cinemaMetaPath("board-1")), "board-1").revisions.p2, undefined);
  assert.deepEqual(calls, []);
});

test("undo restores the previous revision of the board", async () => {
  const { files, text, calls, cinema } = await seeded();
  const applied = await cinema.applyLocal(scope, [patch("p2", 0, "cadrage", "serre")], { locks: {} });
  assert.equal(applied.code, "LOCAL_APPLIED");
  const operationId = applied.data?.operationId;
  assert.ok(operationId);
  const undone = await cinema.undo(scope, operationId!);
  assert.equal(undone.code, "UNDONE");
  assert.equal(await mustText(files, cheminJson("board-1")), text, "the board file is the previous revision, byte for byte");
  const meta = parseMeta(await mustText(files, cinemaMetaPath("board-1")), "board-1");
  assert.equal(meta.revisions.p2, 2, "the sidecar revision only moves forward, so an older quote cannot spend");
  assert.deepEqual(calls, []);
});
