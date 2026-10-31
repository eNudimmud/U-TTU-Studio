import { test } from "node:test";
import assert from "node:assert/strict";
import { knowledge } from "../scripts/agent-knowledge.mjs";
import type { Knowledge } from "../src/lib/agent/uttu.ts";
import { buildInstructions, buildPack, cleanProject } from "../src/lib/agent/uttu-comfy.ts";
import { LOCALES } from "../src/lib/i18n/config.ts";

// JD 31.10: the bubble answered « ton personnage Enki … DÉCOR (Capitole, Le hall) … une PLAN ».
// Those names came from his own project (PROJECT block), never from the prompt. This keeps it that way.
const k = knowledge("abcdef0123456789") as Knowledge;
const PERSONAL = /\b(Enki|Capitole|The Bloc|Le hall|Mira|Coursière|JD|Jean-Daniel)\b/i;
const QUESTIONS = ["Par où je commence ?", "How do I make a video of my character?", "Wie fange ich an?", "¿Cómo hago un plano?"];

test("without a project the prompt and its knowledge name no character, place or person", () => {
  for (const locale of LOCALES) {
    for (const question of QUESTIONS) {
      const prompt = buildInstructions(locale, buildPack(k, locale, question), "abc1234");
      const hit = prompt.match(PERSONAL);
      assert.equal(hit, null, `${locale} « ${question} »: ${hit?.[0]}`);
      assert.doesNotMatch(prompt, /PROJECT \(/);
    }
  }
});

test("project names reach the prompt only inside the PROJECT block, marked as the visitor's own", () => {
  const project = cleanProject({ name: "Mon clip", items: [{ role: "cast", name: "Enki" }, { role: "decor", name: "Capitole" }] });
  const prompt = buildInstructions("fr", buildPack(k, "fr", "Par où je commence ?"), "abc1234", project);
  const at = prompt.indexOf("PROJECT (the visitor's own");
  assert.ok(at > 0);
  assert.equal(prompt.slice(0, at).match(PERSONAL), null);
  assert.match(prompt.slice(at), /- cast: Enki/);
});

test("the guide answers simply: no pipeline lecture, « un plan », no reply-format words as features", () => {
  const prompt = buildInstructions("fr", "PACK", "abc1234");
  assert.doesNotMatch(prompt, /CAST → DÉCOR → PRISE/);
  assert.doesNotMatch(prompt, /in 5 steps/);
  assert.match(prompt, /Never recite the studio's steps/);
  assert.match(prompt, /« un plan », never « une plan »/);
  assert.match(prompt, /only if their project data lists it, as theirs/);
});
