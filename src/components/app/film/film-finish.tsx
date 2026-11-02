"use client";

// Finish: sharpen the takes already kept. SeedVR2, or Real-ESRGAN anime when the project look is Anime 2.5D.
// Nothing here redraws a frame, and nothing starts before the quote is confirmed.

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { finishPlan } from "@/lib/film/finish-step";
import { formatCredits } from "@/lib/credits";
import { playSpan, type Edit, type VideoClip } from "@/lib/montage/edit";
import { chooseEdit } from "@/lib/montage/from-takes";
import { useProjectLook } from "@/components/look/use-look";
import { sourceFile } from "@/lib/suite/media";
import { useStudio } from "../studio-session";

export function FilmFinish({ onEdit }: { onEdit(): void }) {
  const { t } = useI18n();
  const { ready, studio, media, loadMontages, runOutil } = useStudio();
  const { doc } = useProjectLook();
  const anime = doc.look?.kind === "anime25d";
  const [edit, setEdit] = useState<Edit | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!ready) return;
    let gone = false;
    void loadMontages().then(saved => {
      if (gone) return;
      const choice = chooseEdit({ saved, sequences: studio.sequences, shots: studio.shots, takes: studio.takes });
      setEdit(choice.edit);
      setPicked(choice.edit.video[0]?.id ?? null);
    });
    return () => { gone = true; };
  }, [ready, loadMontages, studio.sequences, studio.shots, studio.takes]);

  const clip = edit?.video.find(item => item.id === picked) ?? null;
  const plan = clip ? finishPlan({ media: clip.kind === "image" ? "image" : "video", anime, seconds: playSpan(clip) }) : null;

  async function confirm() {
    if (!clip?.source || !plan) return;
    const url = media[clip.source];
    if (!url) { setNote(t("chrome.finishMissing")); return; }
    const file = await sourceFile(url, `${clip.id}.bin`, clip.kind === "image" ? "image" : "video");
    const result = await runOutil({
      outil: plan.tool,
      images: plan.tool === "ret-finaliser" ? [file] : [],
      video: plan.tool === "vid-finaliser" ? file : undefined,
      prompt: "",
      confirmed: true,
      seconds: playSpan(clip),
      fluidifier: false,
      animeFinish: plan.engine === "realesrgan-anime",
      from: clip.source,
      onStage() {},
    });
    setAsk(false);
    setNote(result.ok ? t("chrome.finishDone") : result.message);
  }

  return <section className="u-finish" data-film-finish="" aria-labelledby="u-title">
    <header className="u-head">
      <h1 id="u-title" tabIndex={-1}>{t("nav.finish")}</h1>
      <p>{t("chrome.finishLead")}</p>
    </header>
    {!edit || edit.video.length === 0 ? <p className="u-film-note" data-finish-empty="">{t("chrome.finishEmpty")} <button type="button" className="u-link" onClick={onEdit}>{t("nav.edit")}</button></p>
      : <ul className="u-finish-list" role="list">
        {edit.video.map((item, index) => <FinishRow key={item.id} clip={item} index={index} anime={anime} on={item.id === picked} onPick={() => { setPicked(item.id); setAsk(false); setNote(""); }} />)}
      </ul>}
    {plan && clip && <div className="u-finish-act">
      <p data-finish-engine="">{plan.engine === "realesrgan-anime" ? t("chrome.finishEngineAnime") : t("chrome.finishEngineSeed")} · {t("chrome.finishQuote", { n: formatCredits(plan.credits), high: formatCredits(plan.high) })}</p>
      {!ask
        ? <button type="button" className="u-film-gold" data-finish-go="" onClick={() => setAsk(true)}>{t("chrome.finishThis")}</button>
        : <button type="button" className="u-film-gold" data-finish-confirm="" onClick={() => void confirm()}>{t("chrome.finishConfirm")}</button>}
    </div>}
    {note && <p role="status" data-finish-note="">{note}</p>}
  </section>;
}

function FinishRow({ clip, index, anime, on, onPick }: { clip: VideoClip; index: number; anime: boolean; on: boolean; onPick(): void }) {
  const { t } = useI18n();
  const plan = finishPlan({ media: clip.kind === "image" ? "image" : "video", anime, seconds: playSpan(clip) });
  return <li>
    <button type="button" className="u-finish-row" aria-pressed={on} data-finish-take={clip.id} onClick={onPick}>
      <span>{index + 1}</span>
      <strong>{clip.label || t("chrome.finishKept")}</strong>
      <small>{plan.engine === "realesrgan-anime" ? t("chrome.finishEngineAnime") : t("chrome.finishEngineSeed")}</small>
    </button>
  </li>;
}
