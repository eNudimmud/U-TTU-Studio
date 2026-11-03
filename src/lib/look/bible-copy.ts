// Anime bible copy. English is the default. Prices stay estimates.

import type { Locale } from "../i18n/config.ts";
import type { AnimePreset } from "./model.ts";

export interface BibleCopy {
  kicker: string;
  title: string;
  lede: string;
  frame: string;
  replace: string;
  replaced: string;
  locks: { line: string; shading: string; palette: string; depth: string };
  lockLine: string;
  lockShading: string;
  lockDepth: string;
  timing: string;
  timingNote: string;
  timingSave: string;
  timingCancel: string;
  castKicker: string;
  sheet: string;
  made: string;
  addCharacter: string;
  sheetNote: string;
  placesKicker: string;
  places: string;
  concept: string;
  apply: string;
  applyNote: string;
  applied: string;
  nextCast: string;
  nextDecor: string;
  storyboard: string;
  note: string;
  caption: string;
  confirmTitle: string;
  confirmBody: string;
  confirmYes: string;
  confirmNo: string;
  lockConfirm: string;
  emptyCast: string;
  emptyPlaces: string;
}

const en: BibleCopy = {
  kicker: "Anime bible · locked for this project",
  title: "Same *line*, same light, every shot.",
  lede: "These are the production rules Uttu reads before making anything. Change one and she tells you which pictures need remaking, with the price, before doing it.",
  frame: "Key visual",
  replace: "Replace",
  replaced: "New reference set, shown below. Nothing was sent to render it.",
  locks: { line: "Line", shading: "Shading", palette: "Palette", depth: "Depth" },
  lockLine: "Fine ink, darker on the outline",
  lockShading: "2-tone cel + warm rim light",
  lockDepth: "Painted layers, 3D camera",
  timing: "Animation timing — on twos",
  timingNote: "Characters move “on twos” (one new drawing every 2 frames), like hand-drawn animation. Camera moves stay smooth, at full frame rate.",
  timingSave: "Save timing",
  timingCancel: "Cancel",
  castKicker: "Cast",
  sheet: "Model sheet (settei)",
  made: "◆ made in this look",
  addCharacter: "＋ Character",
  sheetNote: "Model sheets are made from your Cast photos, in Cast — once this look is applied, they come out in it.",
  placesKicker: "Places",
  places: "Backgrounds (layout)",
  concept: "Concept art",
  apply: "Apply this look to the project",
  applyNote: "No credits used. Nothing is rendered — this only sets how characters and backgrounds you make next will look.",
  applied: "Applied. Make a character or a background next — they will use this look.",
  nextCast: "Make a character →",
  nextDecor: "Make a background →",
  storyboard: "Go to the storyboard",
  note: "Confirm first. Nothing starts without your yes.",
  caption: "Concept art — shows the direction only. Nothing here was rendered by this project.",
  confirmTitle: "Apply this look to the project?",
  confirmBody: "This uses no credits and can be undone. It changes no picture already made; it only guides what you make next.",
  confirmYes: "Apply the look",
  confirmNo: "Back",
  lockConfirm: "Saving this lock does not redraw anything. Pictures already made stay until you remake them.",
  emptyCast: "Your cast",
  emptyPlaces: "Your places",
};

const fr: BibleCopy = {
  ...en,
  kicker: "Bible anime · verrouillée pour ce projet",
  title: "Le même *trait*, la même lumière, à chaque plan.",
  lede: "Ce sont les règles de production qu'Uttu lit avant de faire quoi que ce soit. Change-en une et elle te dit quelles images refaire, avec le prix, avant de le faire.",
  frame: "Key visual",
  replace: "Remplacer",
  replaced: "Nouvelle référence enregistrée, affichée ci-dessous. Rien n'a été envoyé pour la rendre.",
  locks: { line: "Trait", shading: "Ombrage", palette: "Palette", depth: "Profondeur" },
  lockLine: "Encre fine, plus sombre sur le contour",
  lockShading: "Cel 2 tons + rim light chaud",
  lockDepth: "Couches peintes, caméra 3D",
  timing: "Cadence d'animation — on twos",
  timingNote: "Les personnages bougent « on twos » (un nouveau dessin toutes les 2 images), comme un dessin animé. La caméra reste fluide, à pleine cadence.",
  timingSave: "Enregistrer la cadence",
  timingCancel: "Annuler",
  castKicker: "Cast",
  sheet: "Planche personnage (settei)",
  made: "◆ fait dans ce look",
  addCharacter: "＋ Personnage",
  sheetNote: "Les planches se font depuis tes photos de Cast, dans Cast — une fois ce look appliqué, elles en sortent.",
  placesKicker: "Lieux",
  places: "Fonds peints (layout)",
  concept: "Concept art",
  apply: "Appliquer ce look au projet",
  applyNote: "Aucun crédit utilisé. Rien n'est rendu — ça fixe juste le style des personnages et lieux que tu feras ensuite.",
  applied: "Appliqué. Fais un personnage ou un lieu ensuite — ils arriveront dans ce look.",
  nextCast: "Faire un personnage →",
  nextDecor: "Faire un lieu →",
  storyboard: "Aller au storyboard",
  note: "Confirmation d'abord. Rien ne part sans ton oui.",
  caption: "Concept art — montre la direction seulement. Rien ici n'a été rendu par ce projet.",
  confirmTitle: "Appliquer ce look au projet ?",
  confirmBody: "Ça n'utilise aucun crédit et se défait. Ça ne change aucune image déjà faite ; ça guide juste ce que tu fais ensuite.",
  confirmYes: "Appliquer le look",
  confirmNo: "Retour",
  lockConfirm: "Enregistrer ce verrou ne redessine rien. Les images déjà faites restent tant que tu ne les refais pas.",
  emptyCast: "Ton cast",
  emptyPlaces: "Tes lieux",
};

const de: BibleCopy = {
  ...en,
  kicker: "Anime-Bibel · für dieses Projekt verriegelt",
  title: "Dieselbe *Linie*, dasselbe Licht, jede Einstellung.",
  lede: "Uttu liest diese Verriegelungen, bevor sie etwas macht. Änderst du eine, sagt sie dir, welche Bilder neu müssen, mit dem Preis, bevor sie es tut.",
  frame: "Key visual",
  replace: "Ersetzen",
  replaced: "Neue Referenz gespeichert, unten gezeigt. Es wurde nichts zum Rendern gesendet.",
  locks: { line: "Linie", shading: "Schattierung", palette: "Palette", depth: "Tiefe" },
  lockLine: "Feine Tinte, dunkler an der Kontur",
  lockShading: "2-Ton-Cel + warmes Rim Light",
  lockDepth: "Gemalte Schichten, 3D-Kamera",
  timing: "Animations-Timing — on twos",
  timingNote: "Figuren bewegen sich « on twos » (eine neue Zeichnung alle 2 Bilder), wie handgezeichnet. Kamerafahrten bleiben flüssig, mit voller Bildrate.",
  timingSave: "Timing sichern",
  timingCancel: "Abbrechen",
  sheet: "Figurenblatt (Settei)",
  made: "◆ in diesem Look gemacht",
  addCharacter: "＋ Figur",
  sheetNote: "Figurenblätter entstehen aus deinen Cast-Fotos, in Cast — sobald dieser Look angewendet ist, kommen sie darin heraus.",
  placesKicker: "Orte",
  places: "Hintergründe (Layout)",
  apply: "Diesen Look auf das Projekt anwenden",
  applyNote: "Keine Credits. Es wird nichts gerendert — das legt nur fest, wie Figuren und Hintergründe aussehen, die du als Nächstes machst.",
  applied: "Angewendet. Mach als Nächstes eine Figur oder einen Ort — sie kommen in diesem Look heraus.",
  nextCast: "Figur machen →",
  nextDecor: "Ort machen →",
  storyboard: "Zum Storyboard",
  note: "Erst bestätigen. Ohne dein Ja startet nichts.",
  caption: "Concept Art — zeigt nur die Richtung. Nichts hier wurde von diesem Projekt gerendert.",
  confirmTitle: "Diesen Look auf das Projekt anwenden?",
  confirmBody: "Das braucht keine Credits und lässt sich rückgängig machen. Es ändert kein bereits gemachtes Bild; es lenkt nur, was du als Nächstes machst.",
  confirmYes: "Look anwenden",
  confirmNo: "Zurück",
  lockConfirm: "Diese Verriegelung speichern zeichnet nichts neu. Vorhandene Bilder bleiben, bis du sie neu machst.",
  emptyCast: "Dein Cast",
  emptyPlaces: "Deine Orte",
};

const es: BibleCopy = {
  ...en,
  kicker: "Biblia anime · cerrada para este proyecto",
  title: "El mismo *trazo*, la misma luz, en cada plano.",
  lede: "Uttu lee estos cierres antes de hacer nada. Cambia uno y te dice qué imágenes hay que rehacer, con el precio, antes de hacerlo.",
  frame: "Key visual",
  replace: "Reemplazar",
  replaced: "Nueva referencia guardada, mostrada abajo. No se envió nada para renderizarla.",
  locks: { line: "Trazo", shading: "Sombra", palette: "Paleta", depth: "Profundidad" },
  lockLine: "Tinta fina, más oscura en el contorno",
  lockShading: "Cel de 2 tonos + luz de contorno cálida",
  lockDepth: "Capas pintadas, cámara 3D",
  timing: "Cadencia de animación — on twos",
  timingNote: "Los personajes se mueven « on twos » (un dibujo nuevo cada 2 fotogramas), como el dibujo a mano. La cámara sigue suave, a cadencia completa.",
  timingSave: "Guardar la cadencia",
  timingCancel: "Cancelar",
  castKicker: "Reparto",
  sheet: "Hoja de personaje (settei)",
  made: "◆ hecho en este look",
  addCharacter: "＋ Personaje",
  sheetNote: "Las hojas salen de las fotos de tu reparto, en Reparto — una vez aplicado este look, salen ya en él.",
  placesKicker: "Lugares",
  places: "Fondos pintados (layout)",
  apply: "Aplicar este look al proyecto",
  applyNote: "Sin créditos. No se renderiza nada — solo fija el estilo de los personajes y lugares que hagas después.",
  applied: "Aplicado. Haz un personaje o un lugar después — saldrán en este look.",
  nextCast: "Hacer un personaje →",
  nextDecor: "Hacer un lugar →",
  storyboard: "Ir al storyboard",
  note: "Confirma primero. No empieza nada sin tu sí.",
  caption: "Arte conceptual — solo muestra la dirección. Nada aquí fue renderizado por este proyecto.",
  confirmTitle: "¿Aplicar este look al proyecto?",
  confirmBody: "No usa créditos y se puede deshacer. No cambia ninguna imagen ya hecha; solo guía lo que hagas después.",
  confirmYes: "Aplicar el look",
  confirmNo: "Volver",
  lockConfirm: "Guardar este cierre no redibuja nada. Las imágenes ya hechas se quedan hasta que las rehagas.",
  emptyCast: "Tu reparto",
  emptyPlaces: "Tus lugares",
};

export const BIBLE_COPY: Record<Locale, BibleCopy> = { en, fr, de, es };

export function bibleCopy(locale: Locale): BibleCopy {
  return BIBLE_COPY[locale] ?? en;
}

export const PALETTES: Record<AnimePreset, string[]> = {
  theatrical: ["#1d2a44", "#2f5a6a", "#b5502e", "#e8b45a", "#14131a"],
  neon: ["#120818", "#3a1d6e", "#e23d8c", "#3ec7ff", "#0a0a0c"],
  daylight: ["#f2d7a2", "#7eb6d6", "#e7e2d4", "#3d6b4f", "#1c2430"],
  darkfantasy: ["#140e18", "#3a2a22", "#8a3b2a", "#c9a75b", "#0c0c10"],
  retro: ["#1a2744", "#c45b4a", "#e6d3a3", "#2c3a4a", "#111111"],
  own: ["#1d2a44", "#2f5a6a", "#b5502e", "#e8b45a", "#14131a"],
};
