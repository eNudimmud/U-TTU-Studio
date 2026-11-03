// Uttu writes a storyboard from one sentence (SB4). Pure and deterministic, no model, no credit: the
// structure (scenes → shots, framing, camera, length, references) comes from shot-grammar principles —
// open wide on the place, introduce the character, get closer for the feeling, vary the framing, never
// two identical shots in a row, end wide. Names come only from the visitor's sentence and project.
// Words come from the visitor's language (messages/storyboard/<locale>.json → storyboard.gabarits).

import { comprendrePlan, lieuDeLaPhrase } from "../film/comprendre.ts";
import { mentionedReferences } from "../creation/mentions.ts";
import type { KnownName } from "../intention/resolve.ts";
import { foldName } from "./identites.ts";
import {
  nouvelId, refsPropres, storyboardVide, type Cadrage, type Camera, type DureeCible, type DureePlan, type Format,
  type PlanSB, type RefPlan, type Sequence, type Storyboard, planVide, REPLIQUE_MAX,
} from "./storyboard.ts";

export type TypePlan = "etablir" | "arrivee" | "detail" | "action" | "regard" | "reaction" | "mouvement" | "depart" | "dernier" | "fin";
export type TypeSequence = "unique" | "ouverture" | "coeur" | "chute";

export interface Gabarits {
  quelquun: string;
  lieu: string;
  sequences: Record<TypeSequence, { titre: string; resume: string }>;
  plans: Record<TypePlan, { titre: string; action: string }>;
  /** The same shots when no place is known: nothing says « the place », the sentence stays whole. */
  sansLieu?: Partial<Record<TypePlan, string>>;
}

export interface ContexteEcriture {
  /** The visitor's CAST cards and DÉCOR places (names only). Nothing else is ever named. */
  cast: readonly KnownName[];
  decor: readonly KnownName[];
  /** Place references the visitor named (Références box, category DÉCOR) that have no DÉCOR card yet. */
  lieuxNommes?: readonly string[];
  /** CE5-L: folded names held by two identities (homonyms). Never linked, never created: clarification. */
  ambigus?: readonly string[];
}

export interface OptionsEcriture {
  dureeCible: DureeCible;
  format: Format;
  /** The visitor picked the format: no question about it. */
  formatChoisi: boolean;
  gabarits: Gabarits;
  now: string;
  suffixe: string;
  /** True when this length has a quote for the default render: 8 s and 10 s are only used when priced. */
  dureeChiffree?(duree: DureePlan): boolean;
}

export type Question = { type: "qui" } | { type: "format" } | null;

export interface Ecrit {
  storyboard: Storyboard;
  question: Question;
  /** Names found in the project and linked. */
  repris: string[];
  /** Names that will be created by the first shot that needs them. */
  nouveaux: string[];
}

const FORME: Record<TypePlan, { cadrage: Cadrage; camera: Camera }> = {
  etablir: { cadrage: "large", camera: "fixe" },
  arrivee: { cadrage: "moyen", camera: "fixe" },
  detail: { cadrage: "detail", camera: "fixe" },
  action: { cadrage: "moyen", camera: "approche" },
  regard: { cadrage: "serre", camera: "approche" },
  reaction: { cadrage: "serre", camera: "fixe" },
  mouvement: { cadrage: "large", camera: "suit" },
  depart: { cadrage: "moyen", camera: "fixe" },
  dernier: { cadrage: "large", camera: "autour" },
  fin: { cadrage: "large", camera: "fixe" },
};

/** The découpage by target length: 15 s → 3 shots, 30 s → 3 × 2, 60 s → 3 + 4 + 3. */
const DECOUPAGE: Record<DureeCible, { type: TypeSequence; plans: TypePlan[] }[]> = {
  15: [{ type: "unique", plans: ["etablir", "action", "fin"] }],
  30: [
    { type: "ouverture", plans: ["etablir", "arrivee"] },
    { type: "coeur", plans: ["action", "regard"] },
    { type: "chute", plans: ["mouvement", "fin"] },
  ],
  60: [
    { type: "ouverture", plans: ["etablir", "arrivee", "detail"] },
    { type: "coeur", plans: ["action", "regard", "reaction", "mouvement"] },
    { type: "chute", plans: ["depart", "dernier", "fin"] },
  ],
};

const CAMERAS: Camera[] = ["fixe", "suit", "approche", "autour"];
/** Motion verbs choose a following camera for the main action (FR/EN/DE/ES). */
const MOUVEMENT = /\b(march|court|cour|travers|roul|vol|nag|danse|fui|walk|run|cross|ride|driv|fly|swim|danc|flee|chase|geh|lauf|renn|fahr|flieg|tanz|camin|corr|cruz|vuel|bail|hu[iy])\w*/iu;
const GUILLEMETS = /[«"“„]\s*([^»"”“]{1,200}?)\s*[»"”“]/u;
const DIT_FIN = /(?:[,;]\s*|\s+|^)(?:[\p{L}’'-]+\s+)?(?:dit|dit-elle|dit-il|says|said|sagt|dice|diciendo)\s*:?\s*$/iu;

/** The action without the quoted words nor the « she says: » left in front of them. */
export function sansReplique(text: string): string {
  return text.replace(new RegExp(GUILLEMETS.source, "gu"), " ").replace(/\s+/g, " ").trim().replace(DIT_FIN, "").replace(/[\s:]+$/u, "").trim();
}

const ARTICLE = /^(?:the|a|an|le|la|les|l['’]|un|une|der|die|das|den|dem|ein|eine|el|los|las|una?)\b/iu;
/** Weather and time of day are not places: « in the rain », « at dawn » never become a DÉCOR card. */
const PAS_UN_LIEU = /^(?:the |la |le |l['’]|der |die |das |el |la )?(?:rain|snow|fog|wind|storm|night|dawn|dusk|sun|morning|evening|pluie|neige|brume|brouillard|vent|orage|nuit|aube|aurore|cr[eé]puscule|soleil|matin|soir|regen|schnee|nebel|wind|sturm|nacht|morgengrauen|d[aä]mmerung|sonne|morgen|abend|lluvia|nieve|niebla|viento|tormenta|noche|amanecer|alba|atardecer|sol|ma[nñ]ana|tarde|dark|darkness|obscurit[eé]|dunkel(?:heit)?|oscuridad|silence|silencio|stille)\b/iu;

/** Everyday place nouns (FR/EN/DE/ES), read only with their article: « la ville », « the city », « die Stadt ». */
const NOMS_DE_LIEU = [
  "city", "town", "village", "street", "road", "alley", "square", "park", "forest", "woods", "beach", "sea", "harbour", "harbor", "port", "station", "bridge", "roof", "rooftop", "house", "room", "kitchen", "garden", "field", "desert", "mountain", "river", "lake", "quay", "market", "church", "school", "bar", "club", "café", "cafe", "subway", "office", "hall", "corridor", "hallway", "stairs", "courtyard", "island", "shore", "cliff", "valley", "hill", "studio", "stage",
  "ville", "rue", "ruelle", "parc", "forêt", "bois", "plage", "mer", "gare", "pont", "toit", "maison", "chambre", "cuisine", "jardin", "champ", "désert", "montagne", "rivière", "fleuve", "lac", "quai", "marché", "église", "école", "métro", "bureau", "salle", "couloir", "escalier", "cour", "île", "rive", "falaise", "vallée", "colline", "scène",
  "stadt", "dorf", "straße", "strasse", "gasse", "platz", "wald", "strand", "meer", "hafen", "bahnhof", "brücke", "dach", "haus", "zimmer", "küche", "garten", "feld", "wüste", "berg", "fluss", "see", "kai", "markt", "kirche", "schule", "u-bahn", "büro", "saal", "flur", "treppe", "hof", "insel", "ufer", "klippe", "tal", "hügel", "bühne",
  "ciudad", "pueblo", "calle", "callejón", "plaza", "parque", "bosque", "playa", "mar", "puerto", "estación", "puente", "tejado", "azotea", "casa", "habitación", "cocina", "jardín", "campo", "desierto", "montaña", "río", "lago", "muelle", "mercado", "iglesia", "escuela", "oficina", "estudio", "sala", "pasillo", "escalera", "patio", "isla", "orilla", "acantilado", "valle", "colina", "escenario",
];
const ARTICLE_LIEU = "the|this|that|la|le|les|l['’]|cette|ce|cet|sa|son|der|die|das|den|dem|des|diese[nmrs]?|el|los|las|esta|este|su";
const LIEU_NOMME = new RegExp(`(?<![\\p{L}])(?:${ARTICLE_LIEU})\\s*(?<=['’]|\\s)(?:${NOMS_DE_LIEU.join("|")})(?![\\p{L}-])`, "iu");

/** « Uttu crosses the city… »: an everyday place noun with its article, when no preposition named one. */
export function lieuCommun(phrase: string): string | null {
  const hit = LIEU_NOMME.exec(phrase)?.[0]?.replace(/\s+/g, " ").trim();
  return hit ? hit.charAt(0).toUpperCase() + hit.slice(1) : null;
}

/** « @Quai Nord »: a DÉCOR card the sentence mentions. The « @ » is removed for everything else. */
export function lieuMentionne(phrase: string, decor: readonly KnownName[]): KnownName | null {
  return mentionedReferences(phrase, decor)[0] ?? null;
}
/** A DÉCOR card or named place written in the sentence without « @ », whole words, any case; the longest wins. */
export function lieuEcrit(phrase: string, lieux: readonly KnownName[]): KnownName | null {
  const folded = phrase.toLowerCase();
  return [...lieux].filter(item => item.name.trim().length >= 3).sort((a, b) => b.name.trim().length - a.name.trim().length).find(item => {
    const name = item.name.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return new RegExp(`(?<![\\p{L}\\p{N}])${name}(?![\\p{L}\\p{N}])`, "u").test(folded);
  }) ?? null;
}
const motsDuLieu = (nom: string) => nom.toLowerCase().split(/\s+/).filter(Boolean);
const sansArobase = (text: string) => text.replace(/(^|[^\p{L}\p{N}_])@(?=[\p{L}\p{N}])/gu, "$1");

/** The first place named in the sentence that is not weather or a time of day. */
export function lieuDeLIdee(phrase: string): string | null {
  // « along the quay », « through the hall »: read like « in ».
  let rest = phrase.replace(/\b(?:along|through|le long d(?:e |u |es |['’])|à travers|entlang|durch|a lo largo d(?:e|el)|por)\s+/giu, " in ");
  for (let i = 0; i < 4; i += 1) {
    const lieu = lieuDeLaPhrase(rest);
    if (!lieu) return null;
    if (!PAS_UN_LIEU.test(lieu)) return lieu;
    const at = rest.toLowerCase().indexOf(lieu.toLowerCase());
    rest = at >= 0 ? rest.slice(at + lieu.length) : "";
  }
  return null;
}

/** Fills {qui} {lieu} {idee}. A name starting with an article loses its capital inside a sentence. */
function remplir(modele: string, values: Record<string, string>): string {
  return modele.replace(/\{(\w+)\}/g, (match, key: string, at: number) => {
    const value = values[key] ?? "";
    return at > 0 && ARTICLE.test(value) ? value.charAt(0).toLowerCase() + value.slice(1) : value;
  }).replace(/\s{2,}/g, " ").trim().replace(/^\p{Ll}/u, c => c.toUpperCase());
}

function majuscule(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

const PETIT_MOT = /^(?:in|on|at|to|of|under|with|by|for|from|into|over|sous|avec|par|pour|vers|entre|unter|mit|von|nach|bajo|con|por|para|sobre|the|a|an|and|dans|sur|à|au|de|du|des|la|le|les|un|une|et|im|am|auf|zu|der|die|das|und|en|a|al|del|el|los|las|y)$/iu;
const PAROLE = "(?:dit|dit-elle|dit-il|says|said|sagt|dice|diciendo)";

/**
 * « A DJ crosses the city in the rain… » → « A DJ crosses the city ». At most five words of the action
 * really written (CE5-L): the first sentence only, commas, « while » and « then » are not cut blindly (names
 * in a list stay together). A line alone (« « Bonjour » dit Uttu ») gives the speaker and their words.
 */
export function titreDeLIdee(idee: string): string {
  const phrase = idee.replace(/\s+/g, " ").trim().split(/(?<=[.!?…])\s+(?=\p{Lu}|[«"“„])/u)[0] ?? "";
  const quote = GUILLEMETS.exec(phrase);
  const tidy = (text: string) => text.replace(/[«»"“”„()[\]]/g, " ").replace(/\s+/g, " ").trim().replace(/[\s.!?…;:,—–-]+$/u, "").trim();
  const bare = tidy(phrase.replace(new RegExp(GUILLEMETS.source, "gu"), " "));
  const speaker = new RegExp(`^${PAROLE}\\s+(.+)$|^(.+?)\\s+${PAROLE}$`, "iu").exec(bare);
  if (quote && speaker) {
    const qui = (speaker[1] ?? speaker[2] ?? "").trim();
    return majuscule(`${qui} ${quote[0].trim()}`).slice(0, 60);
  }
  const words = tidy(sansReplique(phrase)).split(/\s+/).filter(Boolean).slice(0, 5);
  if (words.length) words[words.length - 1] = words.at(-1)!.replace(/[,;:]+$/u, "");
  // Never end on a small word: « crosses the city in » → « crosses the city ».
  while (words.length > 2 && PETIT_MOT.test(words.at(-1)!)) words.pop();
  return majuscule(words.join(" ")).slice(0, 60) || "Storyboard";
}

/** Two identical shots in a row (framing and camera) never stay: the camera moves to the next kind. */
export function varier(plans: PlanSB[]): PlanSB[] {
  const out: PlanSB[] = [];
  for (const plan of plans) {
    const prev = out.at(-1);
    let next = plan;
    if (prev && prev.cadrage === next.cadrage && prev.camera === next.camera) {
      const at = CAMERAS.indexOf(next.camera ?? "fixe");
      next = { ...next, camera: CAMERAS[(at + 1) % CAMERAS.length]! };
    }
    out.push(next);
  }
  return out;
}

export function ecrireStoryboard(ideeBrute: string, ctx: ContexteEcriture, options: OptionsEcriture): Ecrit {
  const brut = ideeBrute.replace(/\s+/g, " ").trim().slice(0, 600);
  const lieux: KnownName[] = [
    ...ctx.decor,
    ...(ctx.lieuxNommes ?? []).filter(nom => !ctx.decor.some(item => item.name.trim().toLowerCase() === nom.trim().toLowerCase())).map(name => ({ id: "", name })),
  ];
  // « @Quai Nord », or a DÉCOR card / named place written as is (« in Blanche of Castille »): a place.
  const mention = lieuMentionne(brut.replace(GUILLEMETS, " "), lieux) ?? lieuEcrit(brut.replace(GUILLEMETS, " "), lieux);
  const idee = sansArobase(brut);
  const compris = comprendrePlan(idee.replace(GUILLEMETS, " "), ctx);
  // CE5-L: a name held by two identities is neither linked nor created again (clarification).
  const ambigus = new Set((ctx.ambigus ?? []).map(foldName));
  const ambigu = (nom: string) => ambigus.has(foldName(nom));
  const ambiguite = compris.qui.some(item => item.nouveau && ambigu(item.nom));
  // A mentioned place is never read as a new character.
  const qui: RefPlan[] = compris.qui
    .filter(item => !item.nouveau || !ambigu(item.nom))
    .filter(item => !item.nouveau || !motsDuLieu(mention?.name ?? compris.ou?.nom ?? lieuDeLIdee(idee) ?? "").includes(item.nom.trim().toLowerCase()))
    .map(item => ({ role: "qui", nom: item.nom, id: item.nouveau ? null : item.id }));
  // A known place (DÉCOR card) is linked; a new one is read from the sentence, never from the weather.
  // Order: an @mentioned DÉCOR card, a DÉCOR card named in the sentence, a place after a preposition,
  // an everyday place noun (« la ville »), else no place at all (the shots are written without one).
  const ou: RefPlan | null = mention
    ? { role: "ou", nom: mention.name, id: mention.id || null }
    : compris.ou && !compris.ou.nouveau
    ? { role: "ou", nom: compris.ou.nom, id: compris.ou.id }
    : (() => {
      const phrase = idee.replace(GUILLEMETS, " ");
      const nom = lieuDeLIdee(phrase) ?? lieuCommun(phrase);
      if (!nom || ambigu(nom)) return null;
      const known = ctx.decor.find(item => item.name.trim().toLowerCase() === nom.toLowerCase());
      return { role: "ou", nom: known?.name ?? nom, id: known?.id ?? null };
    })();
  const g = options.gabarits;
  const nomQui = qui.length ? qui.map(item => item.nom).join(", ") : g.quelquun;
  const nomLieu = ou?.nom ?? g.lieu;
  const quote = GUILLEMETS.exec(idee)?.[1]?.trim().slice(0, REPLIQUE_MAX) ?? "";
  const camIdee = compris.read.camera.move ? null : MOUVEMENT.test(idee) ? "suit" as const : null;
  const action = sansReplique(compris.read.action.trim() || idee);
  const values = { qui: nomQui, lieu: nomLieu, idee: majuscule(action) };
  const dixOk = options.dureeChiffree?.(10) ?? false;
  // A line wants 8 s, but only when 8 s has a quote for the default render; otherwise 5 s stays filmable.
  const huitOk = options.dureeChiffree?.(8) ?? true;

  let n = 0;
  const sequences: Sequence[] = DECOUPAGE[options.dureeCible].map((seq, s) => {
    const plans = seq.plans.map(type => {
      n += 1;
      const forme = FORME[type];
      const parle = qui.length > 0 && (type === "regard" || (options.dureeCible === 15 && type === "action" && quote !== ""));
      const refs = refsPropres([
        ...(type === "etablir" || type === "detail" ? [] : qui),
        ...(ou && type !== "detail" ? [ou] : []),
      ]);
      const base = planVide(`p${n}`, options.format);
      const duree: DureePlan = parle && huitOk ? 8 : type === "action" && options.dureeCible === 60 && dixOk ? 10 : 5;
      const plan: PlanSB = {
        ...base,
        // CE5-L: the shot carrying the idea is titled from its action; the others keep the draft's words.
        titre: type === "action" && action ? titreDeLIdee(action) : g.plans[type].titre,
        action: remplir((!ou && g.sansLieu?.[type]) || g.plans[type].action, values).slice(0, 240),
        refs,
        cadrage: forme.cadrage,
        camera: type === "action" && camIdee ? camIdee : forme.camera,
        duree,
        dialogue: parle
          ? { type: "replique", qui: qui[0]!.nom, texte: quote, source: quote ? "idee" : "uttu", propositions: [] }
          : base.dialogue,
        raccord: s > 0 || n > 1 ? type !== "etablir" && type !== "detail" : false,
      };
      return plan;
    });
    return { id: `s${s + 1}`, titre: g.sequences[seq.type].titre, resume: remplir(g.sequences[seq.type].resume, values).slice(0, 240), plans };
  });
  // Variety across scene borders too.
  const ordre = varier(sequences.flatMap(seq => seq.plans));
  let k = 0;
  const finales = sequences.map(seq => ({ ...seq, plans: seq.plans.map(() => ordre[k++]!) }));

  const titre = titreDeLIdee(idee);
  const sb: Storyboard = {
    ...storyboardVide({ id: nouvelId(titre, options.suffixe), titre, idee, format: options.format, dureeCible: options.dureeCible, now: options.now }),
    logline: idee.slice(0, 240),
    sequences: finales,
  };
  const question: Question = (qui.length === 0 && (ctx.cast.length === 0 || ambiguite)) ? { type: "qui" } : !options.formatChoisi ? { type: "format" } : null;
  const tous = [...qui, ...(ou ? [ou] : [])];
  return { storyboard: sb, question, repris: tous.filter(ref => ref.id).map(ref => ref.nom), nouveaux: tous.filter(ref => !ref.id).map(ref => ref.nom) };
}

/** The answer to « Who is the main character? »: every shot that shows someone gets them (new, created on first film). */
export function definirPersonnage(sb: Storyboard, nom: string, ctx: ContexteEcriture, quelquun: string, now?: string): Storyboard {
  const clean = nom.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!clean) return sb;
  // CE5-L: a homonym is never linked to one of the two identities nor made a third time.
  if ((ctx.ambigus ?? []).map(foldName).includes(foldName(clean))) return sb;
  const known = ctx.cast.find(item => item.name.trim().toLowerCase() === clean.toLowerCase());
  const ref: RefPlan = { role: "qui", nom: known?.name ?? clean, id: known?.id ?? null };
  return {
    ...sb,
    majLe: now ?? sb.majLe,
    sequences: sb.sequences.map(seq => ({ ...seq, plans: seq.plans.map(plan => {
      // Only the shots written around « the character » show them: the place and the details stay empty.
      const montre = quelquun.trim() !== "" && (plan.action.includes(quelquun) || plan.titre.includes(quelquun));
      if (!montre || plan.refs.some(item => item.role === "qui")) return plan;
      return { ...plan, action: plan.action.split(quelquun).join(ref.nom), refs: refsPropres([ref, ...plan.refs]) };
    }) })),
  };
}
