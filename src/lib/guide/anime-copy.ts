// Anime production guide. The terms below are never translated — they are the words anime
// production actually uses, in English, in every locale. Only the one-line explanations are.
// English is the source; FR, DE and ES follow it.

export type AnimeGuideLocale = "en" | "fr" | "de" | "es";

export interface AnimeGuideTerm {
  term: string;
  body: string;
}

export interface AnimeGuideExample {
  title: string;
  template: string;
  good: string;
  bad: string;
  badNote: string;
}

export interface AnimeGuideCopy {
  kicker: string;
  title: string;
  titleEm: string;
  lede: string;
  glossaryTitle: string;
  glossaryLede: string;
  glossary: AnimeGuideTerm[];
  styleTitle: string;
  styleLede: string;
  styles: AnimeGuideTerm[];
  modelsTitle: string;
  modelsLede: string;
  models: AnimeGuideExample[];
  back: string;
  openStudio: string;
}

const en: AnimeGuideCopy = {
  kicker: "Guide · ANIME Studio",
  title: "Speak the",
  titleEm: "real words.",
  lede: "ANIME Studio uses the terms anime production actually uses, in English, everywhere. Here is what each one means, and what to write for each tool — with a bad prompt next to the one that works.",
  glossaryTitle: "The words you'll see",
  glossaryLede: "Shown as labels in the studio. Explained once, here.",
  glossary: [
    { term: "Key visual", body: "The single reference image that sets a whole project's look — everything else is made to match it." },
    { term: "Settei / model sheet", body: "A turnaround reference sheet for one character: front, three-quarter, side, back, same outfit and proportions." },
    { term: "Layout", body: "The stage that places a character into a background at the right size, angle and framing, before the shot is animated." },
    { term: "Genga", body: "The key drawings an animator makes that define where a movement starts, peaks and ends." },
    { term: "Douga", body: "The in-between drawings filled in between the genga to make a movement read as smooth." },
    { term: "Cel shading", body: "Flat, 2-tone color with a hard edge between light and shadow — no soft gradient blending." },
    { term: "2.5D", body: "Flat, cel-shaded characters moving over a painted background, inside a real, moving 3D camera." },
    { term: "Compositing", body: "The final assembly: character, background, effects and color graded together into one frame." },
    { term: "On twos / on threes", body: "Limited animation: a new drawing every 2nd or 3rd frame instead of every frame — the classic TV-anime economy of motion." },
    { term: "Smear frame", body: "A stretched, blurred drawing standing in for a very fast motion, instead of drawing every position along the way." },
    { term: "Impact frame", body: "A single, high-contrast still held for a beat at the moment of a hit, to sell its weight." },
    { term: "Sakuga", body: "A shot animated to a noticeably higher standard than the rest of the show — usually one key action beat." },
  ],
  styleTitle: "Style vocabulary",
  styleLede: "Name a real reference and a concrete detail. \"Anime style\" alone describes nothing a model can act on.",
  styles: [
    { term: "Makoto Shinkai-style lighting", body: "Hard sun shafts through clouds, visible lens flare, a backlit silhouette against a saturated sky." },
    { term: "Ghibli watercolor backgrounds", body: "Soft, hand-painted gouache texture, muted earth tones, visible brushwork in foliage and clouds." },
    { term: "Trigger-style impact frames", body: "A single hyper-stylized still, exaggerated anatomy, blown-out contrast, held on the hit." },
    { term: "Thick lineart", body: "A heavy, uneven ink line that thickens on the outer silhouette and thins on interior detail, like a 90s cel." },
    { term: "Flat cel shading, soft gradient shadow", body: "Mostly flat 2-tone color, but the shadow's edge is a short, soft gradient instead of a hard line — a modern digital-cel look." },
  ],
  modelsTitle: "Good prompt, bad prompt — by tool",
  modelsLede: "Same tool, same cost, very different result. The good column names concrete, visual choices; the bad column is the kind of prompt that gives the model nothing to decide.",
  models: [
    {
      title: "Key visual (Krea 2 Turbo, style reference)",
      template: "image_krea2_turbo_int8_image_style_reference",
      good: "Key visual, fine dark ink lineart, flat two-tone cel shading, warm amber rim light at dusk, painted background with three depth layers. No text, no watermark.",
      bad: "anime style picture, cool colors, good quality",
      badNote: "Names no line weight, no shading, no light, no layering — the model has nothing concrete to lock onto for every later shot to match.",
    },
    {
      title: "Model sheet / settei (Qwen Image 2.1 edit)",
      template: "image_qwen_image_2_1_image_edit",
      good: "Turnaround sheet: front, three-quarter, side, back. Same character, same outfit, same proportions. Neutral grey background, consistent cel shading across all four poses. No text.",
      bad: "character sheet anime girl",
      badNote: "Doesn't ask for the four fixed angles a model sheet needs, or say the proportions and outfit must match across them.",
    },
    {
      title: "Backgrounds (Krea 2 Turbo / Qwen edit)",
      template: "image_krea2_turbo_int8_image_style_reference",
      good: "Painted background, Ghibli watercolor style, layered depth: foreground foliage, mid-ground rooftops, distant mountains in haze. No people. Soft diffused daylight.",
      bad: "nice anime background",
      badNote: "No depth layers, no named reference, no lighting — three things a background needs to feel painted rather than flat.",
    },
    {
      title: "Acting shots (Wan 2.2 14B + AniSora)",
      template: "video_wan2_2_14B_i2v",
      good: "Character walks into frame, on-twos timing, a weight-shifted stride, hair and cloth with a short secondary-motion lag, cel-shaded, matching the project's key visual.",
      bad: "make them move",
      badNote: "Says nothing about timing, weight or secondary motion — the three things that make hand-drawn-feeling movement read as intentional rather than generic.",
    },
    {
      title: "Camera / wide shots (LTX-2.5)",
      template: "video_ltx2_5_i2v",
      good: "Slow dolly-in across a painted skyline at golden hour, Makoto Shinkai-style volumetric light shafts through cloud, visible parallax between depth layers, no camera shake.",
      bad: "cinematic camera movement",
      badNote: "Names no camera move, no light, no reference — \"cinematic\" alone is not a visual instruction.",
    },
  ],
  back: "← Back to the guide",
  openStudio: "Open the studio",
};

const fr: AnimeGuideCopy = {
  ...en,
  title: "Parle les",
  titleEm: "vrais mots.",
  lede: "ANIME Studio utilise les termes que la production anime utilise vraiment, en anglais, partout. Voici ce que chacun veut dire, et quoi écrire pour chaque outil — avec un mauvais prompt à côté de celui qui marche.",
  glossaryTitle: "Les mots que tu vas voir",
  glossaryLede: "Affichés comme libellés dans le studio. Expliqués une fois, ici.",
  glossary: [
    { term: "Key visual", body: "L'image de référence unique qui fixe le style de tout le projet — tout le reste est fait pour lui correspondre." },
    { term: "Settei / model sheet", body: "Une planche de référence d'un personnage sous tous les angles : face, trois-quarts, profil, dos, même tenue, mêmes proportions." },
    { term: "Layout", body: "L'étape qui place un personnage dans un décor, à la bonne taille, au bon angle et au bon cadrage, avant que le plan soit animé." },
    { term: "Genga", body: "Les dessins clés qu'un animateur fait pour fixer où un mouvement commence, culmine et finit." },
    { term: "Douga", body: "Les dessins intermédiaires remplis entre les genga pour que le mouvement paraisse fluide." },
    { term: "Cel shading", body: "Une couleur plate, à deux tons, avec un bord net entre lumière et ombre — sans dégradé doux." },
    { term: "2.5D", body: "Des personnages plats, en cel shading, qui bougent sur un décor peint, dans une vraie caméra 3D mobile." },
    { term: "Compositing", body: "L'assemblage final : personnage, décor, effets et étalonnage réunis dans une seule image." },
    { term: "On twos / on threes", body: "Animation limitée : un nouveau dessin toutes les 2 ou 3 images au lieu de chaque image — l'économie de mouvement classique de l'anime télé." },
    { term: "Smear frame", body: "Un dessin étiré et flouté qui tient lieu d'un mouvement très rapide, au lieu de dessiner chaque position." },
    { term: "Impact frame", body: "Une image fixe, à fort contraste, tenue un instant au moment d'un coup, pour en faire sentir le poids." },
    { term: "Sakuga", body: "Un plan animé à un niveau nettement plus haut que le reste de l'épisode — en général un moment d'action clé." },
  ],
  styleTitle: "Vocabulaire de style",
  styleLede: "Nomme une vraie référence et un détail concret. « Style anime » seul ne décrit rien sur quoi un modèle puisse agir.",
  styles: [
    { term: "Makoto Shinkai-style lighting", body: "Des rais de soleil durs à travers les nuages, un flare visible, une silhouette à contre-jour sur un ciel saturé." },
    { term: "Ghibli watercolor backgrounds", body: "Une texture gouache peinte à la main, douce, des tons terre discrets, une touche visible dans le feuillage et les nuages." },
    { term: "Trigger-style impact frames", body: "Une image fixe hyper-stylisée, une anatomie exagérée, un contraste saturé, tenue sur le coup." },
    { term: "Thick lineart", body: "Un trait d'encre épais et irrégulier, plus épais sur le contour extérieur, plus fin dans le détail intérieur, comme un cel des années 90." },
    { term: "Flat cel shading, soft gradient shadow", body: "Une couleur surtout plate à deux tons, mais le bord de l'ombre est un dégradé court et doux plutôt qu'un trait net — un look cel numérique moderne." },
  ],
  modelsTitle: "Bon prompt, mauvais prompt — par outil",
  modelsLede: "Même outil, même coût, un résultat très différent. La colonne bonne nomme des choix visuels concrets ; la mauvaise est le genre de prompt qui ne laisse rien décider au modèle.",
  models: [
    {
      title: "Key visual (Krea 2 Turbo, référence de style)",
      template: "image_krea2_turbo_int8_image_style_reference",
      good: "Key visual, trait d'encre fin et foncé, cel shading plat à deux tons, lumière chaude ambrée de contour au crépuscule, décor peint à trois niveaux de profondeur. Pas de texte, pas de filigrane.",
      bad: "image style anime, couleurs froides, bonne qualité",
      badNote: "Ne nomme ni le trait, ni l'ombrage, ni la lumière, ni les niveaux — le modèle n'a rien de concret à fixer pour que chaque plan suivant corresponde.",
    },
    {
      title: "Model sheet / settei (Qwen Image 2.1 edit)",
      template: "image_qwen_image_2_1_image_edit",
      good: "Planche de référence : face, trois-quarts, profil, dos. Même personnage, même tenue, mêmes proportions. Fond gris neutre, cel shading cohérent sur les quatre poses. Pas de texte.",
      bad: "fiche personnage fille anime",
      badNote: "Ne demande pas les quatre angles fixes dont une planche a besoin, ni que les proportions et la tenue correspondent entre eux.",
    },
    {
      title: "Décors (Krea 2 Turbo / Qwen edit)",
      template: "image_krea2_turbo_int8_image_style_reference",
      good: "Décor peint, style aquarelle Ghibli, profondeur en couches : feuillage au premier plan, toits au second plan, montagnes lointaines dans la brume. Pas de personnage. Lumière du jour douce et diffuse.",
      bad: "joli décor anime",
      badNote: "Aucune couche de profondeur, aucune référence nommée, aucune lumière — trois choses dont un décor a besoin pour paraître peint plutôt que plat.",
    },
    {
      title: "Plans de jeu (Wan 2.2 14B + AniSora)",
      template: "video_wan2_2_14B_i2v",
      good: "Le personnage entre dans le cadre, cadence on-twos, une démarche avec transfert de poids, cheveux et vêtements avec un léger retard de mouvement secondaire, cel shading, cohérent avec le key visual du projet.",
      bad: "fais-le bouger",
      badNote: "Ne dit rien sur la cadence, le poids ou le mouvement secondaire — les trois choses qui font qu'un mouvement se lit comme voulu plutôt que générique.",
    },
    {
      title: "Plans caméra / larges (LTX-2.5)",
      template: "video_ltx2_5_i2v",
      good: "Travelling avant lent sur un ciel peint au coucher du soleil, rais de lumière volumétriques style Makoto Shinkai à travers les nuages, parallaxe visible entre les niveaux de profondeur, pas de tremblement de caméra.",
      bad: "mouvement de caméra cinématographique",
      badNote: "Ne nomme aucun mouvement de caméra, aucune lumière, aucune référence — « cinématographique » seul n'est pas une instruction visuelle.",
    },
  ],
  back: "← Retour au guide",
  openStudio: "Ouvrir le studio",
};

const de: AnimeGuideCopy = {
  ...en,
  title: "Sprich die",
  titleEm: "echten Worte.",
  lede: "ANIME Studio nutzt die Begriffe, die die Anime-Produktion wirklich benutzt, auf Englisch, überall. Hier steht, was jeder bedeutet, und was du für jedes Werkzeug schreibst — mit einem schlechten Prompt neben dem, der funktioniert.",
  glossaryTitle: "Die Wörter, die du siehst",
  glossaryLede: "Als Labels im Studio gezeigt. Hier einmal erklärt.",
  glossary: [
    { term: "Key visual", body: "Das eine Referenzbild, das den Look des ganzen Projekts festlegt — alles andere wird darauf abgestimmt." },
    { term: "Settei / model sheet", body: "Ein Referenzblatt einer Figur aus allen Winkeln: vorne, Dreiviertel, Seite, Rücken, gleiche Kleidung, gleiche Proportionen." },
    { term: "Layout", body: "Die Stufe, die eine Figur in der richtigen Größe, im richtigen Winkel und Bildausschnitt in einen Hintergrund setzt, bevor der Shot animiert wird." },
    { term: "Genga", body: "Die Schlüsselzeichnungen eines Animators, die festlegen, wo eine Bewegung beginnt, ihren Höhepunkt erreicht und endet." },
    { term: "Douga", body: "Die Zwischenzeichnungen, die zwischen den Genga eingefügt werden, damit eine Bewegung flüssig wirkt." },
    { term: "Cel shading", body: "Flache, zweitonige Farbe mit einer harten Kante zwischen Licht und Schatten — ohne weichen Verlauf." },
    { term: "2.5D", body: "Flache, cel-schattierte Figuren, die sich über einen gemalten Hintergrund bewegen, in einer echten, beweglichen 3D-Kamera." },
    { term: "Compositing", body: "Die letzte Montage: Figur, Hintergrund, Effekte und Farbkorrektur zusammen in einem Bild." },
    { term: "On twos / on threes", body: "Limitierte Animation: eine neue Zeichnung alle 2 oder 3 Bilder statt bei jedem Bild — die klassische Bewegungsökonomie des TV-Anime." },
    { term: "Smear frame", body: "Eine gedehnte, unscharfe Zeichnung, die für eine sehr schnelle Bewegung steht, statt jede Position zu zeichnen." },
    { term: "Impact frame", body: "Ein einzelnes, kontrastreiches Standbild, einen Moment lang gehalten im Augenblick eines Treffers, um sein Gewicht zu verkaufen." },
    { term: "Sakuga", body: "Ein Shot, der deutlich aufwendiger animiert ist als der Rest der Serie — meist ein zentraler Action-Moment." },
  ],
  styleTitle: "Stilvokabular",
  styleLede: "Nenn eine echte Referenz und ein konkretes Detail. „Anime-Stil“ allein beschreibt nichts, worauf ein Modell reagieren kann.",
  styles: [
    { term: "Makoto Shinkai-style lighting", body: "Harte Sonnenstrahlen durch Wolken, sichtbares Lens Flare, eine Gegenlicht-Silhouette vor gesättigtem Himmel." },
    { term: "Ghibli watercolor backgrounds", body: "Weiche, handgemalte Gouache-Textur, gedämpfte Erdtöne, sichtbare Pinselführung in Laub und Wolken." },
    { term: "Trigger-style impact frames", body: "Ein einzelnes, hyperstilisiertes Standbild, übertriebene Anatomie, überstrahlter Kontrast, im Treffer gehalten." },
    { term: "Thick lineart", body: "Eine kräftige, unregelmäßige Tuschelinie, dicker am äußeren Umriss, dünner bei Innendetails, wie ein 90er-Cel." },
    { term: "Flat cel shading, soft gradient shadow", body: "Meist flache zweitonige Farbe, aber die Schattenkante ist ein kurzer, weicher Verlauf statt einer harten Linie — ein moderner digitaler Cel-Look." },
  ],
  modelsTitle: "Guter Prompt, schlechter Prompt — pro Werkzeug",
  modelsLede: "Gleiches Werkzeug, gleiche Kosten, ein sehr anderes Ergebnis. Die gute Spalte nennt konkrete, visuelle Entscheidungen; die schlechte ist die Art Prompt, die dem Modell nichts zu entscheiden lässt.",
  models: [
    {
      title: "Key visual (Krea 2 Turbo, Stilreferenz)",
      template: "image_krea2_turbo_int8_image_style_reference",
      good: "Key visual, feine, dunkle Tuschelinie, flaches zweitoniges Cel-Shading, warmes bernsteinfarbenes Randlicht in der Dämmerung, gemalter Hintergrund mit drei Tiefenebenen. Kein Text, kein Wasserzeichen.",
      bad: "Bild im Anime-Stil, kühle Farben, gute Qualität",
      badNote: "Nennt weder Linienstärke, noch Schattierung, noch Licht, noch Ebenen — das Modell hat nichts Konkretes, an dem sich jeder spätere Shot ausrichten kann.",
    },
    {
      title: "Model sheet / settei (Qwen Image 2.1 edit)",
      template: "image_qwen_image_2_1_image_edit",
      good: "Referenzblatt: vorne, Dreiviertel, Seite, Rücken. Gleiche Figur, gleiche Kleidung, gleiche Proportionen. Neutral grauer Hintergrund, einheitliches Cel-Shading über alle vier Posen. Kein Text.",
      bad: "Charakterblatt Anime-Mädchen",
      badNote: "Fragt nicht nach den vier festen Winkeln, die ein Model Sheet braucht, und sagt nicht, dass Proportionen und Kleidung übereinstimmen müssen.",
    },
    {
      title: "Hintergründe (Krea 2 Turbo / Qwen edit)",
      template: "image_krea2_turbo_int8_image_style_reference",
      good: "Gemalter Hintergrund, Ghibli-Aquarellstil, gestaffelte Tiefe: Laub im Vordergrund, Dächer im Mittelgrund, ferne Berge im Dunst. Keine Personen. Weiches, diffuses Tageslicht.",
      bad: "schöner Anime-Hintergrund",
      badNote: "Keine Tiefenebenen, keine benannte Referenz, kein Licht — drei Dinge, die ein Hintergrund braucht, um gemalt statt flach zu wirken.",
    },
    {
      title: "Spiel-Shots (Wan 2.2 14B + AniSora)",
      template: "video_wan2_2_14B_i2v",
      good: "Die Figur geht ins Bild, On-twos-Timing, ein gewichtsverlagerter Schritt, Haare und Kleidung mit kurzem Nachlauf der Sekundärbewegung, Cel-Shading, passend zum Key Visual des Projekts.",
      bad: "lass sie sich bewegen",
      badNote: "Sagt nichts über Timing, Gewicht oder Sekundärbewegung — die drei Dinge, die eine Bewegung handgezeichnet und beabsichtigt wirken lassen statt generisch.",
    },
    {
      title: "Kamera / weite Einstellungen (LTX-2.5)",
      template: "video_ltx2_5_i2v",
      good: "Langsamer Dolly-in über eine gemalte Skyline zur goldenen Stunde, volumetrische Lichtstrahlen im Makoto-Shinkai-Stil durch Wolken, sichtbare Parallaxe zwischen Tiefenebenen, keine Kamerawacklung.",
      bad: "kinoreife Kamerabewegung",
      badNote: "Nennt keine Kamerabewegung, kein Licht, keine Referenz — „kinoreif“ allein ist keine visuelle Anweisung.",
    },
  ],
  back: "← Zurück zum Guide",
  openStudio: "Studio öffnen",
};

const es: AnimeGuideCopy = {
  ...en,
  title: "Habla las",
  titleEm: "palabras reales.",
  lede: "ANIME Studio usa los términos que la producción de anime realmente usa, en inglés, en todas partes. Esto es lo que significa cada uno, y qué escribir para cada herramienta — con un mal prompt al lado del que funciona.",
  glossaryTitle: "Las palabras que verás",
  glossaryLede: "Se muestran como etiquetas en el estudio. Explicadas una vez, aquí.",
  glossary: [
    { term: "Key visual", body: "La única imagen de referencia que fija el estilo de todo el proyecto — todo lo demás se hace para coincidir con ella." },
    { term: "Settei / model sheet", body: "Una hoja de referencia de un personaje desde todos los ángulos: frente, tres cuartos, perfil, espalda, mismo atuendo, mismas proporciones." },
    { term: "Layout", body: "La etapa que coloca a un personaje en un fondo con el tamaño, ángulo y encuadre correctos, antes de animar el plano." },
    { term: "Genga", body: "Los dibujos clave que hace un animador para fijar dónde empieza, culmina y termina un movimiento." },
    { term: "Douga", body: "Los dibujos intermedios que se rellenan entre los genga para que el movimiento se vea fluido." },
    { term: "Cel shading", body: "Color plano, de dos tonos, con un borde duro entre luz y sombra — sin degradado suave." },
    { term: "2.5D", body: "Personajes planos, con cel shading, que se mueven sobre un fondo pintado, dentro de una cámara 3D real y en movimiento." },
    { term: "Compositing", body: "El montaje final: personaje, fondo, efectos y corrección de color reunidos en un solo fotograma." },
    { term: "On twos / on threes", body: "Animación limitada: un dibujo nuevo cada 2 o 3 fotogramas en vez de en cada uno — la economía de movimiento clásica del anime de TV." },
    { term: "Smear frame", body: "Un dibujo estirado y borroso que representa un movimiento muy rápido, en vez de dibujar cada posición." },
    { term: "Impact frame", body: "Un único fotograma fijo de alto contraste, sostenido un instante en el momento de un golpe, para vender su peso." },
    { term: "Sakuga", body: "Un plano animado a un nivel claramente más alto que el resto del episodio — normalmente un momento de acción clave." },
  ],
  styleTitle: "Vocabulario de estilo",
  styleLede: "Nombra una referencia real y un detalle concreto. «Estilo anime» solo no describe nada sobre lo que un modelo pueda actuar.",
  styles: [
    { term: "Makoto Shinkai-style lighting", body: "Haces de sol duros a través de nubes, destello de lente visible, una silueta a contraluz sobre un cielo saturado." },
    { term: "Ghibli watercolor backgrounds", body: "Textura de gouache pintada a mano, suave, tonos tierra discretos, pincelada visible en el follaje y las nubes." },
    { term: "Trigger-style impact frames", body: "Un único fotograma fijo hiperestilizado, anatomía exagerada, contraste muy marcado, sostenido en el golpe." },
    { term: "Thick lineart", body: "Un trazo de tinta grueso e irregular, más grueso en el contorno exterior, más fino en el detalle interior, como un cel de los 90." },
    { term: "Flat cel shading, soft gradient shadow", body: "Color mayormente plano de dos tonos, pero el borde de la sombra es un degradado corto y suave en vez de una línea dura — un look de cel digital moderno." },
  ],
  modelsTitle: "Buen prompt, mal prompt — por herramienta",
  modelsLede: "Misma herramienta, mismo coste, un resultado muy distinto. La columna buena nombra decisiones visuales concretas; la mala es el tipo de prompt que no le deja nada que decidir al modelo.",
  models: [
    {
      title: "Key visual (Krea 2 Turbo, referencia de estilo)",
      template: "image_krea2_turbo_int8_image_style_reference",
      good: "Key visual, trazo de tinta fino y oscuro, cel shading plano de dos tonos, luz de contorno ámbar cálida al atardecer, fondo pintado con tres capas de profundidad. Sin texto, sin marca de agua.",
      bad: "imagen estilo anime, colores fríos, buena calidad",
      badNote: "No nombra ni el trazo, ni el sombreado, ni la luz, ni las capas — el modelo no tiene nada concreto para que cada plano siguiente coincida.",
    },
    {
      title: "Model sheet / settei (Qwen Image 2.1 edit)",
      template: "image_qwen_image_2_1_image_edit",
      good: "Hoja de referencia: frente, tres cuartos, perfil, espalda. Mismo personaje, mismo atuendo, mismas proporciones. Fondo gris neutro, cel shading coherente en las cuatro poses. Sin texto.",
      bad: "ficha de personaje chica anime",
      badNote: "No pide los cuatro ángulos fijos que necesita una model sheet, ni dice que las proporciones y el atuendo deben coincidir entre ellos.",
    },
    {
      title: "Fondos (Krea 2 Turbo / Qwen edit)",
      template: "image_krea2_turbo_int8_image_style_reference",
      good: "Fondo pintado, estilo acuarela Ghibli, profundidad en capas: follaje en primer plano, tejados en plano medio, montañas lejanas entre bruma. Sin personas. Luz de día suave y difusa.",
      bad: "bonito fondo de anime",
      badNote: "Sin capas de profundidad, sin referencia nombrada, sin luz — tres cosas que necesita un fondo para parecer pintado y no plano.",
    },
    {
      title: "Planos de interpretación (Wan 2.2 14B + AniSora)",
      template: "video_wan2_2_14B_i2v",
      good: "El personaje entra en cuadro, ritmo on-twos, un paso con transferencia de peso, pelo y ropa con un breve retraso de movimiento secundario, cel shading, coherente con el key visual del proyecto.",
      bad: "haz que se mueva",
      badNote: "No dice nada sobre el ritmo, el peso ni el movimiento secundario — las tres cosas que hacen que un movimiento se lea como intencionado y no genérico.",
    },
    {
      title: "Planos de cámara / abiertos (LTX-2.5)",
      template: "video_ltx2_5_i2v",
      good: "Travelling de avance lento sobre un skyline pintado a la hora dorada, haces de luz volumétrica estilo Makoto Shinkai entre nubes, paralaje visible entre capas de profundidad, sin temblor de cámara.",
      bad: "movimiento de cámara cinematográfico",
      badNote: "No nombra ningún movimiento de cámara, ninguna luz, ninguna referencia — «cinematográfico» solo no es una instrucción visual.",
    },
  ],
  back: "← Volver a la guía",
  openStudio: "Abrir el estudio",
};

export const ANIME_GUIDE: Record<AnimeGuideLocale, AnimeGuideCopy> = { en, fr, de, es };

export function animeGuide(locale: string): AnimeGuideCopy {
  return ANIME_GUIDE[(locale as AnimeGuideLocale)] ?? en;
}
