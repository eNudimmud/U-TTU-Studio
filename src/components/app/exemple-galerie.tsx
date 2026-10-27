"use client";

// Accueil v2 gallery: « Pars d'un exemple ». Full grid on arrival; collapses to a
// horizontal strip once a card (or a conversation) is active. Tapping fills the
// bar and shows the source on the stage — nothing runs from here.

import { useI18n } from "@/components/i18n/provider";
import {
  EXEMPLE_GALERIE, thumbSrcSet, type ExempleCard,
} from "@/lib/creation/exemple-galerie";
import { assetPath } from "@/lib/site";
import { FamilyIcon } from "./studio-nav";
import { openStudioTool } from "./studio-entry";

function ModeGlyph({ mode }: { mode: ExempleCard["mode"] }) {
  return <FamilyIcon fam={mode === "video" ? "video" : "creer"} />;
}

function CardFace({ card, on, eager }: { card: ExempleCard; on: boolean; eager?: boolean }) {
  const { t } = useI18n();
  const thumb = assetPath(card.thumb);
  const full = assetPath(card.img);
  return <>
    <span className="u-ex-thumb">
      <img
        className="u-ex-main"
        src={thumb}
        srcSet={thumbSrcSet(thumb, full)}
        sizes="(max-width: 600px) 45vw, (max-width: 900px) 30vw, 220px"
        alt=""
        width={640}
        height={400}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
      />
      <span className="u-ex-tag" aria-hidden="true"><ModeGlyph mode={card.mode} />{card.eng}</span>
      {card.todo && <span className="u-ex-todo">{t("barre.galerie.todo")}</span>}
      {card.dur && <span className="u-ex-dur" aria-hidden="true">▶ {card.dur}</span>}
      {card.before && <span className="u-ex-before"><img src={assetPath(card.before.thumb)} alt="" width={64} height={64} loading="lazy" decoding="async" /><span>{t("barre.galerie.before")}</span></span>}
      {!card.before && card.refs.length > 0 && <span className="u-ex-refs" aria-hidden="true">{card.refs.map(r => <img key={r.demoId} src={assetPath(r.thumb)} alt="" width={40} height={40} loading="lazy" decoding="async" />)}</span>}
      <span className="u-ex-inbar">{t("barre.galerie.inBar")}</span>
    </span>
    <span className="u-ex-body">
      <span className="u-ex-t">{t(card.titleKey)}</span>
      <span className="u-ex-act">{on ? t("barre.galerie.active") : t("barre.galerie.do")}</span>
    </span>
  </>;
}

/** Full grid under the empty bar. */
export function ExempleGalerieGrid({ activeId, onPick }: {
  activeId: string | null;
  onPick(card: ExempleCard): void;
}) {
  const { t } = useI18n();
  return <section className="u-ex-galerie" aria-labelledby="u-ex-h" data-ex-galerie="">
    <div className="u-ex-head">
      <div>
        <h2 id="u-ex-h">{t("barre.galerie.title")}</h2>
        <p>{t("barre.galerie.lead")}</p>
      </div>
    </div>
    <ul className="u-ex-grid" role="list">
      {EXEMPLE_GALERIE.map((card, i) => <li key={card.id}>
        <button
          type="button"
          className="u-ex-card"
          data-ex-card={card.id}
          data-ex-on={activeId === card.id ? "" : undefined}
          aria-pressed={activeId === card.id}
          aria-label={t("barre.galerie.aria", { title: t(card.titleKey) })}
          onClick={() => onPick(card)}
        >
          <CardFace card={card} on={activeId === card.id} eager={i === 0} />
        </button>
      </li>)}
    </ul>
    <div className="u-ex-foot">
      <a className="u-secondary u-ex-all" href="#outils/tous" data-barre-all-link="" onClick={event => { event.preventDefault(); openStudioTool("tous"); }}>{t("barre.all")}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></a>
      <span className="u-ex-pby"><img src={assetPath("/exemples/comfy-logomark-yellow.svg")} alt="" width={16} height={16} />{t("barre.galerie.powered")}</span>
    </div>
  </section>;
}

/** Compact strip once a conversation or an example is active. */
export function ExempleGalerieStrip({ activeId, onPick }: {
  activeId: string | null;
  onPick(card: ExempleCard): void;
}) {
  const { t } = useI18n();
  return <section className="u-ex-strip-wrap" aria-labelledby="u-ex-strip-h" data-ex-strip="">
    <div className="u-ex-strip-head">
      <h2 id="u-ex-strip-h">{t("barre.galerie.strip")}</h2>
      <span className="u-ex-strip-n">{t("barre.galerie.stripN", { n: String(EXEMPLE_GALERIE.length) })}</span>
    </div>
    <ul className="u-ex-strip" role="list">
      {EXEMPLE_GALERIE.map(card => <li key={card.id}>
        <button
          type="button"
          className="u-ex-mini"
          data-ex-mini={card.id}
          data-ex-on={activeId === card.id ? "" : undefined}
          aria-pressed={activeId === card.id}
          aria-label={t("barre.galerie.aria", { title: t(card.titleKey) })}
          onClick={() => onPick(card)}
        >
          <img src={assetPath(card.thumb)} alt="" width={160} height={100} loading="lazy" decoding="async" />
          <span className="u-ex-tag" aria-hidden="true"><ModeGlyph mode={card.mode} />{card.eng}</span>
          {card.dur && <span className="u-ex-dur">▶ {card.dur}</span>}
          <span className="u-ex-mini-t">{t(card.titleKey)}</span>
        </button>
      </li>)}
    </ul>
  </section>;
}
