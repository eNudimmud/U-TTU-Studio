// One project is a whole working universe. The vault root only maps them.
// Visible copy says « Mon studio ». These paths stay internal.

import { withFrontmatter } from "./markdown.ts";

export const ACTIVE_FILE = ".uttu/projet.json";
export const DEFAULT_PROJECT_NAME = "Atelier";

export interface ProjectCard {
  slug: string;
  name: string;
}

export interface TreeFolder {
  label: string;
  files: string[];
}

export function projectSlug(name: string): string {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return base || "atelier";
}

export function projectPath(slug: string, file = ""): string {
  return file ? `Projets/${slug}/${file}` : `Projets/${slug}`;
}

export function projectSlugsFrom(paths: readonly string[]): string[] {
  const slugs = new Set<string>();
  for (const path of paths) {
    const match = /^Projets\/([a-z0-9-]+)\//.exec(path);
    if (match) slugs.add(match[1]);
  }
  return [...slugs].sort();
}

export function projectTitle(slug: string, moc: string | undefined): string {
  const title = moc ? /^# (.+)$/m.exec(moc)?.[1]?.trim() : "";
  if (title) return title;
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** A picture, clip, or weight the fiche may point at. Legacy folders stay readable until a move. */
export function vaultMedia(path: string): boolean {
  return /^(?:scenes|refs|prises|clips|roles|loras)\//.test(path)
    || /^Projets\/[a-z0-9-]+\/(?:Lieux|Refs|Prises|Assets|Cast)\//.test(path);
}

export function rolePhotoPath(path: string): boolean {
  return path.startsWith("roles/") || /^Projets\/[a-z0-9-]+\/Refs\//.test(path);
}

export function clipVaultPath(path: string): boolean {
  return path.startsWith("clips/") || /^Projets\/[a-z0-9-]+\/Assets\//.test(path);
}

const TREE: { folder: string; label: string }[] = [
  { folder: "Cast", label: "Personnages" },
  { folder: "Refs", label: "Références" },
  { folder: "Lieux", label: "Lieux" },
  { folder: "Prises", label: "Prises" },
  { folder: "Sequences", label: "Séquences" },
  { folder: "Shots", label: "Plans" },
  { folder: "Prompts", label: "Prompts" },
  { folder: "Templates", label: "Modèles" },
  { folder: "Moteurs", label: "Moteurs" },
  { folder: "Assets", label: "Fichiers" },
];

export function projectTree(slug: string, paths: readonly string[]): TreeFolder[] {
  const prefix = `Projets/${slug}/`;
  const notes = ["_MOC.md", "Bible.md", "Style.md", "Lexique.md", "Journal.md"]
    .filter(name => paths.includes(`${prefix}${name}`));
  const folders = TREE.map(({ folder, label }) => ({
    label,
    files: paths
      .filter(path => path.startsWith(`${prefix}${folder}/`))
      .map(path => path.slice(`${prefix}${folder}/`.length))
      .sort(),
  })).filter(folder => folder.files.length > 0);
  return notes.length > 0 ? [{ label: "Notes", files: notes }, ...folders] : folders;
}

/** A section owns its name. These stems are that name, singular or plural, without accents. */
const SECTION_LABELS: Record<string, string> = {
  personnage: "Personnage",
  personnages: "Personnages",
  reference: "Référence",
  references: "Références",
  lieu: "Lieu",
  lieux: "Lieux",
  prise: "Prise",
  prises: "Prises",
  scene: "Scène",
  scenes: "Scènes",
  sequence: "Séquence",
  sequences: "Séquences",
  shot: "Plan",
  shots: "Plans",
  plan: "Plan",
  plans: "Plans",
  prompt: "Prompt",
  prompts: "Prompts",
  modele: "Modèle",
  modeles: "Modèles",
  template: "Modèle",
  templates: "Modèles",
  moteur: "Moteur",
  moteurs: "Moteurs",
  fichier: "Fichier",
  fichiers: "Fichiers",
  note: "Note",
  notes: "Notes",
};

const FOLDER_MARK: Record<string, string> = {
  Personnages: "Personnage",
  "Références": "Référence",
  Lieux: "Lieu",
  Prises: "Prise",
  "Séquences": "Séquence",
  Plans: "Plan",
  Prompts: "Prompt",
  "Modèles": "Modèle",
  Moteurs: "Moteur",
  Fichiers: "Fichier",
  Notes: "Note",
};

function foldName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** « Modèle · Prise », never the bare stem `prise`. Other section stems get the same mark. */
export function treeFileLabel(folder: string, file: string): string {
  const base = (file.split("/").pop() ?? file).replace(/\.[^.]+$/, "");
  const stem = foldName(base);
  const prefixed = /^(?:modele|moteur)-(.+)$/.exec(stem);
  const name = SECTION_LABELS[prefixed?.[1] ?? stem];
  if (!name) return file;
  return `${FOLDER_MARK[folder] ?? folder} · ${name}`;
}

/** Scaffold notes whose stem was a section. The new file wins if it is already there. */
export const SECTION_FILE_MOVES: readonly [string, string][] = [
  ["Templates/personnage.md", "Templates/modele-personnage.md"],
  ["Templates/scene.md", "Templates/modele-scene.md"],
  ["Templates/prise.md", "Templates/modele-prise.md"],
  ["Moteurs/personnage.md", "Moteurs/moteur-personnage.md"],
  ["Moteurs/references.md", "Moteurs/moteur-references.md"],
  ["Moteurs/lieu.md", "Moteurs/moteur-lieu.md"],
];

export function rewriteSectionLinks(text: string): string {
  let next = text;
  for (const [from, to] of SECTION_FILE_MOVES) {
    const fromStem = from.replace(/\.md$/, "");
    const toStem = to.replace(/\.md$/, "");
    next = next.replaceAll(from, to).replaceAll(fromStem, toStem);
  }
  return next;
}

function fiche(slug: string, type: string, extra: Record<string, string | null> = {}): Record<string, string | null> {
  return {
    type,
    projet: slug,
    statut: "brouillon",
    updated: new Date().toISOString(),
    ...extra,
  };
}

function note(slug: string, type: string, title: string, body: string, extra: Record<string, string | null> = {}): string {
  return withFrontmatter(fiche(slug, type, extra), `# ${title}\n\n${body}\n`);
}

/** Empty folders need a file, or a ZIP would forget them. No graph, no price. */
export function scaffoldFiles(slug: string, name: string): { path: string; text: string }[] {
  const root = `Projets/${slug}`;
  const moteurs = [
    ["moteur-references", "prise", "comfy", "Prise · Références", "Les photos de mon studio deviennent une prise, avec le son. Le devis de run est absent sur le compte de rendu : rien ne part sans un chiffre mesuré au même réglage."],
    ["moteur-personnage", "prise", "comfy", "Prise · Personnage", "Les photos de mon studio tiennent le personnage, d’une prise à l’autre, avec le son. Le devis de run est absent sur le compte de rendu : rien ne part sans un chiffre mesuré au même réglage."],
    ["former", "personnage", "fal", "Former un personnage", "Des clips deviennent un fichier. Les prises suivantes le rechargent. Le prix se lit sur le compte fal, avant le geste."],
    ["moteur-lieu", "scene", "fal", "Former un lieu", "Les vues du lieu deviennent un fichier d’images. Ce n’est pas un volume. Le prix se lit sur le compte fal, avant le geste."],
    ["image", "scene", "fal", "Image d’un lieu", "Le fichier du lieu bâtit une image neuve. Le modèle 3D reste le fichier Blender. Le prix se lit sur le compte fal, avant le geste."],
  ] as const;
  const files: { path: string; text: string }[] = [
    { path: `${root}/Bible.md`, text: note(slug, "projet", "Bible", "Ce qui ne change pas dans ce projet. Rien n’est copié ailleurs.") },
    { path: `${root}/Style.md`, text: note(slug, "projet", "Style", "La lumière, le cadre, ce qu’on évite. À remplir.") },
    { path: `${root}/Lexique.md`, text: note(slug, "projet", "Lexique", "Les mots de ce projet, et ce qu’ils désignent ici.") },
    { path: `${root}/Journal.md`, text: journalShell() },
    { path: `${root}/Sequences/index.md`, text: note(slug, "sequence", "Séquences", "Rien pour l’instant. Une séquence relie des prises de ce projet.") },
    { path: `${root}/Shots/index.md`, text: note(slug, "shot", "Plans", "Rien pour l’instant. Un plan est une case du storyboard : une séquence, puis des prises, dans l’ordre.") },
    { path: `${root}/Prompts/index.md`, text: note(slug, "prompt", "Prompts", "Briques de phrase pour ce projet. Rien n’est envoyé d’ici.") },
    { path: `${root}/Templates/modele-personnage.md`, text: note(slug, "template", "Modèle · Personnage", "Nom, photos, ce qui ne change pas.", { gesture: "personnage" }) },
    { path: `${root}/Templates/modele-scene.md`, text: note(slug, "template", "Modèle · Scène", "Nom, note, images du lieu.", { gesture: "scene" }) },
    { path: `${root}/Templates/modele-prise.md`, text: note(slug, "template", "Modèle · Prise", "Phrase, durée, format. Le prix se lit avant le geste.", { gesture: "prise" }) },
    { path: `${root}/Templates/modele-sequence.md`, text: note(slug, "template", "Modèle · Séquence", "Nom. Puis les prises, dans l’ordre. Entre deux, le raccord : lumière, regard, mouvement, objet.", { gesture: "sequence" }) },
    { path: `${root}/Templates/modele-shot.md`, text: note(slug, "template", "Modèle · Plan", "Nom. La séquence. Les prises, dans l’ordre. Une note courte pour le cadre.", { gesture: "shot" }) },
    ...moteurs.map(([id, gesture, moteur, title, body]) => ({
      path: `${root}/Moteurs/${id}.md`,
      text: note(slug, "moteur", title, body, { moteur, gesture }),
    })),
  ];
  files.push({ path: `${root}/_MOC.md`, text: projectMocShell(slug, name) });
  return files;
}

function journalShell(): string {
  return `# Journal\n\nUne ligne par prise et par formation. Le coût vient du compte qui a payé.\n\n| Date | Quoi | Moteur | Réglage | Calcul (s) | Coût |\n| --- | --- | --- | --- | --- | --- |\n`;
}

export function projectMocShell(slug: string, name: string): string {
  const link = (file: string, label: string) => `- [[Projets/${slug}/${file}|${label}]]`;
  return `# ${name}\n\nCarte de ce projet. Mon studio ne lit que le projet en cours.\n\n## Repères\n\n${[
    link("Bible", "Bible"),
    link("Style", "Style"),
    link("Lexique", "Lexique"),
    link("Journal", "Journal"),
  ].join("\n")}\n\n## Séquences\n\n${link("Sequences/index", "Séquences")}\n\n## Plans\n\n${link("Shots/index", "Plans")}\n\n## Moteurs\n\n${[
    link("Moteurs/moteur-references", "Prise · Références"),
    link("Moteurs/moteur-personnage", "Prise · Personnage"),
    link("Moteurs/former", "Former un personnage"),
    link("Moteurs/moteur-lieu", "Former un lieu"),
    link("Moteurs/image", "Image d’un lieu"),
  ].join("\n")}\n`;
}

export function rootMoc(projects: readonly ProjectCard[]): string {
  const lines = projects.map(project => `- [[Projets/${project.slug}/_MOC|${project.name.replace(/[\[\]|]/g, " ")}]]`);
  const body = lines.length > 0 ? lines.join("\n") : "Rien pour l’instant.";
  return `# Carte de mon studio\n\nCette note relie les projets. Chaque projet est un univers complet. Le dossier reste sur l’appareil qui le tient : rien n’en est copié ailleurs.\n\n${body}\n`;
}

/** Rewrite legacy pointers so a moved fiche still finds its pictures. */
export function relocateText(text: string, slug: string): string {
  const root = `Projets/${slug}`;
  return text
    .replaceAll("refs/", `${root}/Refs/`)
    .replaceAll("scenes/", `${root}/Lieux/`)
    .replaceAll("prises/", `${root}/Prises/`)
    .replaceAll("clips/", `${root}/Assets/`)
    .replaceAll("roles/", `${root}/Refs/`)
    .replaceAll("loras/", `${root}/Assets/`);
}

const LEGACY = /^(?:CANON\.md|jobs\.md|refs\/|scenes\/|prises\/|loras\/|clips\/|roles\/)/;
const ROOT_STATE = new Set([".uttu/etat.json", ".uttu/clips.json", ".uttu/role.json"]);

export function isLegacyPath(path: string): boolean {
  return LEGACY.test(path) || ROOT_STATE.has(path);
}

/** Where a legacy file lands inside one project. Notes that need a parsed kind return null. */
export function legacyDestination(path: string, slug: string): string | null {
  if (path === "CANON.md") return projectPath(slug, "Cast/canon.md");
  if (path === "jobs.md") return projectPath(slug, "Journal.md");
  if (path === ".uttu/etat.json" || path === ".uttu/clips.json" || path === ".uttu/role.json") return projectPath(slug, path);
  if (path.startsWith("refs/")) return projectPath(slug, `Refs/${path.slice("refs/".length)}`);
  if (path.startsWith("scenes/")) return projectPath(slug, `Lieux/${path.slice("scenes/".length)}`);
  if (path.startsWith("prises/")) return projectPath(slug, `Prises/${path.slice("prises/".length)}`);
  if (path.startsWith("clips/")) return projectPath(slug, `Assets/${path.slice("clips/".length)}`);
  if (path.startsWith("roles/")) return projectPath(slug, `Refs/${path.slice("roles/".length)}`);
  if (path.startsWith("loras/") && !path.endsWith(".md")) return projectPath(slug, `Assets/${path.slice("loras/".length)}`);
  return null;
}
