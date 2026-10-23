/**
 * Uttu, free mode: no language model, no network call, no credit.
 * Everything here reads `public/agent/knowledge.json`, built from the studio's own
 * catalogue, registry and messages by `scripts/agent-knowledge.mjs`.
 * Costs come from the registry table only; nothing is invented.
 */

export const UTTU_LOCALES = ["fr", "en", "de", "es"] as const;
export type UttuLocale = (typeof UTTU_LOCALES)[number];

export interface KnowledgeTool {
  id: string; famille: string; sous: string; entrees: readonly string[]; sortie: string; texte: string;
  etat: "pret" | "bientot" | "masque"; public: boolean; geste: string | null;
  cost: [number, number] | null; nature: string | null; tranche: boolean; partenaire: boolean;
}
export interface KnowledgeGesture {
  id: string; onglet: string; clef: string; ouvert: boolean; option: string | null;
  cost: [number, number] | null; nature: string; partenaire: boolean;
}
export interface KnowledgeTab { id: string; href: string; tools: number; gestures: number }
export interface KnowledgeFaq { id: string; q: string; k: string; a: string }
export interface KnowledgeLocale {
  tabs: Record<string, { title: string; line: string }>;
  tools: Record<string, { title: string; line: string; model?: string }>;
  gestures: Record<string, { title: string; phrase: string }>;
  families: Record<string, string>;
  faq: KnowledgeFaq[];
  alias: Record<string, string>;
}
export interface KnowledgeDoc { file: string; title: string; summary: string }
export interface Knowledge {
  schema: 1;
  version: { sha: string; short: string };
  tabs: KnowledgeTab[];
  families: string[];
  tools: KnowledgeTool[];
  gestures: KnowledgeGesture[];
  docs: KnowledgeDoc[];
  locales: Record<UttuLocale, KnowledgeLocale>;
}

/* ---------- Build (used by scripts/agent-knowledge.mjs and the unit tests) ---------- */

type Messages = Record<string, any>;
interface BuildInput {
  sha: string;
  tools: readonly { id: string; famille: string; sous: string; entrees: readonly string[]; sortie: string; texte: string; geste?: string; parTranche?: boolean; onglets: readonly string[] }[];
  toolState(id: string): "pret" | "bientot" | "masque";
  publicTools: readonly string[];
  toolRow(id: string): { credits: number | null; high: number | null; nature: string; partenaire: boolean } | null;
  gestures: readonly { id: string; onglet: string; clef: string; credits: number | null; high: number | null; nature: string; partenaire: boolean; option?: string }[];
  gestureOpen(id: string): boolean;
  families: readonly string[];
  messages: Record<UttuLocale, Messages>;
  docs: readonly { file: string; text: string }[];
}

export const STUDIO_TABS: readonly { id: string; href: string; nav: string }[] = [
  { id: "cast", href: "/studio#personnage", nav: "character" },
  { id: "decor", href: "/studio#scene", nav: "scene" },
  { id: "prise", href: "/studio#prise", nav: "take" },
  { id: "montage", href: "/studio#montage", nav: "edit" },
  { id: "outils", href: "/studio#outils", nav: "" },
  { id: "projets", href: "/mon-studio", nav: "studio" },
];
const SIM_TABS = new Set(["cast", "decor", "prise", "montage", "suite"]);
export const toolHref = (id: string) => `/studio#outils/${id}`;
export const gestureHref = (onglet: string, id: string) =>
  onglet === "cast" ? `/studio?geste=${id}#personnage` : onglet === "decor" ? `/studio?geste=${id}#scene` : onglet === "prise" ? "/studio#prise" : onglet === "montage" ? "/studio#montage" : null;

/** Keeps the first paragraph of a Markdown doc, plain and short. */
export function docSummary(file: string, text: string): KnowledgeDoc {
  const lines = text.split("\n");
  const title = (lines.find(line => /^#\s/.test(line)) ?? file).replace(/^#\s+/, "").trim();
  const paragraph: string[] = [];
  for (const line of lines) {
    const plain = line.trim();
    if (/^(#|>|\||```|!\[|<)/.test(plain) || plain.startsWith("- ")) { if (paragraph.length) break; continue; }
    if (!plain) { if (paragraph.length) break; continue; }
    paragraph.push(plain);
  }
  const summary = paragraph.join(" ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*`_]/g, "").replace(/\s+/g, " ").trim();
  return { file, title, summary: summary.length > 320 ? `${summary.slice(0, 317).replace(/\s+\S*$/, "")}…` : summary };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildKnowledge(input: BuildInput): Knowledge {
  const sha = input.sha || "local";
  const publicSet = new Set(input.publicTools);
  const tools: KnowledgeTool[] = input.tools.map(tool => {
    const row = input.toolRow(tool.id);
    const etat = input.toolState(tool.id);
    return {
      id: tool.id, famille: tool.famille, sous: tool.sous, entrees: [...tool.entrees], sortie: tool.sortie, texte: tool.texte,
      etat, public: publicSet.has(tool.id), geste: tool.geste ?? null,
      cost: etat === "pret" && row?.credits != null && row.high != null ? [round2(row.credits), round2(row.high)] : null,
      nature: row?.nature ?? null, tranche: Boolean(tool.parTranche), partenaire: Boolean(row?.partenaire),
    };
  });
  // Closed gestures have no price and no graph: Uttu never offers them.
  const gestures: KnowledgeGesture[] = input.gestures.filter(g => g.onglet !== "outils" && input.gestureOpen(g.id)).map(g => {
    const ouvert = input.gestureOpen(g.id);
    return {
      id: g.id, onglet: g.onglet, clef: g.clef, ouvert, option: g.option ?? null,
      cost: ouvert && g.credits != null && g.high != null ? [round2(g.credits), round2(g.high)] : null,
      nature: g.nature, partenaire: g.partenaire,
    };
  });
  const tabs: KnowledgeTab[] = STUDIO_TABS.map(tab => ({
    id: tab.id, href: tab.href,
    tools: tab.id === "outils" ? tools.filter(t => t.public).length : input.tools.filter(t => t.onglets.includes(tab.id) && publicSet.has(t.id)).length,
    gestures: gestures.filter(g => g.onglet === tab.id && g.ouvert).length,
  }));
  const locales = {} as Record<UttuLocale, KnowledgeLocale>;
  for (const locale of UTTU_LOCALES) {
    const m = input.messages[locale];
    const u = m.uttu ?? {};
    const outils = m.outils ?? {};
    locales[locale] = {
      tabs: Object.fromEntries(STUDIO_TABS.map(tab => [tab.id, { title: tab.nav ? m.nav?.[tab.nav] ?? tab.id : outils.title ?? tab.id, line: u.tabs?.[tab.id] ?? "" }])),
      tools: Object.fromEntries(tools.filter(t => t.etat === "pret").map(t => [t.id, { title: outils.t?.[t.id]?.title ?? t.id, line: outils.t?.[t.id]?.line ?? "", ...(outils.modelName?.[t.id] ? { model: outils.modelName[t.id] } : {}) }])),
      gestures: Object.fromEntries(gestures.filter(g => g.ouvert).map(g => [g.clef, { title: m.gestes?.[g.clef]?.title ?? g.clef, phrase: m.gestes?.[g.clef]?.phrase ?? "" }])),
      families: Object.fromEntries(input.families.map(f => [f, outils.fam?.[f] ?? f])),
      faq: Object.entries((u.faq ?? {}) as Record<string, { q: string; k: string; a: string }>).map(([id, item]) => ({ id, q: item.q, k: item.k, a: item.a })),
      alias: { ...(u.alias ?? {}) },
    };
  }
  return {
    schema: 1,
    version: { sha, short: sha.slice(0, 7) },
    tabs, families: [...input.families], tools, gestures,
    docs: input.docs.map(doc => docSummary(doc.file, doc.text)),
    locales,
  };
}

/* ---------- Text helpers ---------- */

export const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const STOP: Record<UttuLocale, Set<string>> = {
  fr: new Set("le la les un une des du de d l et ou a au aux en dans sur pour par avec sans ce cet cette ces mon ma mes ton ta tes son sa ses je tu il elle on nous ils est sont suis es etre ai as avoir que qui quoi quel quelle quels quelles comment est-ce pas ne y me te se moi toi faire fait peux peut veux puis".split(" ")),
  en: new Set("the a an of and or to in on for by with without this that these those my your is are am be do does i you it we can how what which who".split(" ")),
  de: new Set("der die das den dem des ein eine einen einem einer und oder zu im in an auf fur mit ohne ist sind bin du ich es wir kann wie was welche welcher wer mein meine dein deine".split(" ")),
  es: new Set("el la los las un una unos unas de del y o a al en con sin para por este esta estos estas mi mis tu tus es son soy ser yo puedo puede como que cual quien".split(" ")),
};
export function words(text: string, locale: UttuLocale): string[] {
  return fold(text).split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1 && !STOP[locale].has(w));
}
/** Same word, or same stem (first five letters) for words of five letters or more. */
const near = (a: string, b: string) => a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5)) || (a.length >= 4 && b.length >= 4 && (a === `${b}s` || b === `${a}s`));

/* ---------- FAQ search ---------- */

export interface FaqHit { kind: "faq" | "tool" | "gesture" | "tab" | "doc"; id: string; title: string; text: string; href?: string; score: number }

type Entry = Omit<FaqHit, "score"> & { q: string; key: string };
function entries(k: Knowledge, locale: UttuLocale): Entry[] {
  const L = k.locales[locale];
  const list: Entry[] = [];
  for (const f of L.faq) list.push({ kind: "faq", id: f.id, title: f.q, text: f.a.replaceAll("{version}", k.version.short), q: f.q, key: f.k });
  for (const tab of k.tabs) { const t = L.tabs[tab.id]; if (t) list.push({ kind: "tab", id: tab.id, title: t.title, text: t.line, href: tab.href, q: t.title, key: "" }); }
  for (const tool of k.tools) {
    const t = L.tools[tool.id]; if (!t || !tool.public) continue;
    list.push({ kind: "tool", id: tool.id, title: t.title, text: t.line, href: toolHref(tool.id), q: t.title, key: `${L.families[tool.famille] ?? ""} ${tool.sous} ${tool.sortie}` });
  }
  for (const g of k.gestures) {
    const t = L.gestures[g.clef]; const href = gestureHref(g.onglet, g.id); if (!t || !g.ouvert || g.option || !href) continue;
    list.push({ kind: "gesture", id: g.id, title: t.title, text: t.phrase, href, q: t.title, key: L.tabs[g.onglet]?.title ?? "" });
  }
  if (locale === "fr" || locale === "en") for (const d of k.docs) if (d.summary) list.push({ kind: "doc", id: d.file, title: d.title, text: d.summary, q: d.title, key: "" });
  return list;
}

const WEIGHT = { faq: 1, tab: 0.9, tool: 0.8, gesture: 0.75, doc: 0.45 } as const;

/** Best local answers for a question, highest score first. Empty when nothing is close enough. */
export function searchFaq(k: Knowledge, locale: UttuLocale, question: string, limit = 3): FaqHit[] {
  const query = [...new Set(words(question, locale))];
  if (!query.length) return shortQuestion(k, locale, question);
  const hits: FaqHit[] = [];
  for (const entry of entries(k, locale)) {
    const strong = [...words(entry.q, locale), ...words(entry.key, locale)];
    const weak = words(entry.text, locale);
    let sum = 0, strongHits = 0;
    for (const w of query) {
      if (strong.some(s => near(s, w))) { sum += 1; strongHits++; }
      else if (weak.some(s => near(s, w))) sum += 0.35;
    }
    if (!strongHits) continue;
    const score = (sum / query.length) * WEIGHT[entry.kind] + Math.min(strongHits, 3) * 0.05;
    if (score >= (entry.kind === "faq" ? 0.5 : 0.6)) hits.push({ kind: entry.kind, id: entry.id, title: entry.title, text: entry.text, href: entry.href, score: Math.round(score * 1000) / 1000 });
  }
  return hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
}

/** A question made only of small words (« Qui es-tu ? », "Who are you?"): a FAQ entry whose keywords hold every word. */
function shortQuestion(k: Knowledge, locale: UttuLocale, question: string): FaqHit[] {
  const raw = [...new Set(fold(question).split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1))];
  if (raw.length < 2) return [];
  for (const f of k.locales[locale].faq) {
    const keys = new Set(fold(f.k).split(/[^\p{L}\p{N}]+/u));
    if (raw.every(w => keys.has(w))) return [{ kind: "faq", id: f.id, title: f.q, text: f.a.replaceAll("{version}", k.version.short), score: 0.5 }];
  }
  return [];
}

/* ---------- Cost simulator ---------- */

export interface SimItem { id: string; kind: "gesture" | "tool"; title: string; group: string; cost: [number, number]; tranche: boolean; nature: string }
export interface SimLine { item: SimItem; qty: number; low: number; high: number }
export interface SimResult { lines: SimLine[]; low: number; high: number; unknown: string[]; tranche: boolean }

/** Every priced gesture of the four tabs and « Et ensuite ? », and every public ready tool. Nothing else has a price. */
export function simItems(k: Knowledge, locale: UttuLocale): SimItem[] {
  const L = k.locales[locale];
  const items: SimItem[] = [];
  for (const g of k.gestures) {
    if (!g.cost || !g.ouvert || g.option || !SIM_TABS.has(g.onglet)) continue;
    const title = L.gestures[g.clef]?.title ?? g.clef;
    items.push({ id: g.id, kind: "gesture", title, group: L.tabs[g.onglet]?.title ?? g.onglet, cost: g.cost, tranche: false, nature: g.nature });
  }
  for (const t of k.tools) {
    if (!t.cost || t.etat !== "pret") continue;
    const model = L.tools[t.id]?.model;
    items.push({ id: t.id, kind: "tool", title: `${L.tools[t.id]?.title ?? t.id}${model ? ` · ${model}` : ""}`, group: L.tabs.outils?.title ?? "outils", cost: t.cost, tranche: t.tranche, nature: t.nature ?? "hypothese" });
  }
  return items;
}

const NUMBER_WORDS: Record<UttuLocale, string[]> = {
  fr: ["zero", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"],
  en: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"],
  de: ["null", "ein", "zwei", "drei", "vier", "funf", "sechs", "sieben", "acht", "neun", "zehn"],
  es: ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"],
};
const EXTRA_ONE: Record<UttuLocale, string[]> = { fr: ["une"], en: ["a", "an"], de: ["eine", "einen", "einem"], es: ["una", "un"] };
const COST_WORDS = /\b(combien|cout\w*|prix|credit\w*|cr|estim\w*|devis|budget|how much|cost\w*|price|wie ?viel\w*|kost\w*|preis|kalkulation|cuanto\w*|cuesta\w*|costar\w*|precio|presupuesto)\b/;
/** An order to the production plan (« Prépare trois prises… »), not a cost question. */
const ACTION = /^\s*(prepare\w*|cree\w*|creer|fais|faire|genere\w*|lance\w*|tourne\w*|monte\w*|assemble\w*|make|create|generate|build|render|run|bereite\w*|erstell\w*|mach\w*|generier\w*|prepara\w*|crea\w*|haz|genera\w*|monta\w*)\b/;
const SPLIT = /\s*(?:\+|,|;|\n|&|\bet\b|\bpuis\b|\bplus\b|\band\b|\bthen\b|\bund\b|\bdann\b|\by\b|\bmas\b|\bluego\b)\s*/;

/** A quantity the visitor wrote: digits or a number word. « un », « a », « eine » are articles, not counts. */
function quantity(segment: string, locale: UttuLocale): { n: number; explicit: boolean } | null {
  const digits = /(?:^|[^\p{L}\p{N}.,])(?:x\s*)?(\d{1,3})(?:\s*(?:x|×))?(?![\p{N}])/u.exec(segment);
  if (digits) return { n: Math.min(99, Math.max(0, Number(digits[1]))), explicit: true };
  for (const w of fold(segment).split(/[^\p{L}]+/u)) {
    const n = NUMBER_WORDS[locale].indexOf(w);
    if (n > 1) return { n, explicit: true };
    if (n === 1 || EXTRA_ONE[locale].includes(w)) return { n: 1, explicit: false };
  }
  return null;
}

/** All the ways to name one priced item: authored aliases first, then its own title. */
function aliases(k: Knowledge, locale: UttuLocale, items: SimItem[]): { item: SimItem; tokens: string[] }[] {
  const L = k.locales[locale];
  const byId = new Map(items.map(item => [item.id, item]));
  const out: { item: SimItem; tokens: string[] }[] = [];
  for (const [id, list] of Object.entries(L.alias)) {
    const item = byId.get(id); if (!item) continue;
    for (const name of list.split(",")) { const tokens = fold(name).split(/[^\p{L}\p{N}]+/u).filter(Boolean); if (tokens.length) out.push({ item, tokens }); }
  }
  for (const item of items) {
    const [title, model] = item.title.split(" · ");
    for (const name of [title, model]) { const tokens = name ? words(name, locale) : []; if (tokens.length) out.push({ item, tokens }); }
  }
  return out;
}

function matchSegment(segment: string, table: { item: SimItem; tokens: string[] }[]): SimItem | null {
  const seg = fold(segment).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  let best: { item: SimItem; size: number } | null = null;
  for (const entry of table) {
    if (!entry.tokens.every(token => seg.some(w => near(w, token)))) continue;
    if (!best || entry.tokens.length > best.size) best = { item: entry.item, size: entry.tokens.length };
  }
  return best?.item ?? null;
}

const floor1 = (n: number) => Math.floor(n * 10 + 1e-9) / 10;
const ceil1 = (n: number) => Math.ceil(n * 10 - 1e-9) / 10;

export function simulate(picks: readonly { item: SimItem; qty: number }[], unknown: string[] = []): SimResult {
  const merged = new Map<string, { item: SimItem; qty: number }>();
  for (const pick of picks) {
    if (pick.qty <= 0) continue;
    const prev = merged.get(pick.item.id);
    merged.set(pick.item.id, { item: pick.item, qty: Math.min(99, (prev?.qty ?? 0) + pick.qty) });
  }
  const lines = [...merged.values()].map(({ item, qty }) => ({ item, qty, low: floor1(item.cost[0] * qty), high: ceil1(item.cost[1] * qty) }));
  const low = floor1(lines.reduce((sum, line) => sum + line.item.cost[0] * line.qty, 0));
  const high = ceil1(lines.reduce((sum, line) => sum + line.item.cost[1] * line.qty, 0));
  return { lines, low, high, unknown, tranche: lines.some(line => line.item.tranche) };
}

/**
 * Reads « 3 portraits + 2 prises LTX ». Returns null when the text is not a cost question:
 * no priced item named, or items named without a quantity or a cost word.
 */
export function simulateText(k: Knowledge, locale: UttuLocale, text: string): SimResult | null {
  const items = simItems(k, locale);
  const table = aliases(k, locale, items);
  const asksCost = COST_WORDS.test(fold(text));
  if (!asksCost && ACTION.test(fold(text))) return null;
  const picks: { item: SimItem; qty: number }[] = [];
  const unknown: string[] = [];
  let counted = false;
  for (const raw of fold(text).replace(/[?!.:]/g, " ").split(SPLIT)) {
    const segment = raw.trim(); if (!segment) continue;
    const qty = quantity(segment, locale);
    const item = matchSegment(segment, table);
    if (item) { picks.push({ item, qty: qty?.n ?? 1 }); if (qty?.explicit) counted = true; }
    else if (qty?.explicit && /\d/.test(segment)) unknown.push(segment.replace(COST_WORDS, "").trim());
  }
  if (!picks.length || (!asksCost && !counted)) return null;
  return simulate(picks, unknown.filter(Boolean));
}

/** The visitor asks about a price (« combien », "cost", « Kosten »…), not only names items. */
export const asksCost = (text: string) => COST_WORDS.test(fold(text));

export function formatCr(locale: UttuLocale, value: number): string {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : locale, { maximumFractionDigits: 1 }).format(value);
}
