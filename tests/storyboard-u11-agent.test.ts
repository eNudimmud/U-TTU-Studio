import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIntent } from "../src/lib/cinema/intent.ts";
import type { IntentContext, IntentEnvelope } from "../src/lib/cinema/types.ts";
import { answerOf, agentChange, agentReading, boardFromProposal, confirmProposal, proposalsOf, U11_AGENT_CEILING, withQuotableDurations } from "../src/lib/storyboard/u11-agent.ts";
import { tousLesPlans } from "../src/lib/storyboard/storyboard.ts";

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

test("a structural change is only the operation the proposal names", () => {
  const ctx = context({
    shots: [
      { shotId: "p1", revision: 0, index: 0, titre: "Léa sur le quai", action: "arrive", archived: false, lockedFields: [] },
      { shotId: "p2", revision: 0, index: 1, titre: "Le marché", action: "traverse", archived: false, lockedFields: [] },
    ],
    storyboardRevision: 0,
  });
  const board = {
    version: 1, id: "board-1", titre: "La traversée", idee: "x", logline: "", scenario: "", format: "paysage" as const, dureeCible: 30 as const, musique: "", archive: false, creeLe: "t", majLe: "t",
    sequences: [{ id: "s1", titre: "", resume: "", plans: [
      { id: "p1", titre: "Léa sur le quai", action: "arrive", refs: [], cadrage: "large" as const, camera: "fixe" as const, duree: 5 as const, format: "paysage" as const, rendu: "fidele" as const, dialogue: { type: "aucune" as const, qui: null, texte: "", source: "visiteur" as const, propositions: [] }, son: { musique: "", ambiance: "" }, promptManuel: null, raccord: false, planFilmId: null, etat: "a-tourner" as const },
      { id: "p2", titre: "Le marché", action: "traverse", refs: [], cadrage: "moyen" as const, camera: "fixe" as const, duree: 5 as const, format: "paysage" as const, rendu: "fidele" as const, dialogue: { type: "aucune" as const, qui: null, texte: "", source: "visiteur" as const, propositions: [] }, son: { musique: "", ambiance: "" }, promptManuel: null, raccord: false, planFilmId: null, etat: "a-tourner" as const },
    ] }],
  };
  const patch = envelope({
    creativeGoal: "La traversée",
    expectedResult: "closer",
    operations: [{ kind: "shot.patch", target: { ...ctx.scope, shotId: "p1", expectedRevision: 0 }, patch: { cadrage: "serre" } }],
    rationale: "",
    unresolved: [],
  }, ctx);
  const next = boardFromProposal(board, patch, "t2");
  assert.deepEqual(tousLesPlans(next).map(plan => plan.id), ["p1", "p2"]);
  assert.equal(tousLesPlans(next)[0]!.cadrage, "serre");
  assert.equal(tousLesPlans(next)[1]!.cadrage, "moyen");
  const invalid = answerOf("invalid", null);
  assert.equal(invalid.status, "invalid");
});
