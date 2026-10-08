// One asset list for the project. A card is a media file plus a markdown note.
// Loose files dropped in the Obsidian folder become cards after a refresh.

import { readFrontmatter, list, num, text, withFrontmatter } from "../coffre/markdown.ts";
import { cleanCardName, type CastCard, type DecorCard } from "./gallery.ts";

export const ASSET_KINDS = ["personnage", "decor", "plan", "son", "importe"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export type AssetFilter = "tout" | AssetKind;

const FOLDER: Record<AssetKind, string> = {
  personnage: "Cast",
  decor: "Decors",
  plan: "Prises",
  son: "Sons",
  importe: "Assets",
};

const FROM_FOLDER: Record<string, AssetKind> = {
  Cast: "personnage",
  Decors: "decor",
  Lieux: "decor",
  Prises: "plan",
  Sons: "son",
  Assets: "importe",
};

const MEDIA = /\.(png|jpe?g|webp|gif|mp4|webm|mov|wav|mp3|m4a|ogg)$/i;

export interface AssetRecord {
  id: string;
  kind: AssetKind;
  name: string;
  at: string;
  prompt: string;
  geste: string;
  template: string;
  refs: string[];
  devis: number | null;
  cout: number | null;
  media: string;
  note: string;
  /** Public preview, not a vault file. */
  preview: string | null;
  loose: boolean;
}

export function assetFolder(kind: AssetKind): string {
  return FOLDER[kind];
}

export function assetPaths(project: string, kind: AssetKind, id: string, ext: string): { media: string; note: string } {
  const leaf = ext.replace(/^\./, "") || "png";
  const folder = `Projets/${project}/${FOLDER[kind]}`;
  return { media: `${folder}/${id}.${leaf}`, note: `${folder}/${id}.md` };
}

export function assetNote(card: AssetRecord): string {
  const picture = card.media ? `\n\n![[${card.media}]]\n` : "\n";
  const body = `# ${card.name}\n${picture}\n${card.prompt || "Sans texte."}\n`;
  return withFrontmatter({
    type: card.kind === "personnage" ? "cast" : card.kind === "decor" ? "decor" : card.kind === "plan" ? "prise" : card.kind === "son" ? "son" : "asset",
    date: card.at,
    prompt: card.prompt,
    geste: card.geste,
    template: card.template,
    refs: card.refs,
    devis: card.devis,
    cout: card.cout,
    nom: card.name,
    media: card.media,
    statut: "pret",
  }, body);
}

export function readAssetNote(id: string, source: string, fallbackMedia = ""): AssetRecord | null {
  const { fields } = readFrontmatter(source);
  const type = text(fields.type);
  const kind: AssetKind | null = type === "cast" || type === "personnage"
    ? "personnage"
    : type === "decor" || type === "lieu"
      ? "decor"
      : type === "prise" || type === "take"
        ? "plan"
        : type === "son"
          ? "son"
          : type === "asset"
            ? "importe"
            : null;
  if (!kind) return null;
  const name = cleanCardName(text(fields.nom)) || id;
  const media = text(fields.media) || text(fields.sheet) || text(fields.rendu) || fallbackMedia;
  return {
    id,
    kind,
    name,
    at: text(fields.date),
    prompt: text(fields.prompt),
    geste: text(fields.geste),
    template: text(fields.template),
    refs: list(fields.refs).length > 0 ? list(fields.refs) : list(fields.photos),
    devis: num(fields.devis),
    cout: num(fields.cout),
    media,
    note: "",
    preview: null,
    loose: false,
  };
}

function kindFromPath(path: string): { project: string; kind: AssetKind; id: string } | null {
  const match = /^Projets\/([a-z0-9-]+)\/(Cast|Decors|Lieux|Prises|Sons|Assets)\/([^/]+)$/.exec(path);
  if (!match) return null;
  const kind = FROM_FOLDER[match[2]];
  if (!kind) return null;
  const file = match[3];
  if (!MEDIA.test(file) && !file.endsWith(".md")) return null;
  const id = file.replace(/\.[^.]+$/, "").replace(/-montage$/, "");
  if (!id || id === "canon") return null;
  return { project: match[1], kind, id };
}

/** Media dropped by hand, with no note beside it, comes back as a card. */
export function looseAssets(paths: readonly string[], project: string | null): AssetRecord[] {
  if (!project) return [];
  const notes = new Set<string>();
  const media = new Map<string, string>();
  for (const path of paths) {
    const parsed = kindFromPath(path);
    if (!parsed || parsed.project !== project) continue;
    const key = `${parsed.kind}:${parsed.id}`;
    if (path.endsWith(".md")) notes.add(key);
    else if (MEDIA.test(path)) media.set(key, path);
  }
  const out: AssetRecord[] = [];
  for (const [key, path] of media) {
    if (notes.has(key)) continue;
    const parsed = kindFromPath(path);
    if (!parsed) continue;
    const name = cleanCardName(parsed.id.replace(/-/g, " ")) || parsed.id;
    out.push({
      id: parsed.id,
      kind: parsed.kind,
      name,
      at: "",
      prompt: "",
      geste: "",
      template: "",
      refs: [],
      devis: null,
      cout: null,
      media: path,
      note: "",
      preview: null,
      loose: true,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export function filterAssets(cards: readonly AssetRecord[], filter: AssetFilter, query: string): AssetRecord[] {
  const needle = query.trim().toLowerCase();
  return cards.filter(card => {
    if (filter !== "tout" && card.kind !== filter) return false;
    if (!needle) return true;
    return `${card.name} ${card.prompt} ${card.geste}`.toLowerCase().includes(needle);
  });
}

/** Columns that keep every card on the grid. The page scrolls; the card does not clip. */
export function galleryColumns(width: number): number {
  if (width >= 1440) return 5;
  if (width >= 1280) return 4;
  if (width >= 768) return 3;
  if (width >= 390) return 2;
  return 1;
}

const CYCLE = [
  { kind: "personnage" as const, file: "/exemples/cast-uttu.webp", title: "Uttu" },
  { kind: "personnage" as const, file: "/exemples/cast-coursiere.webp", title: "La coursière" },
  { kind: "personnage" as const, file: "/exemples/cast-vieil-homme.webp", title: "Le vieil homme" },
  { kind: "personnage" as const, file: "/exemples/cast-dj.webp", title: "DJ" },
  { kind: "decor" as const, file: "/exemples/decor-quai-nuit.webp", title: "Le quai" },
  { kind: "decor" as const, file: "/exemples/decor-rue-pluie.webp", title: "La pluie" },
  { kind: "decor" as const, file: "/exemples/decor-piece.webp", title: "La pièce" },
  { kind: "decor" as const, file: "/exemples/decor-toit-aube.webp", title: "Le toit" },
  { kind: "decor" as const, file: "/exemples/decor-gare.webp", title: "La gare" },
  { kind: "decor" as const, file: "/exemples/decor-couloir.webp", title: "Le couloir" },
  { kind: "plan" as const, file: "/exemples/decor-quai-nuit.webp", title: "Plan quai" },
  { kind: "son" as const, file: "", title: "Voix" },
  { kind: "importe" as const, file: "/exemples/decor-piece.webp", title: "Import" },
];

export function assetFromCast(card: CastCard): AssetRecord {
  return {
    id: card.id,
    kind: "personnage",
    name: card.name,
    at: card.at,
    prompt: card.prompt,
    geste: card.geste ?? "",
    template: card.template,
    refs: card.photos,
    devis: card.quote,
    cout: card.cost,
    media: card.sheet ?? "",
    note: "",
    preview: card.preview,
    loose: false,
  };
}

export function assetFromDecor(card: DecorCard & { at?: string; template?: string; quote?: number; cost?: number | null }): AssetRecord {
  return {
    id: card.id,
    kind: "decor",
    name: card.name,
    at: card.at ?? "",
    prompt: card.prompt,
    geste: card.geste ?? "",
    template: card.template ?? "",
    refs: [],
    devis: card.quote ?? null,
    cout: card.cost ?? null,
    media: card.sheet ?? "",
    note: "",
    preview: card.preview,
    loose: false,
  };
}

/** Layout proof. House stills repeated. Nothing is written to the vault. */
export function previewAssets(count: number): AssetRecord[] {
  const total = Math.max(0, Math.floor(count));
  return Array.from({ length: total }, (_, index) => {
    const source = CYCLE[index % CYCLE.length];
    const n = String(index + 1).padStart(2, "0");
    return {
      id: `apercu-${n}`,
      kind: source.kind,
      name: `${source.title} ${n}`,
      at: "2026-10-08T12:00:00.000Z",
      prompt: "Aperçu de grille. Rendu maison, pas un nouvel envoi.",
      geste: source.kind === "personnage" ? "cast-photos" : source.kind === "decor" ? "decor-photo" : source.kind === "plan" ? "prise-plan" : "",
      template: "",
      refs: [],
      devis: null,
      cout: null,
      media: "",
      note: "",
      preview: source.file || null,
      loose: false,
    };
  });
}
