"use client";

// The bar's thread (« le fil »). A send becomes a bubble, then one card: the estimate and a
// clear confirm, the run's progress, and the result with « Et ensuite ? ». The runs are the
// tools' own: runOutil (Klein, Modifier, Références, Animer) and PRISE's requestRun, whose
// confirm sheet is PRISE's. Agent answers here with the assistant's own kernel and runs nothing.
// The thread lives in sessionStorage; « Nouvelle conversation » clears it.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n, useLocaleSwitch } from "@/components/i18n/provider";
import { emptyConversation, type Conversation } from "@/lib/agent/kernel/production";
import { agentLocale, interpretAgentRequest, localizedTurn } from "@/lib/agent/language";
import { productionContext } from "@/lib/agent/context";
import { studioActionRegistry } from "@/lib/agent/registry";
import { formatCredits } from "@/lib/credits";
import { nearestExemple } from "@/lib/creation/exemple-galerie";
import { outilEtat, outilParId } from "@/lib/outils/catalogue";
import { outilQuote } from "@/lib/outils/graphs";
import { quoteCredits } from "@/lib/prise/rendu";
import { resolveTakeQuote } from "@/lib/render/billed-quote";
import { quotesToRecords } from "@/lib/render/measured-quote";
import { takeProfile } from "@/lib/render/take-graph";
import { assetPath } from "@/lib/site";
import { sourceFile } from "@/lib/suite/media";
import { AGENT_HANDOFF_EVENT, AGENT_HANDOFF_KEY, PRISE_HANDOFF_KEY, REFS_HANDOFF_KEY, priseHandoff, writeHandoff, type BarreMode, type BarreSettings } from "@/lib/barre/model";
import {
  append, busyJob, clearFil, emptyFil, findJob, lastResult, loadFil, patchJob, planSend, prisePrompt, priseSettings, saveFil,
  type Fil, type FilJob, type FilLink, type FilRef, type FilRoute,
} from "@/lib/barre/thread";
import { EtEnsuite } from "./et-ensuite";
import { fillBarre } from "./creation-bar";
import { toggleAssistant } from "./assistant-panel";
import { MontageButton } from "./montage-button";
import { useStudio, type MontageInput } from "./studio-session";

const AGENT_KEY = "u-ttu-barre-fil-agent";

function go(hash: string) {
  if (window.location.hash !== hash) window.history.pushState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const TAKE_STAGE: Record<string, string> = { start: "envoi", upload: "envoi", submit: "envoi", queue: "file", prepare: "file", render: "calcul", fetch: "retour", measure: "mesure" };

export interface FilSend { mode: BarreMode; text: string; refs: FilRef[]; settings: BarreSettings }

export interface FilRunner {
  fil: Fil;
  send(input: FilSend): void;
  confirm(id: string): void;
  cancel(id: string): void;
  retry(id: string): void;
  reset(): void;
  /** What a send would start, for the bar's button and route line: the tool and its estimate. */
  preview(input: FilSend): { route: string; where: string; quote: number | null };
}

/** The thread and its runs. One run at a time; nothing starts without a confirm. */
export function useFil(): FilRunner {
  const { t } = useI18n();
  const { locale: uiLocale } = useLocaleSwitch();
  const session = useStudio();
  const { studio, prefs, connected, setSheet, sheet, run, requestRun, resetRun, runOutil, media, cast } = session;
  const [fil, setFil] = useState<Fil>(emptyFil);
  const live = useRef(fil); live.current = fil;
  const loaded = useRef(false);
  const prise = useRef<{ id: string; saw: boolean } | null>(null);
  const update = useCallback((next: (fil: Fil) => Fil) => setFil(current => { const value = next(current); live.current = value; return value; }), []);

  useEffect(() => { setFil(loadFil(window.sessionStorage)); }, []);
  // Skip the first save: on mount `fil` is still empty while loadFil's setState is pending.
  // Writing that empty state would wipe sessionStorage (and Strict Mode remount would then
  // reload nothing). After the first run we persist every change, including a real clear.
  useEffect(() => {
    if (!loaded.current) { loaded.current = true; return; }
    saveFil(window.sessionStorage, fil);
  }, [fil]);

  const quoteOf = useCallback((route: FilRoute): number | null => {
    if (route.kind === "outil") { const outil = outilParId(route.id); return outil ? outilQuote(outil)?.credits ?? null : null; }
    return quoteCredits(resolveTakeQuote(takeProfile(priseSettings(route.settings, prefs.engineManual ? prefs.engine : "ltx")), quotesToRecords(studio.quotes)));
  }, [prefs.engine, prefs.engineManual, studio.quotes]);

  const startPrise = useCallback(async (job: FilJob) => {
    if (job.route.kind !== "prise") return;
    const route = job.route;
    if (run.phase === "done" || run.phase === "error") resetRun();
    const planche = route.cast.map(ref => Boolean(cast.find(card => card.id === ref.id)?.sheet));
    prise.current = { id: job.id, saw: false };
    await requestRun({
      planId: "barre",
      castIds: route.cast.map(ref => ref.id),
      decorId: route.decor?.id ?? null,
      line: job.text,
      prompt: prisePrompt(job.text, route, planche),
      settings: priseSettings(route.settings, prefs.engineManual ? prefs.engine : "ltx"),
      resume: [
        { label: t("p0.fiab.sentCast"), value: route.cast.map(ref => ref.name).join(", ") || "—" },
        { label: t("p0.fiab.sentDecor"), value: route.decor?.name || "—" },
        { label: t("p0.fiab.sentWords"), value: job.text },
      ],
      change: t("p0.fiab.changePrise"),
    });
  }, [cast, prefs.engine, prefs.engineManual, requestRun, resetRun, run.phase, t]);

  // PRISE's run, followed from here: running → done (the take) or error; a closed confirm is « annulé ».
  useEffect(() => {
    const held = prise.current;
    if (!held) return;
    const job = findJob(live.current, held.id);
    if (!job) { prise.current = null; return; }
    if (sheet === "confirm" || sheet === "connect") held.saw = true;
    if (run.phase === "running") {
      const event = run.event;
      update(f => patchJob(f, held.id, { status: "running", stage: TAKE_STAGE[event.stage] ?? "envoi", seconds: event.stage === "render" ? event.seconds : undefined }));
    } else if (run.phase === "done") {
      const take = studio.takes.find(item => item.id === run.takeId);
      if (!take) return;
      prise.current = null;
      update(f => patchJob(f, held.id, { status: "done", takeId: take.id, path: take.video, poster: take.poster ?? undefined, cost: take.costCredits, url: media[take.video] }));
    } else if (run.phase === "error") {
      prise.current = null;
      update(f => patchJob(f, held.id, { status: "error", message: run.message }));
    } else if (sheet === null && held.saw && job.status === "confirm") {
      prise.current = null;
      update(f => patchJob(f, held.id, { status: "cancelled" }));
    }
  }, [media, run, sheet, studio.takes, update]);

  const startOutil = useCallback(async (job: FilJob) => {
    if (job.route.kind !== "outil") return;
    const outil = outilParId(job.route.id);
    if (!outil || outilEtat(outil, prefs).kind !== "pret") { update(f => patchJob(f, job.id, { status: "error", message: t("barre.fil.toolClosed") })); return; }
    update(f => patchJob(f, job.id, { status: "running", stage: "envoi", message: undefined }));
    try {
      const images = await Promise.all(job.route.images.map(ref => sourceFile(ref.src || (ref.path ? media[ref.path] : "") || "", ref.name, "image")));
      const single = job.route.images.length === 1 ? job.route.images[0].path : undefined;
      const result = await runOutil({
        outil: outil.id, images, prompt: job.text, confirmed: true, from: single,
        onStage: (stage, seconds) => update(f => patchJob(f, job.id, { stage, seconds })),
      });
      if (result.ok) update(f => patchJob(f, job.id, { status: "done", url: result.url, path: result.path, cost: result.cost ?? null }));
      else update(f => patchJob(f, job.id, { status: "error", message: result.message }));
    } catch {
      update(f => patchJob(f, job.id, { status: "error", message: t("barre.fil.readFailed") }));
    }
  }, [media, prefs, runOutil, t, update]);

  const agentReply = useCallback((of: string, text: string) => {
    const operations = studioActionRegistry(prefs, t);
    const context = productionContext(session, operations, []);
    const locale = agentLocale(uiLocale);
    let previous: Conversation = emptyConversation(studio.project ?? "");
    try { const raw = window.sessionStorage.getItem(AGENT_KEY); if (raw) { const parsed = JSON.parse(raw) as Conversation; if (parsed.projectId === previous.projectId) previous = parsed; } } catch { /* fresh */ }
    const next = localizedTurn(previous, text, context, locale, t);
    try { window.sessionStorage.setItem(AGENT_KEY, JSON.stringify(next)); } catch { /* this page only */ }
    const said = [...next.messages].reverse().find(m => m.role === "assistant")?.text ?? t("agent.welcome");
    const ids = [...(next.plan?.steps.map(step => step.operationId) ?? []), ...interpretAgentRequest(text, context, locale)];
    const links: FilLink[] = [];
    for (const id of ids) {
      const op = operations.find(item => item.id === id);
      if (!op?.href || op.status !== "ready" || links.some(link => link.href === op.href && link.label === op.label)) continue;
      links.push({ label: op.label, href: op.href, quote: op.quote ? t("barre.cost", { credits: formatCredits(op.quote.credits) }) : undefined });
      if (links.length >= 4) break;
    }
    update(f => append(f, { id: uid("a"), role: "agent", of, text: said, links }));
  }, [prefs, session, studio.project, t, uiLocale, update]);

  const send = useCallback((input: FilSend) => {
    const last = lastResult(live.current);
    const plan = planSend({ ...input, last, lastName: t("barre.fil.lastName") });
    const user = { id: uid("u"), role: "user" as const, mode: input.mode, text: input.text.trim(), refs: plan.kind === "run" ? plan.refs : input.refs, at: Date.now() };
    if (plan.kind === "agent") { update(f => append(f, user)); agentReply(user.id, user.text); return; }
    if (plan.kind === "note") { update(f => append(f, user, { id: uid("n"), role: "note", of: user.id, key: plan.key })); return; }
    if (busyJob(live.current)) { update(f => append(f, user, { id: uid("n"), role: "note", of: user.id, key: "barre.fil.busy" })); return; }
    const job: FilJob = {
      id: uid("j"), role: "job", of: user.id, text: user.text, route: plan.route, sortie: plan.sortie, status: "confirm", quote: quoteOf(plan.route),
      aspect: plan.route.kind === "prise" && plan.route.settings.format === "9:16" ? "vertical" : "horizontal",
    };
    update(f => append(f, user, job));
    // PRISE's own confirm (its reliability card and estimate) is the clear confirm for a take.
    if (job.route.kind === "prise") void startPrise(job);
  }, [agentReply, quoteOf, startPrise, t, update]);

  const confirm = useCallback((id: string) => {
    const job = findJob(live.current, id);
    if (!job || job.status !== "confirm") return;
    if (!connected) { setSheet("connect"); return; }
    if (job.route.kind === "prise") void startPrise(job);
    else void startOutil(job);
  }, [connected, setSheet, startOutil, startPrise]);

  const cancel = useCallback((id: string) => {
    if (prise.current?.id === id) { prise.current = null; if (sheet === "confirm") setSheet(null); }
    update(f => patchJob(f, id, { status: "cancelled" }));
  }, [setSheet, sheet, update]);

  const retry = useCallback((id: string) => {
    const job = findJob(live.current, id);
    if (!job || busyJob(live.current)) return;
    update(f => patchJob(f, id, { status: "confirm", message: undefined, stage: undefined }));
    if (job.route.kind === "prise") void startPrise({ ...job, status: "confirm" });
  }, [startPrise, update]);

  const reset = useCallback(() => {
    prise.current = null;
    try { window.sessionStorage.removeItem(AGENT_KEY); } catch { /* nothing kept */ }
    update(() => clearFil(window.sessionStorage));
  }, [update]);

  const preview = useCallback((input: FilSend) => {
    const plan = planSend({ ...input, text: input.text.trim() || "…", last: lastResult(fil), lastName: t("barre.fil.lastName") });
    if (plan.kind === "agent") return { route: "agent", where: t("barre.where.agentHere"), quote: null };
    if (plan.kind === "note") return { route: "note", where: t("barre.where.needRef"), quote: null };
    return { route: plan.route.kind === "prise" ? "prise" : plan.route.id, where: plan.route.kind === "prise" ? t("nav.take") : t(`outils.t.${plan.route.id}.title`), quote: quoteOf(plan.route) };
  }, [fil, quoteOf, t]);

  return useMemo(() => ({ fil, send, confirm, cancel, retry, reset, preview }), [fil, send, confirm, cancel, retry, reset, preview]);
}

/** « Ouvrir dans l'outil »: the same tool page, already filled, for fine control. */
function openInTool(job: FilJob) {
  if (job.route.kind === "prise") {
    writeHandoff(window.sessionStorage, PRISE_HANDOFF_KEY, priseHandoff(job.text, job.route.cast.concat(job.route.decor ? [job.route.decor] : []).map(ref => ({ kind: ref.kind === "decor" ? "decor" as const : "cast" as const, id: ref.id, name: ref.name, src: ref.src })), job.route.settings));
    go("#prise");
    return;
  }
  try { sessionStorage.setItem("u-ttu-consigne", job.text); } catch { /* the tool still opens */ }
  const images = job.route.images.filter(ref => ref.src && !ref.src.startsWith("blob:") || ref.path).map(ref => ({ name: ref.name, url: ref.src, path: ref.path }));
  if (images.length) writeHandoff(window.sessionStorage, REFS_HANDOFF_KEY, { tool: job.route.id, images });
  go(`#outils/${job.route.id}`);
}

function toolName(t: (k: string, v?: Record<string, string | number>) => string, job: FilJob) {
  return job.route.kind === "prise" ? t("nav.take") : t(`outils.t.${job.route.id}.title`);
}

export function BarreFil({ runner }: { runner: FilRunner }) {
  const { t } = useI18n();
  const { media } = useStudio();
  const list = useRef<HTMLOListElement>(null);
  const count = runner.fil.messages.length;
  const tail = runner.fil.messages[count - 1];
  const beat = `${count}:${tail?.role === "job" ? tail.status : ""}`;
  // The newest card comes into view from its top, so a result shows above the bar.
  useEffect(() => {
    if (!count) return;
    const last = list.current?.lastElementChild as HTMLElement | null;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    last?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [beat, count]);
  if (count === 0) return null;
  const src = (ref: FilRef) => ref.src || (ref.path ? media[ref.path] ?? "" : "");
  return <section className="u-fil" data-fil="" aria-label={t("barre.fil.title")}>
    <div className="u-fil-head">
      <h2 className="u-label">{t("barre.fil.title")}</h2>
      <button type="button" className="u-secondary u-fil-new" data-fil-new="" onClick={runner.reset}>{t("barre.fil.new")}</button>
    </div>
    <ol ref={list} className="u-fil-list" role="log" aria-live="polite" aria-label={t("barre.fil.title")}>
      {runner.fil.messages.map(m => {
        if (m.role === "user") return <li key={m.id} className="u-fil-user" data-fil-user={m.mode}>
          {m.refs.length > 0 && <ul className="u-fil-refs" role="list" aria-label={t("barre.attached")}>
            {m.refs.map(ref => <li key={`${ref.kind}-${ref.id}`} className="u-fil-ref" data-fil-ref={ref.kind}>
              {src(ref) ? <img src={src(ref)} alt="" width={40} height={40} /> : <span className="u-fil-ref-dot" aria-hidden="true" />}
              <span>{ref.name}</span>
            </li>)}
          </ul>}
          <p><span className="sr-only">{t("agent.you")} · {t(`barre.mode.${m.mode}`)} : </span>{m.text}</p>
          <span className="u-fil-mode" aria-hidden="true">{t(`barre.mode.${m.mode}`)}</span>
        </li>;
        if (m.role === "note") return <li key={m.id} className="u-fil-note" data-fil-note={m.key}><p>{t(m.key)}</p></li>;
        if (m.role === "agent") return <li key={m.id} className="u-fil-agent" data-fil-agent="">
          <p className="u-fil-who">U*TTU</p>
          <p>{m.text}</p>
          {m.links.length > 0 && <ul className="u-fil-links" role="list">
            {m.links.map(link => <li key={`${link.href}-${link.label}`}><a className="u-secondary" href={assetPath(link.href)} data-fil-link="">{link.label}{link.quote && <small> · {link.quote}</small>}</a></li>)}
          </ul>}
          <p className="u-small">{t("barre.fil.agentSafe")}</p>
          <button type="button" className="u-text-button" data-fil-assistant="" onClick={() => {
            const asked = runner.fil.messages.find(u => u.id === m.of);
            writeHandoff(window.sessionStorage, AGENT_HANDOFF_KEY, asked?.role === "user" ? asked.text : "");
            toggleAssistant(true);
            requestAnimationFrame(() => window.dispatchEvent(new Event(AGENT_HANDOFF_EVENT)));
          }}>{t("barre.fil.toAssistant")}</button>
        </li>;
        return <JobCard key={m.id} job={m} runner={runner} />;
      })}
    </ol>
  </section>;
}


function QuoteExemple({ job }: { job: FilJob }) {
  const { t } = useI18n();
  const mode = job.sortie === "video" ? "video" as const : "image" as const;
  const tool = job.route.kind === "outil" ? job.route.id : "prise";
  const hasRefs = job.route.kind === "outil"
    ? job.route.images.length > 0
    : job.route.cast.length > 0 || Boolean(job.route.decor);
  const card = nearestExemple({ mode, tool, hasRefs });
  return <div className="u-fil-quote-ex" data-fil-quote-ex="">
    <img src={assetPath(card.thumb)} alt="" width={72} height={48} loading="lazy" decoding="async" />
    <p><strong>{t("barre.galerie.quoteNear")}</strong><br /><small>{t(card.titleKey)} · {t(`barre.galerie.tool.${card.tool}`)} · {t("barre.cost", { credits: formatCredits(card.price) })}</small></p>
  </div>;
}

function JobCard({ job, runner }: { job: FilJob; runner: FilRunner }) {
  const { t } = useI18n();
  const { media, connected, setSheet } = useStudio();
  const name = toolName(t, job);
  const cost = job.quote !== null ? t("barre.cost", { credits: formatCredits(job.quote) }) : null;
  const url = job.url || (job.path ? media[job.path] : "") || "";
  const poster = job.poster ? (job.poster.startsWith("Projets/") ? media[job.poster] : job.poster) : undefined;
  const open = <a className="u-text-button u-fil-open" href={job.route.kind === "prise" ? "#prise" : `#outils/${job.route.id}`} data-fil-open="" onClick={event => { event.preventDefault(); openInTool(job); }}>{t("barre.fil.openTool")}</a>;

  const montage: MontageInput | null = !url ? null
    : job.takeId ? { takeId: job.takeId, planId: "barre", label: job.text.slice(0, 80), seconds: 5, aspect: job.aspect, still: "", prompt: job.text, sceneName: "", composeur: "" }
    : job.sortie === "video" && job.path ? { planId: "barre", label: job.text.slice(0, 80), seconds: 5, aspect: job.aspect, still: "", video: job.path, prompt: job.text, sceneName: "", composeur: "" }
    : job.sortie === "image" ? { planId: "barre", label: job.text.slice(0, 80), seconds: 5, aspect: job.aspect, still: url, prompt: job.text, sceneName: "", composeur: "" }
    : null;

  return <li className="u-fil-job" data-fil-job={job.status} data-fil-tool={job.route.kind === "prise" ? "prise" : job.route.id} data-fil-sortie={job.sortie}>
    <p className="u-fil-who">{name}{cost && <span className="u-fil-cost"> · {cost}</span>}</p>
    {job.status === "confirm" && job.route.kind === "outil" && <div className="u-fil-confirm" data-fil-confirm-card="">
      <p>{t("barre.fil.confirmLine")}</p>
      {!connected && <QuoteExemple job={job} />}
      {!connected && <p className="u-small">{t("barre.fil.needLink")}</p>}
      <div className="u-fil-actions">
        {connected
          ? <button type="button" className="u-primary" data-fil-confirm="" onClick={() => runner.confirm(job.id)}>{cost ? t("barre.fil.go", { cost }) : t("barre.fil.goNoQuote")}</button>
          : <button type="button" className="u-primary" data-fil-link-comfy="" onClick={() => setSheet("connect")}>{t("entry.link")}</button>}
        <button type="button" className="u-secondary" data-fil-cancel="" onClick={() => runner.cancel(job.id)}>{t("verb.cancel")}</button>
      </div>
    </div>}
    {job.status === "confirm" && job.route.kind === "prise" && <div className="u-fil-confirm" data-fil-confirm-card="prise">
      <p>{t("barre.fil.confirmPrise")}</p>
      <div className="u-fil-actions">
        <button type="button" className="u-primary" data-fil-reconfirm="" onClick={() => runner.retry(job.id)}>{t("barre.fil.showConfirm")}</button>
        <button type="button" className="u-secondary" data-fil-cancel="" onClick={() => runner.cancel(job.id)}>{t("verb.cancel")}</button>
      </div>
    </div>}
    {job.status === "running" && <div className="u-fil-progress" role="status" data-fil-progress={job.stage ?? "envoi"}>
      <span className="u-fil-bar" aria-hidden="true"><span /></span>
      <p>{job.stage === "calcul" && !job.seconds ? t("barre.fil.stage.calculStart") : t(`barre.fil.stage.${job.stage ?? "envoi"}`, { seconds: String(job.seconds ?? 0) })}</p>
      <p className="u-small">{t("finaliser.keepOpen")}</p>
    </div>}
    {job.status === "done" && <div className="u-fil-result" data-fil-result={job.sortie} data-aspect={job.aspect}>
      {url ? (job.sortie === "image"
        ? <img src={url} alt={job.text} className="u-fil-media" data-fil-media="" />
        : <video src={url} poster={poster} className="u-fil-media" data-fil-media="" controls playsInline muted loop preload="metadata" aria-label={job.text} />)
        : <p className="u-small">{t("barre.fil.inCreations")}</p>}
      <p className="u-small" data-fil-saved="">{t("barre.fil.saved")} {typeof job.cost === "number" ? t("finaliser.cost", { credits: formatCredits(job.cost) }) : t("finaliser.costUnknown")}</p>
      <div className="u-fil-actions">
        {job.sortie === "image" && <button type="button" className="u-secondary" data-fil-animate="" onClick={() => fillBarre("video", t("barre.fil.animateText"))}>{t("barre.fil.animate")}</button>}
        {job.sortie === "image" && <button type="button" className="u-secondary" data-fil-modify="" onClick={() => fillBarre("image", t("barre.fil.modifyText"))}>{t("barre.fil.modify")}</button>}
        {montage && <MontageButton input={montage} />}
      </div>
      {url && <EtEnsuite source={{ kind: job.sortie, url, name: job.text.slice(0, 60) || name, path: job.path, aspect: job.aspect }} defaultOpen />}
    </div>}
    {(job.status === "error" || job.status === "cancelled" || job.status === "interrupted") && <div className="u-fil-confirm" data-fil-stopped={job.status}>
      <p>{job.status === "error" ? job.message || t("create.failed") : t(`barre.fil.${job.status}`)}</p>
      <div className="u-fil-actions">
        {job.status !== "interrupted" && <button type="button" className="u-secondary" data-fil-retry="" onClick={() => runner.retry(job.id)}>{t("barre.fil.retry")}</button>}
        {job.status === "interrupted" && <a className="u-secondary" href={assetPath("/mon-studio")} data-fil-creations="">{t("barre.fil.toCreations")}</a>}
      </div>
    </div>}
    {open}
  </li>;
}
