"use client";

// Refonte FILM · PR 4 — the examples of an empty plan (DESIGN §6, maquettes 01 and 09). One card per
// example: IMAGE or VIDÉO badge, the real before → after, « ≈ X crédits estimés », one button.
// One card per view: the next one peeks, its button only shows once it is swiped in.

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { mediaApres, type Exemple } from "@/lib/film/exemples";
import { assetPath } from "@/lib/site";

export function FilmExemples({ exemples, cout, busy, onRefaire }: { exemples: readonly Exemple[]; cout(exemple: Exemple): number | null; busy: string | null; onRefaire(exemple: Exemple): void }) {
  const { t } = useI18n();
  const list = useRef<HTMLUListElement>(null);
  const [vus, setVus] = useState<Set<string>>(() => new Set(exemples[0] ? [exemples[0].id] : []));
  useEffect(() => {
    const root = list.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const seen = new IntersectionObserver(entries => setVus(current => {
      const next = new Set(current);
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.filmExemple ?? "";
        if (entry.intersectionRatio >= 0.6) next.add(id); else next.delete(id);
      }
      return next;
    }), { root, threshold: [0, 0.6, 1] });
    root.querySelectorAll("[data-film-exemple]").forEach(node => seen.observe(node));
    return () => seen.disconnect();
  }, [exemples]);

  return <section className="u-film-exemples" aria-labelledby="u-film-ex-title" data-film-exemples="">
    <h2 id="u-film-ex-title" className="u-film-eyebrow">{t("film2.exemples.titre")}</h2>
    <ul ref={list} className="u-film-ex-list" tabIndex={0} aria-label={t("film2.exemples.liste", { n: String(exemples.length) })}>
      {exemples.map(exemple => {
        const credits = cout(exemple);
        const refs = exemple.avant.filter(item => item.kind !== "texte").length;
        const texte = exemple.avant.find(item => item.kind === "texte");
        const shown = vus.has(exemple.id);
        return <li key={exemple.id} className="u-film-ex" data-film-exemple={exemple.id} data-vu={shown ? "" : undefined}>
          <div className="u-film-ex-media">
            <div className="u-film-ex-avant" data-film-avant="">
              {exemple.avant.map((item, index) => item.kind === "texte"
                ? <p key={index} className="u-film-ex-texte">« {t(item.texte)} »</p>
                : <img key={index} src={assetPath(item.thumb)} alt={item.nom} width={80} height={80} loading="lazy" decoding="async" />)}
            </div>
            <span className="u-film-ex-fleche" aria-hidden="true">→</span>
            <figure className="u-film-ex-apres" data-film-apres={mediaApres(exemple)}>
              {"video" in exemple.apres
                ? <video src={assetPath(exemple.apres.video)} poster={assetPath(exemple.apres.poster)} preload="none" controls muted playsInline loop aria-label={t("film2.exemples.resultat")} />
                : <img src={assetPath(exemple.apres.image)} alt={t("film2.exemples.resultat")} loading="lazy" decoding="async" />}
              <figcaption>{t("film2.exemples.reel")}</figcaption>
              <span className="u-film-ex-badge" data-film-badge={exemple.type}>{exemple.type === "video" ? t("film2.exemples.video", { s: String(exemple.secondes ?? 5) }) : t("film2.exemples.image")}</span>

            </figure>
          </div>
          <div className="u-film-ex-corps">
            <strong>{t(exemple.titre)}</strong>
            <small>
              {exemple.type === "video" ? t("film2.exemples.recetteVideo", { n: String(refs) }) : texte ? t("film2.exemples.recetteTexte") : t("film2.exemples.recettePhoto")}
              {" · "}<span id={`u-film-ex-cout-${exemple.id}`} data-film-ex-cout="">{credits === null ? t("film2.exemples.sansPrix") : t("film2.credits", { n: formatCredits(credits) })}</span>
            </small>
            <button type="button" className="u-film-refaire" data-film-refaire={exemple.id} disabled={busy !== null || credits === null} tabIndex={shown ? 0 : -1} aria-describedby={`u-film-ex-cout-${exemple.id}`} aria-busy={busy === exemple.id || undefined} onClick={() => onRefaire(exemple)}>
              {busy === exemple.id ? t("film2.exemples.prepare") : t("film2.exemples.refaire")}
            </button>
          </div>
        </li>;
      })}
    </ul>
    <p className="u-film-note">{t("film2.exemples.note")}</p>
  </section>;
}
