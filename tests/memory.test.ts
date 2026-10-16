import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { readFrontmatter } from "../src/lib/coffre/markdown.ts";
import { createProject, loadStudio, writeMemory, writePromptNote, writeText } from "../src/lib/coffre/model.ts";
import {
  MEMORY_KINDS, MEMORY_SHELL, emptyMemory, memoryField, memoryFilled, memoryKindOf, readProjectMemory,
} from "../src/lib/coffre/memory.ts";
import { scaffoldFiles } from "../src/lib/coffre/project.ts";
import { memoryVault } from "../src/lib/coffre/store.ts";
import { GUIDE_LINES } from "../src/lib/guide.ts";

const read = (path: string) => readFileSync(path, "utf8");

describe("mémoire du projet", () => {
  it("reads the scaffold as empty, and keeps words that were written", async () => {
    const store = memoryVault();
    const slug = await createProject(store, "Le quai");
    const born = await loadStudio(store);
    assert.equal(born.project, slug);
    assert.deepEqual(born.memory, emptyMemory());
    assert.equal(memoryFilled(born.memory), false);
    for (const kind of MEMORY_KINDS) {
      const file = scaffoldFiles(slug, "Le quai").find(item => item.path.endsWith(kind === "prompts" ? "Prompts/index.md" : `${kind[0].toUpperCase()}${kind.slice(1)}.md`));
      assert.ok(file, kind);
      assert.equal(memoryField(kind, file.text), "");
      assert.equal(readFrontmatter(file.text).fields.statut, "brouillon");
    }

    await writeMemory(store, slug, "bible", "La pluie ne s’arrête pas.");
    await writeMemory(store, slug, "style", "Lumière froide, cadre serré.");
    await writeMemory(store, slug, "lexique", "Quai : le bord, pas la rue.");
    await writeMemory(store, slug, "prompts", "Elle ne se retourne pas.");
    await writePromptNote(store, slug, "nuit.md", "La ville reste noire.");
    await writeText(store, `Projets/${slug}/Prompts/vide.md`, "---\ntype: \"prompt\"\n---\n# vide\n\n");
    const held = await loadStudio(store);
    assert.equal(held.memory.bible, "La pluie ne s’arrête pas.");
    assert.equal(held.memory.style, "Lumière froide, cadre serré.");
    assert.equal(held.memory.lexique, "Quai : le bord, pas la rue.");
    assert.equal(held.memory.prompts, "Elle ne se retourne pas.");
    assert.deepEqual(held.memory.notes, [{ file: "nuit.md", text: "La ville reste noire." }]);
    assert.equal(memoryFilled(held.memory), true);
    assert.equal(readFrontmatter((await store.get(`Projets/${slug}/Bible.md`))?.text ?? "").fields.statut, "tenu");

    await writeMemory(store, slug, "bible", "   ");
    const cleared = await loadStudio(store);
    assert.equal(cleared.memory.bible, "");
    const shell = (await store.get(`Projets/${slug}/Bible.md`))?.text ?? "";
    assert.match(shell, new RegExp(MEMORY_SHELL.bible.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(readFrontmatter(shell).fields.statut, "brouillon");
    assert.doesNotMatch(cleared.memory.bible + cleared.memory.style + cleared.memory.lexique, /Uttu|quai, la nuit/i);
  });

});
