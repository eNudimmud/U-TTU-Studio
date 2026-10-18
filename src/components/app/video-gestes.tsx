"use client";

// Gestes vidéo de PRISE : raccord, caméra, élargir, effacer. Chaque geste montre
// son devis estimé (jamais présenté comme mesuré), demande une confirmation du
// maximum, puis part sur le compte de rendu. Le rendu va au bout, sans annulation.

import { ConnectLink } from "./connect-link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { PREVIS_SECONDS, VIDEO_GESTE_TEXT, VIDEO_GESTES, type VideoGesteId } from "@/lib/render/video-gestes";
import { casesVisibles, gesteOuvert, gesteParId, gesteVisible } from "@/lib/workflows/registre";
import { useStudio, type FinaliseOutcome, type FinaliseStage } from "./studio-session";

import { recordMaquette } from "@/lib/maquette/record";

export interface PrevisClip { file: File; at: number }

export function VideoGestes({ aspect = "horizontal", previs: sent = null, onRecordPrevis, previsLeft = 0, only }: {
  aspect?: "horizontal" | "vertical";
  /** A previs filmed in the maquette above. It lands straight in Caméra maîtrisée. */
  previs?: PrevisClip | null;
  /** Films the maquette along its camera path. Without it, the canvas is filmed as it moves. */
  onRecordPrevis?(): void;
  /** Seconds left while the maquette films, from the panel above. */
  previsLeft?: number;
  /** Only these gestures (PRISE keeps the ones that start from the prévis; the others live in Outils). */
  only?: readonly VideoGesteId[];
}) {
  const { t } = useI18n();
  const { prefs, connected, creating, runVideoGeste, holdClip } = useStudio();
  const rows = VIDEO_GESTES.filter(id => !only || only.includes(id)).flatMap(id => {
    const row = gesteParId(id);
    return row && gesteOuvert(row) && gesteVisible(row, prefs) ? [row] : [];
  });
  const [picked, setPicked] = useState<VideoGesteId>(only?.[0] ?? VIDEO_GESTES[0]);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [text, setText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [stage, setStage] = useState<{ stage: FinaliseStage; seconds?: number } | null>(null);
  const [outcome, setOutcome] = useState<FinaliseOutcome | null>(null);
  const [ownRecording, setRecording] = useState(0);
  const recording = Math.max(ownRecording, previsLeft);
  const [previsUrl, setPrevisUrl] = useState("");
  const [previsNote, setPrevisNote] = useState("");
  const recordingRef = useRef(false);
  useEffect(() => () => { if (previsUrl) URL.revokeObjectURL(previsUrl); }, [previsUrl]);
  useEffect(() => () => { if (outcome?.ok) URL.revokeObjectURL(outcome.url); }, [outcome]);
  useEffect(() => setConfirmed(false), [aspect]);
  const clipRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!sent) return;
    setPicked("prise-previs");
    setConfirmed(false);
    setOutcome(null);
    setFiles(current => ({ ...current, video_1: sent.file }));
    setPrevisUrl(URL.createObjectURL(sent.file));
    setPrevisNote(t("videoGeste.previsReady", { seconds: String(PREVIS_SECONDS) }));
  }, [sent?.at]);
  useEffect(() => {
    // After a recording the clip must be on screen, not the top of the block (mobile 390).
    if (previsUrl) requestAnimationFrame(() => clipRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }, [previsUrl]);
  const row = rows.find(item => item.id === picked) ?? rows[0];
  if (!row || row.credits === null || row.high === null) return null;
  const geste = row.id as VideoGesteId;
  const cases = casesVisibles(row);
  const needText = VIDEO_GESTE_TEXT[geste];
  const missing = cases.some(item => !files[item.id]) || (needText && !text.trim());
  const busy = stage !== null || recording > 0;
  const can = connected && confirmed && !missing && !busy && !creating;
  const why = !connected ? t("videoGeste.needLink") : missing ? t("videoGeste.needFiles") : !confirmed ? t("videoGeste.needConfirm") : "";

  async function previs() {
    if (onRecordPrevis) { onRecordPrevis(); return; }
    if (recordingRef.current) return;
    recordingRef.current = true;
    setPrevisNote("");
    setConfirmed(false);
    try {
      const file = await recordMaquette(PREVIS_SECONDS, setRecording);
      if (!file) { setPrevisNote(t("videoGeste.previsNoCanvas")); return; }
      setFiles(current => ({ ...current, video_1: file }));
      setPrevisUrl(URL.createObjectURL(file));
      setPrevisNote(t("videoGeste.previsReady", { seconds: String(PREVIS_SECONDS) }));
    } catch { setPrevisNote(t("videoGeste.previsNoCanvas")); }
    finally { recordingRef.current = false; setRecording(0); }
  }

  function choose(id: VideoGesteId) {
    setPicked(id);
    setFiles({});
    setPrevisUrl("");
    setPrevisNote("");
    setConfirmed(false);
    setOutcome(null);
  }

  async function launch() {
    if (!can) return;
    setOutcome(null);
    setStage({ stage: "envoi" });
    const result = await runVideoGeste({ geste, files, prompt: text, confirmed, aspect, onStage: (next, seconds) => setStage({ stage: next, seconds }) });
    setStage(null);
    setConfirmed(false);
    setOutcome(result);
  }

  return <section className="u-video-gestes" data-video-gestes="" aria-labelledby="u-video-gestes-title">
    <h2 id="u-video-gestes-title" className="u-label">{t("videoGeste.title")}</h2>
    <p className="u-small">{t("videoGeste.lead")}</p>
    <div className="u-choice-row" role="group" aria-label={t("videoGeste.title")}>
      {rows.map(item => <button key={item.id} type="button" className="u-chip" data-video-geste={item.id} aria-pressed={item.id === row.id} disabled={busy} aria-describedby={busy ? "u-video-busy" : undefined} onClick={() => choose(item.id as VideoGesteId)}>{t(`gestes.${item.clef}.title`)}</button>)}
    </div>
    <p>{t(`gestes.${row.clef}.phrase`)}</p>
    {geste === "prise-previs" && <div className="u-previs" data-previs="">
      <p className="u-small">{t("videoGeste.previsLead", { seconds: String(PREVIS_SECONDS) })}</p>
      <button type="button" className="u-chip" data-previs-record="" disabled={busy} aria-describedby={busy ? "u-video-busy" : undefined} onClick={() => void previs()}>
        {recording > 0 ? t("videoGeste.previsRecording", { seconds: String(recording) }) : t("videoGeste.previsRecord", { seconds: String(PREVIS_SECONDS) })}
      </button>
      {recording > 0 && <p className="u-small" id="u-video-busy" aria-live="polite">{t("videoGeste.previsMove")}</p>}
      {previsNote && <p className="u-small" aria-live="polite">{previsNote}</p>}
      {previsUrl && <video ref={clipRef} className="u-previs-clip" data-previs-clip="" src={previsUrl} muted loop autoPlay playsInline />}
    </div>}
    {cases.filter(item => !(geste === "prise-previs" && item.id === "video_1" && previsUrl)).map(item => <label key={item.id} className="u-field u-video-file">
      <span className="u-label">{t(geste === "prise-previs" ? `videoGeste.slotPrevis.${item.role}` : `videoGeste.slot.${item.role}`)}</span>
      <input type="file" accept={item.media === "video" ? "video/*" : "image/*"} disabled={busy} onChange={event => {
        setConfirmed(false);
        const file = event.target.files?.[0];
        setFiles(current => {
          const next = { ...current };
          if (file) next[item.id] = file; else delete next[item.id];
          return next;
        });
      }} />
    </label>)}
    <label className="u-field">
      <span className="u-label">{t(needText ? `videoGeste.text.${geste}` : "videoGeste.textOptional")}</span>
      <textarea aria-label={t(needText ? `videoGeste.text.${geste}` : "videoGeste.textOptional")} rows={2} value={text} maxLength={600} disabled={busy} onChange={event => { setText(event.target.value); setConfirmed(false); }} />
    </label>
    <div className="u-final-quote" data-video-quote="estime">
      <p className="u-cost">{t("videoGeste.quote", { credits: formatCredits(row.credits), ceiling: formatCredits(row.high) })}</p>
      <p className="u-small">{t("videoGeste.estimate")}</p>
      <p className="u-small">{t("safety.estimate")}</p>
    </div>
    <button type="button" role="checkbox" className="u-final-confirm" aria-checked={confirmed} disabled={busy} aria-describedby={busy ? "u-video-busy" : undefined} onClick={() => setConfirmed(current => !current)}>
      <span className="u-final-box" aria-hidden="true">{confirmed ? "✓" : ""}</span>
      <span>{t("videoGeste.confirm", { ceiling: formatCredits(row.high) })}</span>
    </button>
    <button type="button" className="u-secondary" data-video-go="" disabled={!can} aria-describedby={why ? "u-video-why" : busy ? "u-video-busy" : undefined} onClick={() => void launch()}>
      {t("videoGeste.go", { credits: formatCredits(row.credits) })}
    </button>
    {why && !busy && <p className="u-why" id="u-video-why">{why}</p>}
    {why && !busy && <ConnectLink />}
    {stage && <p className="u-small" id="u-video-busy" aria-live="polite">{t(`finaliser.${stage.stage}`, { seconds: String(stage.seconds ?? 0) })} {t("finaliser.keepOpen")}</p>}
    {outcome && (outcome.ok
      ? <div className="u-video-done"><video src={outcome.url} controls playsInline /><p className="u-small">{t("videoGeste.done")} {outcome.cost === null ? t("finaliser.costUnknown") : t("finaliser.cost", { credits: formatCredits(outcome.cost) })}</p><button type="button" className="u-chip" onClick={() => { holdClip({ source: outcome.path, label: t(`gestes.${row.clef}.title`), kind: "video" }); window.location.hash = "montage"; }}>{t("assets.toMontage")}</button></div>
      : <p className="u-why" role="alert">{outcome.message}</p>)}
  </section>;
}
