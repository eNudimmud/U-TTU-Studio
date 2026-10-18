"use client";

// « Et ensuite ? » : the next step on an asset or a take, in one tap. Each tool shows its
// estimate on the button (« estimé », never presented as measured), asks one confirmation
// of the reserve, then runs on the visitor's Comfy account. The result is a new asset:
// the asset it starts from is only read, so a failed run never touches it. No cancel.

import { useEffect, useId, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { protocole } from "@/lib/fiabilite";
import { SUITE_SORTIE, SUITE_SOURCE, SUITE_TEXTE, type Elargir, type SuiteGeste } from "@/lib/suite/graphs";
import { lastFrame, sourceFile, videoSeconds } from "@/lib/suite/media";
import { suiteQuote } from "@/lib/suite/quote";
import { gesteOuvert, gesteParId, gesteVisible } from "@/lib/workflows/registre";
import { ProtocolStrip } from "./fiabilite-card";
import { useStudio, type FinaliseOutcome, type FinaliseStage } from "./studio-session";

export interface SuiteSource {
  kind: "image" | "video";
  /** What the browser shows (blob, data or site URL). */
  url: string;
  name: string;
  /** Vault path of the validated asset, written as the result's reference. */
  path?: string;
  aspect?: "horizontal" | "vertical";
}

type Outil = SuiteGeste | "suite-3d";

const IMAGE_TOOLS: Outil[] = ["suite-modifier", "suite-finaliser-image", "suite-detourer", "suite-elargir", "suite-3d", "suite-animer", "suite-parler"];
const VIDEO_TOOLS: Outil[] = ["suite-finaliser-video", "suite-fluidifier", "suite-prolonger"];
const MESH = { perso: "prise-volume-perso", objet: "prise-volume-objet" } as const;

export function EtEnsuite({ source, onPrise, initial = null, defaultOpen = false }: {
  source: SuiteSource;
  /** Animer: also offer to open the image in PRISE. */
  onPrise?(): void;
  /** Opens straight on one tool (screenshots, deep links). */
  initial?: Outil | null;
  /** Results show the menu open, visible without opening a detail panel. */
  defaultOpen?: boolean;
}) {
  const { t } = useI18n();
  const { prefs } = useStudio();
  const [open, setOpen] = useState(initial !== null || defaultOpen);
  const [tool, setTool] = useState<Outil | null>(initial);
  const menuId = useId();
  useEffect(() => { setTool(initial); setOpen(initial !== null || defaultOpen); }, [source.url]);
  const tools = (source.kind === "image" ? IMAGE_TOOLS : VIDEO_TOOLS).filter(id => {
    const row = gesteParId(id === "suite-3d" ? MESH.objet : id);
    return row && gesteOuvert(row) && gesteVisible(row, prefs);
  });
  if (!source.url || tools.length === 0) return null;

  return <section className="u-suite" data-et-ensuite={source.kind} aria-label={t("suite.title")}>
    <button type="button" className="u-suite-toggle" aria-expanded={open} aria-controls={menuId} data-suite-toggle="" onClick={() => setOpen(value => !value)}>
      <span>{t("suite.title")}</span><span aria-hidden="true">{open ? "−" : "+"}</span>
    </button>
    {open && <div id={menuId} className="u-suite-menu" role="group" aria-label={t("suite.title")}>
      {tools.map(id => {
        const quote = id === "suite-3d" ? null : suiteQuote(id);
        const mesh = id === "suite-3d" ? gesteParId(MESH.objet) : null;
        const credits = quote?.credits ?? mesh?.credits ?? null;
        return <button key={id} type="button" className="u-suite-item" data-suite-item={id} aria-pressed={tool === id} onClick={() => setTool(current => current === id ? null : id)}>
          <span className="u-suite-name">{t(`suite.tools.${id}.title`)}</span>
          {credits !== null && <span className="u-suite-cost">{t("suite.chip", { credits: formatCredits(credits) })}</span>}
        </button>;
      })}
    </div>}
    {open && tool && <SuitePanel key={`${tool}-${source.url}`} tool={tool} source={source} onPrise={onPrise} onClose={() => setTool(null)} />}
  </section>;
}

function SuitePanel({ tool, source, onPrise, onClose }: { tool: Outil; source: SuiteSource; onPrise?(): void; onClose(): void }) {
  const { t } = useI18n();
  const { connected, creating, runSuite, runMeshGeste, holdClip, balance } = useStudio();
  const [text, setText] = useState("");
  const [audio, setAudio] = useState<File | null>(null);
  const [side, setSide] = useState<Elargir>("cotes");
  const [fluide, setFluide] = useState(false);
  const [mesh, setMesh] = useState<keyof typeof MESH>("objet");
  const [seconds, setSeconds] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [stage, setStage] = useState<{ stage: FinaliseStage; seconds?: number } | null>(null);
  const [outcome, setOutcome] = useState<FinaliseOutcome | null>(null);
  const titleId = useId();
  const busyId = `${titleId}-busy`;
  useEffect(() => {
    if (source.kind !== "video") return;
    let gone = false;
    void videoSeconds(source.url).then(value => { if (!gone) setSeconds(value); });
    return () => { gone = true; };
  }, [source.url, source.kind]);
  useEffect(() => () => { if (outcome?.ok) URL.revokeObjectURL(outcome.url); }, [outcome]);

  const is3d = tool === "suite-3d";
  const meshRow = gesteParId(MESH[mesh]);
  const quote = useMemo(() => is3d
    ? (meshRow && meshRow.credits !== null && meshRow.high !== null ? { credits: meshRow.credits, high: meshRow.high } : null)
    : suiteQuote(tool, { seconds: seconds ?? undefined, fluidifier: fluide }), [is3d, meshRow, tool, seconds, fluide]);
  const texte = is3d ? "aucun" : SUITE_TEXTE[tool];
  const sortie = is3d ? "mesh" : SUITE_SORTIE[tool];
  const busy = stage !== null;
  const missing = (texte === "requis" && !text.trim()) || (tool === "suite-parler" && !audio);
  const lowBalance = Boolean(quote && balance && balance.credits < quote.high);
  const can = connected && confirmed && !missing && !busy && !creating && Boolean(quote) && !lowBalance;
  const why = !connected ? t("videoGeste.needLink")
    : missing ? t(tool === "suite-parler" && !audio ? "suite.needVoice" : "videoGeste.needText")
    : lowBalance && quote ? t("finaliser.needCeiling", { ceiling: formatCredits(quote.high) })
    : !confirmed ? t("videoGeste.needConfirm") : "";
  const states = protocole({
    prepared: !missing,
    checked: connected && !lowBalance,
    quoted: Boolean(quote),
    confirming: confirmed,
    running: busy,
    failed: outcome?.ok === false,
    landed: outcome?.ok === true,
    archived: outcome?.ok === true,
  });

  function reset() { setConfirmed(false); setOutcome(null); }

  async function launch() {
    if (!can || !quote) return;
    setOutcome(null);
    setStage({ stage: "envoi" });
    const onStage = (next: FinaliseStage, at?: number) => setStage({ stage: next, seconds: at });
    try {
      let result: FinaliseOutcome;
      if (is3d) {
        const file = await sourceFile(source.url, source.name, "image");
        result = await runMeshGeste({ geste: MESH[mesh], file, confirmed, onStage });
      } else {
        const fromVideo = SUITE_SOURCE[tool] === "video";
        const file = tool === "suite-prolonger" ? await lastFrame(source.url, source.name) : await sourceFile(source.url, source.name, fromVideo ? "video" : "image");
        result = file
          ? await runSuite({ geste: tool, source: file, audio: audio ?? undefined, prompt: text, confirmed, aspect: source.aspect, elargir: side, fluidifier: fluide, seconds: seconds ?? undefined, from: source.path, onStage })
          : { ok: false, message: t("suite.noFrame") };
      }
      setOutcome(result);
    } catch (error) {
      setOutcome({ ok: false, message: error instanceof Error && error.message ? error.message : t("create.failed") });
    } finally {
      setStage(null);
      setConfirmed(false);
    }
  }

  return <section className="u-suite-panel" data-suite-panel={tool} aria-labelledby={titleId}>
    <header className="u-suite-head">
      <h3 id={titleId}>{t(`suite.tools.${tool}.title`)}</h3>
      <button type="button" className="u-suite-close" aria-label={t("finaliser.close")} disabled={busy} aria-describedby={busy ? busyId : undefined} onClick={onClose}>×</button>
    </header>
    <p className="u-small">{t(`suite.tools.${tool}.phrase`)}</p>
    <ProtocolStrip states={states} />
    {tool === "suite-elargir" && <div className="u-choice-row" role="group" aria-label={t("suite.side")}>
      {(["cotes", "haut-bas", "tout"] as const).map(id => <button key={id} type="button" className="u-chip" aria-pressed={side === id} data-suite-side={id} disabled={busy} aria-describedby={busy ? busyId : undefined} onClick={() => { setSide(id); reset(); }}>{t(`suite.sides.${id}`)}</button>)}
    </div>}
    {is3d && <div className="u-choice-row" role="group" aria-label={t("suite.tools.suite-3d.title")}>
      {(["objet", "perso"] as const).map(id => <button key={id} type="button" className="u-chip" aria-pressed={mesh === id} data-suite-mesh={id} disabled={busy} aria-describedby={busy ? busyId : undefined} onClick={() => { setMesh(id); reset(); }}>{t(`suite.mesh.${id}`)}</button>)}
    </div>}
    {tool === "suite-finaliser-video" && <button type="button" role="checkbox" className="u-final-confirm" aria-checked={fluide} data-suite-fluide="" disabled={busy} aria-describedby={busy ? busyId : undefined} onClick={() => { setFluide(value => !value); reset(); }}>
      <span className="u-final-box" aria-hidden="true">{fluide ? "✓" : ""}</span>
      <span>{t("suite.fluide")}</span>
    </button>}
    {tool === "suite-parler" && <label className="u-field u-video-file">
      <span className="u-label">{t("suite.voice")}</span>
      <span className="u-chip u-file-chip u-suite-file" data-suite-voice="">
        <span>{audio ? audio.name : t("suite.voicePick")}</span>
        <input type="file" accept="audio/*" disabled={busy} aria-describedby={busy ? busyId : undefined} onChange={event => { setAudio(event.target.files?.[0] ?? null); reset(); }} />
      </span>
    </label>}
    {texte !== "aucun" && <label className="u-field">
      <span className="u-label">{t(`suite.tools.${tool}.text`)}{texte === "facultatif" ? ` ${t("suite.optional")}` : ""}</span>
      <textarea rows={2} value={text} maxLength={600} disabled={busy} aria-describedby={busy ? busyId : undefined} onChange={event => { setText(event.target.value); reset(); }} />
    </label>}
    {quote && <div className="u-final-quote" data-suite-quote="estime">
      <p className="u-cost">{t("suite.quote", { credits: formatCredits(quote.credits), ceiling: formatCredits(quote.high) })}</p>
      <p className="u-small">{t("suite.safe")}</p>
    </div>}
    <button type="button" role="checkbox" className="u-final-confirm" aria-checked={confirmed} data-suite-confirm="" disabled={busy} aria-describedby={busy ? busyId : undefined} onClick={() => setConfirmed(value => !value)}>
      <span className="u-final-box" aria-hidden="true">{confirmed ? "✓" : ""}</span>
      <span>{t("videoGeste.confirm", { ceiling: formatCredits(quote?.high ?? 0) })}</span>
    </button>
    <button type="button" className="u-suite-go" data-suite-go="" disabled={!can} aria-describedby={busy ? busyId : why ? `${titleId}-why` : undefined} onClick={() => void launch()}>
      {t("suite.go", { credits: formatCredits(quote?.credits ?? 0) })}
    </button>
    {why && !busy && <p className="u-why" id={`${titleId}-why`}>{why}</p>}
    {tool === "suite-animer" && onPrise && <button type="button" className="u-secondary u-suite-prise" data-suite-prise="" disabled={busy} aria-describedby={busy ? busyId : undefined} onClick={onPrise}>{t("suite.toPrise")}</button>}
    {stage && <p className="u-small" id={busyId} aria-live="polite">{t(`finaliser.${stage.stage}`, { seconds: String(stage.seconds ?? 0) })} {t("finaliser.keepOpen")}</p>}
    {outcome && (outcome.ok
      ? <div className="u-suite-done" data-suite-done="">
        {sortie === "image" ? <img src={outcome.url} alt="" /> : sortie === "video" ? <video src={outcome.url} controls playsInline /> : <a href={outcome.url} download>{t("previs.downloadModel")}</a>}
        <p className="u-small">{t("suite.done")} {outcome.cost === null ? t("finaliser.costUnknown") : t("finaliser.cost", { credits: formatCredits(outcome.cost) })}</p>
        {sortie === "video" && <button type="button" className="u-chip" onClick={() => { holdClip({ source: outcome.path, label: t(`suite.tools.${tool}.title`), kind: "video" }); window.location.hash = "montage"; }}>{t("assets.toMontage")}</button>}
      </div>
      : <p className="u-why" role="alert" data-suite-fail="">{outcome.message} {t("suite.intact")}</p>)}
  </section>;
}
