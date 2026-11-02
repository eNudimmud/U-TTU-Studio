// Guide home. English is the source; FR, DE and ES follow it.

export type GuideLocale = "en" | "fr" | "de" | "es";

export interface GuideHome {
  kicker: string;
  title: string;
  titleEm: string;
  lede: string;
  toc: { id: string; label: string }[];
  startTitle: string;
  start: { n: string; title: string; body: string; href?: string; link?: string }[];
  stepsTitle: string;
  steps: { title: string; body: string }[];
  lookTitle: string;
  lookBody: string;
  costsTitle: string;
  costs: { label: string; price: string }[];
  costsNote: string;
  faqTitle: string;
  faq: { q: string; a: string }[];
  toolsTitle: string;
  toolsBody: string;
  toolsLink: string;
  openStudio: string;
}

const en: GuideHome = {
  kicker: "Guide",
  title: "Learn here.",
  titleEm: "Shoot",
  lede: "How the studio works, what each step does, what things cost. The studio stays clean for your work; every explanation lives here.",
  toc: [
    { id: "start", label: "Start" },
    { id: "steps", label: "The 5 steps" },
    { id: "look", label: "Anime 2.5D" },
    { id: "costs", label: "Costs" },
    { id: "faq", label: "FAQ" },
  ],
  startTitle: "Three things, then you shoot.",
  start: [
    { n: "01", title: "Connect your Comfy account", body: "Renders run on your own Comfy Cloud account. Your key stays in your browser." },
    { n: "02", title: "Make your first character", body: "One sentence or up to 4 photos. The quote shows before anything runs.", href: "/studio#personnage", link: "Open Cast" },
    { n: "03", title: "Ask Uttu when stuck", body: "The round button in the studio bar. She suggests; you launch." },
  ],
  stepsTitle: "Cast · Set · Shoot · Edit · Finish",
  steps: [
    { title: "Cast", body: "Your characters, the same face in every shot." },
    { title: "Set", body: "A place from a text, a photo, or a real location scouted in 3D." },
    { title: "Shoot", body: "Prepare, frame, preview in 3D, render, keep the best take." },
    { title: "Edit", body: "Four tracks — video, voice, music, text. MP4 export runs in your browser, no render." },
    { title: "Finish", body: "Makes the kept takes sharper and larger. Nothing is regenerated." },
  ],
  lookTitle: "Anime 2.5D",
  lookBody: "A setting of the whole project, chosen once. Wide shots and camera moves go to LTX-2.5; acting shots to Wan 2.2 with AniSora; Finish uses a Real-ESRGAN anime pass. Choosing the look starts no render.",
  costsTitle: "A quote before every credit.",
  costs: [
    { label: "A character picture · FLUX.3 Klein", price: "≈ 4–6 credits estimated" },
    { label: "A reference-true shot · MiniMax H3", price: "≈ 4–6 credits estimated" },
    { label: "A shot with a camera move · LTX-2.5", price: "≈ 18–27 credits estimated" },
    { label: "An anime shot, 5 s · Anime 2.5D", price: "≈ 16 credits estimated" },
    { label: "Finish a 5 s take · SeedVR2", price: "≈ 42–63 credits estimated" },
    { label: "A message to Uttu", price: "≈ 0.2 credits estimated at most" },
    { label: "Edit and MP4 export", price: "no render" },
  ],
  costsNote: "The exact quote is shown again in the tool before you confirm. Nothing is sent from this page.",
  faqTitle: "Questions",
  faq: [
    { q: "How do I start?", a: "Open the studio, connect your Comfy account, then start with Cast. Every button shows ≈ how many credits it costs before it starts." },
    { q: "What costs credits?", a: "Image, video, sound and 3D renders, on your Comfy Cloud account. Uttu’s replies cost a little; touring the studio, scouting a place on the map and exporting your edit start no render." },
    { q: "Do I need a Comfy subscription?", a: "Yes, to run renders: they go through the Comfy Cloud API. Check plans and prices on comfy.org." },
    { q: "Is my key safe?", a: "Your key stays in your browser; the studio keeps no key on a server. If it leaks, delete it on platform.comfy.org and make a new one." },
    { q: "Can I cancel a render?", a: "Once sent to Comfy, the studio never cancels it. If the page closes, “Recover the render” reads the job already sent, without starting a new one." },
    { q: "Image or video: how do I create?", a: "In “What are we shooting?”, pick Image or Video before you type. Video with references runs on MiniMax H3, otherwise on LTX. The quote shows under the bubble before anything is sent." },
    { q: "What is StoryWeave?", a: "The new storyboard: talk with Uttu, a panel per character, place and scene, a four-track timeline. Coming soon." },
  ],
  toolsTitle: "Know every engine.",
  toolsBody: "Plain notes on each engine: what it does best, where it slips, one tip, what it costs and its licence.",
  toolsLink: "Browse the tools",
  openStudio: "Open the studio",
};

const fr: GuideHome = {
  ...en,
  title: "Apprends ici.",
  titleEm: "Tourne",
  lede: "Comment le studio marche, ce que fait chaque étape, ce que ça coûte. Le studio reste net pour ton travail ; chaque explication est ici.",
  toc: [
    { id: "start", label: "Commencer" },
    { id: "steps", label: "Les 5 étapes" },
    { id: "look", label: "Anime 2.5D" },
    { id: "costs", label: "Coûts" },
    { id: "faq", label: "FAQ" },
  ],
  startTitle: "Trois choses, puis tu tournes.",
  start: [
    { n: "01", title: "Relie ton compte Comfy", body: "Les rendus tournent sur ton propre compte Comfy Cloud. Ta clé reste dans le navigateur." },
    { n: "02", title: "Fais ton premier personnage", body: "Une phrase, ou jusqu’à 4 photos. Le devis s’affiche avant tout lancement.", href: "/studio#personnage", link: "Ouvrir CAST" },
    { n: "03", title: "Demande à Uttu si tu bloques", body: "Le bouton rond dans la barre du studio. Elle propose ; tu lances." },
  ],
  stepsTitle: "CAST · DÉCOR · PRISE · MONTAGE · FINALISER",
  steps: [
    { title: "CAST", body: "Tes personnages, le même visage dans chaque plan." },
    { title: "DÉCOR", body: "Un lieu à partir d’un texte, d’une photo, ou d’un vrai endroit repéré en 3D." },
    { title: "PRISE", body: "Préparer, cadrer, prévisualiser en 3D, rendre, garder la meilleure prise." },
    { title: "MONTAGE", body: "Quatre pistes — vidéo, voix, musique, texte. L’export MP4 tourne dans ton navigateur, aucun rendu." },
    { title: "FINALISER", body: "Rend les prises gardées plus nettes et plus grandes. Rien n’est régénéré." },
  ],
  lookBody: "Un réglage de tout le projet, choisi une fois. Les plans larges et les mouvements de caméra vont vers LTX-2.5 ; le jeu vers Wan 2.2 avec AniSora ; Finaliser utilise une passe Real-ESRGAN anime. Choisir le look ne lance aucun rendu.",
  costsTitle: "Un devis avant chaque crédit.",
  costs: [
    { label: "Une image de personnage · FLUX.3 Klein", price: "≈ 4–6 crédits estimés" },
    { label: "Un plan fidèle aux références · MiniMax H3", price: "≈ 4–6 crédits estimés" },
    { label: "Un plan avec mouvement de caméra · LTX-2.5", price: "≈ 18–27 crédits estimés" },
    { label: "Un plan anime, 5 s · Anime 2.5D", price: "≈ 16 crédits estimés" },
    { label: "Finaliser une prise de 5 s · SeedVR2", price: "≈ 42–63 crédits estimés" },
    { label: "Un message à Uttu", price: "≈ 0,2 crédit estimé au plus" },
    { label: "Montage et export MP4", price: "aucun rendu" },
  ],
  costsNote: "Le devis exact s’affiche encore dans l’outil avant ta confirmation. Rien n’est envoyé depuis cette page.",
  faqTitle: "Questions",
  faq: [
    { q: "Comment je commence ?", a: "Ouvre le studio, relie ton compte Comfy, puis commence par CAST. Chaque bouton montre ≈ combien de crédits il coûte avant de partir." },
    { q: "Qu’est-ce qui coûte des crédits ?", a: "Les rendus image, vidéo, son et 3D, sur ton compte Comfy Cloud. Les réponses d’Uttu coûtent un peu ; visiter le studio, repérer un lieu sur la carte et exporter le montage ne lancent aucun rendu." },
    { q: "Faut-il un abonnement Comfy ?", a: "Oui, pour lancer des rendus : ils passent par l’API Comfy Cloud. Les offres et les prix sont sur comfy.org." },
    { q: "Ma clé est-elle en sécurité ?", a: "Ta clé reste dans le navigateur ; le studio n’en garde aucune sur un serveur. Si elle fuit, supprime-la sur platform.comfy.org et fais-en une nouvelle." },
    { q: "Puis-je annuler un rendu ?", a: "Une fois envoyé à Comfy, le studio ne l’annule jamais. Si la page se ferme, « Récupérer le rendu » lit le travail déjà envoyé, sans en lancer un nouveau." },
    { q: "Image ou vidéo : comment créer ?", a: "Dans « Qu’est-ce qu’on tourne ? », choisis Image ou Vidéo avant d’écrire. La vidéo avec références tourne sur MiniMax H3, sinon sur LTX. Le devis s’affiche sous la bulle avant tout envoi." },
    { q: "Qu’est-ce que StoryWeave ?", a: "Le nouveau storyboard : parler avec Uttu, un panneau par personnage, lieu et scène, une timeline à quatre pistes. Bientôt." },
  ],
  toolsTitle: "Connais chaque moteur.",
  toolsBody: "Des notes simples sur chaque moteur : ce qu’il fait de mieux, où il dérape, une astuce, son coût et sa licence.",
  toolsLink: "Voir les outils",
  openStudio: "Ouvrir le studio",
};

const de: GuideHome = {
  ...en,
  title: "Lern hier.",
  titleEm: "Dreh",
  lede: "Wie das Studio arbeitet, was jeder Schritt tut, was es kostet. Das Studio bleibt ruhig für deine Arbeit; jede Erklärung steht hier.",
  toc: [
    { id: "start", label: "Start" },
    { id: "steps", label: "Die 5 Schritte" },
    { id: "look", label: "Anime 2.5D" },
    { id: "costs", label: "Kosten" },
    { id: "faq", label: "FAQ" },
  ],
  startTitle: "Drei Dinge, dann drehst du.",
  start: [
    { n: "01", title: "Verbinde dein Comfy-Konto", body: "Renders laufen auf deinem eigenen Comfy-Cloud-Konto. Dein Schlüssel bleibt im Browser." },
    { n: "02", title: "Mach deine erste Figur", body: "Ein Satz oder bis zu 4 Fotos. Das Angebot steht da, bevor etwas läuft.", href: "/studio#personnage", link: "Besetzung öffnen" },
    { n: "03", title: "Frag Uttu, wenn du stockst", body: "Der runde Knopf in der Studioleiste. Sie schlägt vor; du startest." },
  ],
  stepsTitle: "Besetzung · Kulisse · Take · Schnitt · Finalisieren",
  steps: [
    { title: "Besetzung", body: "Deine Figuren, dasselbe Gesicht in jeder Einstellung." },
    { title: "Kulisse", body: "Ein Ort aus Text, Foto oder einem echten Platz in 3D." },
    { title: "Take", body: "Vorbereiten, kadrieren, in 3D ansehen, rendern, den besten Take behalten." },
    { title: "Schnitt", body: "Vier Spuren — Video, Stimme, Musik, Text. Der MP4-Export läuft im Browser, kein Rendering." },
    { title: "Finalisieren", body: "Macht die behaltenen Takes schärfer und größer. Nichts wird neu erzeugt." },
  ],
  lookBody: "Eine Einstellung für das ganze Projekt, einmal gewählt. Weite Einstellungen und Kamerafahrten gehen an LTX-2.5; Spiel an Wan 2.2 mit AniSora; Finalisieren nutzt Real-ESRGAN anime. Die Wahl startet kein Rendering.",
  costsTitle: "Ein Angebot vor jedem Credit.",
  costs: en.costs.map((row, i) => ({ ...row, price: row.price.replace("credits estimated", "Credits geschätzt").replace("no render", "kein Rendering").replace("at most", "höchstens") })),
  costsNote: "Das genaue Angebot steht noch einmal im Werkzeug, bevor du bestätigst. Von dieser Seite wird nichts gesendet.",
  faqTitle: "Fragen",
  faq: [
    { q: "Wie fange ich an?", a: "Öffne das Studio, verbinde dein Comfy-Konto und beginn mit der Besetzung. Jeder Knopf zeigt ≈ wie viele Credits er kostet, bevor er startet." },
    { q: "Was kostet Credits?", a: "Bild-, Video-, Ton- und 3D-Renders auf deinem Comfy-Cloud-Konto. Uttus Antworten kosten wenig; das Studio ansehen, einen Ort auf der Karte suchen und den Schnitt exportieren starten kein Rendering." },
    { q: "Brauche ich ein Comfy-Abo?", a: "Ja, um Renders zu starten: sie laufen über die Comfy-Cloud-API. Pläne und Preise stehen auf comfy.org." },
    { q: "Ist mein Schlüssel sicher?", a: "Dein Schlüssel bleibt im Browser; das Studio bewahrt keinen Schlüssel auf einem Server. Wenn er bekannt wird, lösch ihn auf platform.comfy.org und mach einen neuen." },
    { q: "Kann ich einen Render abbrechen?", a: "Einmal an Comfy gesendet, bricht das Studio ihn nie ab. Schließt die Seite, liest „Render wiederholen“ den schon gesendeten Job, ohne einen neuen zu starten." },
    { q: "Bild oder Video: wie erstelle ich?", a: "Unter „Was drehen wir?“ wählst du Bild oder Video, bevor du schreibst. Video mit Referenzen läuft auf MiniMax H3, sonst auf LTX. Das Angebot steht unter der Blase, bevor etwas gesendet wird." },
    { q: "Was ist StoryWeave?", a: "Das neue Storyboard: mit Uttu reden, ein Panel je Figur, Ort und Szene, eine Timeline mit vier Spuren. Kommt bald." },
  ],
  toolsTitle: "Kenn jeden Motor.",
  toolsBody: "Kurze Notizen zu jedem Motor: was er am besten kann, wo er rutscht, ein Tipp, was er kostet und seine Lizenz.",
  toolsLink: "Werkzeuge ansehen",
  openStudio: "Studio öffnen",
};

const es: GuideHome = {
  ...en,
  title: "Aprende aquí.",
  titleEm: "Rueda",
  lede: "Cómo funciona el estudio, qué hace cada paso, cuánto cuesta. El estudio se queda limpio para tu trabajo; cada explicación vive aquí.",
  toc: [
    { id: "start", label: "Empezar" },
    { id: "steps", label: "Los 5 pasos" },
    { id: "look", label: "Anime 2.5D" },
    { id: "costs", label: "Costes" },
    { id: "faq", label: "FAQ" },
  ],
  startTitle: "Tres cosas, y ruedas.",
  start: [
    { n: "01", title: "Conecta tu cuenta de Comfy", body: "Los renders corren en tu propia cuenta de Comfy Cloud. Tu clave se queda en el navegador." },
    { n: "02", title: "Haz tu primer personaje", body: "Una frase o hasta 4 fotos. El presupuesto aparece antes de que nada arranque.", href: "/studio#personnage", link: "Abrir Reparto" },
    { n: "03", title: "Pregunta a Uttu si te atascas", body: "El botón redondo en la barra del estudio. Ella propone; tú lanzas." },
  ],
  stepsTitle: "Reparto · Decorado · Toma · Montaje · Finalizar",
  steps: [
    { title: "Reparto", body: "Tus personajes, la misma cara en cada plano." },
    { title: "Decorado", body: "Un lugar desde un texto, una foto o un sitio real en 3D." },
    { title: "Toma", body: "Preparar, encuadrar, previsualizar en 3D, renderizar, guardar la mejor toma." },
    { title: "Montaje", body: "Cuatro pistas — vídeo, voz, música, texto. La exportación MP4 corre en tu navegador, sin render." },
    { title: "Finalizar", body: "Hace las tomas guardadas más nítidas y más grandes. Nada se regenera." },
  ],
  lookBody: "Un ajuste de todo el proyecto, elegido una vez. Los planos abiertos y los movimientos de cámara van a LTX-2.5; la interpretación a Wan 2.2 con AniSora; Finalizar usa un pase Real-ESRGAN anime. Elegir el look no lanza ningún render.",
  costsTitle: "Un presupuesto antes de cada crédito.",
  costs: en.costs.map(row => ({ ...row, price: row.price.replace("credits estimated", "créditos estimados").replace("no render", "sin render").replace("at most", "como máximo") })),
  costsNote: "El presupuesto exacto vuelve a mostrarse en la herramienta antes de confirmar. Desde esta página no se envía nada.",
  faqTitle: "Preguntas",
  faq: [
    { q: "¿Cómo empiezo?", a: "Abre el estudio, conecta tu cuenta de Comfy y empieza por Reparto. Cada botón muestra ≈ cuántos créditos cuesta antes de arrancar." },
    { q: "¿Qué cuesta créditos?", a: "Los renders de imagen, vídeo, sonido y 3D, en tu cuenta de Comfy Cloud. Las respuestas de Uttu cuestan un poco; recorrer el estudio, explorar un lugar en el mapa y exportar el montaje no lanzan ningún render." },
    { q: "¿Necesito una suscripción de Comfy?", a: "Sí, para lanzar renders: pasan por la API de Comfy Cloud. Planes y precios en comfy.org." },
    { q: "¿Mi clave está segura?", a: "Tu clave se queda en el navegador; el estudio no guarda ninguna clave en un servidor. Si se filtra, bórrala en platform.comfy.org y crea otra." },
    { q: "¿Puedo cancelar un render?", a: "Una vez enviado a Comfy, el estudio no lo cancela. Si la página se cierra, «Recuperar el render» lee el trabajo ya enviado, sin empezar uno nuevo." },
    { q: "Imagen o vídeo: ¿cómo creo?", a: "En «¿Qué rodamos?», elige Imagen o Vídeo antes de escribir. El vídeo con referencias corre en MiniMax H3, si no en LTX. El presupuesto aparece bajo la burbuja antes de enviar nada." },
    { q: "¿Qué es StoryWeave?", a: "El nuevo storyboard: hablar con Uttu, un panel por personaje, lugar y escena, una línea de tiempo de cuatro pistas. Pronto." },
  ],
  toolsTitle: "Conoce cada motor.",
  toolsBody: "Notas claras de cada motor: en qué destaca, dónde falla, un consejo, cuánto cuesta y su licencia.",
  toolsLink: "Ver las herramientas",
  openStudio: "Abrir el estudio",
};

export const GUIDE_HOME: Record<GuideLocale, GuideHome> = { en, fr, de, es };

export function guideHome(locale: string): GuideHome {
  return GUIDE_HOME[(locale as GuideLocale)] ?? en;
}
