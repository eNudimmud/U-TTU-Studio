// The project frame is chosen once. 16:9 is the default. 9:16 is the other option.

import { withFrontmatter } from "../coffre/markdown.ts";

export const PROJECT_FORMATS = ["16:9", "9:16"] as const;
export type ProjectFormat = (typeof PROJECT_FORMATS)[number];
export const DEFAULT_PROJECT_FORMAT: ProjectFormat = "16:9";
export const FORMAT_FILE = ".uttu/format.md";

export function isProjectFormat(value: string): value is ProjectFormat {
  return (PROJECT_FORMATS as readonly string[]).includes(value);
}

export function formatMarkdown(format: ProjectFormat): string {
  return withFrontmatter(
    { type: "projet", format },
    `Format du projet : ${format}. Il s'applique à toutes les images clés et à toutes les prises.\n`,
  );
}

export function readProjectFormat(source: string | undefined): ProjectFormat {
  if (!source) return DEFAULT_PROJECT_FORMAT;
  const match = /format:\s*"?(16:9|9:16)"?/.exec(source);
  return match && isProjectFormat(match[1]) ? match[1] : DEFAULT_PROJECT_FORMAT;
}
