"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocaleSwitch } from "@/components/i18n/provider";
import { lookCopy } from "@/lib/look/copy";
import { lookAnime, type AnimePreset, type AnimePresetId } from "@/lib/look/model";
import { assetPath } from "@/lib/site";
import { Em, ProjectBar } from "./project-bar";
import { useProjectLook } from "./use-look";
import "./look.css";

const PRESETS: AnimePresetId[] = ["theatrical", "neon", "daylight", "darkfantasy"];
const PRESET_IMAGE: Record<AnimePresetId, string> = {
  theatrical: "/look/anime/style-theatrical.webp",
  neon: "/look/anime/style-neon.webp",
  daylight: "/look/anime/style-daylight.webp",
  darkfantasy: "/look/anime/style-darkfantasy.webp",
};
const STEP_IMAGE = [
  "",
  "/look/anime/char-sheet.webp",
  "/look/anime/bg-city-dawn.webp",
  "/look/anime/shot-2-medium.webp",
  "/look/anime/shot-3-closeup.webp",
];
const REEL = ["/look/anime/shot-1-wide.webp", "/look/anime/shot-2-medium.webp", "/look/anime/shot-3-closeup.webp"];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function LookPage() {
  const { locale } = useLocaleSwitch();
  const copy = lookCopy(locale);
  const router = useRouter();
  const { name, doc, confirm } = useProjectLook();
  const [preset, setPreset] = useState<AnimePreset>("theatrical");
  const [own, setOwn] = useState<{ name: string; url: string }[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!doc.look) return;
    setPreset(doc.look.preset);
  }, [doc.look]);
  const styleSrc = own[0]?.url ?? assetPath(PRESET_IMAGE[preset === "own" || preset === "retro" ? "theatrical" : preset]);
  const shown = useMemo(() => (preset === "own" ? "own" : preset), [preset]);

  function pickFiles(list: FileList | null) {
    const files = [...(list ?? [])].filter(file => file.type.startsWith("image/")).slice(0, 2);
    setOwn(current => {
      for (const item of current) URL.revokeObjectURL(item.url);
      return files.map(file => ({ name: file.name.replace(/[^\w.-]+/g, "-").slice(0, 80), url: URL.createObjectURL(file) }));
    });
    if (files.length) { setPreset("own"); setNotice(""); }
  }

  async function useLook() {
    if (preset === "own" && own.length === 0) { setNotice(copy.ownNeed); return; }
    const next = lookAnime(preset, {
      ownRefs: own.map(item => item.name),
      locks: doc.look?.locks,
      onTwos: doc.look?.onTwos,
      styleFrameRef: doc.look?.styleFrameRef ?? null,
    });
    await confirm(next);
    setNotice(copy.saved);
    router.push("/look/bible");
  }

  return <div className="look-root" data-look-page="">
    <ProjectBar copy={copy} name={name} current="look" />
    <div className="look-hero">
      <div className="look-hero-media">
        <img src={assetPath("/look/anime/hero-key.webp")} alt={copy.heroAlt} width={1280} height={800} fetchPriority="high" decoding="async" />
        <div className="fade" />
      </div>
      <div className="look-hero-in">
        <div className="look-kicker">{copy.kicker}</div>
        <h1><Em text={copy.title} /></h1>
        <p className="look-lede">{copy.lede}</p>
        <div className="look-go">
          <button type="button" className="look-primary" onClick={() => scrollToId("pick")}>{copy.start}</button>
          <button type="button" className="look-secondary" onClick={() => scrollToId("how")}>{copy.how}</button>
        </div>
        <ul className="look-promise">{copy.promises.map(item => <li key={item}>{item}</li>)}</ul>
      </div>
      <p className="look-caption">{copy.caption}</p>
    </div>

    <main className="look-main">
      <section className="look-section" id="pick">
        <div className="look-head">
          <div><div className="look-kicker">{copy.step1Kicker}</div><h2><Em text={copy.step1Title} /></h2></div>
          <p>{copy.step1Lead}</p>
        </div>
        <div className="look-styles">
          {PRESETS.map(id => <button key={id} type="button" className="look-style" aria-pressed={shown === id} onClick={() => { setPreset(id); setNotice(""); }}>
            <div className="pic"><img src={assetPath(PRESET_IMAGE[id])} alt="" width={768} height={1024} loading="lazy" decoding="async" /></div>
            <span className="mark">{copy.selected}</span>
            <span className="txt"><b>{copy.presets[id].title}</b><span className="d">{copy.presets[id].line}</span></span>
          </button>)}
        </div>
        <div className="look-own">
          <label className="look-ghost">
            {copy.own}
            <input className="look-file" type="file" accept="image/*" multiple onChange={event => pickFiles(event.target.files)} />
          </label>
          <span>{copy.ownHint}</span>
        </div>
        <p className="look-caption" style={{ marginTop: 8 }}>{copy.caption}</p>
      </section>

      <section className="look-section" id="how">
        <div className="look-head">
          <div><div className="look-kicker">{copy.step2Kicker}</div><h2><Em text={copy.step2Title} /></h2></div>
          <p>{copy.step2Lead}</p>
        </div>
        <div className="look-guide">
          <img src={assetPath("/exemples/uttu-portrait-640.webp")} alt={copy.guideAlt} width={640} height={800} loading="lazy" decoding="async" />
          <div><div className="who">{copy.guideKicker}</div><p>{copy.guideBody}</p></div>
        </div>
        <div className="look-steps">
          {copy.steps.map((step, index) => <article key={step.title} className="look-step">
            <div className="pic">
              <img src={index === 0 ? styleSrc : assetPath(STEP_IMAGE[index]!)} alt="" width={640} height={480} loading="lazy" decoding="async" />
            </div>
            <div className="bd"><b>{step.title}</b><p>{step.body}</p><span className="cost">{step.cost}</span></div>
          </article>)}
        </div>
        <details className="look-models">
          <summary>› {copy.modelsSummary}</summary>
          <table>
            <thead><tr>{copy.modelsHead.map((head, index) => <th key={head} className={index === 2 ? "hide-sm" : undefined}>{head}</th>)}</tr></thead>
            <tbody>
              {copy.models.map(row => <tr key={row[0]}><td>{row[0]}</td><td className="m">{row[1]}</td><td className="hide-sm">{row[2]}</td></tr>)}
            </tbody>
          </table>
        </details>
      </section>

      <section className="look-section" aria-label={copy.reelKicker}>
        <div className="look-head">
          <div><div className="look-kicker">{copy.reelKicker}</div><h2><Em text={copy.reelTitle} /></h2></div>
          <p>{copy.reelLead}</p>
        </div>
        <div className="look-reel">
          {copy.shots.map((shot, index) => <figure key={shot.title} className="look-cut">
            <img src={assetPath(REEL[index]!)} alt="" width={1280} height={720} loading="lazy" decoding="async" />
            <figcaption className="cap"><span className="n">{index + 1} · 5 s</span>{shot.title} <span className="look-move">{shot.move}</span></figcaption>
          </figure>)}
        </div>
        <p className="look-caption" style={{ marginTop: 8 }}>{copy.caption}</p>
      </section>

      <section className="look-final">
        <img src={assetPath("/look/anime/bg-workshop-night.webp")} alt="" width={1280} height={720} loading="lazy" decoding="async" />
        <div className="in">
          <div className="look-kicker">{copy.ready}</div>
          <h2><Em text={copy.finalTitle} /></h2>
          <p className="look-note">{copy.finalNote}</p>
          <div className="look-go">
            <button type="button" className="look-primary" onClick={() => void useLook()}>{copy.use}</button>
            <a className="look-secondary" href={assetPath("/storyboard?storyboard=u11")}>{copy.keep}</a>
          </div>
          {notice && <p className="look-status" role="status">{notice}</p>}
        </div>
      </section>
    </main>
  </div>;
}
