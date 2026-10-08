// Obsidian notes for a character and a décor. Frontmatter stays readable.

import { readFrontmatter, text, num, list, withFrontmatter, type Front } from "../coffre/markdown.ts";
import { VIEW_NAMES, type CastCard, cleanCardName } from "./gallery.ts";

export interface FiledCast {
  id: string;
  name: string;
  at: string;
  prompt: string;
  source: "texte" | "photos";
  photos: string[];
  sheet: string | null;
  template: string;
  quote: number;
  cost: number | null;
  project: string;
}

export interface FiledDecor {
  id: string;
  name: string;
  at: string;
  prompt: string;
  sheet: string | null;
  template: string;
  quote: number;
  cost: number | null;
  project: string;
  castLink: string | null;
}

function wiki(path: string, label: string): string {
  const alias = label.replace(/[\[\]|\r\n]/g, " ").replace(/\s+/g, " ").trim();
  return alias ? `[[${path}|${alias}]]` : `[[${path}]]`;
}

export function castNote(card: FiledCast): string {
  const base = `Projets/${card.project}/Cast/${card.id}`;
  const picture = card.sheet ? `\n\n![[${card.sheet}]]\n` : "\n";
  const body = `# ${card.name}\n${picture}\nVues : ${VIEW_NAMES.join(", ")}.\n\n${card.prompt || "Sans texte."}\n`;
  return withFrontmatter({
    type: "cast",
    date: card.at,
    prompt: card.prompt,
    moteur: "comfy",
    template: card.template,
    devis: card.quote,
    cout: card.cost,
    source: card.source,
    statut: "pret",
    nom: card.name,
    projet: card.project,
    sheet: card.sheet,
    photos: card.photos,
    vues: [...VIEW_NAMES],
  }, body);
}

export function readCastNote(id: string, source: string): FiledCast | null {
  const { fields } = readFrontmatter(source);
  if (text(fields.type) !== "cast") return null;
  const name = cleanCardName(text(fields.nom)) || id;
  const quote = num(fields.devis);
  if (quote === null) return null;
  const sourceKind = text(fields.source) === "photos" ? "photos" : "texte";
  return {
    id,
    name,
    at: text(fields.date),
    prompt: text(fields.prompt),
    source: sourceKind,
    photos: list(fields.photos),
    sheet: text(fields.sheet) || null,
    template: text(fields.template),
    quote,
    cost: num(fields.cout),
    project: text(fields.projet),
  };
}

export function filedToCard(card: FiledCast): CastCard {
  return {
    id: card.id,
    name: card.name,
    at: card.at,
    prompt: card.prompt,
    source: card.source,
    photos: card.photos,
    sheet: card.sheet,
    preview: null,
    status: "pret",
    template: card.template,
    quote: card.quote,
    cost: card.cost,
    engine: "comfy",
  };
}

export function decorNote(card: FiledDecor): string {
  const cast = card.castLink ? `\n\nPersonnage : ${wiki(card.castLink, "Personnage")}\n` : "\n";
  const picture = card.sheet ? `\n\n![[${card.sheet}]]\n` : "\n";
  const body = `# ${card.name}\n${picture}\n${card.prompt || "Sans texte."}${cast}`;
  return withFrontmatter({
    type: "decor",
    date: card.at,
    prompt: card.prompt,
    moteur: "comfy",
    template: card.template,
    devis: card.quote,
    cout: card.cost,
    statut: "pret",
    nom: card.name,
    projet: card.project,
    sheet: card.sheet,
    rendu: card.sheet,
    cast: card.castLink,
  }, body);
}

export function readDecorNote(id: string, source: string): FiledDecor | null {
  const { fields } = readFrontmatter(source);
  if (text(fields.type) !== "decor" && text(fields.type) !== "lieu") return null;
  const name = cleanCardName(text(fields.nom)) || id;
  return {
    id,
    name,
    at: text(fields.date),
    prompt: text(fields.prompt),
    sheet: text(fields.sheet) || text(fields.rendu) || null,
    template: text(fields.template),
    quote: num(fields.devis) ?? 0,
    cost: num(fields.cout),
    project: text(fields.projet),
    castLink: text(fields.cast) || null,
  };
}

/** A note round-trip keeps the fields Obsidian shows. */
export function frontOf(source: string): Front {
  return readFrontmatter(source).fields;
}
