"use client";

// « Outils » : every Comfy tool of the studio in one place, by family. One panel for every
// tool, always in the same order: entrée → consigne → références (repliées) → réglages
// (repliés) → one full-width button named after the action, with its estimate. Results sit
// next to the panel and each one shows « Et ensuite ? » open. A tool that is not wired yet
// says « bientôt » and why; there is never a button that does nothing. No cancel.

import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";
import { useI18n } from "@/components/i18n/provider";
import type { AssetRecord } from "@/lib/creation/assets";
import { formatCredits } from "@/lib/credits";
import { protocole } from "@/lib/fiabilite";
import { cherche, dansFamille, FAMILLES, OUTILS, outilEtat, outilParId, outilPartenaire, outilsOnglet, type Entree, type Famille, type Outil, type Sortie } from "@/lib/outils/catalogue";
import { outilQuote } from "@/lib/outils/graphs";
import { assetPath } from "@/lib/site";
import { lastFrame, sourceFile, typeFromName, videoSeconds } from "@/lib/suite/media";
import type { Elargir } from "@/lib/suite/graphs";
import type { Onglet } from "@/lib/workflows/registre";
import { EtEnsuite } from "./et-ensuite";
import { ProtocolStrip } from "./fiabilite-card";
import { useStudio, type FinaliseOutcome, type FinaliseStage } from "./studio-session";

export const SAMPLES: Record<Entree, { url: string; name: string }> = {
  image: { url: "/exemples/cast-coursiere.webp", name: "exemple-personnage.webp" },
  image2: { url: "/exemples/decor-quai-nuit.webp", name: "exemple-lieu.webp" },
  video: { url: "/exemples/outils/plan-exemple.mp4", name: "exemple-plan.mp4" },
  audio: { url: "/exemples/voix-exemple.wav", name: "exemple-voix.wav" },
};

const MEDIA: Record<Entree, "image" | "video" | "audio"> = { image: "image", image2: "image", video: "video", audio: "audio" };

/** The hash that opens the hub, optionally on one tool: #outils or #outils/<id>. */
export function outilFromHash(hash: string): string | null {
  const match = /^#outils\/([a-z0-9-]+)/.exec(hash);
  return match ? match[1] : null;
}

function openTool(id: string | null) {
  const hash = id ? `#outils/${id}` : "#outils";
  if (window.location.pathname.endsWith("/studio")) {
    if (window.location.hash !== hash) window.history.pushState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.href = assetPath(`/studio${hash}`);
  }
}

function QuoteLine({ outil }: { outil: Outil }) {
  const { t } = useI18n();
  const quote = outilQuote(outil);
  const price = quote?.credits ?? outil.prix ?? null;
  if (price === null) return null;
  return <span className="u-outil-cost">
    {quote ? t("outils.cost", { credits: formatCredits(price) }) : t("outils.partnerPrice", { credits: formatCredits(price) })}
    {outil.parTranche ? ` ${t("outils.perBlock")}` : ""} <small>{t("outils.estimate")}</small>
  </span>;
}

export function OutilCard({ outil }: { outil: Outil }) {
  const { t } = useI18n();
  const { prefs } = useStudio();
  const etat = outilEtat(outil, prefs);
  const partner = outilPartenaire(outil);
  const badge = <span className="u-outil-badge" data-partner={partner ? "" : undefined}>{t(partner ? "outils.partner" : "outils.open")}</span>;
  const body = <>
    <span className="u-outil-top"><span className="u-outil-name">{t(`outils.t.${outil.id}.title`)}</span>{badge}</span>
    <span className="u-outil-line">{t(`outils.t.${outil.id}.line`)}</span>
    <QuoteLine outil={outil} />
  </>;
  if (etat.kind === "pret") {
    return <button type="button" className="u-outil-card" data-outil={outil.id} data-etat="pret" onClick={() => openTool(outil.id)}>{body}</button>;
  }
  const reason = etat.kind === "masque" ? t(`outils.hidden.${etat.raison}`) : etat.raison === "unwired" ? t("gestes.unwired") : t(`outils.why.${etat.raison}`);
  return <article className="u-outil-card" data-outil={outil.id} data-etat={etat.kind} aria-label={`${t(`outils.t.${outil.id}.title`)} · ${t("outils.soon")}`}>
    {body}
    <span className="u-outil-soon"><strong>{etat.kind === "masque" ? t("outils.partner") : t("outils.soon")}</strong> · {reason}</span>
  </article>;
}

/** One tab's own tools, from the same hub data, folded so the tab stays short. */
export function OutilsStrip({ onglet, open = false }: { onglet: Onglet; open?: boolean }) {
  const { t } = useI18n();
  const list = outilsOnglet(onglet);
  if (list.length === 0) return null;
  return <details className="u-outils-strip" data-outils-onglet={onglet} open={open || undefined}>
    <summary><span>{t("outils.tabTools")}</span><span className="u-small">{t("outils.count", { n: String(list.length) })}</span></summary>
    <div className="u-outils-strip-body">
      <div className="u-outils-grid">{list.map(item => <OutilCard key={item.id} outil={item} />)}</div>
      <button type="button" className="u-secondary" data-outils-all="" onClick={() => openTool(null)}>{t("outils.seeAll")}</button>
    </div>
  </details>;
}

/** « Que veux-tu créer ? » on the studio home: one click to the hub. */
export function OutilsEntry() {
  const { t } = useI18n();
  const ready = OUTILS.length;
  return <button type="button" className="u-outils-entry" data-outils-entry="" onClick={() => openTool(null)}>
    <span className="u-outils-entry-title">{t("outils.entry")}</span>
    <span className="u-small">{t("outils.entryLead", { n: String(ready) })}</span>
  </button>;
}

export function OutilsHub({ tool }: { tool: string | null }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [famille, setFamille] = useState<Famille | "tout">("tout");
  const outil = tool ? outilParId(tool) : null;
  const searchId = useId();
  // Search aliases (e.g. « finaliser » finds « Améliorer la vidéo »); only some tools carry them.
  const tags = (id: string) => (t.has(`outils.t.${id}.tags`) ? t(`outils.t.${id}.tags`) : "");

  const list = useMemo(() => OUTILS.filter(item => dansFamille(item, famille) && (!query.trim() || cherche(`${t(`outils.t.${item.id}.title`)} ${t(`outils.t.${item.id}.line`)} ${t(`outils.fam.${item.famille}`)} ${t(`outils.sous.${item.sous}`)} ${tags(item.id)}`, query))), [famille, query, t]);

  if (outil) {
    return <div className="u-outils-work" data-outils-tool={outil.id}>
      <button type="button" className="u-secondary u-outils-back" data-outils-back="" onClick={() => openTool(null)}>← {t("outils.back")}</button>
      <div className="u-outils-split">
        <ToolPanel key={outil.id} outil={outil} />
        <OutilResults key={`resultats-${outil.id}`} sortie={outil.sortie} />
      </div>
    </div>;
  }

  return <section className="u-outils" data-outils-hub="" aria-labelledby="u-title">
    <header className="u-outils-head">
      <h1 id="u-title" tabIndex={-1}>{t("outils.entry")}</h1>
      <p className="u-small">{t("outils.entryLead", { n: String(OUTILS.length) })}</p>
    </header>
    <div className="u-outils-tools">
      <label className="u-field u-outils-search" htmlFor={searchId}>
        <span className="u-label">{t("outils.search")}</span>
        <input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("outils.search")} data-outils-search="" />
      </label>
      <div className="u-choice-row u-outils-families" role="group" aria-label={t("outils.title")}>
        {(["tout", ...FAMILLES] as const).map(id => <button key={id} type="button" className="u-chip" aria-pressed={famille === id} data-outils-famille={id} onClick={() => setFamille(id)}>
          {id === "tout" ? t("outils.all") : t(`outils.fam.${id}`)}
        </button>)}
      </div>
    </div>
    <p className="u-small" aria-live="polite" data-outils-count={list.length}>{list.length ? t("outils.count", { n: String(list.length) }) : t("outils.none")}</p>
    {(famille === "tout" ? FAMILLES : [famille]).map(fam => {
      const items = list.filter(item => famille === "tout" ? item.famille === fam : true);
      if (!items.length) return null;
      return <section key={fam} className="u-outils-family" data-outils-section={fam}>
        <h2>{t(`outils.fam.${fam}`)}</h2>
        <div className="u-outils-grid">{items.map(item => <OutilCard key={item.id} outil={item} />)}</div>
      </section>;
    })}
  </section>;
}

interface Picked { url: string; name: string; file?: File; path?: string; aspect?: "horizontal" | "vertical" }

function kindOfAsset(asset: AssetRecord, media: Record<string, string>): "image" | "video" | "audio" | "mesh" | null {
  const path = asset.media || asset.preview || "";
  if (/\.(glb|gltf)$/i.test(path)) return "mesh";
  if (/\.(mp4|webm|mov)$/i.test(path) || asset.kind === "plan") return /\.(png|jpe?g|webp)$/i.test(path) ? "image" : "video";
  if (/\.(mp3|wav|flac|ogg|m4a)$/i.test(path) || asset.kind === "son") return "audio";
  if (/\.(png|jpe?g|webp|gif)$/i.test(path)) return "image";
  return media[path] ? "image" : null;
}

function useResultAssets(): { asset: AssetRecord; url: string; kind: "image" | "video" | "audio" | "mesh" }[] {
  const { loose, media, studio } = useStudio();
  return useMemo(() => {
    const takes: AssetRecord[] = studio.takes.map(take => ({ id: take.id, kind: "plan", name: take.line || take.id, at: take.at, prompt: take.prompt, geste: "prise-plan", template: "", refs: [], devis: take.announcedCredits, cout: take.costCredits, media: take.video, note: "", preview: null, loose: false }));
    return [...loose, ...takes]
      .map(asset => ({ asset, url: asset.preview ? assetPath(asset.preview) : (media[asset.media] ?? ""), kind: kindOfAsset(asset, media) }))
      .filter((item): item is { asset: AssetRecord; url: string; kind: "image" | "video" | "audio" | "mesh" } => Boolean(item.url && item.kind))
      .sort((a, b) => b.asset.at.localeCompare(a.asset.at));
  }, [loose, media, studio.takes]);
}

function InputSlot({ entree, value, busy, busyId, onChange }: { entree: Entree; value: Picked | null; busy: boolean; busyId: string; onChange(next: Picked | null): void }) {
  const { t } = useI18n();
  const id = useId();
  const [over, setOver] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const want = MEDIA[entree];
  const own = useResultAssets().filter(item => item.kind === want).slice(0, 8);
  const accept = `${want}/*`;
  function take(file: File | undefined) {
    if (!file || !(file.type || typeFromName(file.name)).startsWith(`${want}/`)) return;
    onChange({ url: URL.createObjectURL(file), name: file.name, file });
  }
  function drop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    if (!busy) take(event.dataTransfer.files?.[0]);
  }
  return <div className="u-outil-input" data-outil-input={entree} data-over={over ? "" : undefined} onDragOver={event => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
    <span className="u-label" id={`${id}-label`}>{t(`outils.kind.${entree}`)}</span>
    {value && <div className="u-outil-preview">
      {want === "image" ? <img src={value.url} alt="" /> : want === "video" ? <video src={value.url} muted playsInline controls /> : <audio src={value.url} controls />}
      <span className="u-small">{value.name}</span>
    </div>}
    <div className="u-outil-input-actions">
      <label className="u-chip u-file-chip" data-outil-file={entree}>
        <span>{value ? t("outils.replace") : t("outils.pick")}</span>
        <input type="file" accept={accept} disabled={busy} aria-labelledby={`${id}-label`} aria-describedby={busy ? busyId : undefined} onChange={event => take(event.target.files?.[0] ?? undefined)} />
      </label>
      <button type="button" className="u-chip" data-outil-sample={entree} disabled={busy} aria-describedby={busy ? busyId : undefined} onClick={() => onChange({ url: assetPath(SAMPLES[entree].url), name: SAMPLES[entree].name })}>{t("outils.sample")}</button>
      {own.length > 0 && <button type="button" className="u-chip" aria-expanded={studioOpen} data-outil-studio={entree} disabled={busy} aria-describedby={busy ? busyId : undefined} onClick={() => setStudioOpen(open => !open)}>{t("outils.fromStudio")}</button>}
    </div>
    {studioOpen && <div className="u-outil-own" role="group" aria-label={t("outils.fromStudio")}>
      {own.map(item => <button key={item.asset.id} type="button" className="u-outil-own-item" onClick={() => { onChange({ url: item.url, name: item.asset.name, path: item.asset.media || undefined }); setStudioOpen(false); }}>
        {want === "image" ? <img src={item.url} alt="" /> : <span>{want === "video" ? "▶" : "♪"}</span>}
        <span className="u-small">{item.asset.name}</span>
      </button>)}
    </div>}
  </div>;
}

export function ToolPanel({ outil }: { outil: Outil }) {
  const { t } = useI18n();
  const { connected, creating, runOutil, balance, setSheet, prefs } = useStudio();
  const [inputs, setInputs] = useState<Partial<Record<Entree, Picked | null>>>({});
  const [text, setText] = useState("");
  const [aspect, setAspect] = useState<"horizontal" | "vertical">("horizontal");
  const [side, setSide] = useState<Elargir>("cotes");
  const [fluide, setFluide] = useState(false);
  const [mesh, setMesh] = useState<"objet" | "perso">("objet");
  const [consent, setConsent] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [stage, setStage] = useState<{ stage: FinaliseStage; seconds?: number } | null>(null);
  const [outcome, setOutcome] = useState<FinaliseOutcome | null>(null);
  const titleId = useId();
  const busyId = `${titleId}-busy`;
  const whyId = `${titleId}-why`;
  const etat = outilEtat(outil, prefs);
  // Two taps in the same frame never send two jobs.
  const sending = useRef(false);

  const main = outil.entrees.filter(item => item !== "image2");
  const refs = outil.entrees.filter(item => item === "image2");
  const reglages = [...(outil.reglages ?? []), ...(outil.moteur?.kind === "mesh" ? ["mesh" as const] : [])];
  const video = inputs.video;
  useEffect(() => {
    if (!video) { setSeconds(null); return; }
    let gone = false;
    void videoSeconds(video.url).then(value => { if (!gone) setSeconds(value); });
    return () => { gone = true; };
  }, [video]);

  const quote = useMemo(() => outilQuote(outil, { seconds: seconds ?? undefined, fluidifier: fluide, mesh }), [outil, seconds, fluide, mesh]);
  const busy = stage !== null;
  const missingInput = main.find(item => !inputs[item]);
  const missingText = outil.texte === "requis" && !text.trim();
  const needConsent = Boolean(outil.consentement && inputs.audio && !consent);
  const lowBalance = Boolean(quote && balance && balance.credits < quote.high);
  const can = etat.kind === "pret" && connected && confirmed && !missingInput && !missingText && !needConsent && !busy && !creating && Boolean(quote) && !lowBalance;
  const why = etat.kind !== "pret" ? t("gestes.unwired")
    : missingInput ? t("outils.needInput", { what: t(`outils.kind.${missingInput}`) })
    : missingText ? t("videoGeste.needText")
    : needConsent ? t("outils.needConsent")
    : !connected ? t("videoGeste.needLink")
    : lowBalance && quote ? t("finaliser.needCeiling", { ceiling: formatCredits(quote.high) })
    : !confirmed ? t("videoGeste.needConfirm")
    : creating ? t("outils.busy") : "";
  const states = protocole({ prepared: !missingInput && !missingText && !needConsent, checked: connected && !lowBalance, quoted: Boolean(quote), confirming: confirmed, running: busy, failed: outcome?.ok === false, landed: outcome?.ok === true, archived: outcome?.ok === true });
  const action = outil.entrees.length === 0 || outil.famille === "3d" ? t(`outils.do.${outil.sortie}`) : t(`outils.t.${outil.id}.title`);
  const lock = { disabled: busy, "aria-describedby": busy ? busyId : undefined };

  function set(entree: Entree, next: Picked | null) { setInputs(current => ({ ...current, [entree]: next })); setConfirmed(false); setOutcome(null); }
  function reset() { setConfirmed(false); setOutcome(null); }

  async function launch() {
    if (!can || !quote || sending.current) return;
    sending.current = true;
    setOutcome(null);
    setStage({ stage: "envoi" });
    const onStage = (next: FinaliseStage, at?: number) => setStage({ stage: next, seconds: at });
    try {
      const toFile = async (entree: Entree) => {
        const picked = inputs[entree];
        if (!picked) return undefined;
        if (picked.file) return picked.file;
        const kind = MEDIA[entree];
        if (kind === "audio") {
          const blob = await (await fetch(picked.url)).blob();
          return new File([blob], picked.name, { type: blob.type || typeFromName(picked.name, "audio/wav") });
        }
        return sourceFile(picked.url, picked.name, kind);
      };
      const images: File[] = [];
      if (outil.geste === "suite-prolonger" && inputs.video) {
        const frame = await lastFrame(inputs.video.url, inputs.video.name);
        if (!frame) throw new Error(t("suite.noFrame"));
        images.push(frame);
      }
      for (const entree of ["image", "image2"] as const) {
        const file = await toFile(entree);
        if (file) images.push(file);
      }
      const from = inputs.image?.path ?? inputs.video?.path;
      const result = await runOutil({ outil: outil.id, images, video: await toFile("video"), audio: await toFile("audio"), prompt: text, confirmed, aspect, elargir: side, fluidifier: fluide, seconds: seconds ?? undefined, mesh, consent, from, onStage });
      setOutcome(result);
    } catch (error) {
      setOutcome({ ok: false, message: error instanceof Error && error.message ? error.message : t("create.failed") });
    } finally {
      sending.current = false;
      setStage(null);
      setConfirmed(false);
    }
  }

  return <section className="u-tool-panel" data-tool-panel={outil.id} aria-labelledby={titleId}>
    <header className="u-tool-head">
      <h1 id={titleId} tabIndex={-1}>{t(`outils.t.${outil.id}.title`)}</h1>
      <span className="u-outil-badge" data-partner={outilPartenaire(outil) ? "" : undefined}>{t(outilPartenaire(outil) ? "outils.partner" : "outils.open")}</span>
    </header>
    <p className="u-small">{t(`outils.t.${outil.id}.line`)}</p>
    <ProtocolStrip states={states} />
    {main.length > 0 && <fieldset className="u-tool-step" data-tool-step="entree">
      <legend className="u-label">{t("outils.input")}</legend>
      {main.map(entree => <InputSlot key={entree} entree={entree} value={inputs[entree] ?? null} busy={busy} busyId={busyId} onChange={next => set(entree, next)} />)}
      {outil.consentement && inputs.audio && <button type="button" role="checkbox" className="u-final-confirm" aria-checked={consent} data-tool-consent="" {...lock} onClick={() => { setConsent(value => !value); reset(); }}>
        <span className="u-final-box" aria-hidden="true">{consent ? "✓" : ""}</span><span>{t("outils.consent")}</span>
      </button>}
    </fieldset>}
    {outil.texte !== "aucun" && <label className="u-field u-tool-step" data-tool-step="consigne">
      <span className="u-label">{t("outils.prompt")}{outil.texte === "facultatif" ? ` ${t("suite.optional")}` : ""}</span>
      <textarea rows={3} value={text} maxLength={1200} {...lock} onChange={event => { setText(event.target.value); reset(); }} />
    </label>}
    {refs.length > 0 && <details className="u-tool-fold" data-tool-step="references">
      <summary>{t("outils.refs")}</summary>
      {refs.map(entree => <InputSlot key={entree} entree={entree} value={inputs[entree] ?? null} busy={busy} busyId={busyId} onChange={next => set(entree, next)} />)}
    </details>}
    {reglages.length > 0 && <details className="u-tool-fold" data-tool-step="reglages">
      <summary>{t("outils.settings")}</summary>
      {reglages.includes("aspect") && <div className="u-choice-row" role="group" aria-label={t("outils.format")}>
        {(["horizontal", "vertical"] as const).map(id => <button key={id} type="button" className="u-chip" aria-pressed={aspect === id} data-tool-aspect={id} {...lock} onClick={() => { setAspect(id); reset(); }}>{t(`outils.aspect.${id}`)}</button>)}
      </div>}
      {reglages.includes("elargir") && <div className="u-choice-row" role="group" aria-label={t("suite.side")}>
        {(["cotes", "haut-bas", "tout"] as const).map(id => <button key={id} type="button" className="u-chip" aria-pressed={side === id} data-tool-side={id} {...lock} onClick={() => { setSide(id); reset(); }}>{t(`suite.sides.${id}`)}</button>)}
      </div>}
      {reglages.includes("mesh") && <div className="u-choice-row" role="group" aria-label={t("outils.settings")}>
        {(["objet", "perso"] as const).map(id => <button key={id} type="button" className="u-chip" aria-pressed={mesh === id} data-tool-mesh={id} {...lock} onClick={() => { setMesh(id); reset(); }}>{t(`outils.mesh.${id}`)}</button>)}
      </div>}
      {reglages.includes("fluide") && <button type="button" role="checkbox" className="u-final-confirm" aria-checked={fluide} data-tool-fluide="" {...lock} onClick={() => { setFluide(value => !value); reset(); }}>
        <span className="u-final-box" aria-hidden="true">{fluide ? "✓" : ""}</span><span>{t("suite.fluide")}</span>
      </button>}
    </details>}
    <button type="button" role="checkbox" className="u-final-confirm" aria-checked={confirmed} data-tool-confirm="" {...lock} onClick={() => setConfirmed(value => !value)}>
      <span className="u-final-box" aria-hidden="true">{confirmed ? "✓" : ""}</span>
      <span>{t("outils.confirm", { credits: formatCredits(quote?.credits ?? 0), ceiling: formatCredits(quote?.high ?? 0) })}</span>
    </button>
    <button type="button" className="u-tool-go" data-tool-go="" disabled={!can} aria-describedby={busy ? busyId : why ? whyId : undefined} onClick={() => void launch()}>
      <span>{action}</span>
      {quote && <span className="u-tool-go-cost">{t("outils.cost", { credits: formatCredits(quote.credits) })} <small>{t("outils.estimate")}</small> <small className="u-tool-go-reserve">{t("outils.reserve", { ceiling: formatCredits(quote.high) })}</small></span>}
    </button>
    {why && !busy && <p className="u-why" id={whyId} data-tool-why="">{why}{!connected && etat.kind === "pret" && !missingInput && !missingText ? <> <button type="button" className="u-link" data-tool-link="" onClick={() => setSheet("connect")}>{t("outils.link")}</button></> : null}</p>}
    {!connected && (missingInput || missingText) && !busy && <p className="u-small" data-tool-link-hint="">{t("videoGeste.needLink")} <button type="button" className="u-link" data-tool-link="" onClick={() => setSheet("connect")}>{t("outils.link")}</button></p>}
    {stage && <p className="u-small" id={busyId} aria-live="polite">{t(`finaliser.${stage.stage}`, { seconds: String(stage.seconds ?? 0) })} {t("finaliser.keepOpen")}</p>}
    {outcome && !outcome.ok && <p className="u-why" role="alert" data-tool-fail="">{outcome.message} {t("suite.intact")}</p>}
    {outcome?.ok && <p className="u-small" data-tool-done="">{t("suite.done")} {outcome.cost === null ? t("finaliser.costUnknown") : t("finaliser.cost", { credits: formatCredits(outcome.cost) })}</p>}
  </section>;
}

type Filtre = "tout" | Sortie;

export function OutilResults({ sortie, limit = 12, title, hideEmpty = false }: { sortie?: Sortie; limit?: number; title?: string; hideEmpty?: boolean }) {
  const { t } = useI18n();
  const all = useResultAssets();
  const [filtre, setFiltre] = useState<Filtre>(sortie ?? "tout");
  const shown = all.filter(item => filtre === "tout" || item.kind === filtre).slice(0, limit);
  if (hideEmpty && all.length === 0) return null;
  return <section className="u-tool-results" data-tool-results="" aria-label={t("outils.results")}>
    <header className="u-tool-results-head">
      <h2>{title ?? t("outils.results")}</h2>
      <div className="u-choice-row" role="group" aria-label={t("outils.results")}>
        {(["tout", "image", "video", "audio", "mesh"] as const).map(id => <button key={id} type="button" className="u-chip" aria-pressed={filtre === id} data-results-filter={id} onClick={() => setFiltre(id)}>{t(`outils.filter.${id}`)}</button>)}
      </div>
    </header>
    {shown.length === 0 ? <p className="u-small" data-results-empty="">{t("outils.resultsEmpty")}</p> : <div className="u-tool-results-list">
      {shown.map(({ asset, url, kind }) => <article key={asset.id} className="u-tool-result" data-result={asset.id}>
        {kind === "image" ? <img src={url} alt={asset.name} /> : kind === "video" ? <video src={url} controls playsInline muted /> : kind === "audio" ? <audio src={url} controls /> : <a className="u-chip" href={url} download>{t("outils.download")}</a>}
        <p className="u-small u-tool-result-name">{asset.name}</p>
        {(kind === "image" || kind === "video") && <EtEnsuite source={{ kind, url, name: asset.name, path: asset.media || undefined }} defaultOpen />}
      </article>)}
    </div>}
  </section>;
}
