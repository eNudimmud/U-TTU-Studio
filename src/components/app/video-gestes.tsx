"use client";

// Gestes vidéo de PRISE : raccord, caméra, élargir, effacer. Chaque geste montre
// son devis estimé (jamais présenté comme mesuré), demande une confirmation du
// maximum, puis part sur le compte de rendu. Le rendu va au bout, sans annulation.

import { useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { VIDEO_GESTE_TEXT, VIDEO_GESTES, type VideoGesteId } from "@/lib/render/video-gestes";
import { casesVisibles, gesteOuvert, gesteParId, gesteVisible } from "@/lib/workflows/registre";
import { useStudio, type FinaliseOutcome, type FinaliseStage } from "./studio-session";

export function VideoGestes() {
  const { t } = useI18n();
  const { prefs, connected, creating, runVideoGeste } = useStudio();
  const rows = VIDEO_GESTES.flatMap(id => {
    const row = gesteParId(id);
    return row && gesteOuvert(row) && gesteVisible(row, prefs) ? [row] : [];
  });
  const [picked, setPicked] = useState<VideoGesteId>(VIDEO_GESTES[0]);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [text, setText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [stage, setStage] = useState<{ stage: FinaliseStage; seconds?: number } | null>(null);
  const [outcome, setOutcome] = useState<FinaliseOutcome | null>(null);
  const row = rows.find(item => item.id === picked) ?? rows[0];
  if (!row || row.credits === null || row.high === null) return null;
  const geste = row.id as VideoGesteId;
  const cases = casesVisibles(row);
  const needText = VIDEO_GESTE_TEXT[geste];
  const missing = cases.some(item => !files[item.id]) || (needText && !text.trim());
  const busy = stage !== null;
  const can = connected && confirmed && !missing && !busy && !creating;
  const why = !connected ? t("videoGeste.needLink") : missing ? t("videoGeste.needFiles") : !confirmed ? t("videoGeste.needConfirm") : "";

  function choose(id: VideoGesteId) {
    setPicked(id);
    setFiles({});
    setConfirmed(false);
    setOutcome(null);
  }

  async function launch() {
    if (!can) return;
    setOutcome(null);
    setStage({ stage: "envoi" });
    const result = await runVideoGeste({ geste, files, prompt: text, confirmed, onStage: (next, seconds) => setStage({ stage: next, seconds }) });
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
    {cases.map(item => <label key={item.id} className="u-field u-video-file">
      <span className="u-label">{t(`videoGeste.slot.${item.role}`)}</span>
      <input type="file" accept={item.media === "video" ? "video/*" : "image/*"} disabled={busy} onChange={event => {
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
      <textarea rows={2} value={text} maxLength={600} disabled={busy} onChange={event => setText(event.target.value)} />
    </label>
    <div className="u-final-quote" data-video-quote="estime">
      <p className="u-cost">{t("videoGeste.quote", { credits: formatCredits(row.credits), ceiling: formatCredits(row.high) })}</p>
      <p className="u-small">{t("videoGeste.estimate")}</p>
    </div>
    <button type="button" role="checkbox" className="u-final-confirm" aria-checked={confirmed} disabled={busy} aria-describedby={busy ? "u-video-busy" : undefined} onClick={() => setConfirmed(current => !current)}>
      <span className="u-final-box" aria-hidden="true">{confirmed ? "✓" : ""}</span>
      <span>{t("videoGeste.confirm", { ceiling: formatCredits(row.high) })}</span>
    </button>
    <button type="button" className="u-secondary" data-video-go="" disabled={!can} aria-describedby={why ? "u-video-why" : busy ? "u-video-busy" : undefined} onClick={() => void launch()}>
      {t("videoGeste.go", { credits: formatCredits(row.credits) })}
    </button>
    {why && !busy && <p className="u-why" id="u-video-why">{why}</p>}
    {stage && <p className="u-small" id="u-video-busy" aria-live="polite">{t(`finaliser.${stage.stage}`, { seconds: String(stage.seconds ?? 0) })} {t("finaliser.keepOpen")}</p>}
    {outcome && (outcome.ok
      ? <div className="u-video-done"><video src={outcome.url} controls playsInline /><p className="u-small">{t("videoGeste.done")} {outcome.cost === null ? t("finaliser.costUnknown") : t("finaliser.cost", { credits: formatCredits(outcome.cost) })}</p></div>
      : <p className="u-why" role="alert">{outcome.message}</p>)}
  </section>;
}
