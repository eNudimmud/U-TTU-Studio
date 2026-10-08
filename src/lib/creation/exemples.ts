import manifest from "../../../public/exemples/manifest.json";

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
