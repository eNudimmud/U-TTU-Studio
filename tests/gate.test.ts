import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canKeep, computeFlags, evaluateGate, type GateInput } from "../src/lib/gate/rules.ts";
import { cleanDataset, cleanInput, makeImage } from "./fixtures.ts";

const status = (input: GateInput, id: string) => evaluateGate(input).checks.find(item => item.id === id)?.status;

describe("dataset gate", () => {
  it("passes a clean 15-image dataset and builds trigger + variables captions", () => {
    const result = evaluateGate(cleanInput());
    assert.equal(result.verdict, "PASS", result.checks.filter(item => item.status !== "pass").map(item => `${item.id} ${item.detail}`).join("\n"));
    assert.equal(result.captions.length, 15);
    assert.equal(result.captions[0], "mira_v1, front view, close-up portrait, black leather jacket, rainy street at night, neon rim light");
  });

  it("starts in a pending state instead of a wall of FAIL", () => {
    const result = evaluateGate({ trigger: "", invariants: "", images: [], confirmations: {} });
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.failCount, 0);
    assert.equal(result.todoCount, result.checks.filter(item => item.status === "todo").length);
    assert.ok(result.todoCount >= 15);
  });

  it("blocks when the kept count is not exactly 15", () => {
    const images = cleanDataset();
    images[0].decision = "rejeter";
    assert.equal(status(cleanInput(images), "G03"), "fail");
    const more = [...cleanDataset(), makeImage({ variables: "orange scarf, train station", angle: "profil", framing: "buste" })];
    assert.equal(status(cleanInput(more), "G03"), "fail");
  });

  it("blocks captions that restate a declared invariant, plural included", () => {
    const images = cleanDataset();
    images[2].variables = "grey hoodie, green eyes, subway platform";
    const result = evaluateGate(cleanInput(images));
    const g15 = result.checks.find(item => item.id === "G15");
    assert.equal(g15?.status, "fail");
    assert.match(g15?.detail ?? "", /green eyes/);
    assert.deepEqual(g15?.imageIds, [images[2].id]);
    const plural = cleanDataset();
    plural[4].variables = "denim jacket, freckles visible in sunlight, rooftop";
    assert.equal(status({ ...cleanInput(plural), invariants: "green eyes, freckle" }, "G15"), "fail");
  });

  it("blocks a trait copied into most captions even when it was not declared", () => {
    const images = cleanDataset();
    for (let i = 0; i < 10; i++) images[i].variables = `long silver hair, ${images[i].variables}`;
    const g16 = evaluateGate(cleanInput(images)).checks.find(item => item.id === "G16");
    assert.equal(g16?.status, "fail");
    assert.match(g16?.detail ?? "", /long silver hair/);
  });

  it("requires every imported image to be triaged and every confirmation ticked", () => {
    const images = [...cleanDataset(), makeImage({ decision: "a-trier" })];
    assert.equal(status(cleanInput(images), "G04"), "fail");
    const input = cleanInput();
    assert.equal(status({ ...input, confirmations: { ...input.confirmations, droits: false } }, "G05"), "fail");
    assert.equal(status({ ...input, confirmations: {} }, "G05"), "todo");
  });

  it("flags blur for review and passes once the image is checked by eye", () => {
    const images = cleanDataset();
    images[5].sharpness = 40;
    assert.equal(status(cleanInput(images), "G08"), "fail");
    images[5].reviewed = true;
    assert.equal(status(cleanInput(images), "G08"), "pass");
  });

  it("fails on duplicates until one of the pair is rejected", () => {
    const images = cleanDataset();
    images[7].hash = images[3].hash;
    assert.equal(status(cleanInput(images), "G07"), "fail");
    const withSpare = [...images, makeImage({ variables: "orange scarf, train station, dawn", angle: "trois-quarts", framing: "gros-plan" })];
    withSpare[7].decision = "rejeter";
    assert.equal(status(cleanInput(withSpare), "G07"), "pass");
  });

  it("asks for review on mirrored copies and colour outliers", () => {
    const images = cleanDataset();
    images[9].hash = images[1].mirrorHash;
    images[12].luma = 20;
    const flags = computeFlags(images);
    assert.ok(flags[images[9].id].some(flag => flag.kind === "miroir"));
    assert.ok(flags[images[12].id].some(flag => flag.kind === "hors-norme"));
    assert.equal(status(cleanInput(images), "G09"), "fail");
    images[9].reviewed = images[1].reviewed = images[12].reviewed = true;
    assert.equal(status(cleanInput(images), "G09"), "pass");
  });

  it("forbids keeping unreadable or low resolution images", () => {
    const small = makeImage({ width: 640, height: 900 });
    const broken = makeImage({ readable: false });
    const flags = computeFlags([small, broken]);
    assert.equal(canKeep(flags[small.id]), false);
    assert.equal(canKeep(flags[broken.id]), false);
    const images = cleanDataset();
    images[0].width = 600;
    assert.equal(status(cleanInput(images), "G06"), "fail");
  });

  it("enforces angle coverage, angle balance and framing mix", () => {
    const noProfile = cleanDataset().map(image => ({ ...image, angle: image.angle === "profil" ? "trois-quarts" as const : image.angle }));
    assert.equal(status(cleanInput(noProfile), "G11"), "fail");
    const frontHeavy = cleanDataset().map((image, i) => ({ ...image, angle: i < 10 ? "face" as const : image.angle }));
    assert.equal(status(cleanInput(frontHeavy), "G12"), "fail");
    const portraitsOnly = cleanDataset().map((image, i) => ({ ...image, framing: i < 14 ? "gros-plan" as const : image.framing }));
    assert.equal(status(cleanInput(portraitsOnly), "G13"), "fail");
    const untagged = cleanDataset();
    untagged[3].framing = null;
    assert.equal(status(cleanInput(untagged), "G10"), "fail");
  });

  it("blocks identical and novel-length captions, warns on bare captions", () => {
    const identical = cleanDataset();
    identical[1] = { ...identical[1], angle: identical[0].angle, framing: identical[0].framing, variables: identical[0].variables };
    assert.equal(status(cleanInput(identical), "G18"), "fail");
    const long = cleanDataset();
    long[6].variables = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    assert.equal(status(cleanInput(long), "G17"), "fail");
    const bare = cleanDataset().map((image, i) => ({ ...image, variables: i < 9 ? "" : image.variables }));
    const result = evaluateGate(cleanInput(bare));
    assert.equal(result.checks.find(item => item.id === "G19")?.status, "warn");
  });

  it("rejects weak triggers and requires at least two invariants", () => {
    for (const trigger of ["woman", "woman_1", "mira", "Mira_v1", "m_1", "sks_2"]) assert.equal(status({ ...cleanInput(), trigger }, "G01"), "fail", trigger);
    assert.equal(status({ ...cleanInput(), trigger: "mira_v1" }, "G01"), "pass");
    assert.equal(status({ ...cleanInput(), invariants: "green eyes" }, "G02"), "fail");
  });
});
