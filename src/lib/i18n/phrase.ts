type PhraseFn = (key: string, values?: Record<string, string | number>) => string;

const EXACT: Record<string, string> = {
  "Solde illisible. Rien ne part sans lire le compte qui paiera.": "runtime.balanceUnreadable",
  "Solde vide sur ton compte de rendu.": "runtime.renderEmpty",
  "Coût non calibré à ce réglage. Le temps de calcul réel sera débité, puis mesuré sur cette prise.": "runtime.uncalibrated",
  "Prix fal illisible. Rien ne part sans un prix.": "runtime.falPriceUnreadable",
  "Solde fal illisible. Rien ne part sans lire le compte qui paiera.": "runtime.falBalanceUnreadable",
  "Solde fal vide. Recharge-le sur fal.ai, puis relis-le ici.": "runtime.falEmpty",
  "Le prix se lit sur le compte fal, avant le geste. Rien n’est débité ici.": "runtime.falPriceBefore",
  "Le prix se lit sur le compte fal, avant le geste.": "runtime.falPriceBeforeShort",
  "Il faut relier le compte fal. Le prix s’affiche alors, avant tout débit.": "runtime.linkFalFirst",
  "Le prix du personnage n’est pas lu. Rien ne part.": "runtime.characterPriceUnread",
  "Les deux prix ne sont pas lus. Rien ne part.": "runtime.bothPricesUnread",
  "Le devis n’est pas encore lu. Rien ne part.": "runtime.quoteUnread",
  "Le devis n’est pas lisible. Rien ne part.": "runtime.quoteUnreadable",
  "Compte de rendu relié.": "runtime.renderLinked",
  "Compte de rendu relié par clé.": "runtime.renderLinkedKey",
  "Compte fal relié.": "runtime.falLinked",
  "Clé Blender tenue sur cet appareil.": "runtime.blenderHeld",
  "Clé Blender retirée de cet appareil.": "runtime.blenderRemoved",
  "Mon studio ne s’ouvre pas sur cet appareil. Un navigateur privé peut le bloquer.": "runtime.studioBlocked",
  "Trois photos au plus. Retire une photo pour en mettre une autre.": "runtime.photosMax",
  "Quatre photos au plus pour un personnage.": "runtime.rolePhotosMax",
  "Deux images par lieu au plus.": "runtime.stillsMax",
  "Douze vues en plus au plus.": "runtime.viewsMax",
  "Choisis une photo.": "runtime.pickPhoto",
  "Choisis une image.": "runtime.pickImage",
  "Une photo n’a pas pu être lue. Essaie un JPEG ou un PNG.": "runtime.photoUnread",
  "Une image n’a pas pu être lue.": "runtime.imageUnread",
  "Une vue n’a pas pu être lue.": "runtime.viewUnread",
  "Il manque un fichier de personnage.": "runtime.missingCharacterFile",
  "Le fichier du personnage manque dans mon studio.": "runtime.characterFileMissing",
  "Les photos des références manquent dans mon studio.": "runtime.referencePhotosMissing",
  "L’image filmée manque dans mon studio.": "runtime.filmedStillMissing",
  "Le plan est filmé. Blender a rendu le lieu vide. Le personnage est dans la prise.": "runtime.planFilmed",
  "Le lieu est rendu. Le suivi du personnage reprend. Rien n’est renvoyé.": "runtime.placeRenderedResume",
  "Le lieu est rendu, vide. Le prochain geste filme le personnage, au prix fal seul.": "runtime.placeEmptyNext",
  "Suivi arrêté ici. Si le rendu est déjà parti, il continue sur ton compte.": "runtime.followStopped",
  "Le filmage n’a pas abouti.": "runtime.filmFailed",
  "Trente clips au plus.": "runtime.clipsMaxNotice",
  "Ce clip n’est pas une vidéo mp4, mov, mkv ou avi.": "runtime.clipType",
  "Un clip ou une photo manque dans mon studio.": "runtime.clipOrPhotoMissing",
  "Ce ZIP ne s’ouvre pas.": "runtime.zipClosed",
  "Ce ZIP ne contient pas de studio à ajouter.": "runtime.zipEmpty",
  "Une vue manque dans mon studio.": "runtime.viewMissing",
  "Le lieu est dans mon studio. Ce fichier n’est pas un volume : le Blender du lieu reste le modèle 3D.": "runtime.placeFiled",
  "La formation du lieu n’a pas abouti.": "runtime.placeTrainFailed",
  "Image bâtie depuis le LoRA du lieu. Le fichier Blender reste le modèle 3D.": "runtime.stillBuilt",
  "L’image du lieu n’a pas abouti.": "runtime.placeImageFailed",
  "Clip illisible sur cet appareil.": "runtime.clipUnreadable",
  "Clip trop lourd : 300 Mo au plus.": "runtime.clipHeavy",
  "Donne un nom à ce personnage.": "runtime.nameCharacter",
  "Deux photos du personnage au moins, pour accompagner les clips.": "runtime.twoPhotos",
  "Les clips pèsent plus de 2 Go : retire les plus longs.": "runtime.clipsWeight",
  "Au moins une photo des références.": "runtime.oneReference",
  "Personnages": "tree.characters",
  "Références": "tree.references",
  "Lieux": "tree.places",
  "Prises": "tree.takes",
  "Séquences": "tree.sequences",
  "Plans": "tree.plans",
  "Prompts": "tree.prompts",
  "Modèles": "tree.templates",
  "Modèle · Personnage": "tree.modelCharacter",
  "Modèle · Scène": "tree.modelScene",
  "Modèle · Prise": "tree.modelTake",
  "Modèle · Séquence": "tree.modelSequence",
  "Moteurs": "tree.engines",
  "Moteur · Personnage": "tree.engineCharacter",
  "Moteur · Références": "tree.engineReferences",
  "Moteur · Lieu": "tree.enginePlace",
  "Fichiers": "tree.files",
  "Notes": "tree.notes",
  "Sans nom": "common.unnamed",
  "Personnage": "common.character",
  "Prise": "common.take",
  "débit en attente": "common.chargePending",
  "en attente": "common.pending",
  "pas encore lu": "common.notReadYet",
};

interface Pattern {
  re: RegExp;
  apply(t: PhraseFn, match: RegExpMatchArray): string;
}

function phraseInner(t: PhraseFn, line: string, depth: number): string {
  if (!line || depth > 4) return line;
  const exact = EXACT[line];
  if (exact) return t(exact);
  for (const pattern of PATTERNS) {
    const match = line.match(pattern.re);
    if (match) return pattern.apply(t, match);
  }
  const suffix = ", lu sur le compte fal.";
  if (line.endsWith(suffix)) {
    return t("runtime.readOnFal", { line: phraseInner(t, line.slice(0, -suffix.length), depth + 1) });
  }
  return line;
}

const PATTERNS: Pattern[] = [
  {
    re: /^la plus chère de tes (\d+) dernières prises à ce réglage$/,
    apply: (t, match) => t("runtime.basisSeveral", { count: match[1] }),
  },
  {
    re: /^ta prise du (.+) à ce réglage$/,
    apply: (t, match) => t("runtime.basisOne", { date: match[1] }),
  },
  {
    re: /^Environ (.+) crédits, mesuré sur (.+)\.$/,
    apply: (t, match) => t("runtime.aboutCredits", { amount: match[1], basis: phraseInner(t, match[2], 1) }),
  },
  {
    re: /^Solde trop bas : (.+) crédits\. Il en faut environ (.+), mesuré sur (.+)\.$/,
    apply: (t, match) => t("runtime.balanceLow", { have: match[1], need: match[2], basis: phraseInner(t, match[3], 1) }),
  },
  {
    re: /^(Cette formation|Cette prise) : (.+) au prix fal du jour\. Solde non lu\. Le débit part sur ton compte fal\.$/,
    apply: (t, match) => t("runtime.falOptional", { what: match[1] === "Cette formation" ? t("runtime.thisTraining") : t("runtime.thisTake"), amount: match[2] }),
  },
  {
    re: /^(Cette formation|Cette prise) : (.+) au prix fal du jour, débités sur ton compte fal\.$/,
    apply: (t, match) => t("runtime.falOk", { what: match[1] === "Cette formation" ? t("runtime.thisTraining") : t("runtime.thisTake"), amount: match[2] }),
  },
  {
    re: /^Solde trop bas : (.+) pour (cette formation|cette prise) à (.+)\.$/,
    apply: (t, match) => t("runtime.falLow", { have: match[1], what: match[2] === "cette formation" ? t("runtime.thisTrainingLower") : t("runtime.thisTakeLower"), need: match[3] }),
  },
  {
    re: /^Exemple · (.+) crédit par seconde de calcul, sur le compte de rendu\. Rien n’est débité ici\.$/,
    apply: (t, match) => t("runtime.exampleRender", { rate: match[1] }),
  },
  {
    re: /^Exemple · (.+) pour (\d+) pas, tarif publié le (.+)\. Rien n’est débité ici\.$/,
    apply: (t, match) => t("runtime.exampleTrain", { amount: match[1], steps: match[2], date: match[3] }),
  },
  {
    re: /^Exemple, tarif publié le (.+) : (.+) pour (\d+) s en ([^.]+)\. Le prix de ton compte le remplace après Relier\. Rien n’est débité ici\.$/,
    apply: (t, match) => t("runtime.exampleFalTake", { date: match[1], amount: match[2], seconds: match[3], resolution: match[4] }),
  },
  {
    re: /^Exemple pour (\d+) s : (.+) crédit par seconde de calcul, publié le (.+)\. 1 \$ = (\d+) crédits\. Le chiffre de cette prise se lit après Relier\. Rien n’est débité ici\.$/,
    apply: (t, match) => t("runtime.exampleComfyTake", { seconds: match[1], rate: match[2], date: match[3], credits: match[4] }),
  },
  {
    re: /^Exemple · (.+) crédit\/s$/,
    apply: (t, match) => t("runtime.exampleRate", { rate: match[1] }),
  },
  {
    re: /^Exemple · (.+)$/,
    apply: (t, match) => t("runtime.exampleAmount", { amount: match[1] }),
  },
  {
    re: /^Formation : (.+) pour (\d+) pas, lu sur le compte fal\.$/,
    apply: (t, match) => t("runtime.trainQuote", { amount: match[1], steps: match[2] }),
  },
  {
    re: /^Le trajet est déjà rendu\. Le personnage : (.+)\.$/,
    apply: (t, match) => t("runtime.pathReady", { amount: match[1] }),
  },
  {
    re: /^Blender : (.+) pour (\d+ images|1 image) du trajet\. Personnage : (.+)\.$/,
    apply: (t, match) => t("runtime.blenderAndCharacter", { blender: match[1], images: match[2] === "1 image" ? t("runtime.oneImage") : t("runtime.nImages", { count: match[2].replace(" images", "") }), character: match[3] }),
  },
  {
    re: /^Devis lu : (.+) pour (\d+ images|1 image)\.$/,
    apply: (t, match) => t("runtime.quoteRead", { amount: match[1], images: match[2] === "1 image" ? t("runtime.oneImage") : t("runtime.nImages", { count: match[2].replace(" images", "") }) }),
  },
  {
    re: /^(\d+) vues au moins\. Il en manque (\d+)\.$/,
    apply: (t, match) => t("runtime.viewsShort", { min: match[1], missing: match[2] }),
  },
  {
    re: /^(\d+) vues\. Le fichier apprend ce lieu, pas une personne\.$/,
    apply: (t, match) => t("runtime.viewsReady", { count: match[1] }),
  },
  {
    re: /^(\d+) clips? de plus : (\d+) au moins\.$/,
    apply: (t, match) => t(match[1] === "1" ? "runtime.clipsShortOne" : "runtime.clipsShort", { missing: match[1], min: match[2] }),
  },
  {
    re: /^(\d+) clips au plus\.$/,
    apply: (t, match) => t("runtime.clipsCeiling", { max: match[1] }),
  },
  {
    re: /^Clip trop court : (\d+) s au moins\.$/,
    apply: (t, match) => t("runtime.clipShort", { min: match[1] }),
  },
  {
    re: /^Clip trop long : (\d+) s au plus\.$/,
    apply: (t, match) => t("runtime.clipLong", { max: match[1] }),
  },
  {
    re: /^Ajouté à mon studio : (\d+) fichier\. Les prises et les personnages déjà ici restent\.$/,
    apply: (t, match) => t("runtime.importedOne", { count: match[1] }),
  },
  {
    re: /^Ajouté à mon studio : (\d+) fichiers\. Les prises et les personnages déjà ici restent\.$/,
    apply: (t, match) => t("runtime.importedMany", { count: match[1] }),
  },
  {
    re: /^(\d+) fichiers copiés dans « (.+) »\. Le dossier suit le studio jusqu’à la fermeture\.$/,
    apply: (t, match) => t("runtime.folderCopied", { count: match[1], name: match[2] }),
  },
];

/** Translate a French line the libraries still return. Unknown lines stay as written. */
export function phrase(t: PhraseFn, line: string): string {
  return phraseInner(t, line, 0);
}
