import test from "node:test";
import assert from "node:assert/strict";
import { importName } from "../src/lib/creation/import-media.ts";

test("an exported file name loses its sizes and generic words", () => {
  assert.equal(importName("uttu-portrait-640.webp"), "Uttu");
  assert.equal(importName("le-quai-1024x768.jpg"), "Le quai");
  assert.equal(importName("IMG_2041.jpg"), importName("IMG_2041"));
  assert.notEqual(importName("portrait-640.png"), "");
});

test("a name someone typed stays as typed", () => {
  assert.equal(importName("Portrait-archive.png"), "Portrait-archive");
  assert.equal(importName("Léa.jpg"), "Léa");
  assert.equal(importName("prise.mp4"), "prise");
});

test("a camera number alone stays, so the picker can still hide it", () => {
  assert.equal(importName("1000052812.jpg"), "1000052812");
});
