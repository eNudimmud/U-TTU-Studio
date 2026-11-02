// Look page copy. English is the default. Costs stay estimates in every language.

import type { Locale } from "../i18n/config.ts";
import type { AnimePresetId } from "./model.ts";

export interface LookCopy {
  crumbFallback: string;
  boards: string;
  tabs: { storyboard: string; cast: string; places: string; shots: string; look: string };
  badge: string;
  caption: string;
  kicker: string;
  title: string;
  lede: string;
  start: string;
  how: string;
  promises: [string, string, string, string];
  heroAlt: string;
  step1Kicker: string;
  step1Title: string;
  step1Lead: string;
  selected: string;
  presets: Record<AnimePresetId, { title: string; line: string }>;
  own: string;
  ownHint: string;
  ownNeed: string;
  step2Kicker: string;
  step2Title: string;
  step2Lead: string;
  guideKicker: string;
  guideAlt: string;
  guideBody: string;
  steps: { title: string; body: string; cost: string }[];
  modelsSummary: string;
  modelsHead: [string, string, string];
  models: [string, string, string][];
  reelKicker: string;
  reelTitle: string;
  reelLead: string;
  shots: { title: string; move: string }[];
  ready: string;
  finalTitle: string;
  finalNote: string;
  use: string;
  keep: string;
  saved: string;
}

const en: LookCopy = {
  crumbFallback: "This project",
  boards: "My boards",
  tabs: { storyboard: "Storyboard", cast: "Cast", places: "Places", shots: "Shots", look: "Look" },
  badge: "Anime 2.5D",
  caption: "Concept art — your project is rendered on Comfy with the open anime pipeline",
  kicker: "Project look · Anime 2.5D",
  title: "Your story,\nas a *theatrical anime*.",
  lede: "Painted worlds with real depth, cel-shaded characters lit by the sun, and a camera that moves like in the films you love. Uttu guides you, one picture at a time.",
  start: "Start my anime film",
  how: "See how it's made",
  promises: ["Painted backgrounds", "Cel shading + rim light", "Real 3D camera", "Same look in every shot"],
  heroAlt: "A figure in a crimson scarf on a cliff above a painted valley of lanterns at golden hour",
  step1Kicker: "Step 1 · Pick your style",
  step1Title: "Where should your story *live*?",
  step1Lead: "Each style sets the line, the colours and the light. Choosing costs nothing — you can fine-tune it after.",
  selected: "Selected",
  presets: {
    theatrical: { title: "Theatrical painterly", line: "Sunbeams, gouache skies, big emotions" },
    neon: { title: "Neon night", line: "Rain, reflections, electric rim light" },
    daylight: { title: "Summer daylight", line: "Clouds, sea breeze, quiet moments" },
    darkfantasy: { title: "Dark fantasy", line: "Moonlight, embers, epic scale" },
  },
  own: "＋ Use my own reference",
  ownHint: "Upload 1–2 frames you love, Uttu matches their look.",
  ownNeed: "Add 1 or 2 pictures first. Nothing is uploaded yet.",
  step2Kicker: "Step 2 · How Uttu builds it",
  step2Title: "From one frame to a *finished film*",
  step2Lead: "Five clear steps. Each price is an estimate, shown again before you approve — nothing starts without your yes.",
  guideKicker: "Uttu · your guide",
  guideAlt: "Uttu, your guide",
  guideBody: "I keep the line, the colours and the light identical from the first sketch to the last frame. You tell the story, I keep it beautiful.",
  steps: [
    { title: "Style frame", body: "One key picture that locks the line, palette and light for the whole project.", cost: "≈ 3 credits estimated" },
    { title: "Characters", body: "A turnaround sheet for each person in Cast — front, ¾, side, back.", cost: "≈ 4 credits estimated / sheet" },
    { title: "Places", body: "Painted backgrounds with layers of depth, made for camera moves.", cost: "≈ 3 credits estimated / place" },
    { title: "Shots", body: "Characters placed in their world, then animated: anime acting up close, a 3D camera for wide shots.", cost: "≈ 16 credits estimated / 5 s" },
    { title: "Finish", body: "Sharper lines and HD, on the same frames. Nothing is redrawn.", cost: "≈ 3 credits estimated / 5 s" },
  ],
  modelsSummary: "Made with open models (for the curious)",
  modelsHead: ["Step", "Model", "Licence"],
  models: [
    ["Style frame, places", "Krea 2 Turbo · style reference", "Krea 2 Community"],
    ["Characters, first frame", "Qwen Image 2.1 edit", "open weights"],
    ["Shots · acting", "Wan 2.2 + AniSora 3.2", "Apache 2.0"],
    ["Shots · 3D camera", "LTX-2.5", "LTX-2 Community"],
    ["Finish", "Real-ESRGAN anime · SeedVR2", "BSD · Apache 2.0"],
  ],
  reelKicker: "Where you're headed",
  reelTitle: "Three shots in, it *feels* like a film",
  reelLead: "Same light, two places — wide, medium, close.",
  shots: [
    { title: "Wide shot", move: "3D camera · slow crane" },
    { title: "Medium shot", move: "anime acting" },
    { title: "Close-up", move: "anime acting" },
  ],
  ready: "Ready",
  finalTitle: "Light the first *lantern*.",
  finalNote: "Choosing the look is free. A 3-shot film like the one above is about ≈ 70 credits estimated, shown again before anything is made.",
  use: "Use Anime 2.5D for this project",
  keep: "Keep my current look",
  saved: "The look is saved for this project. Nothing was sent.",
};

const fr: LookCopy = {
  ...en,
  crumbFallback: "Ce projet",
  boards: "Mes storyboards",
  tabs: { storyboard: "Storyboard", cast: "Cast", places: "Lieux", shots: "Plans", look: "Look" },
  caption: "Concept art — ton projet est rendu sur Comfy avec le pipeline anime ouvert",
  kicker: "Look du projet · Anime 2.5D",
  title: "Ton histoire,\ncomme un *anime théâtral*.",
  lede: "Des mondes peints avec de la profondeur, des personnages en cel-shading éclairés par le soleil, et une caméra qui bouge comme dans les films que tu aimes. Uttu te guide, une image à la fois.",
  start: "Commencer mon film anime",
  how: "Voir comment c'est fait",
  promises: ["Fonds peints", "Cel-shading + rim light", "Vraie caméra 3D", "Le même look à chaque plan"],
  heroAlt: "Une figure au foulard pourpre sur une falaise, au-dessus d'une vallée peinte de lanternes",
  step1Kicker: "Étape 1 · Choisis ton style",
  step1Title: "Où ton histoire doit-elle *vivre* ?",
  step1Lead: "Chaque style fixe le trait, les couleurs et la lumière. Choisir ne lance aucun rendu — tu pourras ajuster ensuite.",
  selected: "Choisi",
  presets: {
    theatrical: { title: "Théâtral peint", line: "Rayons, ciels gouache, grandes émotions" },
    neon: { title: "Nuit néon", line: "Pluie, reflets, rim light électrique" },
    daylight: { title: "Jour d'été", line: "Nuages, brise, moments calmes" },
    darkfantasy: { title: "Dark fantasy", line: "Lune, braises, échelle épique" },
  },
  own: "＋ Utiliser ma référence",
  ownHint: "Ajoute 1 ou 2 images que tu aimes. Uttu en reprend le look.",
  ownNeed: "Ajoute d'abord 1 ou 2 images. Rien n'est envoyé.",
  step2Kicker: "Étape 2 · Comment Uttu le construit",
  step2Title: "D'une image à un *film fini*",
  step2Lead: "Cinq étapes claires. Chaque prix est une estimation, montrée de nouveau avant ton accord — rien ne part sans ton oui.",
  guideKicker: "Uttu · ton guide",
  guideAlt: "Uttu, ton guide",
  guideBody: "Je garde le trait, les couleurs et la lumière identiques, du premier croquis à la dernière image. Tu racontes, je veille à ce que ce soit beau.",
  steps: [
    { title: "Cadre de style", body: "Une image qui fixe le trait, la palette et la lumière pour tout le projet.", cost: "≈ 3 crédits estimés" },
    { title: "Personnages", body: "Une planche pour chaque personne du Cast — face, ¾, profil, dos.", cost: "≈ 4 crédits estimés / planche" },
    { title: "Lieux", body: "Des fonds peints en couches, prêts pour les mouvements de caméra.", cost: "≈ 3 crédits estimés / lieu" },
    { title: "Plans", body: "Les personnages dans leur monde, puis animés : jeu anime de près, caméra 3D pour les plans larges.", cost: "≈ 16 crédits estimés / 5 s" },
    { title: "Finition", body: "Des traits plus nets, en HD, sur les mêmes images. Rien n'est redessiné.", cost: "≈ 3 crédits estimés / 5 s" },
  ],
  modelsSummary: "Fait avec des modèles ouverts (pour les curieux)",
  modelsHead: ["Étape", "Modèle", "Licence"],
  reelKicker: "Là où tu vas",
  reelTitle: "Au bout de trois plans, ça *fait* film",
  reelLead: "La même lumière — large, moyen, gros plan.",
  shots: [
    { title: "Plan large", move: "Caméra 3D · grue lente" },
    { title: "Plan moyen", move: "jeu anime" },
    { title: "Gros plan", move: "jeu anime" },
  ],
  ready: "Prêt",
  finalTitle: "Allume la première *lanterne*.",
  finalNote: "Choisir le look ne lance aucun rendu. Un film de 3 plans comme celui-ci revient à ≈ 70 crédits estimés, indiqués de nouveau avant toute création.",
  use: "Utiliser Anime 2.5D pour ce projet",
  keep: "Garder mon look actuel",
  saved: "Le look est enregistré pour ce projet. Rien n'a été envoyé.",
};

const de: LookCopy = {
  ...en,
  crumbFallback: "Dieses Projekt",
  boards: "Meine Boards",
  tabs: { storyboard: "Storyboard", cast: "Cast", places: "Orte", shots: "Einstellungen", look: "Look" },
  caption: "Concept Art — dein Projekt wird auf Comfy mit der offenen Anime-Pipeline gerendert",
  kicker: "Projekt-Look · Anime 2.5D",
  title: "Deine Geschichte,\nals *theatralisches Anime*.",
  lede: "Gemalte Welten mit echter Tiefe, Cel-Shading im Sonnenlicht und eine Kamera, die sich bewegt wie in den Filmen, die du liebst. Uttu führt dich, Bild für Bild.",
  start: "Meinen Anime-Film beginnen",
  how: "So entsteht er",
  promises: ["Gemalte Hintergründe", "Cel-Shading + Rim Light", "Echte 3D-Kamera", "Derselbe Look in jeder Einstellung"],
  heroAlt: "Eine Figur mit rotem Schal auf einer Klippe über einem gemalten Tal voller Laternen",
  step1Kicker: "Schritt 1 · Wähle den Stil",
  step1Title: "Wo soll deine Geschichte *leben*?",
  step1Lead: "Jeder Stil setzt Linie, Farben und Licht. Die Wahl startet kein Rendering — du kannst danach feinjustieren.",
  selected: "Gewählt",
  presets: {
    theatrical: { title: "Theatralisch malerisch", line: "Sonnenstrahlen, Gouache-Himmel, große Gefühle" },
    neon: { title: "Neonnacht", line: "Regen, Spiegelungen, elektrisches Rim Light" },
    daylight: { title: "Sommerlicht", line: "Wolken, Meeresbrise, stille Momente" },
    darkfantasy: { title: "Dark Fantasy", line: "Mondlicht, Glut, epische Weite" },
  },
  own: "＋ Eigene Referenz nutzen",
  ownHint: "Lade 1–2 Bilder hoch, die du liebst. Uttu übernimmt ihren Look.",
  ownNeed: "Füge zuerst 1 oder 2 Bilder hinzu. Es wird noch nichts hochgeladen.",
  step2Kicker: "Schritt 2 · Wie Uttu ihn baut",
  step2Title: "Von einem Bild zum *fertigen Film*",
  step2Lead: "Fünf klare Schritte. Jeder Preis ist eine Schätzung und steht vor deiner Zustimmung — ohne dein Ja startet nichts.",
  guideKicker: "Uttu · deine Begleitung",
  guideAlt: "Uttu, deine Begleitung",
  guideBody: "Ich halte Linie, Farben und Licht vom ersten Entwurf bis zum letzten Bild gleich. Du erzählst, ich halte es schön.",
  steps: [
    { title: "Stilbild", body: "Ein Bild, das Linie, Palette und Licht für das ganze Projekt festlegt.", cost: "≈ 3 Credits geschätzt" },
    { title: "Figuren", body: "Ein Drehblatt für jede Person im Cast — vorne, ¾, Seite, hinten.", cost: "≈ 4 Credits geschätzt / Blatt" },
    { title: "Orte", body: "Gemalte Hintergründe in Tiefenstaffeln, gemacht für Kamerafahrten.", cost: "≈ 3 Credits geschätzt / Ort" },
    { title: "Einstellungen", body: "Figuren in ihrer Welt, dann animiert: Anime-Spiel in der Nähe, 3D-Kamera für weite Einstellungen.", cost: "≈ 16 Credits geschätzt / 5 s" },
    { title: "Finish", body: "Schärfere Linien und HD, auf denselben Bildern. Nichts wird neu gezeichnet.", cost: "≈ 3 Credits geschätzt / 5 s" },
  ],
  modelsSummary: "Mit offenen Modellen (für Neugierige)",
  modelsHead: ["Schritt", "Modell", "Lizenz"],
  reelKicker: "Wohin es geht",
  reelTitle: "Nach drei Einstellungen *fühlt* es sich an wie ein Film",
  reelLead: "Dasselbe Licht — weit, mittel, nah.",
  shots: [
    { title: "Weite Einstellung", move: "3D-Kamera · langsamer Kran" },
    { title: "Halbtotale", move: "Anime-Spiel" },
    { title: "Nahaufnahme", move: "Anime-Spiel" },
  ],
  ready: "Bereit",
  finalTitle: "Zünde die erste *Laterne*.",
  finalNote: "Den Look zu wählen startet kein Rendering. Ein Film mit 3 Einstellungen wie oben liegt bei ≈ 70 Credits geschätzt, noch einmal gezeigt, bevor etwas entsteht.",
  use: "Anime 2.5D für dieses Projekt nutzen",
  keep: "Meinen Look behalten",
  saved: "Der Look ist für dieses Projekt gespeichert. Es wurde nichts gesendet.",
};

const es: LookCopy = {
  ...en,
  crumbFallback: "Este proyecto",
  boards: "Mis tableros",
  tabs: { storyboard: "Storyboard", cast: "Reparto", places: "Lugares", shots: "Planos", look: "Look" },
  caption: "Arte conceptual — tu proyecto se renderiza en Comfy con el pipeline de anime abierto",
  kicker: "Look del proyecto · Anime 2.5D",
  title: "Tu historia,\ncomo un *anime teatral*.",
  lede: "Mundos pintados con profundidad real, personajes en cel shading iluminados por el sol y una cámara que se mueve como en las películas que te gustan. Uttu te guía, una imagen cada vez.",
  start: "Empezar mi película anime",
  how: "Ver cómo se hace",
  promises: ["Fondos pintados", "Cel shading + luz de contorno", "Cámara 3D real", "El mismo look en cada plano"],
  heroAlt: "Una figura con una bufanda carmesí en un acantilado, sobre un valle pintado de faroles",
  step1Kicker: "Paso 1 · Elige el estilo",
  step1Title: "¿Dónde debe *vivir* tu historia?",
  step1Lead: "Cada estilo fija el trazo, los colores y la luz. Elegir no lanza ningún render — podrás ajustarlo después.",
  selected: "Elegido",
  presets: {
    theatrical: { title: "Teatral pictórico", line: "Rayos, cielos al gouache, grandes emociones" },
    neon: { title: "Noche neón", line: "Lluvia, reflejos, luz de contorno eléctrica" },
    daylight: { title: "Luz de verano", line: "Nubes, brisa, momentos en calma" },
    darkfantasy: { title: "Fantasía oscura", line: "Luz de luna, brasas, escala épica" },
  },
  own: "＋ Usar mi referencia",
  ownHint: "Sube 1 o 2 imágenes que te gusten. Uttu copia su look.",
  ownNeed: "Añade primero 1 o 2 imágenes. Aún no se envía nada.",
  step2Kicker: "Paso 2 · Cómo lo construye Uttu",
  step2Title: "De un fotograma a una *película terminada*",
  step2Lead: "Cinco pasos claros. Cada precio es una estimación y se muestra otra vez antes de tu sí — no empieza nada sin él.",
  guideKicker: "Uttu · tu guía",
  guideAlt: "Uttu, tu guía",
  guideBody: "Mantengo el trazo, los colores y la luz iguales desde el primer boceto hasta el último fotograma. Tú cuentas la historia, yo la cuido.",
  steps: [
    { title: "Fotograma de estilo", body: "Una imagen que fija el trazo, la paleta y la luz de todo el proyecto.", cost: "≈ 3 créditos estimados" },
    { title: "Personajes", body: "Una hoja de vueltas para cada persona del reparto — frente, ¾, perfil, espalda.", cost: "≈ 4 créditos estimados / hoja" },
    { title: "Lugares", body: "Fondos pintados en capas de profundidad, hechos para mover la cámara.", cost: "≈ 3 créditos estimados / lugar" },
    { title: "Planos", body: "Los personajes en su mundo, y luego animados: actuación anime de cerca, cámara 3D en los planos abiertos.", cost: "≈ 16 créditos estimados / 5 s" },
    { title: "Acabado", body: "Trazos más nítidos y HD, sobre los mismos fotogramas. No se redibuja nada.", cost: "≈ 3 créditos estimados / 5 s" },
  ],
  modelsSummary: "Hecho con modelos abiertos (para quien tenga curiosidad)",
  modelsHead: ["Paso", "Modelo", "Licencia"],
  reelKicker: "Hacia dónde vas",
  reelTitle: "A los tres planos, *se siente* como una película",
  reelLead: "La misma luz — abierto, medio, primer plano.",
  shots: [
    { title: "Plano abierto", move: "Cámara 3D · grúa lenta" },
    { title: "Plano medio", move: "actuación anime" },
    { title: "Primer plano", move: "actuación anime" },
  ],
  ready: "Listo",
  finalTitle: "Enciende el primer *farol*.",
  finalNote: "Elegir el look no lanza ningún render. Una película de 3 planos como la de arriba sale a ≈ 70 créditos estimados, mostrados de nuevo antes de crear nada.",
  use: "Usar Anime 2.5D en este proyecto",
  keep: "Mantener mi look actual",
  saved: "El look quedó guardado en este proyecto. No se envió nada.",
};

export const LOOK_COPY: Record<Locale, LookCopy> = { en, fr, de, es };

export function lookCopy(locale: Locale): LookCopy {
  return LOOK_COPY[locale] ?? en;
}
