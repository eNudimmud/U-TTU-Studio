"use client";

import { useState } from "react";
import { useLocaleSwitch } from "@/components/i18n/provider";
import { bibleCopy, PALETTES } from "@/lib/look/bible-copy";
import { lookCopy } from "@/lib/look/copy";
import { lookAnime, type AnimeLocks } from "@/lib/look/model";
import { devisPreparation, libelleEstime } from "@/lib/look/quote";
import { assetPath } from "@/lib/site";
import { Em, ProjectBar } from "./project-bar";
import { useProjectLook } from "./use-look";
import "./look.css";

type LockKey = keyof AnimeLocks;

export function BiblePage() {
  const { locale } = useLocaleSwitch();
  const copy = bibleCopy(locale);
  const bar = lookCopy(locale);
  const { name, doc, confirm } = useProjectLook();
  const look = doc.look ?? lookAnime("theatrical");
  const [pending, setPending] = useState<LockKey | null>(null);
  const [timingAsk, setTimingAsk] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const palette = PALETTES[look.preset];
  const price = devisPreparation(1, 2);
  const label = libelleEstime(locale, price.credits);

  async function save(nextLocks: AnimeLocks, onTwos: boolean) {
    await confirm(lookAnime(look.preset, { ...look, locks: nextLocks, onTwos }));
    setPending(null);
    setTimingAsk(false);
  }

  return <div className="look-root" data-look-bible="">
    <ProjectBar copy={bar} name={name} current="look" />
    <main className="look-main look-bible">
      <header className="look-page-head">
        <div className="look-kicker">{copy.kicker}</div>
        <h1><Em text={copy.title} /></h1>
        <p className="look-lede">{copy.lede}</p>
      </header>
      <div className="look-grid">
        <article className="look-card">
          <div className="look-card-pic">
            <img src={assetPath("/look/anime/hero-key.webp")} alt="" width={1280} height={720} fetchPriority="high" decoding="async" />
            <span className="look-tag">{copy.concept}</span>
          </div>
          <div className="look-pad">
            <div className="look-row">
              <b>{copy.frame}</b>
              <label className="look-ghost">{copy.replace}
                <input className="look-file" type="file" accept="image/*" onChange={event => { if (event.target.files?.[0]) setQuoteOpen(true); }} />
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
              <span className="look-made">{copy.made}</span>
            </div>
            <div className="look-sheet">
              <img src={assetPath("/look/anime/char-sheet.webp")} alt="" width={1200} height={675} loading="lazy" decoding="async" />
              <span className="look-tag">{copy.concept}</span>
            </div>
            <div className="look-pad">
              <div className="look-row">
                <a className="look-chip look-chip-add" href={assetPath("/studio#personnage")}>{copy.addCharacter}</a>
              </div>
              <p className="look-note" style={{ marginTop: 8 }}>{copy.sheetNote}</p>
            </div>
          </article>
          <article className="look-card">
            <div className="look-pad look-row">
              <div><div className="look-kicker">{copy.placesKicker}</div><b>{copy.places}</b></div>
              <span className="look-made">{copy.made}</span>
            </div>
            <div className="look-bgs">
              <div className="look-card-pic"><img src={assetPath("/look/anime/bg-city-dawn.webp")} alt="" width={640} height={360} loading="lazy" decoding="async" /><span className="look-tag">{copy.concept}</span></div>
              <div className="look-card-pic"><img src={assetPath("/look/anime/bg-workshop-night.webp")} alt="" width={640} height={360} loading="lazy" decoding="async" /><span className="look-tag">{copy.concept}</span></div>
            </div>
          </article>
        </div>
      </div>
      <div className="look-go" style={{ marginTop: 22 }}>
        <button type="button" className="look-primary" onClick={() => setQuoteOpen(true)}>{copy.make} <span className="cost">· {label}</span></button>
        <a className="look-secondary" href={assetPath("/storyboard?storyboard=u11")}>{copy.storyboard}</a>
      </div>
      <p className="look-note">1 + 1 + 2 · {label}. {copy.note}</p>
      {prepared && <p className="look-status" role="status">{copy.prepared}</p>}
      <p className="look-caption">{copy.caption}</p>
      {quoteOpen && <div className="look-modal" role="dialog" aria-modal="true" aria-labelledby="look-quote-title">
        <div className="look-modal-card">
          <h2 id="look-quote-title">{copy.confirmTitle}</h2>
          <p>{copy.confirmBody}</p>
          <p className="look-cost-line">{label}</p>
          <p className="look-note">1 style frame · ≈ 3 · 1 sheet · ≈ 4 · 2 places · ≈ 3</p>
          <div className="look-go">
            <button type="button" className="look-primary" onClick={() => { setQuoteOpen(false); setPrepared(true); void confirm(look); }}>{copy.confirmYes}</button>
            <button type="button" className="look-ghost" onClick={() => setQuoteOpen(false)}>{copy.confirmNo}</button>
          </div>
        </div>
      </div>}
    </main>
  </div>;
}

function Lock({ name, value, on, onClick }: { name: string; value: string; on: boolean; onClick(): void }) {
  return <button type="button" className="look-lock" aria-pressed={on} onClick={onClick}><small>{name}</small><b>{value}</b></button>;
}
