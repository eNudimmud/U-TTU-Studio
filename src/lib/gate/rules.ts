import { DATASET_SIZE } from "../comfy-stack.ts";
import { buildCaption, checkTrigger, cleanVariables, findInvariantHits, parseInvariants, repeatedTerms, wordCount } from "./captions.ts";
import { hamming, median, medianAbsoluteDeviation } from "./pixels.ts";
import { ANGLES, FACE_ANGLES, WIDE_FRAMINGS, type Angle, type Framing } from "./vocabulary.ts";

export const GATE = {
  datasetSize: DATASET_SIZE,
  minShortSide: 768,
  comfortShortSide: 1024,
  blurAbsolute: 100,
  blurRelative: 0.35,
  duplicateDistance: 6,
  nearDistance: 10,
  outlierMads: 3.5,
  lumaFloor: 40,
  saturationFloor: 0.12,
  minFaceAngles: 3,
  maxAngleShare: 0.6,
  minCloseUps: 3,
  minWideShots: 3,
  maxCaptionWords: 40,
  minInvariants: 2,
  freeVariablesShare: 0.5,
} as const;

export type Decision = "a-trier" | "garder" | "rejeter";

export interface DatasetImage {
  id: string;
  name: string;
  readable: boolean;
  width: number;
  height: number;
  sharpness: number;
  hash: string;
  mirrorHash: string;
  luma: number;
  saturation: number;
  angle: Angle | null;
  framing: Framing | null;
  variables: string;
  decision: Decision;
  reviewed: boolean;
}

export type FlagKind = "illisible" | "basse-resolution" | "resolution-limite" | "flou" | "hors-norme" | "miroir" | "doublon" | "tres-proche";
export type FlagWeight = "reject" | "review" | "pair" | "info";
export interface ImageFlag { kind: FlagKind; weight: FlagWeight; label: string; detail: string; relatedId?: string }

export const CONFIRMATIONS = [
  { id: "sujet", label: "Une seule personne au premier plan sur chaque image." },
  { id: "texte", label: "Aucun texte, logo, filigrane, cadre ni collage." },
  { id: "visages", label: `J’ai zoomé à 100 % : les visages sont nets sur les ${DATASET_SIZE} images.` },
  { id: "masque", label: "Visage jamais masqué (main, lunettes noires, masque), sauf si c’est un invariant." },
  { id: "droits", label: "J’ai les droits sur ces images et le consentement de la personne représentée." },
] as const;
export type ConfirmationId = (typeof CONFIRMATIONS)[number]["id"];

export interface GateInput {
  trigger: string;
  invariants: string;
  images: DatasetImage[];
  confirmations: Partial<Record<ConfirmationId, boolean>>;
}

export type Section = "reglages" | "technique" | "couverture" | "legendes" | "revue";
export const SECTIONS: { id: Section; label: string }[] = [
  { id: "reglages", label: "Réglages" },
  { id: "revue", label: "Tri humain" },
  { id: "technique", label: "Technique" },
  { id: "couverture", label: "Couverture" },
  { id: "legendes", label: "Légendes" },
];

export type CheckStatus = "pass" | "fail" | "warn" | "todo";
export interface GateCheck { id: string; section: Section; label: string; status: CheckStatus; detail: string; imageIds?: string[] }

export interface GateResult {
  verdict: "PASS" | "FAIL";
  checks: GateCheck[];
  flags: Record<string, ImageFlag[]>;
  kept: DatasetImage[];
  captions: string[];
  failCount: number;
  todoCount: number;
  warnCount: number;
}

const shortSide = (image: DatasetImage) => Math.min(image.width, image.height);
const angleLabel = (angle: Angle) => ANGLES.find(item => item.id === angle)?.label ?? angle;
const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;

function outliers(images: DatasetImage[], pick: (image: DatasetImage) => number, floor: number): Set<string> {
  const flagged = new Set<string>();
  if (images.length < 6) return flagged;
  const values = images.map(pick);
  const center = median(values);
  const spread = Math.max(floor, GATE.outlierMads * 1.4826 * medianAbsoluteDeviation(values, center));
  for (const image of images) if (Math.abs(pick(image) - center) > spread) flagged.add(image.id);
  return flagged;
}

export function computeFlags(images: DatasetImage[]): Record<string, ImageFlag[]> {
  const flags: Record<string, ImageFlag[]> = Object.fromEntries(images.map(image => [image.id, [] as ImageFlag[]]));
  const add = (id: string, flag: ImageFlag) => flags[id].push(flag);
  const readable = images.filter(image => image.readable);
  const sharpnessMedian = median(readable.map(image => image.sharpness));

  for (const image of images) {
    if (!image.readable) {
      add(image.id, { kind: "illisible", weight: "reject", label: "Illisible", detail: "Format non décodé par le navigateur : exporte en JPEG ou PNG." });
      continue;
    }
    const side = shortSide(image);
    if (side < GATE.minShortSide) add(image.id, { kind: "basse-resolution", weight: "reject", label: `${side} px`, detail: `Petit côté ${side} px < ${GATE.minShortSide} px : pas assez de pixels pour un visage.` });
    else if (side < GATE.comfortShortSide) add(image.id, { kind: "resolution-limite", weight: "info", label: `${side} px`, detail: `Petit côté ${side} px : accepté, ${GATE.comfortShortSide} px conseillé.` });
    const relative = readable.length >= 5 ? GATE.blurRelative * sharpnessMedian : 0;
    if (image.sharpness < GATE.blurAbsolute || image.sharpness < relative) {
      add(image.id, { kind: "flou", weight: "review", label: "Flou ?", detail: `Netteté ${Math.round(image.sharpness)} (médiane du lot : ${Math.round(sharpnessMedian)}). Zoome sur le visage avant de garder.` });
    }
  }

  const lumaOutliers = outliers(readable, image => image.luma, GATE.lumaFloor);
  const saturationOutliers = outliers(readable, image => image.saturation, GATE.saturationFloor);
  for (const image of readable) {
    if (lumaOutliers.has(image.id) || saturationOutliers.has(image.id)) {
      add(image.id, { kind: "hors-norme", weight: "review", label: "Hors norme", detail: "Lumière ou couleur très différente du reste du lot : vérifie que c’est bien la même identité, pas une dérive de style." });
    }
  }

  const candidates = readable.filter(image => image.decision !== "rejeter");
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i], b = candidates[j];
      const direct = hamming(a.hash, b.hash);
      const mirrored = Math.min(hamming(a.hash, b.mirrorHash), hamming(a.mirrorHash, b.hash));
      if (direct <= GATE.duplicateDistance) {
        add(a.id, { kind: "doublon", weight: "pair", label: "Doublon", detail: `Quasi identique à ${b.name} : garde la meilleure des deux.`, relatedId: b.id });
        add(b.id, { kind: "doublon", weight: "pair", label: "Doublon", detail: `Quasi identique à ${a.name} : garde la meilleure des deux.`, relatedId: a.id });
      } else if (mirrored <= GATE.duplicateDistance) {
        add(a.id, { kind: "miroir", weight: "review", label: "Miroir ?", detail: `Semble être ${b.name} retournée : un miroir inverse les asymétries du visage.`, relatedId: b.id });
        add(b.id, { kind: "miroir", weight: "review", label: "Miroir ?", detail: `Semble être ${a.name} retournée : un miroir inverse les asymétries du visage.`, relatedId: a.id });
      } else if (direct <= GATE.nearDistance) {
        add(a.id, { kind: "tres-proche", weight: "info", label: "Très proche", detail: `Pose très proche de ${b.name}.`, relatedId: b.id });
        add(b.id, { kind: "tres-proche", weight: "info", label: "Très proche", detail: `Pose très proche de ${a.name}.`, relatedId: a.id });
      }
    }
  }
  return flags;
}

export const canKeep = (flags: ImageFlag[]) => !flags.some(flag => flag.weight === "reject");

export function evaluateGate(input: GateInput): GateResult {
  const checks: GateCheck[] = [];
  const check = (id: string, section: Section, label: string, status: CheckStatus, detail: string, imageIds?: string[]) =>
    checks.push({ id, section, label, status, detail, ...(imageIds?.length ? { imageIds } : {}) });

  const flags = computeFlags(input.images);
  const kept = input.images.filter(image => image.decision === "garder");
  const pending = !kept.length;
  const waiting = "En attente d’images retenues.";
  const trigger = input.trigger.trim();
  const invariants = parseInvariants(input.invariants);
  const captions = kept.map(image => buildCaption(trigger, image.angle, image.framing, image.variables));
  const unreviewed = (kinds: FlagKind[]) =>
    kept.filter(image => !image.reviewed && flags[image.id]?.some(flag => flag.weight === "review" && kinds.includes(flag.kind)));

  const triggerError = checkTrigger(trigger);
  check("G01", "reglages", "Trigger unique", !trigger ? "todo" : triggerError ? "fail" : "pass", triggerError ?? `« ${trigger} » porte l’identité à lui seul.`);
  check("G02", "reglages", `Identité déclarée (≥ ${GATE.minInvariants} invariants)`,
    !invariants.length ? "todo" : invariants.length >= GATE.minInvariants ? "pass" : "fail",
    invariants.length >= GATE.minInvariants ? `${invariants.length} invariants : ${invariants.join(", ")}.`
      : "Liste ce qui ne change jamais (ex. green eyes, freckles, scar on left cheek). Ces traits seront interdits dans les légendes.");

  const untriaged = input.images.filter(image => image.decision === "a-trier");
  check("G03", "revue", `${GATE.datasetSize} images retenues, ni plus ni moins`,
    pending ? "todo" : kept.length === GATE.datasetSize ? "pass" : "fail",
    pending ? `0 / ${GATE.datasetSize}.`
      : kept.length === GATE.datasetSize ? `${GATE.datasetSize} / ${GATE.datasetSize}.`
        : kept.length < GATE.datasetSize ? `${kept.length} / ${GATE.datasetSize} : trop peu pour séparer l’identité du décor. Ajoute des images, n’en duplique pas.`
          : `${kept.length} / ${GATE.datasetSize} : l’app Comfy a ${GATE.datasetSize} emplacements. Garde les meilleures.`);
  check("G04", "revue", "Chaque image triée", !input.images.length ? "todo" : untriaged.length ? "fail" : "pass",
    !input.images.length ? "Importe tes images." : untriaged.length ? `${plural(untriaged.length, "image attend", "images attendent")} « Garder » ou « Rejeter ».` : "Toutes les images ont une décision.",
    untriaged.map(image => image.id));
  const missing = CONFIRMATIONS.filter(item => !input.confirmations[item.id]);
  check("G05", "revue", "Confirmations humaines", missing.length === CONFIRMATIONS.length ? "todo" : missing.length ? "fail" : "pass",
    missing.length ? `${plural(missing.length, "case reste", "cases restent")} à cocher : ${missing.map(item => item.label.replace(/\.$/, "")).join(" · ")}.` : `Les ${CONFIRMATIONS.length} confirmations sont faites.`);

  const unreadable = kept.filter(image => !image.readable);
  const small = kept.filter(image => image.readable && shortSide(image) < GATE.minShortSide);
  const limit = kept.filter(image => image.readable && shortSide(image) >= GATE.minShortSide && shortSide(image) < GATE.comfortShortSide);
  check("G06", "technique", `Fichiers lisibles, petit côté ≥ ${GATE.minShortSide} px`,
    pending ? "todo" : unreadable.length || small.length ? "fail" : limit.length ? "warn" : "pass",
    pending ? waiting
      : unreadable.length || small.length ? `${plural(unreadable.length + small.length, "image retenue est illisible ou trop petite", "images retenues sont illisibles ou trop petites")}.`
        : limit.length ? `${plural(limit.length, "image", "images")} sous ${GATE.comfortShortSide} px : accepté, pas idéal.` : "Toutes les images retenues ont assez de pixels.",
    [...unreadable, ...small, ...limit].map(image => image.id));
  const keptIds = new Set(kept.map(image => image.id));
  const duplicates = kept.filter(image => flags[image.id]?.some(flag => flag.kind === "doublon" && !!flag.relatedId && keptIds.has(flag.relatedId)));
  check("G07", "technique", "Aucun doublon", pending ? "todo" : duplicates.length ? "fail" : "pass",
    pending ? waiting : duplicates.length ? `${plural(duplicates.length, "image retenue a", "images retenues ont")} un quasi-double : une pose dupliquée pèse double à l’entraînement.` : "Aucune paire quasi identique parmi les images retenues.",
    duplicates.map(image => image.id));
  const blurry = unreviewed(["flou"]);
  check("G08", "technique", "Netteté vérifiée", pending ? "todo" : blurry.length ? "fail" : "pass",
    pending ? waiting : blurry.length ? `${plural(blurry.length, "image marquée floue n’est pas vérifiée", "images marquées floues ne sont pas vérifiées")} : zoome, puis coche « Vérifié » ou rejette.` : "Aucune image floue non vérifiée.",
    blurry.map(image => image.id));
  const odd = unreviewed(["hors-norme", "miroir"]);
  check("G09", "technique", "Dérives vérifiées (hors norme, miroir)", pending ? "todo" : odd.length ? "fail" : "pass",
    pending ? waiting : odd.length ? `${plural(odd.length, "image signalée n’est pas vérifiée", "images signalées ne sont pas vérifiées")} : même identité ? Sinon, rejette.` : "Aucune dérive signalée sans vérification.",
    odd.map(image => image.id));

  const untagged = kept.filter(image => !image.angle || !image.framing);
  check("G10", "couverture", "Angle et cadrage renseignés", pending ? "todo" : untagged.length ? "fail" : "pass",
    pending ? waiting : untagged.length ? `${plural(untagged.length, "image sans angle ou cadrage", "images sans angle ou cadrage")}.` : "Chaque image retenue a un angle et un cadrage.",
    untagged.map(image => image.id));
  const faceAngles = new Set(kept.map(image => image.angle).filter((angle): angle is Angle => !!angle && FACE_ANGLES.includes(angle)));
  check("G11", "couverture", `≥ ${GATE.minFaceAngles} angles de visage (face, 3/4, profil)`,
    pending ? "todo" : faceAngles.size >= GATE.minFaceAngles ? "pass" : "fail",
    pending ? waiting : faceAngles.size >= GATE.minFaceAngles ? "Face, 3/4 et profil sont couverts."
      : `Couverts : ${[...faceAngles].map(angleLabel).join(", ") || "aucun"}. Sans profil ni 3/4, la LoRA ne sait refaire que ce qu’elle a vu.`);
  const angleCounts = new Map<Angle, number>();
  for (const image of kept) if (image.angle) angleCounts.set(image.angle, (angleCounts.get(image.angle) ?? 0) + 1);
  const dominant = [...angleCounts].find(([, count]) => count / kept.length > GATE.maxAngleShare);
  check("G12", "couverture", `Aucun angle au-delà de ${Math.round(GATE.maxAngleShare * 100)} %`, pending ? "todo" : dominant ? "fail" : "pass",
    pending ? waiting : dominant ? `${angleLabel(dominant[0])} : ${dominant[1]} / ${kept.length}. L’angle dominant finit figé dans la LoRA.` : "Pas d’angle dominant.");
  const closeUps = kept.filter(image => image.framing === "gros-plan").length;
  const wide = kept.filter(image => !!image.framing && WIDE_FRAMINGS.includes(image.framing)).length;
  check("G13", "couverture", `≥ ${GATE.minCloseUps} gros plans et ≥ ${GATE.minWideShots} plans larges`,
    pending ? "todo" : closeUps >= GATE.minCloseUps && wide >= GATE.minWideShots ? "pass" : "fail",
    pending ? waiting : `${plural(closeUps, "gros plan", "gros plans")}, ${wide} en buste ou plein pied. Il faut les deux pour que l’identité tienne du visage à la silhouette.`);

  const noTrigger = kept.filter((_, i) => !trigger || !captions[i].startsWith(`${trigger},`) && captions[i] !== trigger);
  check("G14", "legendes", "Trigger en tête de chaque légende", pending ? "todo" : noTrigger.length ? "fail" : "pass",
    pending ? waiting : noTrigger.length ? "Chaque légende doit commencer par le trigger." : "Toutes les légendes commencent par le trigger.",
    noTrigger.map(image => image.id));
  const invariantHits = kept.map(image => ({ image, hits: findInvariantHits(image.variables, invariants) })).filter(item => item.hits.length);
  check("G15", "legendes", "Aucun invariant dans les légendes", pending ? "todo" : invariantHits.length ? "fail" : "pass",
    pending ? waiting : invariantHits.length ? `« ${[...new Set(invariantHits.flatMap(item => item.hits))].join(" », « ")} » apparaît dans ${plural(invariantHits.length, "légende", "légendes")}. Un trait écrit dans la légende n’est plus porté par le trigger : ta LoRA ne marchera que si tu le réécris.` : "Les légendes ne redisent pas l’identité.",
    invariantHits.map(item => item.image.id));
  const repetitions = repeatedTerms(kept.map(image => image.variables));
  check("G16", "legendes", "Aucun trait recopié de légende en légende", pending ? "todo" : repetitions.length ? "fail" : "pass",
    pending ? waiting : repetitions.length ? `${repetitions.slice(0, 3).map(item => `« ${item.term} » (${item.count}/${kept.length})`).join(", ")} : soit c’est un trait d’identité (retire-le, le trigger le porte), soit ton lot manque de variété (change des images).` : "Pas de trait recopié d’une légende à l’autre.");
  const long = kept.filter((_, i) => wordCount(captions[i]) > GATE.maxCaptionWords);
  check("G17", "legendes", `≤ ${GATE.maxCaptionWords} mots par légende`, pending ? "todo" : long.length ? "fail" : "pass",
    pending ? waiting : long.length ? `${plural(long.length, "légende-roman", "légendes-romans")} : décris ce qui change, pas la personne.` : "Légendes courtes.",
    long.map(image => image.id));
  const firstByCaption = new Map<string, string>();
  const identical = new Set<string>();
  kept.forEach((image, i) => {
    const key = captions[i].toLowerCase();
    const first = firstByCaption.get(key);
    if (first) { identical.add(first); identical.add(image.id); } else firstByCaption.set(key, image.id);
  });
  check("G18", "legendes", "Légendes toutes différentes", pending ? "todo" : identical.size ? "fail" : "pass",
    pending ? waiting : identical.size ? `${plural(identical.size, "légende identique", "légendes identiques")} : décris ce qui diffère (tenue, décor, lumière, expression).` : "Chaque légende décrit sa propre image.",
    [...identical]);
  const bare = kept.filter(image => !cleanVariables(image.variables));
  check("G19", "legendes", "Variables décrites (tenue, décor, lumière, expression)",
    pending ? "todo" : bare.length / kept.length > GATE.freeVariablesShare ? "warn" : "pass",
    pending ? waiting : bare.length ? `${plural(bare.length, "légende sans variable libre", "légendes sans variable libre")} : un décor non décrit risque d’être appris comme identité.` : "Les variables sont décrites.",
    bare.map(image => image.id));

  const failCount = checks.filter(item => item.status === "fail").length;
  const todoCount = checks.filter(item => item.status === "todo").length;
  return {
    verdict: failCount || todoCount ? "FAIL" : "PASS",
    checks,
    flags,
    kept,
    captions,
    failCount,
    todoCount,
    warnCount: checks.filter(item => item.status === "warn").length,
  };
}
