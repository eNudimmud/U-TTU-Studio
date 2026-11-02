import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ajouterPlan, lireRegistre, nouveauPlan, registreJson, registreVide, type Registre } from "../src/lib/film/registre.ts";
import { readInFlight, saveInFlight, type InFlight } from "../src/lib/render/settings.ts";
import { reglerPrise, type EnvoiReglement } from "../src/lib/storyboard/reglement.ts";

const envoi = (planId: string, phrase = "They sit on the terrace."): EnvoiReglement => ({
  planId,
  phrase,
  castIds: ["ada", "pip"],
  decorId: "harbour",
  seconds: 5,
});
const take = { id: "prise-1", fichier: "Projets/atelier/Prises/prise-1.mp4" };

function memory() {
  const bag = new Map<string, string>();
  return {
    getItem: (key: string) => bag.get(key) ?? null,
    setItem: (key: string, value: string) => { bag.set(key, value); },
    removeItem: (key: string) => { bag.delete(key); },
  };
}

describe("B2 · reglerPrise", () => {
  it("files the take on the plan id, never on another plan with the same phrase", () => {
    const other = ajouterPlan(registreVide(), { ...nouveauPlan(registreVide(), "sb-other", "They sit on the terrace."), phrase: "They sit on the terrace." });
    const next = reglerPrise(other, envoi("sb-shot-2"), take);
    assert.deepEqual(next.plans.find(plan => plan.id === "sb-other")!.prises, []);
    const plan = next.plans.find(item => item.id === "sb-shot-2")!;
    assert.deepEqual(plan.prises.map(item => item.id), ["prise-1"]);
    assert.equal(plan.prises[0]!.garde, true);
    assert.equal(plan.prises[0]!.fichier, take.fichier);
    assert.deepEqual(plan.quiIds, ["ada", "pip"]);
    assert.equal(plan.ouId, "harbour");
    assert.deepEqual(next.montage.clips, [{ planId: "sb-shot-2", priseId: "prise-1", in: 0, out: 5 }]);
  });

  it("is idempotent: the same take id is added once, and a replay keeps the filed take", () => {
    const once = reglerPrise(registreVide(), envoi("sb-shot-2"), take);
    const twice = reglerPrise(once, envoi("sb-shot-2"), { id: take.id, fichier: "Projets/atelier/Prises/other.mp4" });
    assert.equal(twice, once, "a second settlement of the same take changes nothing");
    assert.equal(twice.plans.find(plan => plan.id === "sb-shot-2")!.prises.length, 1);
    assert.equal(twice.plans.find(plan => plan.id === "sb-shot-2")!.prises[0]!.fichier, take.fichier);
    assert.equal(twice.montage.clips.length, 1);
    assert.deepEqual(lireRegistre(registreJson(twice)).montage, twice.montage);
  });

  it("recreates a deleted plan by id and leaves the kept take of a sibling intact", () => {
    let registre = reglerPrise(registreVide(), envoi("sb-shot-2"), take);
    registre = reglerPrise(registre, envoi("sb-shot-2"), { id: "prise-2", fichier: "Projets/atelier/Prises/prise-2.mp4" });
    const kept = registre.plans.find(plan => plan.id === "sb-shot-2")!;
    assert.equal(kept.prises.find(item => item.id === "prise-1")!.garde, true);
    assert.equal(kept.prises.find(item => item.id === "prise-2")!.garde, false);
    const deleted: Registre = { ...registre, plans: registre.plans.filter(plan => plan.id !== "sb-shot-2"), montage: { clips: [] } };
    const sibling = ajouterPlan(deleted, { ...nouveauPlan(deleted, "sb-shot-9", "They sit on the terrace."), phrase: "They sit on the terrace.", prises: [{ id: "prise-9", fichier: "Projets/atelier/Prises/prise-9.mp4", garde: true }] });
    const back = reglerPrise(sibling, envoi("sb-shot-2"), take);
    assert.equal(back.plans.find(plan => plan.id === "sb-shot-9")!.prises[0]!.id, "prise-9");
    assert.equal(back.plans.find(plan => plan.id === "sb-shot-9")!.prises[0]!.garde, true);
    assert.deepEqual(back.plans.find(plan => plan.id === "sb-shot-2")!.prises.map(item => item.id), ["prise-1"]);
    assert.equal(back.montage.clips.filter(clip => clip.planId === "sb-shot-2").length, 1);
    assert.equal(back.montage.clips.some(clip => clip.planId === "sb-shot-9"), false);
  });

  it("does not move a take that already belongs to another plan", () => {
    const placed = reglerPrise(registreVide(), envoi("sb-shot-1", "Opening."), { ...take, id: "prise-1" });
    const stayed = reglerPrise(placed, envoi("sb-shot-2"), take);
    assert.equal(stayed, placed);
    assert.equal(stayed.plans.find(plan => plan.id === "sb-shot-2"), undefined);
  });

  it("round-trips the envoi on the in-flight receipt so a reload can settle", () => {
    const storage = memory();
    const flight: InFlight = {
      jobId: "job-12345678",
      project: "atelier",
      planId: "sb-shot-2",
      at: "2026-11-02T00:00:00.000Z",
      sceneId: "harbour",
      sceneName: "Harbour",
      line: "They sit on the terrace.",
      prompt: "They sit on the terrace.",
      settings: { seconds: 5, quality: "rapide", aspect: "horizontal", engine: "h3" },
      balanceBefore: 40,
      envoi: { planId: "sb-shot-2", phrase: "They sit on the terrace.", castIds: ["ada", "pip"], decorId: "harbour" },
    };
    saveInFlight(storage, flight);
    assert.deepEqual(readInFlight(storage)?.envoi, flight.envoi);
    assert.equal(readInFlight(storage)?.planId, "sb-shot-2");
  });

  it("the session settles from finish, and the storyboard page no longer writes the register", () => {
    const session = readFileSync("src/components/app/studio-session.tsx", "utf8");
    const finish = session.slice(session.indexOf("const finish = useCallback"), session.indexOf("useEffect(() => {\n    const params"));
    assert.match(finish, /reglerPrise\(/);
    assert.match(finish, /flight\.planId|envoi\.planId/);
    const resume = session.slice(session.indexOf("const resumeRun"), session.indexOf("useEffect(() => {\n    if (!ready || !client)"));
    assert.match(resume, /finish\(/);
    assert.doesNotMatch(resume, /\.cancel\(|interrupt\(/);
    const page = readFileSync("src/components/storyboard/storyboard-page.tsx", "utf8");
    const effect = page.slice(page.indexOf("A take landed"), page.indexOf("const filmer"));
    assert.doesNotMatch(effect, /setRegistre|sendToMontage|ajouterPrise|auMontage/);
    assert.match(effect, /terminer\(enCours, true\)/);
  });
});
