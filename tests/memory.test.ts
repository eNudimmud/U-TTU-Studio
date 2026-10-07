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
    assert.doesNotMatch(cleared.memory.bible + cleared.memory.style + cleared.memory.lexique, /Mira|quai, la nuit/i);
  });

  it("opens the same four notes from the tree, and shows them on the take", () => {
    assert.equal(memoryKindOf("Notes", "Bible.md"), "bible");
    assert.equal(memoryKindOf("Notes", "Style.md"), "style");
    assert.equal(memoryKindOf("Notes", "Lexique.md"), "lexique");
    assert.equal(memoryKindOf("Prompts", "index.md"), "prompts");
    assert.equal(memoryKindOf("Prompts", "nuit.md"), "prompts");
    assert.equal(memoryKindOf("Prises", "une.md"), null);
    assert.equal(memoryKindOf("Notes", "Journal.md"), null);

    const screens = read("src/components/app/screens.tsx");
    const take = screens.slice(screens.indexOf("export function TakeScreen"), screens.indexOf("export function SphereScreen"));
    assert.match(take, /<ProjectMemory \/>/);
    assert.ok(take.indexOf("<ProjectMemory />") < take.indexOf("className=\"u-primary\""));
    assert.ok(take.indexOf("className=\"u-primary\"") < take.indexOf("<CinemaGestures anchor />"));
    assert.match(take, /t\("verb\.relier"\)/);
    assert.match(take, /t\("verb\.tourner"\)/);
    const sheets = read("src/components/app/sheets.tsx");
    assert.match(sheets, /<ProjectMemory heading \/>/);
    assert.match(sheets, /export function MemorySheet/);
    assert.match(sheets, /memoryKindOf\(group\.label, file\)/);
    const app = read("src/components/app/studio-app.tsx");
    assert.match(app, /<MemorySheet /);
    assert.match(app, /"take-memory"/);
    assert.match(app, /"lora-memory"/);
    assert.match(app, /"scene-memory"/);
    assert.equal(GUIDE_LINES["lora-memory"], GUIDE_LINES["take-memory"]);
    assert.equal(GUIDE_LINES["scene-memory"], GUIDE_LINES["take-memory"]);
    const frGuide = JSON.parse(read("messages/fr.json")) as { guide: Record<string, string> };
    assert.equal(frGuide.guide["lora-memory"], GUIDE_LINES["lora-memory"]);
    assert.equal(frGuide.guide["scene-memory"], GUIDE_LINES["scene-memory"]);
    assert.ok(GUIDE_LINES["take-memory"].length <= 80);
    const lora = read("src/components/app/lora-screen.tsx");
    assert.match(lora, /<ProjectMemory \/>/);
    const sceneFile = read("src/components/app/scene-screen.tsx");
    const scene = sceneFile.slice(sceneFile.indexOf("export function SceneScreen"), sceneFile.indexOf("function VueProjet"));
    assert.match(scene, /<ProjectMemory \/>/);

    const css = read("src/components/app/app.css");
    const phone = css.slice(0, css.indexOf("@media (min-width: 720px)"));
    assert.match(phone, /\.u-memory-grid \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
    assert.doesNotMatch(phone, /\.u-memory-grid \{[^}]*1fr 1fr/);
    const wide = css.slice(css.indexOf("@media (min-width: 720px)"));
    assert.match(wide, /\.u-memory-grid \{[^}]*minmax\(0, 1fr\) minmax\(0, 1fr\)/);

    const catalogs = ["fr", "en", "de", "es"].map(locale => JSON.parse(read(`messages/${locale}.json`)) as {
      memory: { bible: string; style: string; lexique: string; prompts: string; empty: Record<string, string>; noProject: string; lead: string };
    });
    for (const catalog of catalogs) {
      for (const kind of MEMORY_KINDS) {
        assert.ok(catalog.memory[kind].length > 2, kind);
        assert.ok(catalog.memory.empty[kind].length > 8, kind);
        assert.doesNotMatch(catalog.memory.empty[kind], /Coffre|Vault|Tresor|Cofre/i);
      }
      assert.match(catalog.memory.noProject, /studio|Studio|estudio/i);
      assert.doesNotMatch(JSON.stringify(catalog.memory), /Coffre|Vault|Tresor|Cofre/);
    }
    assert.equal(catalogs[0].memory.bible, "Bible");
    assert.equal(catalogs[0].memory.lexique, "Lexique");
    assert.equal(catalogs[1].memory.lexique, "Lexicon");
    assert.equal(catalogs[2].memory.bible, "Bibel");
    assert.equal(catalogs[2].memory.lexique, "Lexikon");
    assert.equal(catalogs[3].memory.bible, "Biblia");
    assert.equal(catalogs[3].memory.lexique, "Léxico");
    assert.equal(catalogs[0].memory.prompts, "Prompts");
  });
});
