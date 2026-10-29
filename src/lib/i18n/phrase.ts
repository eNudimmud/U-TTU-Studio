type PhraseFn = (key: string, values?: Record<string, string | number>) => string;

const EXACT: Record<string, string> = {
  "Ce navigateur ne sait écrire aucune vidéo (ni WebCodecs, ni enregistrement). Mets à jour le navigateur du téléphone (Safari 16.4 ou plus, Chrome Android), puis relance l’export : le montage est gardé.": "runtimeSafe.encodeMp4",
  "Ce navigateur ne peut pas écrire le fichier maître H.264. Exporte d’abord le montage (il marche sur ce téléphone), ou relance Finaliser depuis un navigateur à jour.": "runtimeSafe.encodeMaster",
  "L’enregistrement de la vidéo est vide. Relance l’export en gardant cet onglet ouvert.": "runtimeSafe.recordEmpty",
  "Ce navigateur ne peut pas sécuriser les envois simultanés. Utilise un navigateur récent.": "runtimeSafe.lockUnsupported",
  "Cette prise n’est plus disponible dans le projet.": "runtimeSafe.takeGone",
  "Chaque personnage doit avoir une référence enregistrée. Retire les silhouettes neutres avant de générer.": "runtimeSafe.castNeedsRef",
  "Choisis une image enregistrée ou génère une prise avant le montage.": "runtimeSafe.pickSavedImage",
  "Durée du média illisible.": "runtimeSafe.mediaDuration",
  "Enregistré dans ce navigateur. La copie vers le dossier lié a échoué : reconnecte-le pour synchroniser.": "runtimeSafe.folderCopyFailed",
  "Ferme les autres onglets du studio puis réessaie la sauvegarde.": "runtimeSafe.closeTabs",
  "Impossible de lire l’image. Rien n’a été ajouté au montage.": "runtimeSafe.imageToMontage",
  "La récupération nécessite un navigateur récent.": "runtimeSafe.recoveryBrowser",
  "La vidéo ne répond pas.": "runtimeSafe.videoStalled",
  "Le cloud annonce la fin mais le fichier manque. Le reçu est conservé.": "runtimeSafe.cloudFileMissing",
  "Le cloud confirme que ce rendu est terminé sans résultat. Tu peux préparer un nouvel envoi avec confirmation.": "runtimeSafe.cloudNoResult",
  "Le cloud travaille encore. Réessaie Récupérer le rendu dans quelques instants. Aucun nouvel envoi.": "runtimeSafe.cloudStillWorking",
  "Le décor choisi n’est pas enregistré dans ce projet. Enregistre-le dans DÉCOR avant de générer.": "runtimeSafe.decorNotSaved",
  "Le fichier de la prise manque. Récupère-le avant le montage.": "runtimeSafe.takeFileMissing",
  "Le navigateur ne peut pas conserver le reçu du rendu.": "runtimeSafe.receiptStorage",
  "Le projet a changé. Le média reste dans sa galerie ; ajoute-le à nouveau au montage souhaité.": "runtimeSafe.projectChanged",
  "Le son de cette vidéo ne peut pas être décodé dans ce navigateur.": "runtimeSafe.audioDecode",
  "Le son d’au moins une prise ne se lit pas dans ce navigateur : la vidéo est exportée sans ce son.": "runtimeSafe.soundSkipped",
  "Lecture du média trop longue.": "runtimeSafe.mediaSlow",
  "L’envoi a été interrompu sans reçu. Il peut avoir été facturé. Vérifie l’historique Comfy avant toute nouvelle génération ; ne supprime pas les données de ce navigateur.": "runtimeSafe.sendNoReceipt",
  "L’image de storyboard est illisible.": "runtimeSafe.storyboardImage",
  "L’image ne répond pas.": "runtimeSafe.imageStalled",
  "Média impossible à lire.": "runtimeSafe.mediaUnreadable",
  "Prise enregistrée dans son projet. Tu peux la retrouver et l’ajouter au montage.": "runtimeSafe.takeSaved",
  "Reconnecte le compte qui a envoyé ce rendu pour le récupérer.": "runtimeSafe.reconnectAccount",
  "Rendu récupéré dans son projet d’origine. Le coût reste à vérifier dans ton compte.": "runtimeSafe.recovered",
  "Sauvegarde interrompue. Vérifie l’espace disponible puis réessaie.": "runtimeSafe.saveInterrupted",
  "Un autre onglet suit déjà un rendu.": "runtimeSafe.otherTabFollows",
  "Un média sonore du montage manque.": "runtimeSafe.audioMissing",
  "Un média sonore est inaccessible.": "runtimeSafe.audioInaccessible",
  "Un plan ne contient aucun média.": "runtimeSafe.planEmpty",
  "Un rendu attend sa récupération. Ouvre Crédits puis Récupérer le rendu avant un nouvel envoi.": "runtimeSafe.pendingBeforeSend",
  "Un rendu attend sa récupération. Ouvre Crédits puis Récupérer le rendu.": "runtimeSafe.pending",
  "Un rendu est déjà suivi dans un autre onglet.": "runtimeSafe.otherTabRender",
  "Une image de la vidéo ne peut pas être lue.": "runtimeSafe.videoFrame",
  "Une piste son est illisible. Corrige-la avant l’export.": "runtimeSafe.audioTrack",
  "Une vidéo du montage manque.": "runtimeSafe.videoMissing",
  "Une vidéo est illisible.": "runtimeSafe.videoUnreadable",
  "Solde illisible. Rien ne part sans lire le compte qui paiera.": "runtime.balanceUnreadable",
  "Solde vide sur ton compte de rendu.": "runtime.renderEmpty",
  "Devis absent. Le total de cette prise n’est pas un nombre. Rien ne part.": "runtime.uncalibrated",
  "Pas encore mesuré. Cette durée, cette qualité ou ce format n’a pas de prise réelle. Rien ne part.": "runtime.notMeasured",
  "Le prix du personnage n’est pas lu. Rien ne part.": "runtime.characterPriceUnread",
  "Les deux prix ne sont pas lus. Rien ne part.": "runtime.bothPricesUnread",
  "Le devis n’est pas encore lu. Rien ne part.": "runtime.quoteUnread",
  "Le devis n’est pas lisible. Rien ne part.": "runtime.quoteUnreadable",
  "Ta session Comfy a expiré (connexion ouverte ailleurs ?). Reconnecte-toi.": "runtimeSafe.sessionElsewhere",
  "Le compte de rendu ne répond pas. Vérifie ta connexion, puis réessaie.": "runtimeSafe.renderNetwork",
  "Le rendu a échoué dans le cloud. Vérifie ton historique Comfy pour tout coût éventuel.": "runtimeSafe.cloudFailed",
  "Un rendu précédent attend encore sa récupération. Ouvre Crédits, puis Récupérer le rendu — ou réessaie si le cloud l’a déjà terminé sans résultat.": "runtimeSafe.pendingBlock",
  "Le compte de rendu a refusé la prise. Rien n’a été envoyé.": "runtimeSafe.submitRefused",
  "Crédits insuffisants sur ton compte de rendu.": "runtimeSafe.creditsLow",
  "Ton abonnement de rendu est inactif, ou la file est pleine.": "runtimeSafe.subscriptionInactive",
  "Compte de rendu relié.": "runtime.renderLinked",
  "Compte de rendu relié par clé.": "runtime.renderLinkedKey",
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
  "Le trajet est filmé. Blender a rendu le lieu vide. Le personnage est dans la prise.": "runtime.planFilmed",
  "Le personnage n’est pas dans le trajet.": "runtime.characterNotOnPath",
  "Une image du trajet manque dans mon studio.": "runtime.pathImageMissing",
  "Le lieu est rendu. Le suivi du personnage reprend. Rien n’est renvoyé.": "runtime.placeRenderedResume",
  "Le lieu est rendu, vide. Le prochain geste filme le personnage.": "runtime.placeEmptyNext",
  "Suivi arrêté ici. Si le rendu est déjà parti, il continue sur ton compte.": "runtime.followStopped",
  "Le filmage n’a pas abouti.": "runtime.filmFailed",
  "Trente clips au plus.": "runtime.clipsMaxNotice",
  "Ce clip n’est pas une vidéo mp4, mov, mkv ou avi.": "runtime.clipType",
  "Un clip ou une photo manque dans mon studio.": "runtime.clipOrPhotoMissing",
  "Ce ZIP ne s’ouvre pas.": "runtime.zipClosed",
  "Ce ZIP ne contient pas de studio à ajouter.": "runtime.zipEmpty",
  "Une vue manque dans mon studio.": "runtime.viewMissing",
  "Le lieu est dans mon studio. Ce fichier n’est pas un volume : le Blender du lieu reste le modèle 3D.": "runtime.placeFiled",
  "L’image du lieu n’a pas abouti.": "runtime.placeImageFailed",
  "Clip illisible sur cet appareil.": "runtime.clipUnreadable",
  "Clip trop lourd : 300 Mo au plus.": "runtime.clipHeavy",
  "Fichier trop lourd pour l’envoi : 3,8 Mo au plus. Prends un clip plus court ou une photo plus légère.": "runtime.uploadHeavy",
  "Ce navigateur n’a pas pu préparer ce fichier pour l’envoi. Essaie une photo en jpg ou une vidéo mp4 plus courte.": "runtime.prepareFailed",
  "Vidéo trop longue pour l’envoi : une minute au plus. Raccourcis le clip.": "runtime.videoTooLong",
  "Son trop long pour l’envoi : six minutes au plus. Raccourcis le fichier.": "runtime.audioTooLong",
  "Finaliser garde la qualité de la source : au-delà de 3,8 Mo, elle ne peut pas encore partir sans être dégradée. Raccourcis la vidéo ou finalise-la en plusieurs morceaux.": "runtime.finalTooHeavy",
  "Finaliser garde la qualité de la source : cette image dépasse 3,8 Mo même en jpg de haute qualité. Prends une image plus petite.": "runtime.finalImageTooHeavy",
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
  "Modèle · Plan": "tree.modelShot",
  "Modèle · Raccord": "tree.modelBridge",
  "Modèle · Mouvement": "tree.modelMove",
  "Modèle · Effet": "tree.modelEffect",
  "Moteur · Raccord": "tree.engineBridge",
  "Moteur · Mouvement": "tree.engineMove",
  "Moteur · Effet": "tree.engineEffect",
  "Séquence créée.": "sequence.created",
  "Prise ajoutée.": "sequence.linked",
  "Séquence retirée.": "sequence.removed",
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
  return line;
}

const PATTERNS: Pattern[] = [
  {
    re: /^Estimé : environ (\S+) à (\S+) crédits\. Estimation, pas une mesure : aucune prise réelle facturée pour ce réglage\.$/,
    apply: (t, match) => t("runtime.estimateQuote", { amount: match[1], high: match[2] }),
  },
  {
    re: /^Solde trop bas : (\S+) crédits\. Estimé : environ (\S+) à (\S+) crédits\. Estimation, pas une mesure : aucune prise réelle facturée pour ce réglage\.$/,
    apply: (t, match) => t("runtime.estimateLow", { have: match[1], amount: match[2], high: match[3] }),
  },
  {
    re: /^Solde illisible\. Rien ne part sans lire le compte qui paiera\. Estimé : environ (\S+) à (\S+) crédits\. Estimation, pas une mesure : aucune prise réelle facturée pour ce réglage\.$/,
    apply: (t, match) => t("runtime.estimateUnread", { amount: match[1], high: match[2] }),
  },
  {
    re: /^Solde vide sur ton compte de rendu\. Estimé : environ (\S+) à (\S+) crédits\. Estimation, pas une mesure : aucune prise réelle facturée pour ce réglage\.$/,
    apply: (t, match) => t("runtime.estimateEmpty", { amount: match[1], high: match[2] }),
  },
  {
    re: /^la plus chère de tes (\d+) dernières prises à ce réglage$/,
    apply: (t, match) => t("runtime.basisSeveral", { count: match[1] }),
  },
  {
    re: /^ta prise du (.+) à ce réglage$/,
    apply: (t, match) => t("runtime.basisOne", { date: match[1] }),
  },
  {
    re: /^Environ (\S+) crédits, estimé d’après une prise du (.+)\. Le prix final peut varier\.$/,
    apply: (t, match) => t("runtime.billedQuote", { amount: match[1], date: match[2] }),
  },
  {
    re: /^Solde trop bas : (\S+) crédits\. Environ (\S+) crédits, estimé d’après une prise du (.+)\. Le prix final peut varier\.$/,
    apply: (t, match) => t("runtime.billedLow", { have: match[1], amount: match[2], date: match[3] }),
  },
  {
    re: /^Solde illisible\. Rien ne part sans lire le compte qui paiera\. Environ (\S+) crédits, estimé d’après une prise du (.+)\. Le prix final peut varier\.$/,
    apply: (t, match) => t("runtime.billedUnread", { amount: match[1], date: match[2] }),
  },
  {
    re: /^Solde vide sur ton compte de rendu\. Environ (\S+) crédits, estimé d’après une prise du (.+)\. Le prix final peut varier\.$/,
    apply: (t, match) => t("runtime.billedEmpty", { amount: match[1], date: match[2] }),
  },
  {
    re: /^environ (\S+) crédits$/,
    apply: (t, match) => t("runtime.billedMark", { amount: match[1] }),
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
    re: /^Exemple · (.+) crédit par seconde de calcul, sur le compte de rendu\. Rien n’est débité ici\.$/,
    apply: (t, match) => t("runtime.exampleRender", { rate: match[1] }),
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
  {
    re: /^Deux versions différentes de (.+)\. La synchronisation est suspendue pour conserver les deux versions\. Exporte le coffre avant de les rapprocher\.$/,
    apply: (t, match) => t("runtimeSafe.twoVersions", { name: match[1] }),
  },
  {
    re: /^Le rendu (\S+) a été envoyé, mais son reçu n’a pas pu être sauvegardé\. Conserve cet identifiant et vérifie ton espace disque\. Ne relance pas la génération\.$/,
    apply: (t, match) => t("runtimeSafe.sentNoReceipt", { job: match[1] }),
  },
];

/** Translate a French line the libraries still return. Unknown lines stay as written. */
export function phrase(t: PhraseFn, line: string): string {
  return phraseInner(t, line, 0);
}
