// Cinema prompting guide (/guide/cgi). English is the source; FR, DE and ES follow it.
// Cinematography terms are proper terms of the craft, not English words to translate: they stay
// identical in every locale (anamorphic 2.39:1, rack focus, golden hour…). Only the surrounding
// gloss and the tool tips are localised.

export type CgiGuideLocale = "en" | "fr" | "de" | "es";

export interface GlossaryTerm {
  /** Kept identical in every locale. */
  term: string;
  gloss: string;
}

export interface ToolPrompting {
  name: string;
  tip: string;
  good: string;
  bad: string;
  badWhy: string;
}

export interface CgiGuideCopy {
  kicker: string;
  title: string;
  titleEm: string;
  lede: string;
  backLink: string;
  glossaryTitle: string;
  glossaryLede: string;
  glossary: GlossaryTerm[];
  toolsTitle: string;
  toolsLede: string;
  tools: ToolPrompting[];
  goodLabel: string;
  badLabel: string;
}

const en: CgiGuideCopy = {
  kicker: "Guide · Cinema",
  title: "Prompt it",
  titleEm: "like a cinematographer",
  lede: "Precise terms beat adjectives. Name the lens, the light and the move; skip \u201ccinematic\u201d, \u201c8k\u201d and \u201cbest quality\u201d, which no model reads as an instruction.",
  backLink: "Open the Cinema section",
  glossaryTitle: "A shared vocabulary",
  glossaryLede: "These terms stay in English in every language here \u2014 they are the craft's own words, not an English sentence to translate.",
  glossary: [
    { term: "anamorphic 2.39:1", gloss: "a wide, letterboxed frame with oval bokeh and horizontal lens flares." },
    { term: "35mm / 50mm / 85mm", gloss: "the focal length: wider and more environment at 35mm, a tighter, flatter face at 85mm." },
    { term: "shallow depth of field", gloss: "a thin plane in focus, the rest soft \u2014 ask for it by name, not by \u201cblur\u201d." },
    { term: "key light / fill light", gloss: "the main light that shapes the face, and the softer one that lifts the shadow it leaves." },
    { term: "rim light", gloss: "a thin edge of light around the hair or shoulder, separating the subject from the background." },
    { term: "practical lighting", gloss: "light that appears to come from a lamp, a window or a sign already in the shot, not a studio rig." },
    { term: "golden hour", gloss: "the low, warm, soft light just after sunrise or before sunset." },
    { term: "Rembrandt lighting", gloss: "a 45\u00b0 key light leaving a small triangle of light on the shadowed cheek." },
    { term: "dolly in / dolly out", gloss: "the camera moves straight toward or away from the subject, the lens does not zoom." },
    { term: "rack focus", gloss: "focus shifts from one plane to another during the shot, not a cut." },
    { term: "film grain", gloss: "fine photographic texture across the image, the opposite of a clean digital surface." },
    { term: "ACES", gloss: "a wide, filmic colour space \u2014 ask for it when a shot should read as colour-graded footage, not a flat render." },
    { term: "teal-and-orange grade", gloss: "cool blue-green shadows against warm orange skin tones, a common feature-film grade." },
  ],
  toolsTitle: "Six tools, in their own words",
  toolsLede: "What each model reads well, with one prompt that keeps a shot and one that drifts.",
  tools: [
    {
      name: "FLUX.3 Klein \u2014 Cast, Set",
      tip: "One dense sentence: subject, wardrobe or set dressing, light, lens, grade. Order roughly follows what the model weighs first.",
      good: "Woman in her thirties, short braided hair, worn leather jacket, rain-lit alley, neon signage reflected in puddles, 35mm, shallow depth of field, teal-and-orange grade, film grain.",
      bad: "a cool photo of a woman, 8k, best quality, trending, cinematic",
      badWhy: "\u201c8k\u201d, \u201cbest quality\u201d and \u201ccinematic\u201d name no light, lens or colour \u2014 the model has nothing concrete to place.",
    },
    {
      name: "MiniMax H3 \u2014 reference video (Shoot)",
      tip: "Describe the action and the light in your two reference pictures, not a new scene: H3 keeps the character and the place, your sentence drives the motion.",
      good: "She crosses the room to the window, soft practical lighting from the desk lamp, slow dolly in, handheld sway, footsteps audible on wood.",
      bad: "she does something cool and cinematic, epic music, amazing shot",
      badWhy: "No named move, no named light: the model falls back to its own guess at \u201ccool\u201d.",
    },
    {
      name: "LTX-2.5 \u2014 camera moves (Shoot)",
      tip: "Name one camera move and one light condition per shot; stacking three moves confuses which one leads.",
      good: "Slow dolly in toward her face, rack focus from the foreground candle to her eyes, golden hour light through the window, anamorphic 2.39:1.",
      bad: "zoom in fast, epic reveal, super dramatic, 4k",
      badWhy: "\u201cZoom\u201d is a lens move, not a camera move \u2014 LTX-2.5 reads \u201cdolly\u201d, \u201cpan\u201d, \u201ccrane\u201d and \u201corbit\u201d, not \u201czoom\u201d.",
    },
    {
      name: "Qwen-Edit 2511 \u2014 turnaround (Cast)",
      tip: "Ask for a view, not a new look: repeat the outfit and the light so only the angle changes.",
      good: "Same outfit, same key light from camera left, three-quarter view, then profile, then a close-up on the face.",
      bad: "different angle, cool pose, maybe change the jacket",
      badWhy: "\u201cMaybe change\u201d opens the outfit to drift; a turnaround only works if everything but the angle is pinned down.",
    },
    {
      name: "Wan Animate 2 \u2014 motion control (Shoot)",
      tip: "Name the exact motion in the reference clip; a vague verb lets the model blend it with something else.",
      good: "Mirrors the reference clip's walk cycle exactly, weight shift on each step, same framing, no camera move.",
      bad: "make her move like the video, add some energy and flair",
      badWhy: "\u201cEnergy and flair\u201d is not a motion \u2014 the model has no walk cycle, gesture or weight shift to copy.",
    },
    {
      name: "SeedVR2 \u2014 Finish",
      tip: "Finish never redraws: ask for resolution and texture, never for a new detail, a new expression or a fixed mistake.",
      good: "Upscale to native resolution, keep the film grain and the skin texture, no smoothing.",
      bad: "make it look better, add more detail, fix her hand",
      badWhy: "\u201cFix her hand\u201d asks for a redraw \u2014 Finish only sharpens the kept take; a real fix means a new take upstream.",
    },
  ],
  goodLabel: "Good",
  badLabel: "Drifts",
};

const fr: CgiGuideCopy = {
  ...en,
  kicker: "Guide \u00b7 Cin\u00e9ma",
  title: "Prompte en",
  titleEm: "cin\u00e9aste",
  lede: "Les termes pr\u00e9cis gagnent sur les adjectifs. Nomme l'objectif, la lumi\u00e8re et le mouvement ; laisse de c\u00f4t\u00e9 \u00ab cin\u00e9matique \u00bb, \u00ab 8k \u00bb et \u00ab best quality \u00bb, qu'aucun mod\u00e8le ne lit comme une instruction.",
  backLink: "Ouvrir la section Cin\u00e9ma",
  glossaryTitle: "Un vocabulaire commun",
  glossaryLede: "Ces termes restent en anglais dans chaque langue ici \u2014 ce sont les mots du m\u00e9tier, pas une phrase anglaise \u00e0 traduire.",
  glossary: [
    { term: "anamorphic 2.39:1", gloss: "un cadre large en bandes noires, avec un bokeh ovale et des reflets horizontaux d'objectif." },
    { term: "35mm / 50mm / 85mm", gloss: "la focale : plus large et plus d'environnement \u00e0 35mm, un visage plus serr\u00e9 et plus plat \u00e0 85mm." },
    { term: "shallow depth of field", gloss: "un plan de nettet\u00e9 fin, le reste flou \u2014 \u00e0 demander par son nom, pas par \u00ab flou \u00bb." },
    { term: "key light / fill light", gloss: "la lumi\u00e8re principale qui dessine le visage, et la plus douce qui adoucit l'ombre qu'elle laisse." },
    { term: "rim light", gloss: "un fin trait de lumi\u00e8re sur les cheveux ou l'\u00e9paule, qui s\u00e9pare le sujet du fond." },
    { term: "practical lighting", gloss: "une lumi\u00e8re qui semble venir d'une lampe, d'une fen\u00eatre ou d'une enseigne d\u00e9j\u00e0 dans le plan, pas d'un projecteur de studio." },
    { term: "golden hour", gloss: "la lumi\u00e8re basse, chaude et douce juste apr\u00e8s le lever ou avant le coucher du soleil." },
    { term: "Rembrandt lighting", gloss: "une lumi\u00e8re principale \u00e0 45\u00b0 qui laisse un petit triangle de lumi\u00e8re sur la joue dans l'ombre." },
    { term: "dolly in / dolly out", gloss: "la cam\u00e9ra avance ou recule tout droit vers le sujet, l'objectif ne zoome pas." },
    { term: "rack focus", gloss: "la nettet\u00e9 passe d'un plan \u00e0 un autre pendant le plan, pas par un montage." },
    { term: "film grain", gloss: "une fine texture photographique sur toute l'image, l'oppos\u00e9 d'une surface num\u00e9rique lisse." },
    { term: "ACES", gloss: "un espace couleur large et filmique \u2014 \u00e0 demander quand un plan doit lire comme un rush \u00e9talonn\u00e9, pas un rendu brut." },
    { term: "teal-and-orange grade", gloss: "des ombres bleu-vert froides contre des tons de peau orang\u00e9s chauds, un \u00e9talonnage courant au cin\u00e9ma." },
  ],
  toolsTitle: "Six outils, dans leurs propres mots",
  toolsLede: "Ce que chaque mod\u00e8le lit bien, avec un prompt qui garde un plan et un qui d\u00e9rive.",
  tools: [
    {
      name: "FLUX.3 Klein \u2014 CAST, D\u00c9COR",
      tip: "Une phrase dense : sujet, tenue ou d\u00e9cor, lumi\u00e8re, objectif, \u00e9talonnage. L'ordre suit \u00e0 peu pr\u00e8s ce que le mod\u00e8le p\u00e8se en premier.",
      good: "Femme d'une trentaine d'ann\u00e9es, cheveux courts tress\u00e9s, veste en cuir us\u00e9e, ruelle sous la pluie, enseignes n\u00e9on refl\u00e9t\u00e9es dans les flaques, 35mm, shallow depth of field, teal-and-orange grade, film grain.",
      bad: "une belle photo d'une femme, 8k, best quality, trending, cin\u00e9matique",
      badWhy: "\u00ab 8k \u00bb, \u00ab best quality \u00bb et \u00ab cin\u00e9matique \u00bb ne nomment aucune lumi\u00e8re, aucun objectif, aucune couleur \u2014 le mod\u00e8le n'a rien de concret \u00e0 placer.",
    },
    {
      name: "MiniMax H3 \u2014 vid\u00e9o par r\u00e9f\u00e9rences (PRISE)",
      tip: "D\u00e9cris l'action et la lumi\u00e8re de tes deux images de r\u00e9f\u00e9rence, pas une nouvelle sc\u00e8ne : H3 garde le personnage et le lieu, ta phrase pilote le mouvement.",
      good: "Elle traverse la pi\u00e8ce vers la fen\u00eatre, lumi\u00e8re practical douce depuis la lampe de bureau, dolly in lent, l\u00e9ger balancement \u00e0 la main, pas audibles sur le bois.",
      bad: "elle fait un truc cool et cin\u00e9matique, musique \u00e9pique, plan incroyable",
      badWhy: "Aucun mouvement nomm\u00e9, aucune lumi\u00e8re nomm\u00e9e : le mod\u00e8le retombe sur sa propre id\u00e9e de \u00ab cool \u00bb.",
    },
    {
      name: "LTX-2.5 \u2014 mouvements de cam\u00e9ra (PRISE)",
      tip: "Nomme un mouvement de cam\u00e9ra et une lumi\u00e8re par plan ; en empiler trois brouille celui qui m\u00e8ne.",
      good: "Dolly in lent vers son visage, rack focus de la bougie au premier plan vers ses yeux, lumi\u00e8re golden hour \u00e0 travers la fen\u00eatre, anamorphic 2.39:1.",
      bad: "zoom rapide, r\u00e9v\u00e9lation \u00e9pique, super dramatique, 4k",
      badWhy: "\u00ab Zoom \u00bb est un mouvement d'objectif, pas de cam\u00e9ra \u2014 LTX-2.5 lit \u00ab dolly \u00bb, \u00ab pan \u00bb, \u00ab crane \u00bb et \u00ab orbit \u00bb, pas \u00ab zoom \u00bb.",
    },
    {
      name: "Qwen-Edit 2511 \u2014 planche de face (CAST)",
      tip: "Demande une vue, pas un nouveau look : r\u00e9p\u00e8te la tenue et la lumi\u00e8re pour que seul l'angle change.",
      good: "M\u00eame tenue, m\u00eame key light depuis la gauche cam\u00e9ra, vue trois-quarts, puis profil, puis un gros plan sur le visage.",
      bad: "angle diff\u00e9rent, pose cool, peut-\u00eatre changer la veste",
      badWhy: "\u00ab Peut-\u00eatre changer \u00bb ouvre la tenue \u00e0 la d\u00e9rive ; une planche de face ne marche que si tout sauf l'angle reste fix\u00e9.",
    },
    {
      name: "Wan Animate 2 \u2014 contr\u00f4le du mouvement (PRISE)",
      tip: "Nomme le mouvement exact du clip de r\u00e9f\u00e9rence ; un verbe vague laisse le mod\u00e8le le m\u00e9langer avec autre chose.",
      good: "Reprend exactement le cycle de marche du clip de r\u00e9f\u00e9rence, transfert de poids \u00e0 chaque pas, m\u00eame cadrage, aucun mouvement de cam\u00e9ra.",
      bad: "fais-la bouger comme la vid\u00e9o, ajoute de l'\u00e9nergie et du style",
      badWhy: "\u00ab \u00c9nergie et style \u00bb n'est pas un mouvement \u2014 le mod\u00e8le n'a aucun cycle de marche, geste ou transfert de poids \u00e0 copier.",
    },
    {
      name: "SeedVR2 \u2014 FINALISER",
      tip: "Finaliser ne redessine jamais : demande une r\u00e9solution et une texture, jamais un nouveau d\u00e9tail, une nouvelle expression ou une erreur corrig\u00e9e.",
      good: "Agrandir \u00e0 la r\u00e9solution native, garder le film grain et la texture de peau, sans adoucir.",
      bad: "rendre \u00e7a plus beau, ajouter plus de d\u00e9tails, corriger sa main",
      badWhy: "\u00ab Corriger sa main \u00bb demande un redessin \u2014 Finaliser ne fait qu'accentuer la prise gard\u00e9e ; une vraie correction vient d'une nouvelle prise en amont.",
    },
  ],
  goodLabel: "R\u00e9ussi",
  badLabel: "D\u00e9rive",
};

const de: CgiGuideCopy = {
  ...en,
  kicker: "Guide \u00b7 Kino",
  title: "Promptest wie",
  titleEm: "ein Kameramann",
  lede: "Pr\u00e4zise Begriffe schlagen Adjektive. Nenne das Objektiv, das Licht und die Bewegung; \u201ecinematic\u201c, \u201e8k\u201c und \u201ebest quality\u201c liest kein Modell als Anweisung.",
  backLink: "Den Kino-Bereich \u00f6ffnen",
  glossaryTitle: "Ein gemeinsames Vokabular",
  glossaryLede: "Diese Begriffe bleiben hier in jeder Sprache auf Englisch \u2014 es sind die eigenen W\u00f6rter des Handwerks, kein englischer Satz zum \u00dcbersetzen.",
  glossary: [
    { term: "anamorphic 2.39:1", gloss: "ein breites Bildformat mit schwarzen Balken, ovalem Bokeh und horizontalen Objektivreflexen." },
    { term: "35mm / 50mm / 85mm", gloss: "die Brennweite: mehr Umgebung bei 35mm, ein engeres, flacheres Gesicht bei 85mm." },
    { term: "shallow depth of field", gloss: "eine d\u00fcnne Sch\u00e4rfeebene, der Rest unscharf \u2014 beim Namen verlangen, nicht als \u201eunscharf\u201c." },
    { term: "key light / fill light", gloss: "das Hauptlicht, das das Gesicht formt, und das weichere Licht, das den entstehenden Schatten aufhellt." },
    { term: "rim light", gloss: "ein d\u00fcnner Lichtsaum um Haar oder Schulter, der das Motiv vom Hintergrund trennt." },
    { term: "practical lighting", gloss: "Licht, das scheinbar von einer Lampe, einem Fenster oder einem Schild im Bild kommt, nicht von einem Studioscheinwerfer." },
    { term: "golden hour", gloss: "das tiefe, warme, weiche Licht kurz nach Sonnenaufgang oder vor Sonnenuntergang." },
    { term: "Rembrandt lighting", gloss: "ein 45\u00b0-Hauptlicht, das ein kleines Lichtdreieck auf der beschatteten Wange l\u00e4sst." },
    { term: "dolly in / dolly out", gloss: "die Kamera f\u00e4hrt gerade auf das Motiv zu oder weg, das Objektiv zoomt nicht." },
    { term: "rack focus", gloss: "die Sch\u00e4rfe wechselt w\u00e4hrend der Einstellung von einer Ebene zur anderen, kein Schnitt." },
    { term: "film grain", gloss: "feine fotografische Textur \u00fcber dem ganzen Bild, das Gegenteil einer glatten digitalen Oberfl\u00e4che." },
    { term: "ACES", gloss: "ein breiter, filmischer Farbraum \u2014 verlangen, wenn eine Einstellung wie farbkorrigiertes Filmmaterial wirken soll, nicht wie ein roher Render." },
    { term: "teal-and-orange grade", gloss: "k\u00fchle blaugr\u00fcne Schatten gegen warme orange Hautt\u00f6ne, eine im Kino h\u00e4ufige Farbkorrektur." },
  ],
  toolsTitle: "Sechs Werkzeuge, mit ihren eigenen Worten",
  toolsLede: "Was jedes Modell gut liest, mit einem Prompt, der eine Einstellung h\u00e4lt, und einem, der abdriftet.",
  tools: [
    {
      name: "FLUX.3 Klein \u2014 Besetzung, Kulisse",
      tip: "Ein dichter Satz: Motiv, Kleidung oder Kulissenausstattung, Licht, Objektiv, Farbkorrektur. Die Reihenfolge folgt grob dem, was das Modell zuerst gewichtet.",
      good: "Frau in den Dreissigern, kurze geflochtene Haare, abgetragene Lederjacke, regenbeleuchtete Gasse, Neonschilder in Pf\u00fctzen gespiegelt, 35mm, shallow depth of field, teal-and-orange grade, film grain.",
      bad: "ein tolles Foto einer Frau, 8k, best quality, trending, cinematic",
      badWhy: "\u201e8k\u201c, \u201ebest quality\u201c und \u201ecinematic\u201c nennen kein Licht, kein Objektiv, keine Farbe \u2014 das Modell hat nichts Konkretes zum Platzieren.",
    },
    {
      name: "MiniMax H3 \u2014 Referenzvideo (Take)",
      tip: "Beschreibe die Handlung und das Licht deiner zwei Referenzbilder, keine neue Szene: H3 beh\u00e4lt Figur und Ort, dein Satz steuert die Bewegung.",
      good: "Sie geht durch den Raum zum Fenster, weiches practical lighting von der Schreibtischlampe, langsames dolly in, leichtes Handheld-Wiegen, Schritte auf Holz h\u00f6rbar.",
      bad: "sie macht etwas Cooles und Cinematic, epische Musik, grandiose Einstellung",
      badWhy: "Keine benannte Bewegung, kein benanntes Licht: das Modell f\u00e4llt auf seine eigene Vorstellung von \u201ecool\u201c zur\u00fcck.",
    },
    {
      name: "LTX-2.5 \u2014 Kamerafahrten (Take)",
      tip: "Nenne eine Kamerabewegung und ein Licht pro Einstellung; drei \u00fcbereinander verwischt, welche f\u00fchrt.",
      good: "Langsames dolly in zu ihrem Gesicht, rack focus von der Kerze im Vordergrund zu ihren Augen, golden hour Licht durchs Fenster, anamorphic 2.39:1.",
      bad: "schnell reinzoomen, epische Enth\u00fcllung, super dramatisch, 4k",
      badWhy: "\u201eZoom\u201c ist eine Objektivbewegung, keine Kamerabewegung \u2014 LTX-2.5 liest \u201edolly\u201c, \u201epan\u201c, \u201ecrane\u201c und \u201eorbit\u201c, nicht \u201ezoom\u201c.",
    },
    {
      name: "Qwen-Edit 2511 \u2014 Ansichten (Besetzung)",
      tip: "Verlange eine Ansicht, keinen neuen Look: wiederhole Kleidung und Licht, damit nur der Winkel wechselt.",
      good: "Gleiche Kleidung, gleiches key light von Kamera links, Dreiviertelansicht, dann Profil, dann eine Nahaufnahme des Gesichts.",
      bad: "anderer Winkel, coole Pose, vielleicht die Jacke \u00e4ndern",
      badWhy: "\u201eVielleicht \u00e4ndern\u201c \u00f6ffnet die Kleidung zum Abdriften; Ansichten funktionieren nur, wenn alles au\u00dfer dem Winkel fixiert bleibt.",
    },
    {
      name: "Wan Animate 2 \u2014 Bewegungssteuerung (Take)",
      tip: "Nenne die genaue Bewegung im Referenzclip; ein vages Verb l\u00e4sst das Modell sie mit etwas anderem vermischen.",
      good: "\u00dcbernimmt genau den Gangzyklus des Referenzclips, Gewichtsverlagerung bei jedem Schritt, gleicher Bildausschnitt, keine Kamerabewegung.",
      bad: "lass sie sich wie im Video bewegen, f\u00fcg etwas Energie und Flair hinzu",
      badWhy: "\u201eEnergie und Flair\u201c ist keine Bewegung \u2014 das Modell hat keinen Gangzyklus, keine Geste, keine Gewichtsverlagerung zum Kopieren.",
    },
    {
      name: "SeedVR2 \u2014 Finalisieren",
      tip: "Finalisieren zeichnet nie neu: verlange Aufl\u00f6sung und Textur, nie ein neues Detail, einen neuen Ausdruck oder einen korrigierten Fehler.",
      good: "Auf native Aufl\u00f6sung hochskalieren, film grain und Hauttextur behalten, nicht gl\u00e4tten.",
      bad: "sieht besser aus machen, mehr Details hinzuf\u00fcgen, ihre Hand korrigieren",
      badWhy: "\u201eHand korrigieren\u201c verlangt ein Neuzeichnen \u2014 Finalisieren sch\u00e4rft nur die behaltene Einstellung; eine echte Korrektur kommt aus einer neuen Einstellung davor.",
    },
  ],
  goodLabel: "Gelungen",
  badLabel: "Driftet ab",
};

const es: CgiGuideCopy = {
  ...en,
  kicker: "Gu\u00eda \u00b7 Cine",
  title: "Haz tu prompt como",
  titleEm: "un director de fotograf\u00eda",
  lede: "Los t\u00e9rminos precisos ganan a los adjetivos. Nombra el objetivo, la luz y el movimiento; deja de lado \u00ab cinematic \u00bb, \u00ab 8k \u00bb y \u00ab best quality \u00bb, que ning\u00fan modelo lee como instrucci\u00f3n.",
  backLink: "Abrir la secci\u00f3n Cine",
  glossaryTitle: "Un vocabulario compartido",
  glossaryLede: "Estos t\u00e9rminos quedan en ingl\u00e9s en cada idioma aqu\u00ed \u2014 son las palabras propias del oficio, no una frase inglesa que traducir.",
  glossary: [
    { term: "anamorphic 2.39:1", gloss: "un encuadre ancho con bandas negras, bokeh ovalado y destellos horizontales de objetivo." },
    { term: "35mm / 50mm / 85mm", gloss: "la distancia focal: m\u00e1s ancho y m\u00e1s entorno a 35mm, un rostro m\u00e1s cerrado y plano a 85mm." },
    { term: "shallow depth of field", gloss: "un plano de nitidez fino, el resto desenfocado \u2014 se pide por su nombre, no como \u00ab borroso \u00bb." },
    { term: "key light / fill light", gloss: "la luz principal que modela el rostro, y la m\u00e1s suave que levanta la sombra que deja." },
    { term: "rim light", gloss: "un fino borde de luz en el cabello o el hombro, que separa el sujeto del fondo." },
    { term: "practical lighting", gloss: "una luz que parece venir de una l\u00e1mpara, una ventana o un letrero ya presente en el plano, no de un foco de estudio." },
    { term: "golden hour", gloss: "la luz baja, c\u00e1lida y suave justo tras el amanecer o antes del atardecer." },
    { term: "Rembrandt lighting", gloss: "una luz principal a 45\u00b0 que deja un peque\u00f1o tri\u00e1ngulo de luz en la mejilla en sombra." },
    { term: "dolly in / dolly out", gloss: "la c\u00e1mara avanza o retrocede en l\u00ednea recta hacia el sujeto, el objetivo no hace zoom." },
    { term: "rack focus", gloss: "el enfoque pasa de un plano a otro durante la toma, no por un corte." },
    { term: "film grain", gloss: "una textura fotogr\u00e1fica fina sobre toda la imagen, lo opuesto a una superficie digital limpia." },
    { term: "ACES", gloss: "un espacio de color amplio y filmico \u2014 se pide cuando un plano debe leerse como metraje etalonado, no un render plano." },
    { term: "teal-and-orange grade", gloss: "sombras fr\u00edas azul-verdosas contra tonos de piel c\u00e1lidos naranjas, un etalonaje habitual en el cine." },
  ],
  toolsTitle: "Seis herramientas, en sus propias palabras",
  toolsLede: "Lo que cada modelo lee bien, con un prompt que mantiene un plano y otro que se desv\u00eda.",
  tools: [
    {
      name: "FLUX.3 Klein \u2014 Reparto, Decorado",
      tip: "Una frase densa: sujeto, vestuario o atrezo, luz, objetivo, etalonaje. El orden sigue aproximadamente lo que el modelo pesa primero.",
      good: "Mujer de unos treinta a\u00f1os, cabello corto trenzado, chaqueta de cuero gastada, callej\u00f3n bajo la lluvia, letreros de ne\u00f3n reflejados en los charcos, 35mm, shallow depth of field, teal-and-orange grade, film grain.",
      bad: "una foto bonita de una mujer, 8k, best quality, trending, cinematic",
      badWhy: "\u00ab 8k \u00bb, \u00ab best quality \u00bb y \u00ab cinematic \u00bb no nombran ninguna luz, objetivo o color \u2014 el modelo no tiene nada concreto que ubicar.",
    },
    {
      name: "MiniMax H3 \u2014 v\u00eddeo por referencias (Toma)",
      tip: "Describe la acci\u00f3n y la luz de tus dos im\u00e1genes de referencia, no una escena nueva: H3 conserva el personaje y el lugar, tu frase dirige el movimiento.",
      good: "Cruza la habitaci\u00f3n hacia la ventana, practical lighting suave desde la l\u00e1mpara de escritorio, dolly in lento, leve balanceo de c\u00e1mara en mano, pasos audibles sobre madera.",
      bad: "hace algo genial y cinematic, m\u00fasica \u00e9pica, plano incre\u00edble",
      badWhy: "Sin movimiento nombrado, sin luz nombrada: el modelo recae en su propia idea de \u00ab genial \u00bb.",
    },
    {
      name: "LTX-2.5 \u2014 movimientos de c\u00e1mara (Toma)",
      tip: "Nombra un movimiento de c\u00e1mara y una luz por plano; apilar tres confunde cu\u00e1l manda.",
      good: "Dolly in lento hacia su rostro, rack focus desde la vela en primer plano hasta sus ojos, luz golden hour a trav\u00e9s de la ventana, anamorphic 2.39:1.",
      bad: "zoom r\u00e1pido, revelaci\u00f3n \u00e9pica, super dram\u00e1tico, 4k",
      badWhy: "\u00ab Zoom \u00bb es un movimiento de objetivo, no de c\u00e1mara \u2014 LTX-2.5 lee \u00ab dolly \u00bb, \u00ab pan \u00bb, \u00ab crane \u00bb y \u00ab orbit \u00bb, no \u00ab zoom \u00bb.",
    },
    {
      name: "Qwen-Edit 2511 \u2014 vistas (Reparto)",
      tip: "Pide una vista, no un look nuevo: repite el vestuario y la luz para que solo cambie el \u00e1ngulo.",
      good: "Mismo vestuario, mismo key light desde la izquierda de c\u00e1mara, vista de tres cuartos, luego perfil, luego un primer plano del rostro.",
      bad: "\u00e1ngulo diferente, pose genial, quiz\u00e1 cambiar la chaqueta",
      badWhy: "\u00ab Quiz\u00e1 cambiar \u00bb abre el vestuario a la deriva; una serie de \u00e1ngulos solo funciona si todo salvo el \u00e1ngulo queda fijado.",
    },
    {
      name: "Wan Animate 2 \u2014 control del movimiento (Toma)",
      tip: "Nombra el movimiento exacto del clip de referencia; un verbo vago deja que el modelo lo mezcle con otra cosa.",
      good: "Repite exactamente el ciclo de marcha del clip de referencia, cambio de peso en cada paso, mismo encuadre, sin movimiento de c\u00e1mara.",
      bad: "haz que se mueva como en el v\u00eddeo, a\u00f1ade algo de energ\u00eda y estilo",
      badWhy: "\u00ab Energ\u00eda y estilo \u00bb no es un movimiento \u2014 el modelo no tiene ciclo de marcha, gesto ni cambio de peso que copiar.",
    },
    {
      name: "SeedVR2 \u2014 Finalizar",
      tip: "Finalizar nunca vuelve a dibujar: pide resoluci\u00f3n y textura, nunca un detalle nuevo, una expresi\u00f3n nueva o un error corregido.",
      good: "Escalar a la resoluci\u00f3n nativa, conservar el film grain y la textura de piel, sin suavizar.",
      bad: "que se vea mejor, a\u00f1ade m\u00e1s detalle, corrige su mano",
      badWhy: "\u00ab Corrige su mano \u00bb pide un redibujado \u2014 Finalizar solo nitidece la toma guardada; una correcci\u00f3n real viene de una toma nueva m\u00e1s arriba.",
    },
  ],
  goodLabel: "Acierta",
  badLabel: "Se desv\u00eda",
};

export const CGI_GUIDE: Record<CgiGuideLocale, CgiGuideCopy> = { en, fr, de, es };

export function cgiGuide(locale: string): CgiGuideCopy {
  return CGI_GUIDE[(locale as CgiGuideLocale)] ?? en;
}
