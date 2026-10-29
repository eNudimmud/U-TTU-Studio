import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ETAPES, etapeApres, etapeInitiale, etapePrecedente, etapeSuivante, isEtape } from "../src/lib/prise/etapes.ts";

const idle = { running: false, failed: false, versions: 0 };

describe("PRISE mobile en 5 étapes", () => {
  it("has the plan's five steps, in order", () => {
    assert.deepEqual([...ETAPES], ["preparer", "plans", "previs", "generer", "reviser"]);
    assert.equal(isEtape("previs"), true);
    assert.equal(isEtape("montage"), false);
  });
  it("opens a fresh plan at the start and a plan with takes on Réviser", () => {
    assert.equal(etapeInitiale(idle), "preparer");
    assert.equal(etapeInitiale({ ...idle, versions: 2 }), "reviser");
    assert.equal(etapeInitiale({ ...idle, running: true }), "reviser");
    assert.equal(etapeInitiale({ ...idle, failed: true }), "reviser");
  });
  it("moves to Réviser only when a render starts, lands or fails", () => {
    assert.equal(etapeApres("generer", idle, { ...idle, running: true }), "reviser");
    assert.equal(etapeApres("plans", { ...idle, versions: 1 }, { ...idle, versions: 2 }), "reviser");
    assert.equal(etapeApres("generer", { ...idle, running: true }, { ...idle, failed: true }), "reviser");
    assert.equal(etapeApres("previs", idle, idle), "previs");
    assert.equal(etapeApres("plans", { ...idle, running: true }, { ...idle, running: true }), "plans");
    assert.equal(etapeApres("preparer", { ...idle, versions: 2 }, { ...idle, versions: 1 }), "preparer");
  });
  it("walks forward and back without leaving the five steps", () => {
    assert.equal(etapeSuivante("preparer"), "plans");
    assert.equal(etapeSuivante("reviser"), null);
    assert.equal(etapePrecedente("preparer"), null);
    assert.equal(etapePrecedente("reviser"), "generer");
  });
});
