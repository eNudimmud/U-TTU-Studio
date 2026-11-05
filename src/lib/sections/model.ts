import type { VaultStore } from "../coffre/store.ts";
import type { OutputRef } from "../render/client.ts";
import type { Section, Step } from "./registry.ts";

export type AssetKind = "cast" | "set" | "take" | "edit";
export interface ProductionAsset {
  id: string;
  section: Section;
  kind: AssetKind;
  name: string;
  path: string;
  media: "image" | "video" | "audio" | "mesh";
  prompt: string;
  at: string;
  refs: string[];
  source: "import" | "comfy" | "legacy" | "edit";
  jobId?: string;
  output?: OutputRef;
  template?: string;
  seed?: number;
  quote?: number;
  credits?: number | null;
  seconds?: number;
  structure?: string;
  shotId?: string;
  number?: number;
  kept?: boolean;
  finalPath?: string;
  finalJobId?: string;
  finalOutput?: OutputRef;
  finalCredits?: number | null;
}
export interface Production {
  version: 1;
  assets: ProductionAsset[];
  bible: Partial<Record<Section, string>>;
}
export const emptyProduction = (): Production => ({
  version: 1,
  assets: [],
  bible: {},
});
export const productionPath = (project: string) =>
  `Projets/${project}/.uttu/production.json`;
export async function readProduction(
  store: VaultStore,
  project: string,
): Promise<Production> {
  const text = (await store.get(productionPath(project)))?.text;
  if (!text) return emptyProduction();
  const value = JSON.parse(text) as Production;
  if (value.version !== 1 || !Array.isArray(value.assets) || !value.bible)
    throw new Error(
      "Le registre du projet est illisible. Aucune donnée n’a été remplacée.",
    );
  return value;
}
export async function writeProduction(
  store: VaultStore,
  project: string,
  value: Production,
) {
  await store.put({
    path: productionPath(project),
    text: JSON.stringify(value),
    updatedAt: Date.now(),
  });
}
/** One kept take per shot and per section. Never infer a selection from array order. */
export function keepTake(value: Production, id: string): Production {
  const chosen = value.assets.find((a) => a.id === id);
  if (!chosen || chosen.kind !== "take" || !chosen.shotId)
    throw new Error("Cette prise n’existe pas.");
  return {
    ...value,
    assets: value.assets.map((a) =>
      a.kind === "take" &&
      a.section === chosen.section &&
      a.shotId === chosen.shotId
        ? { ...a, kept: a.id === id }
        : a,
    ),
  };
}
export function nextTakeNumber(
  value: Production,
  section: Section,
  shotId: string,
) {
  return (
    Math.max(
      0,
      ...value.assets
        .filter((a) => a.section === section && a.shotId === shotId)
        .map((a) => a.number ?? 0),
    ) + 1
  );
}
export function stepState(
  value: Production,
  section: Section,
  step: Step,
): "À commencer" | "En cours" | "Prêt" {
  const assets = value.assets.filter((a) => a.section === section);
  if (step === "finish")
    return assets.some((a) => a.kept && a.finalPath)
      ? "Prêt"
      : assets.some((a) => a.kept)
        ? "En cours"
        : "À commencer";
  if (step === "shoot")
    return assets.some((a) => a.kind === "take" && a.kept)
      ? "Prêt"
      : assets.some((a) => a.kind === "take")
        ? "En cours"
        : "À commencer";
  return assets.some((a) => a.kind === (step === "edit" ? "edit" : step))
    ? "Prêt"
    : "À commencer";
}
/** Media is committed and read back before a successful result or any cost enters the project. */
export async function fileResult(
  store: VaultStore,
  project: string,
  asset: ProductionAsset,
  blob: Blob,
  invalid: (blob: Blob) => Promise<boolean>,
): Promise<Production> {
  if (!blob.size || (await invalid(blob)))
    throw new Error(
      "Résultat vide ou illisible. Il n’a pas été ajouté au projet.",
    );
  const value = await readProduction(store, project);
  if (value.assets.some((a) => a.id === asset.id)) return value; // recovery is idempotent
  await store.put({ path: asset.path, blob, updatedAt: Date.now() });
  if ((await store.get(asset.path))?.blob?.size !== blob.size)
    throw new Error(
      "Le résultat n’a pas pu être conservé. Son reçu reste disponible.",
    );
  const next = { ...value, assets: [...value.assets, asset] };
  await writeProduction(store, project, next);
  return next;
}
