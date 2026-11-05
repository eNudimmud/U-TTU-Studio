import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STYLE_RECIPES,
  buildStylePrompt,
  searchStyles,
} from "../src/lib/sections/styles.ts";
const required = [
  "Neill Blomkamp",
  "Lana Wachowski",
  "Lilly Wachowski",
  "Steven Spielberg",
  "James Cameron",
  "Zack Snyder",
  "Sam Raimi",
  "Rob Zombie",
  "Quentin Tarantino",
  "Hideo Kojima",
  "Michel Gondry",
  "Michel Hazanavicius",
  "Stephen King",
  "Peter Jackson",
  "Martin Scorsese",
  "Orson Welles",
  "Sean Penn",
  "Christopher Nolan",
  "Manga",
  "Gekiga",
  "Afro Samurai",
  "Spider-Verse",
  "Arcane",
  "Studio Ghibli",
  "Hayao Miyazaki",
  "Shōjirō Nishimi",
  "Ankama Animation",
  "Label 619",
  "777Run",
  "DreamWorks",
  "The Wild Robot",
  "Ne Zha 2",
  "Makoto Shinkai",
  "Loving Vincent",
  "Yoh Yoshinari",
  "Hiroyuki Imaishi",
  "Hiromu Arakawa",
  "Akira Toriyama",
  "Hironobu Sakaguchi",
  "Yūji Horii",
  "Studio Gonzo",
  "Adult Swim",
  "Rick et Morty",
  "South Park",
  "Matt Groening",
  "Punk",
  "Analogic",
  "Caricature",
  "VHS",
  "Y2K",
  "Argentique",
];
test("all requested reference names and media have a searchable original recipe", () => {
  const refs = new Set(STYLE_RECIPES.flatMap((s) => s.references));
  for (const name of required) assert.ok(refs.has(name), `Missing ${name}`);
  assert.equal(
    new Set(STYLE_RECIPES.map((s) => s.id)).size,
    STYLE_RECIPES.length,
  );
});
test("each recipe supplies distinct stage prompts, not artist-name commands", () => {
  for (const style of STYLE_RECIPES) {
    const prompts = (["cast", "set", "shoot", "motion"] as const).map((use) =>
      buildStylePrompt(style, use, "an original masked courier"),
    );
    assert.equal(new Set(prompts).size, 4);
    for (const p of prompts) {
      assert.ok(p.length > 150);
      assert.ok(!/in the style of/i.test(p));
    }
    assert.match(prompts[1], /No main character/);
    assert.match(prompts[3], /Preserve the source image/);
  }
});
test("accent-insensitive search and section boundaries work", () => {
  assert.equal(searchStyles("anime", "gekiga")[0].id, "gekiga");
  assert.equal(searchStyles("anime", "Yūji Horii")[0].id, "horii-storybook");
  assert.equal(searchStyles("cinema", "nolan")[0].id, "architectural-tension");
  assert.equal(searchStyles("cinema", "Arcane").length, 0);
  assert.ok(searchStyles("anime", "777run").length > 0);
});
