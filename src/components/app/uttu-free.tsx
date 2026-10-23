"use client";
// Uttu, free mode: onboarding guide, local FAQ, cost simulator. No model, no network call
// except the static knowledge file, no credit. Actions go to the production plan below.
// Comfy mode (opt-in, linked account only, accepted once per session): the same knowledge
// phrased by a small model on the visitor's own Comfy account via /studio-agent/chat.
// The model never launches anything; costs are computed here, never by the model.
import { useEffect, useMemo, useRef, useState } from "react";
import { assetPath } from "@/lib/site";
import { useI18n } from "@/components/i18n/provider";
import { asksCost, formatCr, searchFaq, simItems, simulate, simulateText, toolHref, type FaqHit, type Knowledge, type SimItem, type SimResult, type UttuLocale } from "@/lib/agent/uttu";
import { HISTORY, MAX_MESSAGE, perMessageCeiling, type AgentAction, type AgentErrorCode, type ChatResult } from "@/lib/agent/uttu-comfy";
import { useStudio } from "./studio-session";

const LOG_KEY = "u-ttu-uttu-log";
const MODE_KEY = "u-ttu-uttu-mode";
/** Per-session consent to paid messages. sessionStorage: it ends with the tab. */
const ACCEPT_KEY = "u-ttu-uttu-comfy-ok";
const ERROR_CODES: readonly AgentErrorCode[] = ["auth", "credits", "subscription", "busy", "invalid", "refused", "network", "timeout", "failed"];
const ERROR_ACTS: Partial<Record<AgentErrorCode, Act[]>> = { auth: ["connect"], credits: ["guide"], subscription: ["guide"] };
function session(key: string): string | null { try { return window.sessionStorage.getItem(key); } catch { return null; } }
function setSession(key: string, value: string) { try { window.sessionStorage.setItem(key, value); } catch {} }
/** A gesture title says what, its tab says where: « Cast · Depuis un texte ». */
const label = (item: SimItem) => item.kind === "gesture" ? `${item.group} · ${item.title}` : item.title;
const COMFY_CLOUD = "https://cloud.comfy.org/";
const COMFY_PRICING = "https://www.comfy.org/cloud/pricing";
const COMFY_KEYS = "https://platform.comfy.org/profile/api-keys?onboarding=router";

let cache: Promise<Knowledge> | null = null;
function loadKnowledge(): Promise<Knowledge> {
  cache ??= fetch(assetPath("/agent/knowledge.json"), { cache: "force-cache" }).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Knowledge>; });
  cache.catch(() => { cache = null; });
  return cache;
}

type Act = "guide" | "connect" | "sim" | "plan";
interface Turn { role: "user" | "assistant"; text: string; at: number; hits?: FaqHit[]; sim?: SimResult; acts?: Act[]; plan?: string; comfy?: { credits: number; measured: boolean }; tool?: string; local?: boolean; error?: AgentErrorCode }
const FAQ_ACTS: Record<string, Act[]> = { start: ["guide"], key: ["connect"], subscription: ["guide"], credits: ["guide"], cost: ["sim"], estimate: ["sim"] };

function readLog(): Turn[] {
  try { const raw = JSON.parse(window.localStorage.getItem(LOG_KEY) ?? "[]"); return Array.isArray(raw) ? raw.slice(-30) : []; } catch { return []; }
}

export function UttuFree({ locale, isAction, onPlan }: { locale: UttuLocale; isAction(text: string): boolean; onPlan(text: string): void }) {
  const { t } = useI18n();
  const { connected, setSheet, agentAuth, linkMode } = useStudio();
  const [knowledge, setKnowledge] = useState<Knowledge | null>(null);
  const [failed, setFailed] = useState(false);
  const [log, setLog] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [guideOpen, setGuideOpen] = useState(true);
  const [simOpen, setSimOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDetailsElement>(null);
  const simRef = useRef<HTMLDetailsElement>(null);
  const [mode, setMode] = useState<"free" | "comfy">("free");
  const [accepted, setAccepted] = useState(false);
  const [held, setHeld] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const comfy = connected && mode === "comfy";
  const ceiling = useMemo(() => perMessageCeiling(knowledge), [knowledge]);
  const cost = formatCr(locale, ceiling);

  useEffect(() => {
    setLog(readLog()); loadKnowledge().then(setKnowledge, () => setFailed(true));
    setAccepted(session(ACCEPT_KEY) === "1"); if (session(MODE_KEY) === "comfy") setMode("comfy");
  }, []);
  const gateRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (held !== null) requestAnimationFrame(() => { gateRef.current?.scrollIntoView({ block: "nearest" }); gateRef.current?.querySelector<HTMLButtonElement>("[data-uttu-accept]")?.focus(); }); }, [held]);
  function pickMode(next: "free" | "comfy") { setMode(next); setSession(MODE_KEY, next); if (next === "free") setHeld(null); }
  useEffect(() => { setGuideOpen(!connected); }, [connected]);
  useEffect(() => {
    try { window.localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-30))); } catch {}
    const node = logRef.current; if (node) node.scrollTop = node.scrollHeight;
  }, [log]);

  function answer(value: string): Turn {
    const at = Date.now();
    if (!knowledge) return { role: "assistant", text: t(failed ? "uttu.loadError" : "uttu.loading"), at };
    const sim = simulateText(knowledge, locale, value);
    if (sim) return { role: "assistant", text: t("uttu.sim.reply"), at, sim, acts: ["sim"] };
    const hits = searchFaq(knowledge, locale, value);
    const action = isAction(value);
    const top = hits[0];
    if (top && (top.kind === "faq" || !action)) {
      const text = top.kind === "doc" ? `${t("uttu.docFrom", { file: top.id })} ${top.text}` : top.text;
      const acts = [...(top.kind === "faq" ? FAQ_ACTS[top.id] ?? [] : []), ...(action ? ["plan" as const] : [])];
      return { role: "assistant", text, at, hits, acts, plan: action ? value : undefined };
    }
    if (action) return { role: "assistant", text: t("uttu.planHint"), at, hits, acts: ["plan"], plan: value };
    return { role: "assistant", text: t("uttu.notFound"), at, acts: ["guide", "sim"] };
  }
  function send(value = text) {
    const clean = value.trim().slice(0, MAX_MESSAGE); if (!clean) return;
    if (comfy) { void sendComfy(clean); return; }
    setLog(current => [...current, { role: "user" as const, text: clean, at: Date.now() }, answer(clean)].slice(-30));
    setText("");
  }
  /** Paid path. Nothing leaves the browser before the visitor accepted this session. */
  async function sendComfy(clean: string, ok = accepted) {
    if (busy.current) return;
    // A priced question is answered by the studio itself, for free.
    const sim = knowledge && asksCost(clean) ? simulateText(knowledge, locale, clean) : null;
    if (sim) {
      setLog(current => [...current, { role: "user" as const, text: clean, at: Date.now() }, { role: "assistant" as const, text: t("uttu.sim.reply"), at: Date.now(), sim, acts: ["sim" as const], local: true }].slice(-30));
      setText(""); return;
    }
    if (!ok) { setHeld(clean); return; }
    busy.current = true; setPending(true); setText("");
    const history = log.filter(turn => !turn.error).slice(-HISTORY).map(turn => ({ role: turn.role, text: turn.text }));
    setLog(current => [...current, { role: "user" as const, text: clean, at: Date.now() }].slice(-30));
    let turn: Turn;
    try {
      const auth = await agentAuth();
      if (!auth) throw Object.assign(new Error("auth"), { code: "auth" });
      const response = await fetch(assetPath("/studio-agent/chat"), { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({ message: clean, history, locale }), cache: "no-store" });
      const data = await response.json().catch(() => ({})) as Partial<ChatResult> & { error?: string };
      if (!response.ok || typeof data.reply !== "string") throw Object.assign(new Error("router"), { code: data.error ?? "failed" });
      const action = (data.action ?? { kind: "none", tool: null, request: null }) as AgentAction;
      turn = { role: "assistant", text: data.reply, at: Date.now(), comfy: { credits: Number(data.credits) || 0, measured: !!data.measured },
        tool: action.kind === "open_tool" && action.tool ? action.tool : undefined,
        acts: action.kind === "plan" ? ["plan"] : undefined, plan: action.kind === "plan" ? action.request ?? clean : undefined };
    } catch (error) {
      const raw = (error as { code?: string })?.code;
      const code = (ERROR_CODES as readonly string[]).includes(raw ?? "") ? raw as AgentErrorCode : "network";
      turn = { role: "assistant", text: t(`uttu.comfy.errors.${code}`), at: Date.now(), error: code, acts: ERROR_ACTS[code] };
    }
    setLog(current => [...current, turn].slice(-30));
    busy.current = false; setPending(false);
  }
  function accept() {
    setAccepted(true); setSession(ACCEPT_KEY, "1");
    const message = held; setHeld(null);
    if (message) void sendComfy(message, true);
  }
  function act(kind: Act, turn: Turn) {
    if (kind === "connect") { setSheet("connect"); return; }
    if (kind === "plan") { onPlan(turn.plan ?? ""); return; }
    const ref = kind === "guide" ? guideRef : simRef;
    if (kind === "guide") setGuideOpen(true); else setSimOpen(true);
    requestAnimationFrame(() => ref.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  return <section className="u-uttu-free" data-uttu="" aria-labelledby="u-uttu-log-title">
    <h3 id="u-uttu-log-title" className="sr-only">{t("uttu.log")}</h3>
    <div className="u-uttu-log" data-uttu-log="" role="log" aria-live="polite" aria-label={t("uttu.log")} ref={logRef}>
      <article data-role="assistant"><strong>{t("uttu.me")}</strong><p>{t(comfy ? "uttu.comfy.welcome" : "uttu.welcome")}</p></article>
      {log.map((turn, i) => <article key={`${turn.at}-${i}`} data-role={turn.role}>
        <strong>{turn.role === "user" ? t("uttu.you") : t("uttu.me")}</strong>
        <p>{turn.text}</p>
        {turn.sim && <SimView sim={turn.sim} locale={locale} />}
        {turn.hits && turn.hits.length > 1 && <p className="u-small">{t("uttu.seeAlso")} {turn.hits.slice(1).map((hit, n) => <span key={hit.id}>{n > 0 && " · "}{hit.href ? <a href={assetPath(hit.href)}>{hit.title}</a> : <button type="button" className="u-link" onClick={() => send(hit.title)}>{hit.title}</button>}</span>)}</p>}
        {turn.hits?.[0]?.href && turn.role === "assistant" && <a className="u-uttu-go" href={assetPath(turn.hits[0].href)}>{t("uttu.open")} · {turn.hits[0].title}</a>}
        {turn.tool && knowledge && <ToolLink id={turn.tool} knowledge={knowledge} locale={locale} />}
        {turn.comfy && <p className="u-small u-uttu-spent" data-uttu-spent="">{t(turn.comfy.measured ? "uttu.comfy.spent" : "uttu.comfy.spentMax", { cost: new Intl.NumberFormat(locale === "en" ? "en-GB" : locale, { maximumFractionDigits: 2 }).format(Math.max(0.01, turn.comfy.credits)) })}</p>}
        {turn.local && comfy && <p className="u-small">{t("uttu.comfy.local")}</p>}
        {turn.acts && turn.acts.length > 0 && <div className="u-uttu-acts" data-uttu-error={turn.error}>{turn.acts.map(kind => <button key={kind} type="button" className="u-secondary" data-uttu-act={kind} onClick={() => act(kind, turn)}>
          {kind === "connect" ? t("uttu.guide.key.button") : kind === "plan" ? t("uttu.planButton") : kind === "guide" ? t("uttu.guide.title") : t("uttu.sim.title")}
        </button>)}</div>}
      </article>)}
      {pending && <p className="u-small" data-uttu-pending="" role="status">{t("uttu.comfy.thinking")}</p>}
      {!knowledge && !failed && <p className="u-small">{t("uttu.loading")}</p>}
      {failed && <p className="u-small" role="alert">{t("uttu.loadError")}</p>}
    </div>
    {connected ? <div className="u-uttu-mode" role="group" aria-label={t("uttu.comfy.mode")} data-uttu-mode={mode}>
      <button type="button" aria-pressed={mode === "free"} data-uttu-mode-pick="free" onClick={() => pickMode("free")}>{t("uttu.comfy.free")}</button>
      <button type="button" aria-pressed={mode === "comfy"} data-uttu-mode-pick="comfy" onClick={() => pickMode("comfy")}>{t("uttu.comfy.paid", { cost })}</button>
    </div> : <div className="u-uttu-invite" data-uttu-invite="">
      <p className="u-small">{t("uttu.comfy.invite", { cost })}</p>
      <button type="button" className="u-secondary" data-uttu-invite-connect="" onClick={() => setSheet("connect")}>{t("uttu.comfy.inviteButton")}</button>
    </div>}
    {comfy && <p className="u-small" data-uttu-paid-note="">{t(linkMode === "session" ? "uttu.comfy.paidNoteSession" : "uttu.comfy.paidNote")}</p>}
    {comfy && held !== null && <div className="u-uttu-gate" ref={gateRef} role="alertdialog" aria-labelledby="u-uttu-gate-title" data-uttu-gate="">
      <strong id="u-uttu-gate-title">{t("uttu.comfy.gateTitle")}</strong>
      <p className="u-small">{t("uttu.comfy.gateBody", { cost })}</p>
      <div className="u-uttu-acts">
        <button type="button" className="u-primary" data-uttu-accept="" onClick={accept}>{t("uttu.comfy.accept")}</button>
        <button type="button" className="u-secondary" data-uttu-decline="" onClick={() => { setHeld(null); pickMode("free"); }}>{t("uttu.comfy.decline")}</button>
      </div>
    </div>}
    <div className="u-uttu-suggest" role="group" aria-label={t("uttu.suggest")}>
      {(["start", "cost", "free", "cancel"] as const).map(key => <button key={key} type="button" className="u-chip" data-uttu-suggest={key} onClick={() => send(t(`uttu.suggestions.${key}`))}>{t(`uttu.suggestions.${key}`)}</button>)}
    </div>
    <div className="u-uttu-ask">
      <label className="u-field"><span className="u-label">{t("uttu.ask")}</span>
        <textarea data-uttu-input="" rows={2} maxLength={MAX_MESSAGE} value={text} placeholder={t("uttu.placeholder")} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
      </label>
      <button type="button" className="u-primary" data-uttu-send="" aria-busy={pending || undefined} onClick={() => send()}>{comfy ? t("uttu.comfy.send") : t("uttu.send")}</button>
      {comfy && <span className="u-small u-uttu-count" data-uttu-count="">{t("uttu.comfy.counter", { n: text.length, max: MAX_MESSAGE })}</span>}
    </div>
    <details className="u-uttu-card" data-uttu-guide="" ref={guideRef} open={guideOpen} onToggle={e => setGuideOpen(e.currentTarget.open)}>
      <summary>{t("uttu.guide.title")}</summary>
      <p className="u-small">{t("uttu.guide.lead")}</p>
      {connected && <p className="u-uttu-ok" data-uttu-connected="">{t("uttu.guide.connected")}</p>}
      <ol className="u-uttu-steps">
        <Step n={1} done={connected} title={t("uttu.guide.account.title")} body={t("uttu.guide.account.body")} doneLabel={t("uttu.guide.done")}><a className="u-secondary" href={COMFY_CLOUD} target="_blank" rel="noopener noreferrer">{t("uttu.guide.account.link")} ↗</a></Step>
        <Step n={2} done={connected} title={t("uttu.guide.plan.title")} body={t("uttu.guide.plan.body")} doneLabel={t("uttu.guide.done")}><a className="u-secondary" data-uttu-pricing="" href={COMFY_PRICING} target="_blank" rel="noopener noreferrer">{t("uttu.guide.plan.link")} ↗</a></Step>
        <Step n={3} done={connected} title={t("uttu.guide.credits.title")} body={t("uttu.guide.credits.body")} doneLabel={t("uttu.guide.done")} />
        <Step n={4} done={connected} title={t("uttu.guide.key.title")} body={t("uttu.guide.key.body")} doneLabel={t("uttu.guide.done")}>
          <a className="u-secondary" href={COMFY_KEYS} target="_blank" rel="noopener noreferrer">{t("uttu.guide.key.link")} ↗</a>
          {!connected && <button type="button" className="u-primary" data-uttu-connect="" onClick={() => setSheet("connect")}>{t("uttu.guide.key.button")}</button>}
        </Step>
      </ol>
    </details>
    <details className="u-uttu-card" data-uttu-simulator="" ref={simRef} open={simOpen} onToggle={e => setSimOpen(e.currentTarget.open)}>
      <summary>{t("uttu.sim.title")}</summary>
      {knowledge ? <Simulator knowledge={knowledge} locale={locale} /> : <p className="u-small">{t("uttu.loading")}</p>}
    </details>
    {knowledge && <p className="u-small u-uttu-version" data-uttu-version={knowledge.version.short}>{t("uttu.version", { version: knowledge.version.short })}</p>}
  </section>;
}

function Step({ n, done, title, body, doneLabel, children }: { n: number; done: boolean; title: string; body: string; doneLabel: string; children?: React.ReactNode }) {
  return <li data-uttu-step={n} data-done={done ? "" : undefined}>
    <strong>{title}{done && <span className="u-uttu-done"> · {doneLabel}</span>}</strong>
    <p className="u-small">{body}</p>
    {children && <div className="u-uttu-acts">{children}</div>}
  </li>;
}

function SimView({ sim, locale }: { sim: SimResult; locale: UttuLocale }) {
  const { t } = useI18n();
  const f = (n: number) => formatCr(locale, n);
  return <div className="u-uttu-sim" data-uttu-result="">
    <ul>{sim.lines.map(line => <li key={line.item.id}>{t("uttu.sim.line", { qty: line.qty, name: label(line.item), low: f(line.low), high: f(line.high) })}</li>)}</ul>
    <p className="u-uttu-total" data-uttu-total="">{t("uttu.sim.total", { low: f(sim.low), high: f(sim.high) })}</p>
    {sim.unknown.length > 0 && <p className="u-small">{t("uttu.sim.unknown", { list: sim.unknown.join(", ") })}</p>}
    {sim.tranche && <p className="u-small">{t("uttu.sim.perBlock")}</p>}
    <p className="u-small">{t("uttu.sim.note")}</p>
  </div>;
}

function Simulator({ knowledge, locale }: { knowledge: Knowledge; locale: UttuLocale }) {
  const { t } = useI18n();
  const items = useMemo(() => simItems(knowledge, locale), [knowledge, locale]);
  const groups = useMemo(() => [...new Set(items.map(item => item.group))], [items]);
  const [pick, setPick] = useState(items[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [picks, setPicks] = useState<{ id: string; qty: number }[]>([]);
  const byId = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);
  const resolved = picks.flatMap(p => { const item = byId.get(p.id); return item ? [{ item, qty: p.qty }] : []; }) as { item: SimItem; qty: number }[];
  const sim = simulate(resolved);
  return <div className="u-uttu-simulator">
    <p className="u-small">{t("uttu.sim.lead")}</p>
    <div className="u-uttu-pick">
      <label className="u-field"><span className="u-label">{t("uttu.sim.pick")}</span>
        <select data-uttu-pick="" value={pick} onChange={e => setPick(e.target.value)}>
          {groups.map(group => <optgroup key={group} label={group}>{items.filter(item => item.group === group).map(item => <option key={item.id} value={item.id}>{item.title} · {formatCr(locale, item.cost[0])}–{formatCr(locale, item.cost[1])} cr.</option>)}</optgroup>)}
        </select>
      </label>
      <label className="u-field u-uttu-qty"><span className="u-label">{t("uttu.sim.qty")}</span>
        <input data-uttu-qty="" type="number" inputMode="numeric" min={1} max={99} value={qty} onChange={e => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))} />
      </label>
      <button type="button" className="u-secondary" data-uttu-add="" onClick={() => { if (pick) setPicks(current => [...current, { id: pick, qty }]); }}>{t("uttu.sim.add")}</button>
    </div>
    {sim.lines.length ? <>
      <ul className="u-uttu-picks">{sim.lines.map(line => <li key={line.item.id}>
        <span>{t("uttu.sim.line", { qty: line.qty, name: label(line.item), low: formatCr(locale, line.low), high: formatCr(locale, line.high) })}</span>
        <button type="button" className="u-top-icon" aria-label={t("uttu.sim.remove", { name: label(line.item) })} onClick={() => setPicks(current => current.filter(p => p.id !== line.item.id))}>×</button>
      </li>)}</ul>
      <p className="u-uttu-total" data-uttu-total="">{t("uttu.sim.total", { low: formatCr(locale, sim.low), high: formatCr(locale, sim.high) })}</p>
      {sim.tranche && <p className="u-small">{t("uttu.sim.perBlock")}</p>}
      <p className="u-small">{t("uttu.sim.note")}</p>
      <button type="button" className="u-link" onClick={() => setPicks([])}>{t("uttu.sim.clear")}</button>
    </> : <p className="u-small">{t("uttu.sim.empty")}</p>}
  </div>;
}

/** The model names a tool; the studio links it and prices it from the registry. Launch stays in the tool. */
function ToolLink({ id, knowledge, locale }: { id: string; knowledge: Knowledge; locale: UttuLocale }) {
  const { t } = useI18n();
  const tool = knowledge.tools.find(item => item.id === id);
  const name = knowledge.locales[locale].tools[id]?.title ?? id;
  if (!tool) return null;
  return <p className="u-uttu-tool">
    <a className="u-uttu-go" data-uttu-tool={id} href={assetPath(toolHref(id))}>{t("uttu.comfy.openTool", { name })}</a>
    {tool.cost && <span className="u-small" data-uttu-tool-cost=""> · {t("uttu.comfy.toolCost", { low: formatCr(locale, tool.cost[0]), high: formatCr(locale, tool.cost[1]) })}</span>}
  </p>;
}
