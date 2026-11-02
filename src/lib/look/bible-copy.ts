// Anime bible copy. English is the default. Prices stay estimates.

import type { Locale } from "../i18n/config.ts";
import type { AnimePreset } from "./model.ts";

export interface BibleCopy {
  kicker: string;
  title: string;
  lede: string;
  frame: string;
  replace: string;
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
  make: string;
  storyboard: string;
  note: string;
  caption: string;
  confirmTitle: string;
  confirmBody: string;
  confirmYes: string;
  confirmNo: string;
  prepared: string;
  lockConfirm: string;
  emptyCast: string;
  emptyPlaces: string;
}

const en: BibleCopy = {
  kicker: "Anime bible · locked for this project",
  title: "Same *line*, same light, every shot.",
  lede: "Uttu reads these locks before making anything. Change one and she tells you which pictures need remaking, with the price, before doing it.",
  frame: "Style frame",
  replace: "Replace",
  locks: { line: "Line", shading: "Shading", palette: "Palette", depth: "Depth" },
  lockLine: "Fine ink, darker on the outline",
  lockShading: "2-tone cel + warm rim light",
  lockDepth: "Painted layers, 3D camera",
  timing: "Anime timing",
  timingNote: "Characters move “on twos”, like hand-drawn animation. Camera moves stay smooth.",
  timingSave: "Save timing",
  timingCancel: "Cancel",
  castKicker: "Cast",
  sheet: "Character sheet",
  made: "◆ made in this look",
  addCharacter: "＋ Character",
  sheetNote: "Sheets come from your Cast photos, redrawn in the project look.",
  placesKicker: "Places",
  places: "Painted backgrounds",
  concept: "Concept art",
  make: "Make the sheet and places",
  storyboard: "Go to the storyboard",
  note: "Confirm first. Nothing starts without your yes.",
  caption: "Concept art — your project is rendered on Comfy with the open anime pipeline",
  confirmTitle: "Make the sheet and places",
  confirmBody: "This is the quote. Nothing is sent until you approve a render later.",
  confirmYes: "Keep this quote",
  confirmNo: "Back",
  prepared: "Quote kept. Nothing was sent.",
  lockConfirm: "Saving this lock does not redraw anything. Pictures already made stay until you approve a new one.",
  emptyCast: "Your cast",
  emptyPlaces: "Your places",
};

const fr: BibleCopy = {
  ...en,
  kicker: "Bible anime · verrouillée pour ce projet",
  title: "Le même *trait*, la même lumière, à chaque plan.",
  lede: "Uttu lit ces verrous avant de faire quoi que ce soit. Change-en un et elle te dit quelles images refaire, avec le prix, avant de le faire.",
  frame: "Cadre de style",
  replace: "Remplacer",
  locks: { line: "Trait", shading: "Ombrage", palette: "Palette", depth: "Profondeur" },
  lockLine: "Encre fine, plus sombre sur le contour",
  lockShading: "Cel 2 tons + rim light chaud",
  lockDepth: "Couches peintes, caméra 3D",
  timing: "Rythme anime",
  timingNote: "Les personnages bougent « on twos », comme un dessin animé. La caméra reste fluide.",
  timingSave: "Enregistrer le rythme",
  timingCancel: "Annuler",
  castKicker: "Cast",
  sheet: "Planche personnage",
  made: "◆ fait dans ce look",
  addCharacter: "＋ Personnage",
  sheetNote: "Les planches viennent des photos de ton Cast, redessinées dans le look du projet.",
  placesKicker: "Lieux",
  places: "Fonds peints",
  concept: "Concept art",
  make: "Faire la planche et les lieux",
  storyboard: "Aller au storyboard",
  note: "Confirmation d'abord. Rien ne part sans ton oui.",
  caption: "Concept art — ton projet est rendu sur Comfy avec le pipeline anime ouvert",
  confirmTitle: "Faire la planche et les lieux",
  confirmBody: "Voici le devis. Rien n'est envoyé tant que tu n'approuves pas un rendu plus tard.",
  confirmYes: "Garder ce devis",
  confirmNo: "Retour",
  prepared: "Devis gardé. Rien n'a été envoyé.",
  lockConfirm: "Enregistrer ce verrou ne redessine rien. Les images déjà faites restent tant que tu n'approuves pas une nouvelle.",
  emptyCast: "Ton cast",
  emptyPlaces: "Tes lieux",
};

const de: BibleCopy = {
  ...en,
  kicker: "Anime-Bibel · für dieses Projekt verriegelt",
  title: "Dieselbe *Linie*, dasselbe Licht, jede Einstellung.",
  lede: "Uttu liest diese Verriegelungen, bevor sie etwas macht. Änderst du eine, sagt sie dir, welche Bilder neu müssen, mit dem Preis, bevor sie es tut.",
  frame: "Stilbild",
  replace: "Ersetzen",
  locks: { line: "Linie", shading: "Schattierung", palette: "Palette", depth: "Tiefe" },
  lockLine: "Feine Tinte, dunkler an der Kontur",
  lockShading: "2-Ton-Cel + warmes Rim Light",
  lockDepth: "Gemalte Schichten, 3D-Kamera",
  timing: "Anime-Timing",
  timingNote: "Figuren bewegen sich « on twos », wie gezeichnet. Kamerafahrten bleiben flüssig.",
  timingSave: "Timing sichern",
  timingCancel: "Abbrechen",
  sheet: "Figurenblatt",
  made: "◆ in diesem Look gemacht",
  addCharacter: "＋ Figur",
  sheetNote: "Die Blätter kommen aus deinen Cast-Fotos, neu gezeichnet im Look des Projekts.",
  placesKicker: "Orte",
  places: "Gemalte Hintergründe",
  make: "Blatt und Orte machen",
  storyboard: "Zum Storyboard",
  note: "Erst bestätigen. Ohne dein Ja startet nichts.",
  caption: "Concept Art — dein Projekt wird auf Comfy mit der offenen Anime-Pipeline gerendert",
  confirmTitle: "Blatt und Orte machen",
  confirmBody: "Das ist die Schätzung. Es wird nichts gesendet, bis du später ein Rendering freigibst.",
  confirmYes: "Schätzung behalten",
  confirmNo: "Zurück",
  prepared: "Schätzung behalten. Es wurde nichts gesendet.",
  lockConfirm: "Diese Verriegelung speichern zeichnet nichts neu. Vorhandene Bilder bleiben, bis du ein neues freigibst.",
  emptyCast: "Dein Cast",
  emptyPlaces: "Deine Orte",
};

const es: BibleCopy = {
  ...en,
  kicker: "Biblia anime · cerrada para este proyecto",
  title: "El mismo *trazo*, la misma luz, en cada plano.",
  lede: "Uttu lee estos cierres antes de hacer nada. Cambia uno y te dice qué imágenes hay que rehacer, con el precio, antes de hacerlo.",
  frame: "Fotograma de estilo",
  replace: "Reemplazar",
  locks: { line: "Trazo", shading: "Sombra", palette: "Paleta", depth: "Profundidad" },
  lockLine: "Tinta fina, más oscura en el contorno",
  lockShading: "Cel de 2 tonos + luz de contorno cálida",
  lockDepth: "Capas pintadas, cámara 3D",
  timing: "Ritmo anime",
  timingNote: "Los personajes se mueven « on twos », como el dibujo a mano. La cámara sigue suave.",
  timingSave: "Guardar el ritmo",
  timingCancel: "Cancelar",
  castKicker: "Reparto",
  sheet: "Hoja de personaje",
  made: "◆ hecho en este look",
  addCharacter: "＋ Personaje",
  sheetNote: "Las hojas salen de las fotos de tu reparto, redibujadas en el look del proyecto.",
  placesKicker: "Lugares",
  places: "Fondos pintados",
  make: "Hacer la hoja y los lugares",
  storyboard: "Ir al storyboard",
  note: "Confirma primero. No empieza nada sin tu sí.",
  caption: "Arte conceptual — tu proyecto se renderiza en Comfy con el pipeline de anime abierto",
  confirmTitle: "Hacer la hoja y los lugares",
  confirmBody: "Este es el presupuesto. No se envía nada hasta que apruebes un render más tarde.",
  confirmYes: "Guardar este presupuesto",
  confirmNo: "Volver",
  prepared: "Presupuesto guardado. No se envió nada.",
  lockConfirm: "Guardar este cierre no redibuja nada. Las imágenes ya hechas se quedan hasta que apruebes una nueva.",
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
