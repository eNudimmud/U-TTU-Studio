"use client";

import { useState } from "react";
import { useLocaleSwitch } from "@/components/i18n/provider";
import { bibleCopy, PALETTES } from "@/lib/look/bible-copy";
import { lookAnime, type AnimeLocks } from "@/lib/look/model";
import { storyboardDoor } from "@/app/storyboard/closed";
import { assetPath } from "@/lib/site";
import { Em } from "./project-bar";
import { useProjectLook } from "./use-look";
import { StudioProvider, useStudio } from "@/components/app/studio-session";
import { TopBar } from "@/components/app/top-bar";
import { AssistantPanel } from "@/components/app/assistant-panel";
import { ConnectSheet, CreditSheet } from "@/components/app/studio-frames";
import "@/components/app/app.css";
import "./look.css";

type LockKey = keyof AnimeLocks;

export function BiblePage() {
  return <StudioProvider><BibleChrome><BiblePageInner /></BibleChrome></StudioProvider>;
}

function BiblePageInner() {
  const { locale } = useLocaleSwitch();
  const copy = bibleCopy(locale);
  const { doc, confirm } = useProjectLook();
  const look = doc.look ?? lookAnime("theatrical");
  const applied = Boolean(doc.look);
  const [pending, setPending] = useState<LockKey | null>(null);
  const [timingAsk, setTimingAsk] = useState(false);
  const [applyAsk, setApplyAsk] = useState(false);
  const [notice, setNotice] = useState("");
  const [frameUrl, setFrameUrl] = useState<string | null>(null);

  const palette = PALETTES[look.preset];

  async function save(nextLocks: AnimeLocks, onTwos: boolean) {
    await confirm(lookAnime(look.preset, { ...look, locks: nextLocks, onTwos }));
    setPending(null);
    setTimingAsk(false);
  }

  async function applyLook() {
    await confirm(look);
    setApplyAsk(false);
    setNotice(copy.applied);
  }

  async function replaceFrame(file: File) {
    const url = URL.createObjectURL(file);
    setFrameUrl(current => { if (current) URL.revokeObjectURL(current); return url; });
    const name = file.name.replace(/[^\w.-]+/g, "-").slice(0, 80);
    await confirm(lookAnime("own", { locks: look.locks, onTwos: look.onTwos, styleFrameRef: look.styleFrameRef, ownRefs: [name] }));
    setNotice(copy.replaced);
  }

  return <>
    <div className="look-root" data-look-bible="">
    <main className="look-main look-bible">
      <header className="look-page-head">
        <div className="look-kicker">{copy.kicker}</div>
        <h1><Em text={copy.title} /></h1>
        <p className="look-lede">{copy.lede}</p>
      </header>
      <div className="look-grid">
        <article className="look-card">
          <div className="look-card-pic">
            <img src={frameUrl ?? assetPath("/look/anime/hero-key.webp")} alt="" width={1280} height={720} fetchPriority="high" decoding="async" />
            <span className="look-tag">{copy.concept}</span>
          </div>
          <div className="look-pad">
            <div className="look-row">
              <b>{copy.frame}</b>
              <label className="look-ghost">{copy.replace}
                <input className="look-file" type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) void replaceFrame(file); event.target.value = ""; }} />
              </label>
            </div>
            <div className="look-locks">
              <Lock name={copy.locks.line} value={copy.lockLine} on={look.locks.line} onClick={() => setPending("line")} />
              <Lock name={copy.locks.shading} value={copy.lockShading} on={look.locks.shading} onClick={() => setPending("shading")} />
              <button type="button" className="look-lock" aria-pressed={look.locks.palette} onClick={() => setPending("palette")}>
                <small>{copy.locks.palette}</small>
                <span className="look-swatches">{palette.map(color => <i key={color} style={{ background: color }} />)}</span>
              </button>
              <Lock name={copy.locks.depth} value={copy.lockDepth} on={look.locks.depth} onClick={() => setPending("depth")} />
            </div>
            {pending && <div className="look-ask" role="status">
              <p>{copy.lockConfirm}</p>
              <div className="look-go">
                <button type="button" className="look-primary" onClick={() => void save({ ...look.locks, [pending]: !look.locks[pending] }, look.onTwos)}>{copy.timingSave}</button>
                <button type="button" className="look-ghost" onClick={() => setPending(null)}>{copy.timingCancel}</button>
              </div>
            </div>}
            <div className="look-timing">
              <div><b>{copy.timing}</b><div className="look-note">{copy.timingNote}</div></div>
              <button type="button" className="look-switch-hit" aria-pressed={look.onTwos} aria-label={copy.timing} onClick={() => setTimingAsk(true)}>
                <span className={look.onTwos ? "look-switch is-on" : "look-switch"} />
              </button>
            </div>
            {timingAsk && <div className="look-ask" role="status">
              <p>{copy.lockConfirm}</p>
              <div className="look-go">
                <button type="button" className="look-primary" onClick={() => void save(look.locks, !look.onTwos)}>{copy.timingSave}</button>
                <button type="button" className="look-ghost" onClick={() => setTimingAsk(false)}>{copy.timingCancel}</button>
              </div>
            </div>}
          </div>
        </article>
        <div className="look-side">
          <article className="look-card">
            <div className="look-pad look-row">
              <div><div className="look-kicker">{copy.castKicker}</div><b>{copy.sheet}</b></div>
              {applied && <span className="look-made">{copy.made}</span>}
            </div>
            <div className="look-sheet">
              <img src={assetPath("/look/anime/char-sheet.webp")} alt="" width={1200} height={675} loading="lazy" decoding="async" />
              <span className="look-tag">{copy.concept}</span>
            </div>
            <div className="look-pad">
              <div className="look-row">
                <a className="look-chip look-chip-add" href={assetPath("/studio#personnage")}>{applied ? copy.nextCast : copy.addCharacter}</a>
              </div>
              <p className="look-note" style={{ marginTop: 8 }}>{copy.sheetNote}</p>
            </div>
          </article>
          <article className="look-card">
            <div className="look-pad look-row">
              <div><div className="look-kicker">{copy.placesKicker}</div><b>{copy.places}</b></div>
              {applied && <span className="look-made">{copy.made}</span>}
            </div>
            <div className="look-bgs">
              <div className="look-card-pic"><img src={assetPath("/look/anime/bg-city-dawn.webp")} alt="" width={640} height={360} loading="lazy" decoding="async" /><span className="look-tag">{copy.concept}</span></div>
              <div className="look-card-pic"><img src={assetPath("/look/anime/bg-workshop-night.webp")} alt="" width={640} height={360} loading="lazy" decoding="async" /><span className="look-tag">{copy.concept}</span></div>
            </div>
            {applied && <div className="look-pad"><a className="look-chip look-chip-add" href={assetPath("/studio#decor")}>{copy.nextDecor}</a></div>}
          </article>
        </div>
      </div>
      <div className="look-go" style={{ marginTop: 22 }}>
        {applied
          ? <p className="look-status" role="status" data-look-applied="">{copy.applied}</p>
          : <button type="button" className="look-primary" onClick={() => setApplyAsk(true)}>{copy.apply}</button>}
        <a className="look-secondary" href={assetPath(storyboardDoor("/storyboard?storyboard=u11"))}>{copy.storyboard}</a>
      </div>
      {!applied && <p className="look-note">{copy.applyNote}</p>}
      {notice && !applied && <p className="look-status" role="status">{notice}</p>}
      {notice && applied && notice !== copy.applied && <p className="look-status" role="status">{notice}</p>}
      <p className="look-caption">{copy.caption}</p>
      {applyAsk && <div className="look-modal" role="dialog" aria-modal="true" aria-labelledby="look-quote-title">
        <div className="look-modal-card">
          <h2 id="look-quote-title">{copy.confirmTitle}</h2>
          <p>{copy.confirmBody}</p>
          <div className="look-go">
            <button type="button" className="look-primary" onClick={() => void applyLook()}>{copy.confirmYes}</button>
            <button type="button" className="look-ghost" onClick={() => setApplyAsk(false)}>{copy.confirmNo}</button>
          </div>
        </div>
      </div>}
    </main>
    </div>
  </>;
}

function BibleChrome({ children }: { children: React.ReactNode }) {
  const { sheet } = useStudio();
  return <div className="u-app" data-studio="look">
    <TopBar place="look" />
    {children}
    <AssistantPanel />
    {sheet === "credits" && <CreditSheet />}
    {sheet === "connect" && <ConnectSheet />}
  </div>;
}

function Lock({ name, value, on, onClick }: { name: string; value: string; on: boolean; onClick(): void }) {
  return <button type="button" className="look-lock" aria-pressed={on} onClick={onClick}><small>{name}</small><b>{value}</b></button>;
}
