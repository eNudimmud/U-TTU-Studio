import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyStudio, mocMarkdown, storyboardsDuProjet } from "../src/lib/coffre/model.ts";

const studio = () => ({ ...emptyStudio(), project: "atelier", projectName: "Atelier" });

test("the project map lists its storyboards, archived ones last and marked", () => {
  const entries = [
    { path: "Projets/atelier/Storyboard/la-pluie-a1.md", text: "---\ntype: storyboard\nstatut: en-cours\n---\n# Uttu sous la pluie\n" },
    { path: "Projets/atelier/Storyboard/ancien-b2.md", text: "---\nstatut: archive\n---\n# Ancien\n" },
    { path: "Projets/atelier/.uttu/sb-la-pluie-a1.json", text: "{}" },
    { path: "Projets/autre/Storyboard/x-c3.md", text: "# Ailleurs\n" },
  ];
  const sbs = storyboardsDuProjet("atelier", entries);
  assert.deepEqual(sbs, [
    { id: "la-pluie-a1", titre: "Uttu sous la pluie", archive: false },
    { id: "ancien-b2", titre: "Ancien", archive: true },
  ]);
  const moc = mocMarkdown(studio(), sbs);
  assert.match(moc, /## Storyboards\n\n- \[\[Projets\/atelier\/Storyboard\/la-pluie-a1\|Uttu sous la pluie\]\]\n- \[\[Projets\/atelier\/Storyboard\/ancien-b2\|Ancien\]\] · archivé/);
});

test("a project without storyboards keeps the same map", () => {
  assert.equal(mocMarkdown(studio(), []), mocMarkdown(studio()));
  assert.doesNotMatch(mocMarkdown(studio()), /Storyboards/);
});
