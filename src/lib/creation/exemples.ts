import manifest from "../../../public/exemples/manifest.json";

export interface ExempleItem {
  id: string;
  file: string;
  kind: string;
  title: string;
  prompt: string;
  source: string;
  license: string;
  licenseUrl: string;
}

export const EXEMPLES: ExempleItem[] = manifest.items;
