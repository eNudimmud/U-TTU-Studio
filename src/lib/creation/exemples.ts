import manifest from "../../../public/exemples/manifest.json" with { type: "json" };

export interface ExempleItem {
  id: string;
  file: string;
  kind: string;
  aspect: string;
  statut: string;
  title: string;
  prompt: string;
  source: string;
  license: string;
  licenseUrl: string;
}

export const EXEMPLES: ExempleItem[] = manifest.items;
export const EXEMPLES_DECOR = EXEMPLES.filter(item => item.kind === "decor");
export const EXEMPLES_CAST = EXEMPLES.filter(item => item.kind === "cast");

type ExampleT = { (key: string): string; has(key: string): boolean };

/** The example's name and prompt in the visitor's language (catalog `exampleItems`), the manifest's English otherwise. */
export function exampleText(t: ExampleT, item: ExempleItem): { title: string; prompt: string } {
  const base = `exampleItems.${item.id}`;
  return {
    title: t.has(`${base}.title`) ? t(`${base}.title`) : item.title,
    prompt: t.has(`${base}.prompt`) ? t(`${base}.prompt`) : item.prompt,
  };
}
