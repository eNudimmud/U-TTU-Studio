import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clipAspect, clipFormat, clipProblem, datasetCheck, datasetLayout, problemsAfterTouch, triggerPhrase, type Clip } from "../src/lib/lora/dataset.ts";

const clip = (patch: Partial<Clip> = {}): Clip => ({ path: "clips/a.mp4", format: "mp4", bytes: 1000, seconds: 8, width: 720, height: 1280, ...patch });

describe("clips du double", () => {
  it("accepts the four video formats and refuses the rest", () => {
    assert.equal(clipFormat("a.mp4", "video/mp4"), "mp4");
    assert.equal(clipFormat("a.MOV", ""), "mov");
    assert.equal(clipFormat("a.mkv", "video/x-matroska"), "mkv");
    assert.equal(clipFormat("a.webm", "video/webm"), null);
    assert.equal(clipFormat("a.jpg", "image/jpeg"), null);
  });

  it("says what is wrong with one clip before it is stored", () => {
    assert.equal(clipProblem(clip()), null);
    assert.match(clipProblem(clip({ seconds: 2 })) ?? "", /3 s/);
    assert.match(clipProblem(clip({ seconds: 31 })) ?? "", /30 s/);
    assert.match(clipProblem(clip({ bytes: 301 * 1024 * 1024 })) ?? "", /300 Mo/);
    assert.match(clipProblem(clip({ width: 0 })) ?? "", /illisible/);
  });

  it("is ready at ten clips and two look photos, and takes the majority frame", () => {
    const ten = Array.from({ length: 10 }, () => clip());
    const ready = datasetCheck(ten, 2);
    assert.equal(ready.ready, true);
    assert.equal(ready.aspect, "9:16");
    assert.equal(datasetCheck(ten.slice(0, 9), 2).ready, false);
    assert.match(datasetCheck(ten, 1).problems[0], /photos du personnage/);
    const early = datasetCheck([], 0, "");
    assert.equal(problemsAfterTouch(early.problems, { name: false, photos: false, clips: false, submit: false }).length, 0);
    assert.deepEqual(problemsAfterTouch(early.problems, { name: true, photos: false, clips: false, submit: false }).map(line => /nom/.test(line)), [true]);
    assert.equal(problemsAfterTouch(early.problems, { name: false, photos: false, clips: false, submit: true }).length, early.problems.length);
    assert.equal(datasetCheck([...ten, clip({ width: 1920, height: 1080 }), clip({ width: 1920, height: 1080 })], 2).aspect, "9:16");
    assert.equal(clipAspect(clip({ width: 1920, height: 1080 })), "16:9");
    assert.equal(clipAspect(clip({ width: 1000, height: 1000 })), "1:1");
  });

  it("lays the look's photos beside every clip, four at most", () => {
    const clips = [{ blob: new Blob(["a"]), format: "mp4" as const }, { blob: new Blob(["b"]), format: "mov" as const }];
    const refs = [new Blob(["1"]), new Blob(["2"]), new Blob(["3"]), new Blob(["4"]), new Blob(["5"])];
    assert.deepEqual(datasetLayout(clips, refs).map(file => file.name), [
      "clip01.mp4", "clip01.ref_1.jpg", "clip01.ref_2.jpg", "clip01.ref_3.jpg", "clip01.ref_4.jpg",
      "clip02.mov", "clip02.ref_1.jpg", "clip02.ref_2.jpg", "clip02.ref_3.jpg", "clip02.ref_4.jpg",
    ]);
  });

  it("makes a trigger from the character's name", () => {
    const ten = Array.from({ length: 10 }, () => clip());
    assert.equal(triggerPhrase("Mira"), "mira_uttu");
    assert.equal(triggerPhrase("Éloïse"), "eloise_uttu");
    assert.equal(triggerPhrase("   "), "personnage_uttu");
    assert.equal(datasetCheck(ten, 2, "").ready, false);
    assert.equal(datasetCheck(ten, 2, "Mira").ready, true);
  });
});
