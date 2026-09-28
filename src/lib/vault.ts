// Canon vault for a personal U*TTU studio. Offline today: the site explains
// the folder and ships a starter ZIP. It does not read or write the vault.

import type { StudioMode } from "./studio-modes.ts";
import { createZip, type ZipEntry } from "./zip.ts";

export const VAULT_ROOT = "U-TTU-Studio";

/** Public path, without the GitHub Pages base path. */
export const STARTER_VAULT_HREF = "/vault/U-TTU-Studio.zip";
export const STARTER_VAULT_FILE = "U-TTU-Studio.zip";
export const STARTER_VAULT_PUBLIC = "public/vault/U-TTU-Studio.zip";

// Fixed local time so a rebuild does not rewrite the archive on UTC CI.
export const STARTER_VAULT_DATE = new Date(2026, 8, 28, 12, 0, 0);

export const VAULT_FOLDERS = [
  { name: "refs", hint: "Photos sources, deux ou trois." },
  { name: "dataset", hint: "Le lot de quinze, et les légendes .txt." },
  { name: "loras", hint: "Fichiers .safetensors, et une note à côté." },
  { name: "scenes", hint: "Avant, après, entre. Les clips, plus tard." },
  { name: "processes", hint: "Recettes, liens d’apps, prompts." },
] as const;

export const VAULT_DOCUMENTS = [
  { name: "jobs.md", hint: "Le journal des runs." },
  { name: "CANON.md", hint: "L’identité, le trigger, les invariants." },
] as const;

export const VAULT_README = "README.md";

export const VAULT_MODE_MAP = [
  { mode: "creer", label: "Créer", places: ["refs/", "dataset/"], line: "Les sources, puis le lot." },
  { mode: "sphere", label: "Sphère", places: ["scenes/"], line: "Avant, après, entre." },
  { mode: "identite", label: "Identité", places: ["CANON.md", "loras/"], line: "Ce qui ne doit pas bouger." },
  { mode: "bibliotheque", label: "Bibliothèque", places: ["refs/", "dataset/", "loras/", "scenes/"], line: "Ce qui est déjà rangé." },
  { mode: "studio", label: "Studio", places: ["jobs.md", "processes/"], line: "Le journal, et les recettes." },
] as const satisfies readonly { mode: StudioMode; label: string; places: readonly string[]; line: string }[];

export const OBSIDIAN_STEPS = [
  { title: "Télécharger", detail: "Le ZIP part dans ton dossier de téléchargements. La page n’ouvre pas le coffre." },
  { title: "Décompresser", detail: "Tu obtiens le dossier U-TTU-Studio. Les cinq pièces sont vides." },
  { title: "Ouvrir comme coffre", detail: "Dans Obsidian : ouvrir un dossier comme coffre, et choisir ce dossier." },
  { title: "Aucun plugin", detail: "Rien à installer. Le coffre se lit seul. Un plugin reste un choix, plus tard." },
] as const;

export function canonTemplate(): string {
  return `# Canon

Ce fichier tient ce qui ne doit pas changer.
Le trigger porte l’identité. Les légendes, dans \`dataset/\`, disent ce qui peut varier.

## Trigger

\`\`

## Invariants

-
-

## Note

Une ligne, si quelque chose doit rester hors des légendes.
`;
}

export function jobsTemplate(): string {
  return `# Travaux

Journal local. Une ligne par geste. Rien ne quitte la machine.

| Date | Geste | Dossier | Note |
| --- | --- | --- | --- |
|  |  |  |  |

## Modèle

À effacer. Ceci n’est pas un run.

| Date | Geste | Dossier | Note |
| --- | --- | --- | --- |
| 2026-09-28 | Lot rangé | dataset/ | Quinze images, légendes à côté |
| 2026-09-28 | LoRA déposée | loras/ | Fichier .safetensors, note de force à côté |
`;
}

export function readmeTemplate(): string {
  return `# U*TTU Studio — coffre

Ce dossier est le studio. Le site est la surface. Ici, les fichiers restent.

## Ouvrir dans Obsidian

1. Garde ce dossier tel quel, nommé \`U-TTU-Studio\`.
2. Obsidian → ouvrir un dossier comme coffre → ce dossier.
3. Aucun plugin n’est requis.

## Pièces

- \`refs/\` — photos sources, deux ou trois.
- \`dataset/\` — le lot de quinze, et les légendes \`.txt\`.
- \`loras/\` — fichiers \`.safetensors\`, et une note.
- \`scenes/\` — avant, après, entre.
- \`processes/\` — recettes, liens, prompts.
- \`jobs.md\` — le journal.
- \`CANON.md\` — trigger et invariants.

Hors ligne, aujourd’hui. Un compte pourra synchroniser plus tard. La vente reste en HOLD.
`;
}

export function starterVaultEntries(): ZipEntry[] {
  const encode = (text: string) => new TextEncoder().encode(text);
  const root = VAULT_ROOT;
  return [
    { name: `${root}/${VAULT_README}`, data: encode(readmeTemplate()) },
    { name: `${root}/CANON.md`, data: encode(canonTemplate()) },
    { name: `${root}/jobs.md`, data: encode(jobsTemplate()) },
    ...VAULT_FOLDERS.map(folder => ({ name: `${root}/${folder.name}/`, data: new Uint8Array() })),
  ];
}

export function starterVaultArchive(): Uint8Array {
  return createZip(starterVaultEntries(), STARTER_VAULT_DATE);
}
