/**
 * Studio-side language adapter for the pinned Agent kernel.
 * The kernel understands French and English keywords and answers in French or English.
 * This adapter keeps the vendored kernel untouched: it rewrites German and Spanish
 * requests (and French conjugations such as « monte ») into keywords the kernel already
 * knows, feeds the result back as a local interpretation, then replaces the kernel's
 * reply by the catalogue text of the active locale (tutoiement: tu / du / tú).
 * Nothing here calls a model, a network or Comfy.
 */
import { fold, interpretLocally, productionTurn, type Conversation, type Interpretation, type ProductionContext } from "./kernel/production.ts";

export type AgentLocale = "fr" | "en" | "de" | "es";
export const agentLocale = (locale: string): AgentLocale => (["fr", "en", "de", "es"].includes(locale) ? locale : "en") as AgentLocale;

// Media questions open the project library (FR, EN, DE, ES). Everything else goes to the production planner.
export const MEDIA_SEARCH = /retrouve|montre|recherche|quels fichiers|derni[eè]re image|find|show|missing|class(e|er)|\b(finde|zeig|such)\w*|letzte[ns]? bild|welche dateien|fehlend|ordne|sortier|\b(busca|encuentra|muestra)\w*|[uú]ltima imagen|qu[eé] archivos|falta|ordena|clasific/i;
export const MEDIA_CLASSIFY = /class(e|er)|ordne|sortier|ordena|clasific/i;

type Rule = [RegExp, string];
// Applied on folded text (lower case, no diacritics). Order matters: phrases before words.
const FR: Rule[] = [
  [/\bmont(e|es|ent|ons)\b/g, "montage"],
];
const DE: Rule[] = [
  [/\b(ganze[nrs]?|komplette[nrs]?) film\b|\bkurzfilm\w*/g, "complete film"],
  [/\b(ohne|kein\w*) (musik)\b/g, "without music"],
  [/\b(ohne|kein\w*) (ton|sound)\b/g, "without sound"],
  [/\bohne\b|\bkein\w*|\bnicht\b/g, "without"],
  [/\bhintergrund\w* (entfern|losch|weg)\w*|\b(entfern|losch)\w* (den |die |das )?hintergrund\w*|\bfreistell\w*|\bstell\w* (\w+ ){0,3}frei\b/g, "remove background"],
  [/\b(vor)?bereit\w*|\b\w*erstell\w*|\banleg\w*|\bleg\w* (\w+ ){0,3}an\b/g, "prepare"],
  [/\bimportier\w*/g, "import"],
  [/\b(figur|figuren|charakter\w*|person|personen|darsteller\w*)\b/g, "character"],
  [/\b(ansichtsblatt|figurenblatt|blatt|blatter)\b/g, "sheet"],
  [/\b(street.?view|stadtplan|karte)\b/g, "map"],
  [/\b(echter? (ort|drehort)|realer? ort|drehortsuche|location.?scouting)\b/g, "real location"],
  [/\b(kulisse\w*|szenenbild\w*|hintergrund\w*|umgebung\w*|schauplatz\w*|drehort\w*|ort|orte)\b/g, "decor"],
  [/\b(einstellung\w*|aufnahme\w*|szene|szenen)\b/g, "shots"],
  [/\b(drei)\b/g, "three"], [/\b(zwei)\b/g, "two"],
  [/\b(dreh\w*|film(e|en|t)|generier\w*|render\w*)\b/g, "render"],
  [/\b(schneid\w*|schnitt\w*|zusammenschneid\w*|zusammenfug\w*|montier\w*)\b/g, "montage"],
  [/\bexportier\w*/g, "export"],
  [/\b(sicher(e|n|st|t|ung\w*)|speicher\w*)\b/g, "backup"],
  [/\b(wieder ?offn\w*|erneut offn\w*)\b/g, "reopen"],
  [/\b(projekte)\b/g, "projects"],
  [/\b(auftrag|auftrage|aufgabe\w*|wiederherstell\w*|abruf\w*)\b/g, "jobs"],
  [/\b(trainier\w*)\b/g, "training"],
  [/\b(scharf\w*|hochskalier\w*|qualitat verbesser\w*)\b/g, "upscale"],
  [/\b(animier\w*)\b/g, "animate"],
  [/\b(sprech\w*|lippen\w*)\b/g, "talking"],
  [/\b(verlanger\w*)\b/g, "extend video"],
  [/\b(gerausch\w*|soundeffekt\w*)\b/g, "sound effects"],
  [/\b(musik)\b/g, "music"],
  [/\b(stimme\w*|sprecher\w*|erzahl\w*)\b/g, "voice"],
];
const ES: Rule[] = [
  [/\b(pelicula completa|cortometraje\w*)\b/g, "complete film"],
  [/\bsin (musica)\b/g, "without music"],
  [/\bsin (sonido)\b/g, "without sound"],
  [/\bsin\b|\bno\b|\bnada de\b/g, "without"],
  [/\b(quit|elimin|borr)\w* (el )?fondo\b|\brecort\w*/g, "remove background"],
  [/\b(prepar\w*|crea\w*|haz|hacer|genera(r)? un)\b/g, "prepare"],
  [/\bimport\w*/g, "import"],
  [/\b(personaje\w*)\b/g, "character"],
  [/\b(hoja\w*)\b/g, "sheet"],
  [/\b(mapa)\b/g, "map"],
  [/\b(lugar real|ubicacion real|localizacion real)\b/g, "real location"],
  [/\b(decorado\w*|escenario\w*|entorno\w*|fondo\w*|lugar\w*|ubicacion\w*|localizacion\w*)\b/g, "decor"],
  [/\b(toma|tomas|plano|planos|escena|escenas)\b/g, "shots"],
  [/\b(tres)\b/g, "three"], [/\b(dos)\b/g, "two"],
  [/\b(rod\w*|rued\w*|filma\w*|genera\w*|renderiza\w*)\b/g, "render"],
  [/\b(monta|montas|montar|monte|montes|montaje|edita|editar|edicion|ensambla\w*|une las|unir)\b/g, "montage"],
  [/\bexport\w*/g, "export"],
  [/\b(guard\w*|respald\w*|copia de seguridad)\b/g, "backup"],
  [/\b(reabr\w*|vuelve a abrir|volver a abrir)\b/g, "reopen"],
  [/\b(proyectos)\b/g, "projects"],
  [/\b(trabajos?|tareas?|recuper\w*)\b/g, "jobs"],
  [/\b(entren\w*)\b/g, "training"],
  [/\b(nitidez|mejora\w* (la )?calidad|reescal\w*)\b/g, "upscale"],
  [/\b(anima\w*)\b/g, "animate"],
  [/\b(habl\w*|labios)\b/g, "talking"],
  [/\b(alarg\w*|extiend\w*|prolong\w*)\b/g, "extend video"],
  [/\b(efectos? de sonido)\b/g, "sound effects"],
  [/\b(musica)\b/g, "music"],
  [/\b(voz|voces|narra\w*)\b/g, "voice"],
];
const RULES: Record<AgentLocale, Rule[]> = { fr: FR, en: [], de: DE, es: ES };
const CONTINUE: Record<AgentLocale, RegExp> = {
  fr: /^$/, en: /^$/,
  de: /^(weiter|weitermachen|fortfahren|und dann|nachster schritt)[.! ?]*$/,
  es: /^(continua|continuar|sigue|seguir|siguiente|y despues)[.! ?]*$/,
};

/** Rewrites a request into keywords the kernel knows. The original text is never stored in this form. */
export function toKernelLanguage(message: string, locale: AgentLocale): string {
  let text = fold(message);
  for (const [pattern, word] of RULES[locale]) text = text.replace(pattern, ` ${word} `);
  return text.replace(/\s+/g, " ").trim();
}

export function interpretAgentRequest(message: string, context: ProductionContext, locale: AgentLocale): string[] {
  return interpretLocally(toKernelLanguage(message, locale), context);
}

const KERNEL_REPLIES: Record<string, [string, string]> = {
  preserved: ["Le plan est conservé. Vérifie la prochaine étape ci-dessous.", "Your plan is preserved. Review the next step below."],
  complete: ["Le plan est terminé. Que veux-tu préparer ensuite ?", "The plan is complete. What would you like to prepare next?"],
  which: ["Quelle partie veux-tu préparer : personnage, décor, prise, montage, son ou export ? Ton plan actuel est conservé.", "Which part should we prepare: character, location, shot, edit, audio or export? Your current plan is preserved."],
  describe: ["Décris le sujet, l’action ou l’ambiance à conserver dans ce plan.", "Describe the subject, action or atmosphere to keep in this plan."],
  plan: ["Voici les étapes proposées. Préparer une étape n’autorise aucune génération payante. Valide chaque résultat avant de continuer.", "Here is the proposed sequence. Preparing a step does not authorize a paid generation. Review each result before continuing."],
};
export const AGENT_REPLY_KEYS = Object.keys(KERNEL_REPLIES);
export function replyKey(text: string): string | undefined {
  return AGENT_REPLY_KEYS.find(key => KERNEL_REPLIES[key].includes(text));
}

/**
 * One conversation turn in the active locale. `interpretation` (optional semantic layer)
 * wins when present; otherwise the local adapter above provides the operation ids.
 */
export function localizedTurn(previous: Conversation, message: string, context: ProductionContext, locale: AgentLocale, t: (key: string) => string, interpretation?: Interpretation, at?: number): Conversation {
  const original = message.trim();
  const folded = fold(original);
  const continuing = CONTINUE[locale].test(folded);
  const input = continuing ? "continue" : original;
  const local: Interpretation = { operationIds: interpretAgentRequest(original, context, locale), confidence: 1 };
  const next = productionTurn(previous, input, context, { at, interpretation: interpretation ?? local, language: locale === "fr" ? "fr" : "en" });
  if (next === previous) return next;
  const messages = [...next.messages];
  const last = messages.length - 1;
  const key = replyKey(messages[last]?.text ?? "");
  if (key && messages[last].role === "assistant") messages[last] = { ...messages[last], text: t(`agent.reply.${key}`) };
  if (continuing && messages[last - 1]?.role === "user") messages[last - 1] = { ...messages[last - 1], text: original.slice(0, 2000) };
  let plan = next.plan;
  // The kernel counts « trois/three/deux/two »; German and Spanish numbers are read here.
  const count = /\b(drei|tres)\b/.test(folded) ? 3 : /\b(zwei|dos)\b/.test(folded) ? 2 : 0;
  if (plan && count && plan !== previous.plan) plan = { ...plan, steps: plan.steps.map(s => s.operationId === "local:shots" && s.quantity === 1 ? { ...s, quantity: count } : s) };
  return { ...next, plan, messages };
}
