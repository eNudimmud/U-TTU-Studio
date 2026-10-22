/** Local adapters complement (never replace) the actual production catalogue. */
import { studioProductionMap } from "./studio-map.ts";
import { outilParGeste, outilParId } from "../outils/catalogue.ts";
import type { FiltreGestes } from "../workflows/registre.ts";
import type { Operation } from "./kernel/production.ts";

export type Adapter = "navigate" | "shots" | "montage" | "backup" | "projects" | "jobs";
export interface StudioAction extends Operation {
  adapter: Adapter;
  href?: string;
  toolId?: string;
  gestureId?: string;
  evidenceKey: string;
}
const natives: StudioAction[] = [
  { id: "local:cast", area: "cast", label: "Préparer le personnage", description: "Photos, références, identité et planche de personnage", href: "/studio#personnage", adapter: "navigate", evidenceKey: "cast", status: "ready", inputKinds: [], outputKind: "image", requiresPrompt: false },
  { id: "local:lora", area: "cast", label: "Entraîner une LoRA exportable", description: "L’entraînement exportable n’est pas branché. Utilise les références et planches de CAST.", adapter: "navigate", evidenceKey: "cast", status: "disabled", reason: "lora", inputKinds: ["image"], outputKind: "lora", requiresPrompt: false },
  { id: "local:decor", area: "decor", label: "Préparer le décor", description: "Références photographiques, création et cohérence du lieu", href: "/studio#scene", adapter: "navigate", evidenceKey: "decor", status: "ready", inputKinds: [], outputKind: "image", requiresPrompt: false },
  { id: "local:scout", area: "decor", label: "Repérer un lieu réel", description: "Carte, vues de rue Panoramax/Mapillary selon couverture, import de photos et capture 3D", href: "/studio#scene", adapter: "navigate", evidenceKey: "decor", status: "ready", inputKinds: [], outputKind: "image", requiresPrompt: true },
  { id: "local:shots", area: "prise", label: "Préparer les plans", description: "Créer des brouillons de plans liés aux personnages et décors choisis", href: "/studio#prise", adapter: "shots", evidenceKey: "shots", status: "ready", inputKinds: [], outputKind: "plan", requiresPrompt: true },
  { id: "local:take", area: "prise", label: "Préparer une prise", description: "Choisir le workflow et vérifier le devis dans PRISE avant confirmation", href: "/studio#prise", adapter: "navigate", evidenceKey: "takes", status: "ready", inputKinds: [], outputKind: "video", requiresPrompt: true },
  { id: "local:montage", area: "montage", label: "Assembler les prises", description: "Montage des vidéos sélectionnées, timeline, transitions et pistes sonores", href: "/studio#montage", adapter: "montage", evidenceKey: "montage", status: "ready", inputKinds: [], outputKind: "timeline", requiresPrompt: false },
  { id: "local:export", area: "montage", label: "Exporter le film", description: "Export local MP4 dans MONTAGE ; compatibilité du navigateur vérifiée à l’export", href: "/studio#montage", adapter: "navigate", evidenceKey: "export", status: "ready", inputKinds: [], outputKind: "video", requiresPrompt: false },
  { id: "local:backup", area: "coffre", label: "Sauvegarder le projet", description: "Export ZIP du coffre avec projets, médias, conversations et plans", adapter: "backup", evidenceKey: "backup", status: "ready", inputKinds: [], outputKind: "zip", requiresPrompt: false },
  { id: "local:projects", area: "projets", label: "Rouvrir un projet", description: "Sélection d’un projet existant ou import d’une sauvegarde dans Mon studio", href: "/mon-studio", adapter: "projects", evidenceKey: "projects", status: "ready", inputKinds: [], outputKind: "project", requiresPrompt: false },
  { id: "local:jobs", area: "outils", label: "Suivre ou récupérer un rendu", description: "Récupération d’un job existant ; jamais de renvoi automatique", adapter: "jobs", evidenceKey: "jobs", status: "ready", inputKinds: [], outputKind: "job", requiresPrompt: false },
];

export function studioActionRegistry(filters: FiltreGestes = {}, translate?: (key: string) => string): StudioAction[] {
  const actions = studioProductionMap(filters).map((op): StudioAction => {
    const gestureId = op.id.startsWith("gesture:") ? op.id.slice(8) : op.toolId ? outilParId(op.toolId)?.geste : undefined;
    const toolId = op.toolId ?? (gestureId ? outilParGeste(gestureId)?.id : undefined);
    const href = toolId ? `/studio#outils/${toolId}` : op.area === "cast" ? `/studio?geste=${gestureId}#personnage` : op.area === "decor" ? `/studio?geste=${gestureId}#scene` : undefined;
    return { ...op, status: href ? op.status : "disabled", reason: href ? op.reason : "no-adapter", adapter: "navigate", href, toolId, gestureId,
      label: translate && toolId ? translate(`outils.t.${toolId}.title`) : op.label,
      description: translate && toolId ? translate(`outils.t.${toolId}.line`) : op.label,
      inputKinds: op.inputKinds.filter(kind => kind !== "image2"), evidenceKey: toolId ? `tool:${toolId}` : op.area,
    };
  });
  return [...natives.map(op => ({ ...op, label: translate ? translate(`agent.operations.${op.id.slice(6)}`) : op.label, description: translate ? translate(`agent.descriptions.${op.id.slice(6)}`) : op.description })), ...actions];
}
