import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

function at(root: Record<string, unknown>, path: string): string {
  const value = path.split(".").reduce<unknown>((cursor, key) => (cursor as Record<string, unknown>)[key], root);
  assert.equal(typeof value, "string", path);
  return value as string;
}

describe("audit i18n F16–F18", () => {
  const catalogs = {
    fr: read("messages/fr.json"),
    en: read("messages/en.json"),
    de: read("messages/de.json"),
    es: read("messages/es.json"),
  };

  it("keeps Espace, Plan and the path apart", () => {
    assert.equal(at(catalogs.fr, "scene.plan"), "Espace");
    assert.equal(at(catalogs.en, "scene.plan"), "Layout");
    assert.equal(at(catalogs.de, "scene.plan"), "Raumplan");
    assert.equal(at(catalogs.es, "scene.plan"), "Plano de espacio");
    assert.equal(at(catalogs.fr, "shot.title"), "Plans");
    assert.equal(at(catalogs.en, "shot.title"), "Shots");
    assert.equal(at(catalogs.de, "shot.title"), "Shots");
    assert.equal(at(catalogs.es, "shot.title"), "Viñetas");
    assert.equal(at(catalogs.fr, "film.film.label"), "Filmer ce trajet");
    assert.equal(at(catalogs.en, "film.film.label"), "Film this path");
    assert.equal(at(catalogs.de, "film.film.label"), "Diesen Weg filmen");
    assert.equal(at(catalogs.es, "film.film.label"), "Filmar este recorrido");
    assert.equal(at(catalogs.en, "runtime.planFilmed"), "The path is filmed. Blender rendered the empty location. The character is in the take.");
    assert.doesNotMatch(at(catalogs.en, "film.film.label") + at(catalogs.en, "film.video") + at(catalogs.de, "film.person") + at(catalogs.es, "sheet.confirmFilm"), /layout|Raumplan|plano de espacio/i);
  });

  it("does not give the axis nudge the cinema verb", () => {
    assert.equal(at(catalogs.en, "cinema.camera.name"), "Move the camera");
    assert.equal(at(catalogs.de, "cinema.camera.name"), "Die Kamera bewegen");
    assert.equal(at(catalogs.es, "cinema.camera.name"), "Mover la cámara");
    assert.equal(at(catalogs.en, "scene.moveCamera"), "Shift the camera");
    assert.equal(at(catalogs.de, "scene.moveCamera"), "Die Kamera verschieben");
    assert.equal(at(catalogs.es, "scene.moveCamera"), "Desplazar la cámara");
    assert.notEqual(at(catalogs.en, "scene.moveCamera"), at(catalogs.en, "cinema.camera.name"));
    assert.equal(at(catalogs.fr, "sequence.add"), "Ajouter cette prise");
    assert.equal(at(catalogs.en, "sequence.add"), "Add this take");
    assert.equal(at(catalogs.de, "sequence.add"), "Diesen Take hinzufügen");
    assert.equal(at(catalogs.es, "sequence.add"), "Añadir esta toma");
    assert.equal(at(catalogs.fr, "sequence.linked"), "Prise ajoutée.");
    assert.doesNotMatch(at(catalogs.en, "sequence.linked"), /connect/i);
  });

  it("keeps project memory terms, and marks a native read as still open", () => {
    assert.equal(at(catalogs.fr, "memory.bible"), "Bible");
    assert.equal(at(catalogs.en, "memory.lexique"), "Lexicon");
    assert.equal(at(catalogs.de, "memory.bible"), "Bibel");
    assert.equal(at(catalogs.de, "memory.lexique"), "Lexikon");
    assert.equal(at(catalogs.es, "memory.bible"), "Biblia");
    assert.equal(at(catalogs.es, "memory.lexique"), "Léxico");
    assert.match(at(catalogs.fr, "memory.empty.bible"), /Rien d’écrit/);
    assert.match(at(catalogs.en, "memory.empty.bible"), /Nothing written/);
    assert.match(at(catalogs.de, "memory.empty.bible"), /Nichts geschrieben/);
    assert.match(at(catalogs.es, "memory.empty.bible"), /Nada escrito/);
    assert.equal(at(catalogs.en, "cinema.raccord.name"), "Bridge two images");
    assert.equal(at(catalogs.de, "cinema.raccord.name"), "Zwei Bilder verbinden");
    assert.equal(at(catalogs.es, "cinema.raccord.name"), "Empalmar dos imágenes");
    assert.equal(at(catalogs.en, "cinema.effet.name"), "Apply an effect");
    assert.equal(at(catalogs.de, "cinema.effet.name"), "Einen Effekt setzen");
    assert.equal(at(catalogs.es, "cinema.effet.name"), "Poner un efecto");
    assert.equal(catalogs.en._human, "native_open");
    assert.equal(catalogs.de._human, "native_open");
    assert.equal(catalogs.es._human, "native_open");
    assert.equal(catalogs.fr._human, "source");
  });
});
