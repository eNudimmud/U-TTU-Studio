// Landing sections. English is the source. Prices always say they are estimated.

export type LandingLocale = "en" | "fr" | "de" | "es";

export interface LandingCopy {
  readGuide: string;
  heroLead: string;
  stepsTitle: string;
  stepsLead: string;
  steps: { id: string; name: string; body: string; href: string; go: string; image?: string; alt: string; placeholder?: string }[];
  animeTitle: string;
  animeBody: string;
  animePoints: string[];
  animeCost: string;
  animeLook: string;
  animeBible: string;
  h3Badge: string;
  h3Title: string;
  h3Body: string;
  h3: { name: string; body: string; href?: string; cost: string; soon?: boolean; partner?: boolean }[];
  onlyTitle: string;
  onlyLead: string;
  scoutTitle: string;
  scoutBody: string;
  scoutLink: string;
  uttuTitle: string;
  uttuBody: string;
  uttuCost: string;
  uttuLink: string;
  swTitle: string;
  swBody: string;
  swLink: string;
  modelsTitle: string;
  modelsLead: string;
  openTitle: string;
  openWhy: string;
  openOn: string;
  partnerTitle: string;
  partnerWhy: string;
  partnerHidden: string;
  partnerOn: string;
  openList: { k: string; v: string }[];
  partnerList: { k: string; v: string }[];
  partnerMore: string;
  licenceNote: string;
  partnerSwapHidden: string;
  costsTitle: string;
  costsLead: string;
  costs: { label: string; price: string }[];
  costsLink: string;
  endTitle: string;
  trust: string[];
  soonWord: string;
}

const en: LandingCopy = {
  readGuide: "Read the Guide",
  heroLead: "Cast your characters, build your sets, shoot, cut and finish your film — on your own account, with a quote before every credit.",
  stepsTitle: "Five steps, one bar.",
  stepsLead: "The same five steps you will find at the top of the studio, in the same order.",
  steps: [
    { id: "cast", name: "Cast", body: "Your characters, the same face in every shot.", href: "/studio#personnage", go: "Open Cast", image: "/images/accueil/uttu-portrait-1280.webp", alt: "Uttu, the character, from her official references" },
    { id: "set", name: "Set", body: "A place from a text, a photo or a real location.", href: "/studio#scene", go: "Open Set", image: "/exemples/decor-quai-nuit.webp", alt: "Her set: a cobbled quay at night" },
    { id: "shoot", name: "Shoot", body: "Put the character in the set, frame it, then render.", href: "/studio#prise", go: "Open Shoot", image: "/exemples/outils/prise-uttu-quai-poster.jpg", alt: "The shot: Uttu walking on the quay at night" },
    { id: "edit", name: "Edit", body: "Video, voice, music and text on four tracks. MP4 export in your browser — no render.", href: "/studio#montage", go: "Open Edit", image: "/media/accueil/edit-timeline.webp", alt: "The Edit timeline with Uttu’s shots: four shots on one track, the second selected" },
    { id: "finish", name: "Finish", body: "Sharper and larger. Nothing is regenerated.", href: "/studio#finaliser", go: "Open Finish", image: "/media/accueil/finaliser-avant-apres-1280.webp", alt: "The same quay shot, before (left) and after Finish (right)" },
  ],
  animeTitle: "Your story, as a theatrical anime.",
  animeBody: "Painted backgrounds, cel shading with rim light, a real 3D camera, the same look in every shot. Chosen once for the whole project — choosing starts no render.",
  animePoints: ["LTX-2.5 for wide shots and camera moves", "Wan 2.2 + AniSora for acting up close", "Real-ESRGAN anime at Finish — sharper lines, nothing redrawn"],
  animeCost: "≈ 16 credits estimated per 5 s shot · a 3-shot film ≈ 70 credits estimated, quoted again before anything runs",
  animeLook: "Choose the look",
  animeBible: "See the look bible",
  h3Badge: "Built with MiniMax H3",
  h3Title: "Your character, the same in every shot.",
  h3Body: "Give a name and a few pictures. MiniMax H3 keeps the face, the costume and the place from one shot to the next.",
  h3: [
    { name: "Reference-true video", body: "Characters and place kept consistent", href: "/studio#outils/vid-h3-refs", cost: "≈ 4–6 cr. est." },
    { name: "Faithful keyframes", body: "Start on one picture, end on another, with sound", href: "/studio#outils/vid-multi", cost: "≈ 14 cr. est." },
    { name: "Faithful to the place · FastH3", body: "Your character in your set, set kept", href: "/studio#outils/vid-fasth3", cost: "≈ 8–12 cr. est." },
    { name: "Animate and extend", body: "Bring a picture to life, then continue the shot", href: "/studio#outils/vid-animer", cost: "≈ 4–10 cr. est." },
    { name: "Character swap · Higgsfield Genjutsu", body: "Film anyone, play your character — motion, camera and timing kept. Partner node, labelled as such.", href: "/studio#outils/vid-genjutsu", cost: "≈ 480 cr. est. / 5 s 480p", partner: true },
  ],
  onlyTitle: "Filmmaking tools, in your browser.",
  onlyLead: "They run before any render. Rendering only comes after, with its quote, when you confirm.",
  scoutTitle: "Scout a real place, anywhere.",
  scoutBody: "Type a city or an address: it builds in 3D from OpenStreetMap — real roofs in Switzerland. Pick the time of day, capture your framing.",
  scoutLink: "Scout a location",
  uttuTitle: "Uttu knows every tool.",
  uttuBody: "She knows what each tool does and what it costs, and suggests the next step. You launch it. Closed until you call her; she never covers your work.",
  uttuCost: "≈ 0.2 credits estimated per message at most",
  uttuLink: "How Uttu helps · Guide",
  swTitle: "StoryWeave",
  swBody: "Your story, woven shot by shot: talk with Uttu, a panel for each character, place and scene, and a four-track timeline.",
  swLink: "See what’s coming",
  modelsTitle: "The models really in the studio.",
  modelsLead: "Every tool names its model. Open-weights models run here; partner models go through a paid partner node and are always labelled.",
  openTitle: "Open weights",
  openWhy: "Run with published weights.",
  openOn: "On in the studio",
  partnerTitle: "Partner models",
  partnerWhy: "Through partner nodes, on your account credits.",
  partnerHidden: "Hidden in today’s public build.",
  partnerOn: "On in this build.",
  openList: [
    { k: "Image", v: "FLUX.3 Klein, Qwen-Image 2.1, Qwen-Image 2512 and Qwen Edit, FLUX.2 Klein 9B" },
    { k: "Video", v: "MiniMax H3, FastH3, Pika H3 Flex (MiniMax H3 Community License) · LTX-2.5, LTX-2.3 · Wan 2.2, Wan Animate 2" },
    { k: "Anime", v: "AniSora (with Wan 2.2), Real-ESRGAN anime" },
    { k: "Finish", v: "SeedVR2, frame interpolation, BiRefNet" },
    { k: "3D", v: "TRELLIS.2 · plus 2 in-browser 3D tools (3D mock-up and framing, location scouting), no model" },
    { k: "Sound", v: "Chatterbox, ACE-Step 1.5, Stable Audio 3, MelBand RoFormer" },
    { k: "Agent", v: "Qwen3-VL 8B (Uttu)" },
    { k: "Count", v: "31 of the 44 tools run an open-weights model by default, 11 are partner-only, 2 are in-browser 3D. Today’s public build shows the 33 without partners." },
  ],
  partnerList: [
    { k: "Image", v: "FLUX.3 [pro], GPT Image 2, Ideogram 4.5, Seedream 5 Pro" },
    { k: "Video", v: "MiniMax H3 Max, Kling 3, Seedance 2.5, Vidu Q4, Higgsfield Genjutsu" },
  ],
  partnerMore: "Sound, video and 3D partners: ElevenLabs, Sync, Sonilo, Mirelo, VEED, Bria · Hunyuan3D, Meshy, Tripo.",
  licenceNote: "Open weights is not the same as open source. Some licences limit use: FLUX.2 Klein 9B and Qwen-Image 2.1 are non-commercial; FLUX.3 Klein (Kommunity) and LTX-2.x (Community) allow commercial use only under a revenue cap; Stable Audio 3 needs “Powered by Stability AI”; the MiniMax H3 Community licence excludes the EU, UK, US and South Korea. Check the licence before any commercial use.",
  partnerSwapHidden: "Partner tool, hidden in today’s public build.",
  costsTitle: "A quote before every credit.",
  costsLead: "Every paid button shows “≈ X credits estimated” and waits for your OK. Renders run on your own account.",
  costs: [
    { label: "A character picture", price: "≈ 4–6 credits estimated" },
    { label: "A reference-true shot · MiniMax H3", price: "≈ 4–6 credits estimated" },
    { label: "An anime shot, 5 s", price: "≈ 16 credits estimated" },
    { label: "Finish a 5 s take", price: "≈ 42–63 credits estimated" },
  ],
  costsLink: "Every price, in the Guide",
  endTitle: "Come in, and shoot your first shot.",
  trust: ["Open source, MIT licence", "Your own account, no key kept by us", "Nothing runs without your OK"],
  soonWord: "Soon",
};

function tr(base: LandingCopy, patch: Partial<LandingCopy>): LandingCopy {
  return { ...base, ...patch };
}

const fr = tr(en, {
  readGuide: "Lire le guide",
  heroLead: "Compose tes personnages, bâtis tes décors, tourne, monte et finalise ton film — sur ton propre compte, avec un devis avant chaque crédit.",
  stepsTitle: "Cinq étapes, une barre.",
  stepsLead: "Les mêmes cinq étapes qu’en haut du studio, dans le même ordre.",
  steps: [
    { ...en.steps[0]!, name: "CAST", body: "Tes personnages, le même visage dans chaque plan.", go: "Ouvrir CAST", alt: "Uttu, le personnage, d’après ses références officielles" },
    { ...en.steps[1]!, name: "DÉCOR", body: "Un lieu à partir d’un texte, d’une photo ou d’un vrai endroit.", go: "Ouvrir DÉCOR", alt: "Son décor : un quai pavé, de nuit" },
    { ...en.steps[2]!, name: "PRISE", body: "Place le personnage dans le décor, cadre, puis lance le rendu.", go: "Ouvrir PRISE", alt: "La prise : Uttu marche sur le quai, de nuit" },
    { ...en.steps[3]!, name: "MONTAGE", body: "Vidéo, voix, musique et texte sur quatre pistes. Export MP4 dans ton navigateur — aucun rendu.", go: "Ouvrir MONTAGE", alt: "La timeline du MONTAGE avec les plans d’Uttu : quatre plans sur une piste, le deuxième sélectionné" },
    { ...en.steps[4]!, name: "FINALISER", body: "Plus net et plus grand. Rien n’est régénéré.", go: "Ouvrir FINALISER", alt: "Le même plan du quai, avant (à gauche) et après FINALISER (à droite)" },
  ],
  animeTitle: "Ton histoire, comme un anime théâtral.",
  animeBody: "Décors peints, cel shading avec rim light, une vraie caméra 3D, le même look dans chaque plan. Choisi une fois pour tout le projet — choisir ne lance aucun rendu.",
  animePoints: ["LTX-2.5 pour les plans larges et les mouvements", "Wan 2.2 + AniSora pour le jeu en gros plan", "Real-ESRGAN anime à la finition — traits plus nets, rien n’est redessiné"],
  animeCost: "≈ 16 crédits estimés par plan de 5 s · un film de 3 plans ≈ 70 crédits estimés, devisés à nouveau avant tout lancement",
  animeLook: "Choisir le look",
  animeBible: "Voir la bible du look",
  h3Title: "Ton personnage, fidèle à lui-même dans chaque plan.",
  h3Body: "Donne un nom et quelques images. MiniMax H3 garde le visage, le costume et le lieu d’un plan à l’autre.",
  h3: [
    { ...en.h3[0]!, name: "Vidéo fidèle aux références", body: "Personnages et lieu tenus", cost: "≈ 4–6 cr. est." },
    { ...en.h3[1]!, name: "Keyframes fidèles", body: "Part d’une image, arrive sur une autre, avec le son", cost: "≈ 14 cr. est." },
    { ...en.h3[2]!, name: "Fidèle au lieu · FastH3", body: "Ton personnage dans ton décor, décor tenu", cost: "≈ 8–12 cr. est." },
    { ...en.h3[3]!, name: "Animer et prolonger", body: "Donne vie à une image, puis continue le plan", cost: "≈ 4–10 cr. est." },
    { ...en.h3[4]!, name: "Échange de personnage · Higgsfield Genjutsu", body: "Filme quelqu’un, joue ton personnage — mouvement, caméra et timing gardés. Nœud partenaire, signalé comme tel.", cost: "≈ 480 cr. est. / 5 s 480p" },
  ],
  onlyTitle: "Des outils de tournage, dans ton navigateur.",
  onlyLead: "Ils tournent avant tout rendu. Le rendu ne vient qu’après, avec son devis, quand tu confirmes.",
  scoutTitle: "Repère un vrai lieu, n’importe où.",
  scoutBody: "Écris une ville ou une adresse : ça se construit en 3D depuis OpenStreetMap — vrais toits en Suisse. Choisis l’heure, capture ton cadre.",
  scoutLink: "Repérer un lieu",
  uttuTitle: "Uttu connaît chaque outil.",
  uttuBody: "Elle sait ce que fait chaque outil et ce qu’il coûte, et propose l’étape suivante. Tu lances. Fermée tant que tu ne l’appelles pas ; elle ne couvre jamais ton travail.",
  uttuCost: "≈ 0,2 crédit estimé par message au plus",
  uttuLink: "Comment Uttu aide · Guide",
  swBody: "Ton histoire, tissée plan par plan : parler avec Uttu, un panneau par personnage, lieu et scène, et une timeline à quatre pistes.",
  swLink: "Voir ce qui arrive",
  modelsTitle: "Les modèles vraiment dans le studio.",
  modelsLead: "Chaque outil nomme son modèle. Les poids ouverts tournent ici ; les modèles partenaires passent par un nœud partenaire payant et sont toujours étiquetés.",
  openTitle: "Poids ouverts",
  openWhy: "Tournent avec des poids publiés.",
  openOn: "Actifs dans le studio",
  partnerTitle: "Modèles partenaires",
  partnerWhy: "Via des nœuds partenaires, sur les crédits de ton compte.",
  partnerHidden: "Cachés dans la version publique d’aujourd’hui.",
  partnerOn: "Actifs dans cette version.",
  openList: [
    { k: "Image", v: en.openList[0]!.v },
    { k: "Vidéo", v: en.openList[1]!.v },
    { k: "Anime", v: en.openList[2]!.v },
    { k: "Finition", v: "SeedVR2, interpolation d’images, BiRefNet" },
    { k: "3D", v: "TRELLIS.2 · plus 2 outils 3D dans le navigateur (maquette 3D et cadrage, repérage), sans modèle" },
    { k: "Son", v: en.openList[5]!.v },
    { k: "Agent", v: en.openList[6]!.v },
    { k: "Compte", v: "31 des 44 outils tournent par défaut sur un modèle à poids ouverts, 11 sont uniquement partenaires, 2 sont des outils 3D du navigateur. La version publique d’aujourd’hui montre les 33 sans partenaires." },
  ],
  partnerMore: "Partenaires son, vidéo et 3D : ElevenLabs, Sync, Sonilo, Mirelo, VEED, Bria · Hunyuan3D, Meshy, Tripo.",
  licenceNote: "Poids ouverts ne veut pas dire open source. Certaines licences limitent l’usage : FLUX.2 Klein 9B et Qwen-Image 2.1 sont non commerciaux ; FLUX.3 Klein (Kommunity) et LTX-2.x (Community) n’autorisent l’usage commercial que sous un plafond de revenus ; Stable Audio 3 demande « Powered by Stability AI » ; la licence MiniMax H3 Community exclut l’UE, le Royaume-Uni, les États-Unis et la Corée du Sud. Vérifie la licence avant tout usage commercial.",
  partnerSwapHidden: "Outil partenaire, caché dans la version publique d’aujourd’hui.",
  costsTitle: "Un devis avant chaque crédit.",
  costsLead: "Chaque bouton payant montre « ≈ X crédits estimés » et attend ton accord. Les rendus tournent sur ton propre compte.",
  costs: [
    { label: "Une image de personnage", price: "≈ 4–6 crédits estimés" },
    { label: "Un plan fidèle · MiniMax H3", price: "≈ 4–6 crédits estimés" },
    { label: "Un plan anime, 5 s", price: "≈ 16 crédits estimés" },
    { label: "Finaliser une prise de 5 s", price: "≈ 42–63 crédits estimés" },
  ],
  costsLink: "Tous les prix, dans le guide",
  endTitle: "Entre, et tourne ton premier plan.",
  trust: ["Open source, licence MIT", "Ton propre compte, aucune clé gardée chez nous", "Rien ne part sans ton accord"],
  soonWord: "Bientôt",
});

const de = tr(en, {
  readGuide: "Guide lesen",
  heroLead: "Besetze deine Figuren, baue deine Kulissen, drehe, schneide und finalisiere deinen Film — auf deinem eigenen Konto, mit einem Angebot vor jedem Credit.",
  stepsTitle: "Fünf Schritte, eine Leiste.",
  stepsLead: "Dieselben fünf Schritte wie oben im Studio, in derselben Reihenfolge.",
  steps: [
    { ...en.steps[0]!, name: "Besetzung", body: "Deine Figuren, dasselbe Gesicht in jeder Einstellung.", go: "Besetzung öffnen" },
    { ...en.steps[1]!, name: "Kulisse", body: "Ein Ort aus Text, Foto oder einem echten Platz.", go: "Kulisse öffnen" },
    { ...en.steps[2]!, name: "Take", body: "Figur in die Kulisse setzen, kadrieren, dann rendern.", go: "Take öffnen" },
    { ...en.steps[3]!, name: "Schnitt", body: "Video, Stimme, Musik und Text auf vier Spuren. MP4-Export im Browser — kein Rendering.", go: "Schnitt öffnen", alt: "Die Schnitt-Timeline: vier Einstellungen auf einer Spur, die zweite ausgewählt" },
    { ...en.steps[4]!, name: "Finalisieren", body: "Schärfer und größer. Nichts wird neu erzeugt.", go: "Finalisieren öffnen" },
  ],
  animeTitle: "Deine Geschichte als theatralisches Anime.",
  animeBody: "Gemalte Hintergründe, Cel-Shading mit Rim Light, eine echte 3D-Kamera, derselbe Look in jeder Einstellung. Einmal für das ganze Projekt gewählt — die Wahl startet kein Rendering.",
  animeCost: "≈ 16 Credits geschätzt je 5-s-Einstellung · ein Film mit 3 Einstellungen ≈ 70 Credits geschätzt, vor dem Start noch einmal angeboten",
  animeLook: "Look wählen",
  animeBible: "Look-Bibel ansehen",
  h3Title: "Deine Figur, in jeder Einstellung dieselbe.",
  uttuTitle: "Uttu kennt jedes Werkzeug.",
  uttuCost: "≈ 0,2 Credits geschätzt je Nachricht höchstens",
  uttuLink: "Wie Uttu hilft · Guide",
  swLink: "Was kommt",
  modelsTitle: "Die Modelle, die wirklich im Studio sind.",
  openTitle: "Offene Gewichte",
  openOn: "Im Studio an",
  partnerTitle: "Partner-Modelle",
  partnerHidden: "In der heutigen öffentlichen Version verborgen.",
  partnerOn: "In dieser Version an.",
  licenceNote: "Offene Gewichte heißt nicht Open Source. Manche Lizenzen begrenzen die Nutzung: FLUX.2 Klein 9B und Qwen-Image 2.1 sind nicht kommerziell; FLUX.3 Klein (Kommunity) und LTX-2.x (Community) erlauben kommerzielle Nutzung nur unter einer Umsatzgrenze; Stable Audio 3 verlangt „Powered by Stability AI“; die MiniMax-H3-Community-Lizenz schließt EU, UK, USA und Südkorea aus. Prüfe die Lizenz vor jeder kommerziellen Nutzung.",
  partnerSwapHidden: "Partner-Werkzeug, in der heutigen öffentlichen Version verborgen.",
  costsTitle: "Ein Angebot vor jedem Credit.",
  costsLead: "Jeder bezahlte Knopf zeigt „≈ X Credits geschätzt“ und wartet auf dein OK.",
  costs: en.costs.map(row => ({ ...row, price: row.price.replace("credits estimated", "Credits geschätzt") })),
  costsLink: "Jeder Preis, im Guide",
  endTitle: "Komm rein und dreh deine erste Einstellung.",
  trust: ["Open Source, MIT-Lizenz", "Dein eigenes Konto, kein Schlüssel bei uns", "Nichts läuft ohne dein OK"],
  soonWord: "Bald",
});

const es = tr(en, {
  readGuide: "Leer la guía",
  heroLead: "Reparte tus personajes, construye tus decorados, rueda, monta y termina tu película — en tu propia cuenta, con un presupuesto antes de cada crédito.",
  stepsTitle: "Cinco pasos, una barra.",
  stepsLead: "Los mismos cinco pasos de la barra del estudio, en el mismo orden.",
  steps: [
    { ...en.steps[0]!, name: "Reparto", body: "Tus personajes, la misma cara en cada plano.", go: "Abrir Reparto" },
    { ...en.steps[1]!, name: "Decorado", body: "Un lugar desde un texto, una foto o un sitio real.", go: "Abrir Decorado" },
    { ...en.steps[2]!, name: "Toma", body: "Pon el personaje en el decorado, encuadra y luego renderiza.", go: "Abrir Toma" },
    { ...en.steps[3]!, name: "Montaje", body: "Vídeo, voz, música y texto en cuatro pistas. Exportación MP4 en tu navegador — sin render.", go: "Abrir Montaje", alt: "La línea de tiempo del Montaje: cuatro planos en una pista, el segundo seleccionado" },
    { ...en.steps[4]!, name: "Finalizar", body: "Más nítido y más grande. Nada se regenera.", go: "Abrir Finalizar" },
  ],
  animeTitle: "Tu historia, como un anime teatral.",
  animeBody: "Fondos pintados, cel shading con rim light, una cámara 3D real, el mismo look en cada plano. Elegido una vez para todo el proyecto — elegir no lanza ningún render.",
  animeCost: "≈ 16 créditos estimados por plano de 5 s · una película de 3 planos ≈ 70 créditos estimados, presupuestados otra vez antes de que nada corra",
  animeLook: "Elegir el look",
  animeBible: "Ver la biblia del look",
  h3Title: "Tu personaje, fiel a sí mismo en cada plano.",
  uttuTitle: "Uttu conoce cada herramienta.",
  uttuCost: "≈ 0,2 créditos estimados por mensaje como máximo",
  uttuLink: "Cómo ayuda Uttu · Guía",
  swLink: "Ver lo que viene",
  modelsTitle: "Los modelos que de verdad están en el estudio.",
  openTitle: "Pesos abiertos",
  openOn: "Activos en el estudio",
  partnerTitle: "Modelos de partner",
  partnerHidden: "Ocultos en la versión pública de hoy.",
  partnerOn: "Activos en esta versión.",
  licenceNote: "Pesos abiertos no es lo mismo que código abierto. Algunas licencias limitan el uso: FLUX.2 Klein 9B y Qwen-Image 2.1 no son comerciales; FLUX.3 Klein (Kommunity) y LTX-2.x (Community) solo permiten uso comercial por debajo de un tope de ingresos; Stable Audio 3 exige «Powered by Stability AI»; la licencia MiniMax H3 Community excluye la UE, el Reino Unido, EE. UU. y Corea del Sur. Revisa la licencia antes de cualquier uso comercial.",
  partnerSwapHidden: "Herramienta de partner, oculta en la versión pública de hoy.",
  costsTitle: "Un presupuesto antes de cada crédito.",
  costsLead: "Cada botón de pago muestra «≈ X créditos estimados» y espera tu OK.",
  costs: en.costs.map(row => ({ ...row, price: row.price.replace("credits estimated", "créditos estimados") })),
  costsLink: "Cada precio, en la guía",
  endTitle: "Entra y rueda tu primer plano.",
  trust: ["Código abierto, licencia MIT", "Tu propia cuenta, ninguna clave guardada por nosotros", "Nada corre sin tu OK"],
  soonWord: "Pronto",
});

export const LANDING: Record<LandingLocale, LandingCopy> = { en, fr, de, es };

export function landingCopy(locale: string): LandingCopy {
  return LANDING[(locale as LandingLocale)] ?? en;
}
