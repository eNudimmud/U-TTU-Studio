import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { coffreZip } from "../src/lib/coffre/export.ts";
import { mergeCoffreZip } from "../src/lib/coffre/import.ts";
import { createProject, loadStudio, writeBlob, writeQuotes, writeSequence, writeShot, type Sequence, type Shot, type Take } from "../src/lib/coffre/model.ts";
import { memoryVault } from "../src/lib/coffre/store.ts";
import { BILLED_MEASURE, UNMEASURED_LINE, priseGate, resolveTakeQuote } from "../src/lib/render/billed-quote.ts";
import { COST_OVER_LINE, REAL_COST_UNREAD, journalCostLine, learnTakeCost } from "../src/lib/render/landed-cost.ts";
import { quotesToRecords } from "../src/lib/render/measured-quote.ts";
import { settleLandedTake } from "../src/lib/render/settle-take.ts";
import { takeProfile } from "../src/lib/render/take-graph.ts";

const PROFILE = "h3-4pas-5s-vertical";
const AT = "2026-10-07T21:40:00.000Z";
const PROMPT = "Elle traverse le quai sous la pluie, sans se retourner.";
const read = (path: string) => readFileSync(path, "utf8");

const sequence = (): Sequence => ({ id: "quai-nuit", name: "Quai, la nuit", links: [] });
const shot = (): Shot => ({ id: "gros-plan", name: "Gros plan", sequenceId: "quai-nuit", takeIds: [], note: "Visage", ordre: 0 });

const filmed = (patch: Partial<Take> = {}): Take => ({
  id: "prise-f27",
  at: AT,
  sceneId: "le-quai",
  sceneName: "Le quai",
  line: "Elle traverse",
  settings: { seconds: 5, quality: "rapide", aspect: "vertical" },
  profile: PROFILE,
  jobId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  video: "Projets/uttu/Prises/prise-f27.mp4",
  poster: null,
  prompt: PROMPT,
  gpuSeconds: null,
  costCredits: null,
  balanceBefore: 8,
  balanceAfter: null,
  engine: "comfy",
  loraId: null,
  resolution: null,
  costUsd: null,
  costSource: null,
  announcedCredits: BILLED_MEASURE.credits,
  announcedHigh: BILLED_MEASURE.creditsHigh,
  ...patch,
});

describe("prise rangée après Tourner", () => {
  it("range la sortie dans Prises/ et lie la séquence et le plan quand ils existent", async () => {
    const store = memoryVault();
    await createProject(store, "Uttu");
    await writeSequence(store, sequence(), []);
    await writeShot(store, shot(), [], sequence().name);
    const take = filmed();
    await writeBlob(store, take.video, new Blob(["mp4"], { type: "video/mp4" }));
    const placed = await settleLandedTake(store, take, [sequence()], [shot()], [take]);
    const note = (await store.get("Projets/uttu/Prises/prise-f27.md"))?.text ?? "";
    assert.match(note, /## Texte parti/);
    assert.match(note, new RegExp(PROMPT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(note, new RegExp(`Profil : ${PROFILE}`));
    assert.match(note, /Job : aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/);
    assert.match(note, /Date : 2026-10-07 21:40/);
    assert.match(note, /\[\[Projets\/uttu\/Sequences\/quai-nuit\|Quai, la nuit\]\]/);
    assert.match(note, /\[\[Projets\/uttu\/Shots\/gros-plan\|Gros plan\]\]/);
    assert.equal(placed.sequences[0]?.links[0]?.takeId, take.id);
    assert.deepEqual(placed.shots[0]?.takeIds, [take.id]);
    const sequenceNote = (await store.get("Projets/uttu/Sequences/quai-nuit.md"))?.text ?? "";
    const shotNote = (await store.get("Projets/uttu/Shots/gros-plan.md"))?.text ?? "";
    assert.match(sequenceNote, /\[\[Projets\/uttu\/Prises\/prise-f27\|Elle traverse\]\]/);
    assert.match(shotNote, /\[\[Projets\/uttu\/Prises\/prise-f27\|Elle traverse\]\]/);
    assert.doesNotMatch(note, /Coffre|Vault|class_type|UNETLoader/);

    const bare = memoryVault();
    await createProject(bare, "Uttu");
    const alone = filmed({ id: "prise-seule", video: "Projets/uttu/Prises/prise-seule.mp4" });
    await writeBlob(bare, alone.video, new Blob(["mp4"], { type: "video/mp4" }));
    await settleLandedTake(bare, alone, [], [], [alone]);
    const lone = (await bare.get("Projets/uttu/Prises/prise-seule.md"))?.text ?? "";
    assert.match(lone, /Profil : h3-4pas-5s-vertical/);
    assert.doesNotMatch(lone, /Sequences\/|Shots\//);
  });

  it("écrit le journal devis annoncé contre coût réel, ou coût réel non lu", async () => {
    const unread = filmed({ costCredits: null, balanceAfter: null });
    assert.equal(journalCostLine(unread), `devis annoncé ${BILLED_MEASURE.credits} crédits, au plus ${BILLED_MEASURE.creditsHigh}. ${REAL_COST_UNREAD}.`);
    assert.match(journalCostLine(unread) ?? "", /Coût réel non lu/);
    const read = filmed({ costCredits: 6, balanceBefore: 8, balanceAfter: 2 });
    assert.match(journalCostLine(read) ?? "", /devis annoncé 4 crédits, au plus 6/);
    assert.match(journalCostLine(read) ?? "", /Coût réel lu : 6 crédits/);
    assert.match(journalCostLine(read) ?? "", new RegExp(COST_OVER_LINE));
    assert.equal(journalCostLine({ ...read, engine: "lora" }), null);
    assert.equal(journalCostLine({ ...read, announcedCredits: null, announcedHigh: null }), null);

    const store = memoryVault();
    await createProject(store, "Uttu");
    await writeBlob(store, unread.video, new Blob(["mp4"], { type: "video/mp4" }));
    await settleLandedTake(store, unread, [], [], [unread]);
    const hidden = (await store.get("Projets/uttu/Journal.md"))?.text ?? "";
    assert.match(hidden, /## Devis et coût/);
    assert.match(hidden, /devis annoncé 4 crédits, au plus 6\. Coût réel non lu\./);

    const seen = filmed({ id: "prise-lue", video: "Projets/uttu/Prises/prise-lue.mp4", costCredits: 6, balanceBefore: 8, balanceAfter: 2 });
    await writeBlob(store, seen.video, new Blob(["mp4"], { type: "video/mp4" }));
    await settleLandedTake(store, seen, [], [], [unread, seen]);
    const journal = (await store.get("Projets/uttu/Journal.md"))?.text ?? "";
    assert.match(journal, /prise-lue\|Elle traverse\]\] — devis annoncé 4 crédits, au plus 6\. Coût réel lu : 6 crédits\. Le coût réel dépasse le devis annoncé\./);
    assert.doesNotMatch(journal, /Coffre|Vault/);
  });

  it("prend le coût réel comme référence et éteint Tourner si le solde ne couvre plus", () => {
    const cold = learnTakeCost({ profile: PROFILE, quotes: [], before: 8, after: 2, at: AT, balance: 2 });
    assert.equal(cold.announced?.credits, BILLED_MEASURE.credits);
    assert.equal(cold.announced?.high, BILLED_MEASURE.creditsHigh);
    assert.equal(cold.real, 6);
    assert.equal(cold.exceeded, true);
    assert.equal(cold.stored, true);
    assert.equal(cold.quotes[0]?.credits, 6);
    assert.equal(cold.gate.allowed, false);
    assert.match(cold.gate.line, /Solde trop bas/);
    assert.match(cold.gate.line, /6/);
    assert.doesNotMatch(cold.gate.line, /class_type|nœud/);

    const covered = learnTakeCost({ profile: PROFILE, quotes: [], before: 100, after: 88, at: AT, balance: 88 });
    assert.equal(covered.real, 12);
    assert.equal(covered.exceeded, true);
    assert.equal(covered.gate.allowed, true);
    assert.match(covered.gate.line, /12/);
    assert.equal(resolveTakeQuote(PROFILE, quotesToRecords(covered.quotes)).source, "balance");

    const missed = learnTakeCost({ profile: PROFILE, quotes: [], before: 21, after: null, at: AT, balance: 21 });
    assert.equal(missed.real, null);
    assert.equal(missed.exceeded, false);
    assert.equal(missed.stored, false);
    assert.equal(missed.quotes.length, 0);
    assert.equal(missed.gate.allowed, true);
    assert.match(missed.gate.line, /Environ 4 crédits, au plus 6/);

    const other = priseGate({ credits: 9000, readAt: 1 }, resolveTakeQuote(takeProfile({ seconds: 8, quality: "rapide", aspect: "vertical" }), quotesToRecords(cold.quotes)));
    assert.equal(other.allowed, false);
    assert.equal(other.line, UNMEASURED_LINE);
    assert.doesNotMatch(read("src/lib/render/landed-cost.ts") + read("src/lib/render/settle-take.ts"), /run_template|submit_workflow|partner_generate|estimate_credits|class_type/);
  });

  it("conserve la note, les liens et le journal au retour du ZIP", async () => {
    const store = memoryVault();
    await createProject(store, "Uttu");
    await writeSequence(store, sequence(), []);
    await writeShot(store, shot(), [], sequence().name);
    const learned = learnTakeCost({ profile: PROFILE, quotes: [], before: 8, after: 2, at: AT, balance: 2 });
    const take = filmed({
      costCredits: learned.real,
      balanceBefore: 8,
      balanceAfter: 2,
      announcedCredits: learned.announced?.credits ?? null,
      announcedHigh: learned.announced?.high ?? null,
    });
    await writeBlob(store, take.video, new Blob(["mp4"], { type: "video/mp4" }));
    await settleLandedTake(store, take, [sequence()], [shot()], [take]);
    if (learned.stored) await writeQuotes(store, learned.quotes);
    const archive = await coffreZip(store);
    const empty = memoryVault();
    await mergeCoffreZip(empty, archive);
    const back = await loadStudio(empty);
    const note = (await empty.get("Projets/uttu/Prises/prise-f27.md"))?.text ?? "";
    assert.match(note, new RegExp(PROMPT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(note, /Profil : h3-4pas-5s-vertical/);
    assert.match(note, /Job : aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/);
    assert.match(note, /Date : 2026-10-07 21:40/);
    assert.match(note, /Sequences\/quai-nuit/);
    assert.match(note, /Shots\/gros-plan/);
    const journal = (await empty.get("Projets/uttu/Journal.md"))?.text ?? "";
    assert.match(journal, /devis annoncé 4 crédits, au plus 6/);
    assert.match(journal, /Coût réel lu : 6 crédits/);
    assert.match(journal, /Le coût réel dépasse le devis annoncé/);
    assert.equal(back.sequences[0]?.links.some(link => link.takeId === take.id), true);
    assert.equal(back.shots[0]?.takeIds.includes(take.id), true);
    assert.equal(back.quotes[0]?.credits, 6);
    assert.equal(back.takes[0]?.prompt, PROMPT);
    assert.equal(back.takes[0]?.announcedCredits, 4);
    assert.equal(back.takes[0]?.announcedHigh, 6);

    const fr = JSON.parse(read("messages/fr.json")) as { take: Record<string, string>; _human: string };
    const en = JSON.parse(read("messages/en.json")) as { take: Record<string, string>; _human: string };
    const de = JSON.parse(read("messages/de.json")) as { take: Record<string, string>; _human: string };
    const es = JSON.parse(read("messages/es.json")) as { take: Record<string, string>; _human: string };
    assert.equal(fr.take.overQuote, COST_OVER_LINE);
    assert.match(fr.take.announcedUnread, /coût réel non lu/i);
    assert.equal(fr.take.filed, "Rangée dans ce projet.");
    assert.equal(en._human, "native_open");
    assert.equal(de._human, "native_open");
    assert.equal(es._human, "native_open");
    assert.match(en.take.overQuote, /real cost/i);
    assert.match(de.take.overQuote, /Kalkulation/);
    assert.match(es.take.overQuote, /presupuesto/i);
    assert.doesNotMatch(`${de.take.overQuote} ${de.take.filed}`, /Angebot|Charakter|Tresor|Vault/);
    assert.doesNotMatch(`${es.take.filed} ${fr.take.filed}`, /Coffre|Vault|Cofre/);
    const screens = read("src/components/app/screens.tsx");
    assert.match(screens, /TakeCostLines/);
    assert.match(screens, /t\("take\.inSphere"\)/);
    const decisions = read("docs/DECISIONS.md");
    const f27 = decisions.slice(0, decisions.indexOf("## F26"));
    assert.match(f27, /F27 — la prise revient dans le projet/);
    assert.match(f27, /Coût réel non lu/);
    assert.match(f27, /0 crédit/);
    assert.match(f27, /native_open/);
    assert.match(f27, /`run_template`, `submit_workflow` et `partner_generate` n’ont pas été appelés/);
  });
});
