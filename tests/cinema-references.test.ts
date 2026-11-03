import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  checkCollections, compileReferences, fromRefPlan, isBlocked, legacyEntityId, resolveReferences, slotPrompt,
  type CatalogueEntry, type ReferenceCapacity, type ShotRefInput, type SlotLabel,
} from "../src/lib/cinema/references.ts";
import { prepareReferences, withPreparedHashes, type PreparationPorts } from "../src/lib/cinema/reference-preparation.ts";
import { assertSnapshotCurrent, isApprovedKeyframe, keyframeReadiness, keyframeVideoPictures, shotSnapshot, type GenerationSettings } from "../src/lib/cinema/snapshot.ts";
import { CinemaError, type ReferenceBinding } from "../src/lib/cinema/types.ts";
import { LTX_REFS_MAX, ltxTakeGraph } from "../src/lib/render/ltx-graph.ts";
import { versPlanFilm } from "../src/lib/storyboard/film.ts";
import { planVide, storyboardVide, type PlanSB, type Storyboard } from "../src/lib/storyboard/storyboard.ts";

// Fixtures: the P0 cast names (Enki, Fizz) as plain labels, and a generic cast. No private picture:
// asset ids are vault paths that exist only here, and bytes are made up in memory.
const P = "film-p0";
const img = (path: string) => ({ assetId: `Projets/${P}/${path}`, sha256: `sha-${path}` });
const card = (category: CatalogueEntry["category"], referenceId: string, name: string, files: string[], extra: Partial<CatalogueEntry> = {}): CatalogueEntry =>
  ({ projectId: P, category, referenceId, name, images: files.map(img), ...extra });
const CATALOGUE: CatalogueEntry[] = [
  card("cast", "enki", "Enki", ["Cast/enki-1.png", "Cast/enki-2.png", "Cast/enki-3.png"]),
  card("cast", "fizz", "Fizz", ["Cast/fizz-1.png", "Cast/fizz-2.png"]),
  card("cast", "ada", "Ada", ["Cast/ada-1.png", "Cast/ada-2.png"]),
  card("cast", "pip", "Pip", ["Cast/pip-1.png"]),
  card("cast", "ghost", "Ghost", []),
  card("decor", "quai", "Harbour", ["Decors/quai-1.png", "Decors/quai-2.png"]),
  card("objet", "lantern", "Lantern", ["Refs/lantern.png"]),
  card("style", "noir", "Noir", ["Refs/noir.png"]),
  // Same name in another project: never reachable from this one.
  { projectId: "other", category: "cast", referenceId: "enki", name: "Enki", images: [{ assetId: "Projets/other/Cast/enki.png", sha256: "x" }] },
];
const LTX: ReferenceCapacity = { roles: ["identity", "environment", "object", "style", "framing"], maxImages: LTX_REFS_MAX, maxBindings: 7 };
const WIDE: ReferenceCapacity = { roles: ["identity", "environment", "object", "style", "framing"], maxImages: 7, maxBindings: 7 };
const ref = (role: ShotRefInput["role"], referenceId: string | null, name = referenceId ?? ""): ShotRefInput => ({ role, referenceId, name });
const resolve = (refs: ShotRefInput[], catalogue = CATALOGUE) => resolveReferences({ projectId: P, refs, catalogue });
const labels = (bindings: readonly ReferenceBinding[], catalogue = CATALOGUE) =>
  new Map<string, SlotLabel>(bindings.map(binding => [binding.bindingId, { name: catalogue.find(entry => entry.projectId === binding.projectId && entry.referenceId === binding.referenceId && entry.category === binding.category)!.name }]));
const imageTag = (i: number) => `Image ${i + 1}`;
const refTag = (i: number) => `<ref_image_${i}>`;

/** Which entity each picture position belongs to, read from the slots only. */
function pictureOwners(compiled: ReturnType<typeof compileReferences>, bindings: readonly ReferenceBinding[]): string[] {
  const owners: string[] = [];
  for (const slot of compiled.slots) for (const index of slot.imageIndices) owners[index] = `${slot.role}:${bindings.find(b => b.bindingId === slot.bindingId)!.referenceId}`;
  return owners;
}

describe("CE1 · resolution by project, category and id", () => {
  it("binds by id, keeps qui/ou/objet/style with their roles, and never reads another project", () => {
    const { bindings, blocked } = resolve([ref("qui", "enki"), ref("ou", "quai"), ref("objet", "lantern"), ref("style", "noir")]);
    assert.equal(blocked, false);
    assert.deepEqual(bindings.map(b => [b.category, b.role, b.referenceId]), [["cast", "identity", "enki"], ["decor", "environment", "quai"], ["objet", "object", "lantern"], ["style", "style", "noir"]]);
    assert.ok(bindings.every(b => b.projectId === P && b.images.every(i => i.assetId.startsWith(`Projets/${P}/`))));
    assert.equal(bindings[0]!.entityId, legacyEntityId(P, "cast", "enki"));
  });

  it("two cards with the same name in different projects stay two identities", () => {
    const here = resolve([ref("qui", null, "Enki")]);
    const there = resolveReferences({ projectId: "other", refs: [ref("qui", null, "Enki")], catalogue: CATALOGUE });
    assert.notEqual(here.bindings[0]!.entityId, there.bindings[0]!.entityId);
    assert.deepEqual(there.bindings[0]!.images.map(i => i.assetId), ["Projets/other/Cast/enki.png"]);
  });

  it("two cards with the same name in one project are ambiguous, not merged", () => {
    const twins = [...CATALOGUE, card("cast", "enki-2", "Enki", ["Cast/enki-b.png"])];
    const result = resolve([ref("qui", null, "enki")], twins);
    assert.equal(result.blocked, true);
    assert.equal(result.diagnostics[0]!.code, "REFERENCE_AMBIGUOUS");
    assert.equal(result.bindings.length, 0);
  });

  it("an unknown reference blocks the shot and creates nobody", () => {
    const result = resolve([ref("qui", "enki"), ref("qui", null, "Blanche"), ref("qui", "nobody")]);
    assert.equal(result.blocked, true);
    assert.deepEqual(result.diagnostics.map(d => d.code), ["REFERENCE_MISSING", "REFERENCE_MISSING"]);
    assert.deepEqual(result.bindings.map(b => b.referenceId), ["enki"], "no binding invented for the unknown names");
  });

  it("a character without pixels is refused, explicitly", () => {
    const result = resolve([ref("qui", "ghost")]);
    assert.equal(result.blocked, true);
    assert.equal(result.diagnostics[0]!.code, "REFERENCE_MISSING");
    assert.equal(compileReferences(result.bindings, LTX).diagnostics.filter(d => d.code === "REFERENCE_MISSING").length, 1, "reported once");
  });

  it("an explicit link ties several cards to one identity; adjacency alone never does", () => {
    const linked = CATALOGUE.map(entry => entry.referenceId === "fizz" ? { ...entry, entityId: "char:enki" } : entry.referenceId === "enki" ? { ...entry, entityId: "char:enki" } : entry);
    const { bindings } = resolve([ref("qui", "enki"), ref("qui", "fizz")], linked);
    assert.equal(new Set(bindings.map(b => b.entityId)).size, 1);
    const { bindings: apart } = resolve([ref("qui", "enki"), ref("qui", "fizz")]);
    assert.equal(new Set(apart.map(b => b.entityId)).size, 2);
  });
});

describe("CE1 · compile: image → role → entity, exact", () => {
  it("character order reversed: each picture still belongs to its own character", () => {
    for (const order of [["enki", "fizz"], ["fizz", "enki"]]) {
      const { bindings } = resolve([...order.map(id => ref("qui", id)), ref("ou", "quai")]);
      const compiled = compileReferences(bindings, LTX, { identityViews: 1 });
      assert.deepEqual(pictureOwners(compiled, bindings), [`identity:${order[0]}`, `identity:${order[1]}`, "environment:quai"]);
      const text = slotPrompt(compiled, bindings, labels(bindings), imageTag);
      const name = (id: string) => id === "enki" ? "Enki" : "Fizz";
      assert.match(text, new RegExp(`^Image 1 shows only ${name(order[0]!)}\\. Image 2 shows only ${name(order[1]!)}\\.`));
      assert.doesNotMatch(text, /same person/i);
      assert.match(text, /These are 2 different characters/);
    }
  });

  it("the place first or last in the shot: it is named by its slot, never presumed to be the last picture", () => {
    for (const refs of [[ref("ou", "quai"), ref("qui", "enki")], [ref("qui", "enki"), ref("ou", "quai")]]) {
      const { bindings } = resolve(refs);
      const compiled = compileReferences(bindings, LTX);
      const place = compiled.slots.find(slot => slot.role === "environment")!;
      assert.deepEqual(compiled.orderedAssetIds[place.imageIndices[0]!], `Projets/${P}/Decors/quai-1.png`);
      assert.match(slotPrompt(compiled, bindings, labels(bindings), imageTag), /Image 2 shows the place, Harbour\. It gives no features to anyone\./);
    }
  });

  it("critical case: two characters × two views + the place = five pictures for a capacity of four → explicit refusal, place kept", () => {
    const { bindings } = resolve([ref("qui", "enki"), ref("qui", "fizz"), ref("ou", "quai")]);
    const compiled = compileReferences(bindings, LTX);
    assert.equal(compiled.orderedAssetIds.length, 5);
    assert.ok(isBlocked(compiled.diagnostics));
    assert.match(compiled.diagnostics.find(d => d.code === "REFERENCE_CAPACITY")!.detail!, /5 pictures needed \(2 per character\), the workflow takes 4/);
    assert.ok(compiled.slots.some(slot => slot.role === "environment" && slot.imageIndices.length === 1), "the place is never the one dropped");
    // The visitor lowers the views explicitly: three pictures, nobody lost.
    const lowered = compileReferences(bindings, LTX, { identityViews: 1 });
    assert.equal(isBlocked(lowered.diagnostics), false);
    assert.deepEqual(pictureOwners(lowered, bindings), ["identity:enki", "identity:fizz", "environment:quai"]);
  });

  it("balances views: nobody gets more than the scarcest character; a lone character sends one", () => {
    const { bindings } = resolve([ref("qui", "enki"), ref("qui", "ada")]);
    const compiled = compileReferences(bindings, WIDE);
    assert.deepEqual(compiled.slots.map(s => s.imageIndices.length), [2, 2]);
    const { bindings: withPip } = resolve([ref("qui", "enki"), ref("qui", "pip")]);
    assert.deepEqual(compileReferences(withPip, WIDE).slots.map(s => s.imageIndices.length), [1, 1]);
    const { bindings: lone } = resolve([ref("qui", "enki")]);
    assert.deepEqual(compileReferences(lone, WIDE).slots.map(s => s.imageIndices.length), [1]);
  });

  it("object and style refs reach the graph with their own roles", () => {
    const { bindings } = resolve([ref("qui", "enki"), ref("ou", "quai"), ref("objet", "lantern"), ref("style", "noir")]);
    const compiled = compileReferences(bindings, WIDE);
    assert.deepEqual(pictureOwners(compiled, bindings), ["identity:enki", "environment:quai", "object:lantern", "style:noir"]);
    const text = slotPrompt(compiled, bindings, labels(bindings), imageTag);
    assert.match(text, /Image 3 shows the object, Lantern\./);
    assert.match(text, /Image 4 gives the visual style only/);
  });

  it("costume: absent, nothing is invented; present but not taken by the workflow, refused rather than ignored", () => {
    const { bindings } = resolve([ref("qui", "enki")]);
    const compiled = compileReferences(bindings, LTX);
    assert.doesNotMatch(slotPrompt(compiled, bindings, labels(bindings), imageTag), /costume/i);
    const costume: ReferenceBinding = { ...bindings[0]!, bindingId: "x:costume", role: "costume", images: [img("Refs/coat.png")] };
    const refused = compileReferences([...bindings, costume], LTX);
    assert.ok(refused.diagnostics.some(d => d.code === "REFERENCE_CAPACITY" && d.bindingId === "x:costume"));
  });

  it("two cards sharing one file both keep the picture and their diagnostics; no group with zero pictures", () => {
    const shared = [...CATALOGUE.filter(e => e.referenceId !== "pip"), card("cast", "pip", "Pip", ["Cast/enki-1.png"])];
    const { bindings } = resolve([ref("qui", "enki"), ref("qui", "pip")], shared);
    const compiled = compileReferences(bindings, LTX);
    assert.ok(compiled.slots.every(slot => slot.imageIndices.length > 0));
    assert.deepEqual(compiled.slots.map(s => s.imageIndices), [[0], [0]]);
    assert.ok(compiled.diagnostics.some(d => d.code === "REFERENCE_SHARED_ASSET" && d.bindingId === bindings[1]!.bindingId));
  });

  it("refuses more references than the workflow takes", () => {
    const { bindings } = resolve([ref("qui", "enki"), ref("qui", "fizz"), ref("ou", "quai")]);
    assert.ok(compileReferences(bindings, { ...WIDE, maxBindings: 2 }).diagnostics.some(d => d.code === "REFERENCE_CAPACITY"));
  });

  it("an incomplete identity collection is refused before any generation", () => {
    const seven = ["a", "b", "c", "d", "e", "f", "g"].map(x => card("cast", `hero-${x}`, `Hero ${x}`, [`Cast/hero-${x}.png`], { entityId: "char:hero" }));
    const catalogue = [...CATALOGUE, ...seven.slice(0, 6)];
    const { bindings } = resolve(seven.slice(0, 6).map(c => ref("qui", c.referenceId)), catalogue);
    const diagnostics = checkCollections(bindings, [{ entityId: "char:hero", referenceIds: seven.map(c => c.referenceId) }]);
    assert.deepEqual(diagnostics.map(d => d.code), ["REFERENCE_MISSING"]);
    assert.match(diagnostics[0]!.detail!, /hero-g missing \(7 required\)/);
    const full = resolve(seven.map(c => ref("qui", c.referenceId)), [...CATALOGUE, ...seven]);
    assert.deepEqual(checkCollections(full.bindings, [{ entityId: "char:hero", referenceIds: seven.map(c => c.referenceId) }]), []);
  });
});

describe("CE1 · pixel preparation (async, cached by hash)", () => {
  const bytes = (label: string) => new Blob([label]);
  const ports = (files: Record<string, string | null | Error>, sheets: ReadonlySet<string>, undecodable: ReadonlySet<string> = new Set()): PreparationPorts & { classified: string[] } => {
    const classified: string[] = [];
    return {
      classified,
      async read(assetId) { const v = files[assetId]; if (v instanceof Error) throw v; return v === undefined || v === null ? null : bytes(v); },
      async classify(blob) { const text = await blob.text(); classified.push(text); if (undecodable.has(text)) throw new Error("decode"); return sheets.has(text) ? "sheet" : "clean"; },
    };
  };

  it("a sheet misfiled among the photos is dropped when the card has a clean view", async () => {
    const enki = card("cast", "enki", "Enki", ["Cast/enki-board.png", "Cast/enki-1.png"]);
    const { bindings } = resolve([ref("qui", "enki")], [enki]);
    const prep = await prepareReferences(bindings, ports({ [`Projets/${P}/Cast/enki-board.png`]: "board", [`Projets/${P}/Cast/enki-1.png`]: "face" }, new Set(["board"])));
    assert.deepEqual(prep.usable.get(bindings[0]!.bindingId), [`Projets/${P}/Cast/enki-1.png`]);
    const compiled = compileReferences(bindings, LTX, { usable: prep.usable });
    assert.deepEqual(compiled.orderedAssetIds, [`Projets/${P}/Cast/enki-1.png`]);
  });

  it("a sheet-only card still sends its sheet, with a diagnostic (the filter never empties a card silently)", async () => {
    const { bindings } = resolve([ref("qui", "pip")]);
    const prep = await prepareReferences(bindings, ports({ [`Projets/${P}/Cast/pip-1.png`]: "board" }, new Set(["board"])));
    assert.deepEqual(prep.usable.get(bindings[0]!.bindingId), [`Projets/${P}/Cast/pip-1.png`]);
    assert.ok(prep.diagnostics.some(d => d.code === "SHEET_ONLY"));
  });

  it("an unreadable file is never « clean »; a card left without a readable picture is refused", async () => {
    const { bindings } = resolve([ref("qui", "fizz")]);
    const prep = await prepareReferences(bindings, ports({ [`Projets/${P}/Cast/fizz-1.png`]: new Error("io"), [`Projets/${P}/Cast/fizz-2.png`]: "garbled" }, new Set(), new Set(["garbled"])));
    assert.equal(prep.pictures[`Projets/${P}/Cast/fizz-1.png`]!.kind, "unreadable");
    assert.equal(prep.pictures[`Projets/${P}/Cast/fizz-2.png`]!.kind, "unreadable");
    assert.ok(prep.diagnostics.some(d => d.code === "REFERENCE_MISSING"));
    assert.ok(isBlocked(compileReferences(bindings, LTX, { usable: prep.usable }).diagnostics));
  });

  it("classifies the same bytes once (cache by hash), and a missing file is reported", async () => {
    const cache = new Map();
    const { bindings } = resolve([ref("qui", "enki"), ref("ou", "quai")]);
    const files = { [`Projets/${P}/Cast/enki-1.png`]: "same", [`Projets/${P}/Cast/enki-2.png`]: "same", [`Projets/${P}/Cast/enki-3.png`]: null, [`Projets/${P}/Decors/quai-1.png`]: "quai", [`Projets/${P}/Decors/quai-2.png`]: "quai2" };
    const first = ports(files, new Set());
    await prepareReferences(bindings, first, cache);
    assert.deepEqual(first.classified.sort(), ["quai", "quai2", "same"]);
    const second = ports(files, new Set());
    const again = await prepareReferences(bindings, second, cache);
    assert.deepEqual(second.classified, [], "nothing classified twice");
    assert.ok(again.diagnostics.some(d => d.code === "IMAGE_MISSING"));
  });

  it("the same preparation feeds quote, prompt and graph; changed pixels change the digest and void the quote", async () => {
    const { bindings } = resolve([ref("qui", "enki"), ref("ou", "quai")]);
    const files = { [`Projets/${P}/Cast/enki-1.png`]: "e1", [`Projets/${P}/Cast/enki-2.png`]: "e2", [`Projets/${P}/Cast/enki-3.png`]: "e3", [`Projets/${P}/Decors/quai-1.png`]: "q1", [`Projets/${P}/Decors/quai-2.png`]: "q2" };
    const sb = board();
    const plan = sb.sequences[0]!.plans[1]!;
    const snap = async (bytesOf: Record<string, string>) => {
      const prep = await prepareReferences(bindings, ports(bytesOf, new Set()));
      const bound = withPreparedHashes(bindings, prep);
      const compiled = compileReferences(bound, LTX, { usable: prep.usable });
      return shotSnapshot({ scope: SCOPE, plan, revision: 3, planFilmId: "pf", bindings: bound, generation: generation(compiled, slotPrompt(compiled, bound, labels(bound), refTag)) });
    };
    const quoted = await snap(files);
    assert.equal((await snap(files)).digest, quoted.digest, "same pixels, same digest");
    const changed = await snap({ ...files, [`Projets/${P}/Cast/enki-1.png`]: "e1-repainted" });
    assert.notEqual(changed.digest, quoted.digest);
    assert.throws(() => assertSnapshotCurrent(quoted.digest, changed), (e: unknown) => e instanceof CinemaError && e.code === "APPROVAL_REQUIRED");
  });
});

const SCOPE = { projectId: P, storyboardId: "sb1" };
function board(): Storyboard {
  const sb = storyboardVide({ id: "sb1", titre: "Quai", idee: "", now: "2026-11-01T00:00:00.000Z" });
  const shot = (id: string, titre: string, refs: PlanSB["refs"]): PlanSB => ({ ...planVide(id), titre, action: titre, refs });
  return { ...sb, sequences: [{ id: "s1", titre: "", plans: [
    shot("p1", "Enki arrives", [{ role: "qui", nom: "Enki", id: "enki" }, { role: "ou", nom: "Harbour", id: "quai" }]),
    shot("p2", "Fizz waits", [{ role: "qui", nom: "Fizz", id: "fizz" }, { role: "ou", nom: "Harbour", id: "quai" }, { role: "objet", nom: "Lantern", id: "lantern" }, { role: "style", nom: "Noir", id: "noir" }]),
    shot("p3", "They leave", [{ role: "qui", nom: "Enki", id: "enki" }, { role: "qui", nom: "Fizz", id: "fizz" }]),
  ] }] } as Storyboard;
}
function generation(compiled: ReturnType<typeof compileReferences>, prompt: string): GenerationSettings {
  return { workflowId: "prise-ltx", workflowDigest: "w", seed: 7, seconds: 5, aspect: "horizontal", resolution: "540p", prompt, orderedAssetIds: compiled.orderedAssetIds, slots: compiled.slots };
}

describe("CE1 · snapshots and the film path", () => {
  async function snapshots(sb: Storyboard) {
    return Promise.all(sb.sequences[0]!.plans.map(async (plan, index) => {
      const { bindings } = resolve(plan.refs.map(fromRefPlan));
      const compiled = compileReferences(bindings, WIDE, { identityViews: 1 });
      return shotSnapshot({ scope: SCOPE, plan, revision: index + 1, planFilmId: `pf-${plan.id}`, bindings, generation: generation(compiled, slotPrompt(compiled, bindings, labels(bindings), refTag)) });
    }));
  }

  it("changing shot 2 leaves the snapshots of shots 1 and 3 identical", async () => {
    const sb = board();
    const before = await snapshots(sb);
    const edited = structuredClone(sb);
    edited.sequences[0]!.plans[1]!.camera = "suit";
    edited.sequences[0]!.plans[1]!.refs.pop();
    const after = await snapshots(edited);
    assert.equal(after[0]!.digest, before[0]!.digest);
    assert.equal(after[2]!.digest, before[2]!.digest);
    assert.deepEqual(after[0], before[0]);
    assert.notEqual(after[1]!.digest, before[1]!.digest);
    assert.ok(Object.isFrozen(after[1]));
  });

  it("qui/ou/objet/style survive versPlanFilm up to the effective inputs", () => {
    const sb = board();
    const plan = sb.sequences[0]!.plans[1]!;
    const envoi = versPlanFilm(sb, plan, { cast: [{ id: "fizz", name: "Fizz" }], decor: [{ id: "quai", name: "Harbour" }] });
    assert.deepEqual(envoi.references.map(r => [r.role, r.referenceId]), [["qui", "fizz"], ["ou", "quai"], ["objet", "lantern"], ["style", "noir"]]);
    const { bindings, blocked } = resolve(envoi.references);
    assert.equal(blocked, false);
    assert.deepEqual(bindings.map(b => b.role), ["identity", "environment", "object", "style"]);
  });

  it("the LTX graph receives the pictures in slot order and names each by role (no same person, no last-picture place)", () => {
    const { bindings } = resolve([ref("qui", "fizz"), ref("qui", "enki"), ref("ou", "quai")]);
    const compiled = compileReferences(bindings, LTX, { identityViews: 1 });
    const roles = slotPrompt(compiled, bindings, labels(bindings), refTag);
    const graph = ltxTakeGraph({ prompt: "They cross the quay.", pictures: compiled.orderedAssetIds, roles, seed: 7, seconds: 5, aspect: "horizontal" });
    const loads = Object.entries(graph).filter(([id]) => id.startsWith("picture_")).sort(([a], [b]) => a.localeCompare(b)).map(([, node]) => node.inputs.image);
    assert.deepEqual(loads, compiled.orderedAssetIds);
    const text = JSON.stringify(graph);
    assert.match(text, /<ref_image_0> shows only Fizz\. <ref_image_1> shows only Enki\. <ref_image_2> shows the place, Harbour\./);
    assert.doesNotMatch(text, /same person/i);
    assert.doesNotMatch(text, /The person from <ref_image_0>/);
    assert.doesNotMatch(text, /in the place from <ref_image_2>/);
  });

  it("the framing guide never replaces the identities", () => {
    const { bindings } = resolve([ref("qui", "enki"), ref("qui", "fizz")]);
    const compiled = compileReferences(bindings, LTX, { identityViews: 1 });
    const roles = slotPrompt(compiled, bindings, labels(bindings), refTag);
    const graph = ltxTakeGraph({ prompt: "They talk.", pictures: compiled.orderedAssetIds, roles, seed: 1, seconds: 5, aspect: "horizontal", controls: { depth: "d.png", edges: "e.png", guide: "g.png" } });
    const text = JSON.stringify(graph);
    assert.match(text, /<ref_image_2> only as the camera and layout guide/);
    assert.match(text, /<ref_image_0> shows only Enki\. <ref_image_1> shows only Fizz\./);
    assert.doesNotMatch(text, /person from <ref_image_0>/);
  });

  it("the LTX builder refuses more than four pictures instead of cutting the last one", () => {
    assert.throws(() => ltxTakeGraph({ prompt: "x", pictures: ["1.png", "2.png", "3.png", "4.png", "decor.png"], seed: 1, seconds: 5, aspect: "horizontal" }), /au plus 4/);
  });

  it("P0: an approved keyframe goes alone to the one-picture LTX path; a raw CAST photo is not a keyframe", () => {
    const { bindings } = resolve([ref("qui", "enki")]);
    const raw = `Projets/${P}/Cast/enki-1.png`;
    const key = `Projets/${P}/Storyboard/sb1-p1-key.png`;
    assert.equal(isApprovedKeyframe(raw, bindings, new Set([raw])), false);
    assert.equal(isApprovedKeyframe(key, bindings, new Set()), false, "not approved by the visitor");
    assert.throws(() => keyframeVideoPictures({ bindings, approvedKeyframeAssetId: raw }, new Set([raw])), (e: unknown) => e instanceof CinemaError && e.code === "REFERENCE_MISSING");
    const pictures = keyframeVideoPictures({ bindings, approvedKeyframeAssetId: key }, new Set([key]));
    const graph = ltxTakeGraph({ prompt: "Enki walks.", pictures, seed: 1, seconds: 5, aspect: "horizontal" });
    assert.ok(!Object.values(graph).some(node => String(node.class_type).includes("Flux2") || String(node._meta?.title ?? "").startsWith("Picture")), "no hidden composition");
    assert.ok(JSON.stringify(graph).includes(key));
  });

  it("the keyframe button state: disabled while the workflow is a candidate or a reference blocks", () => {
    assert.deepEqual(keyframeReadiness({ workflowRunnable: false, diagnostics: [] }), { enabled: false, reason: "WORKFLOW_UNQUALIFIED" });
    assert.deepEqual(keyframeReadiness({ workflowRunnable: true, diagnostics: [{ code: "REFERENCE_CAPACITY", detail: "5 > 4" }] }), { enabled: false, reason: "REFERENCE_CAPACITY", detail: "5 > 4" });
    assert.deepEqual(keyframeReadiness({ workflowRunnable: true, diagnostics: [{ code: "REFERENCE_SHARED_ASSET" }] }), { enabled: true });
  });

  it("no character name is hard-coded in the CE1 modules", () => {
    for (const file of ["references.ts", "reference-preparation.ts", "snapshot.ts"]) {
      assert.doesNotMatch(readFileSync(`src/lib/cinema/${file}`, "utf8"), /\b(enki|fizz|uttu|blanche|mira)\b/i, file);
    }
  });
});
