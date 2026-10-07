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
    ["references", "prise", "comfy", "Prise · Références", "Les photos de mon studio deviennent une prise, avec le son. Le prix se lit sur le compte de rendu, avant le geste."],
    ["personnage", "prise", "comfy", "Prise · Personnage", "Les photos de mon studio tiennent le personnage, d’une prise à l’autre, avec le son. Le prix se lit sur le compte de rendu, avant le geste."],
    ["former", "personnage", "fal", "Former un personnage", "Des clips deviennent un fichier. Les prises suivantes le rechargent. Le prix se lit sur le compte fal, avant le geste."],
    ["lieu", "scene", "fal", "Former un lieu", "Les vues du lieu deviennent un fichier d’images. Ce n’est pas un volume. Le prix se lit sur le compte fal, avant le geste."],
    ["image", "scene", "fal", "Image d’un lieu", "Le fichier du lieu bâtit une image neuve. Le modèle 3D reste le fichier Blender. Le prix se lit sur le compte fal, avant le geste."],
  ] as const;
  const files: { path: string; text: string }[] = [
    { path: `${root}/Bible.md`, text: note(slug, "projet", "Bible", "Ce qui ne change pas dans ce projet. Rien n’est copié ailleurs.") },
    { path: `${root}/Style.md`, text: note(slug, "projet", "Style", "La lumière, le cadre, ce qu’on évite. À remplir.") },
    { path: `${root}/Lexique.md`, text: note(slug, "projet", "Lexique", "Les mots de ce projet, et ce qu’ils désignent ici.") },
    { path: `${root}/Journal.md`, text: journalShell() },
    { path: `${root}/Sequences/index.md`, text: note(slug, "sequence", "Séquences", "Rien pour l’instant. Une séquence relie des prises de ce projet.") },
    { path: `${root}/Shots/index.md`, text: note(slug, "shot", "Plans", "Rien pour l’instant. Un plan est une prise rangée dans ce projet.") },
    { path: `${root}/Prompts/index.md`, text: note(slug, "prompt", "Prompts", "Briques de phrase pour ce projet. Rien n’est envoyé d’ici.") },
    { path: `${root}/Templates/personnage.md`, text: note(slug, "template", "Personnage", "Nom, photos, ce qui ne change pas.", { gesture: "personnage" }) },
    { path: `${root}/Templates/scene.md`, text: note(slug, "template", "Lieu", "Nom, note, images du lieu.", { gesture: "scene" }) },
    { path: `${root}/Templates/prise.md`, text: note(slug, "template", "Prise", "Phrase, durée, format. Le prix se lit avant le geste.", { gesture: "prise" }) },
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
  ].join("\n")}\n\n## Moteurs\n\n${[
    link("Moteurs/references", "Prise · Références"),
    link("Moteurs/personnage", "Prise · Personnage"),
    link("Moteurs/former", "Former un personnage"),
    link("Moteurs/lieu", "Former un lieu"),
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
