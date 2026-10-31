"use client";

// Refonte FILM · PR 7 — « Réglages du plan » (maquette 07). Everything is already chosen; each option
// says its effect and its price. No engine name here: it only appears in « Ce qui sera envoyé ».

import { useEffect, useRef } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { CAMERAS, DUREES, PAROLES, RENDUS, reglagesVersTake, type ReglagesFilm } from "@/lib/film/reglages";
import type { TakeSettings } from "@/lib/render/take-graph";

export function FilmReglages({ value, onChange, prix, onClose }: {
  value: ReglagesFilm;
  onChange(next: ReglagesFilm): void;
  prix(settings: TakeSettings): number | null;
  onClose(): void;
}) {
  const { t } = useI18n();
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => { requestAnimationFrame(() => sheet.current?.querySelector<HTMLElement>("h2")?.focus()); }, []);
  const set = (patch: Partial<ReglagesFilm>) => onChange({ ...value, ...patch });
  const cost = (patch: Partial<ReglagesFilm>) => prix(reglagesVersTake({ ...value, ...patch }));
  const credits = (n: number | null) => n === null ? t("film2.reglages.sansPrix") : t("film2.credits", { n: formatCredits(n) });

  const option = (group: string, key: string, on: boolean, label: string, sub: string, pick: () => void, disabled = false) =>
    <button key={key} type="button" className="u-film-opt" aria-pressed={on} data-film-reglage={`${group}-${key}`} onClick={pick} disabled={disabled} aria-describedby={`u-film-opt-${group}-${key}`}>
      <strong>{label}</strong>
      <small id={`u-film-opt-${group}-${key}`}>{sub}</small>
    </button>;

  return <div className="u-film-sheet-back" onClick={onClose}>
    <div ref={sheet} className="u-film-sheet u-film-reglages" role="dialog" aria-modal="true" aria-labelledby="u-film-reglages-title" data-film-reglages="" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") onClose(); }}>
      <h2 id="u-film-reglages-title" tabIndex={-1}>{t("film2.reglages.titre")}</h2>
      <p className="u-film-lead">{t("film2.reglages.lead")}</p>

      <fieldset className="u-film-group"><legend>{t("film2.reglages.duree")}</legend>
        <div className="u-film-opts">{DUREES.map(duree => { const n = cost({ duree }); return option("duree", String(duree), value.duree === duree, t("film2.duree", { s: String(duree) }), credits(n), () => set({ duree }), n === null); })}</div>
      </fieldset>

      <fieldset className="u-film-group"><legend>{t("film2.reglages.format")}</legend>
        <div className="u-film-opts">
          {option("format", "paysage", value.format === "paysage", t("film2.reglages.paysage"), t("film2.reglages.paysageSous"), () => set({ format: "paysage" }))}
          {option("format", "portrait", value.format === "portrait", t("film2.reglages.portrait"), t("film2.reglages.portraitSous"), () => set({ format: "portrait" }))}
        </div>
      </fieldset>

      <fieldset className="u-film-group"><legend>{t("film2.reglages.camera")}</legend>
        <div className="u-film-opts">
          {option("camera", "phrase", value.camera === null, t("film2.reglages.cam.phrase"), t("film2.reglages.cam.phraseSous"), () => set({ camera: null }))}
          {CAMERAS.map(camera => option("camera", camera, value.camera === camera, t(`film2.reglages.cam.${camera}`), t(`film2.reglages.cam.${camera}Sous`), () => set({ camera })))}
        </div>
      </fieldset>

      <fieldset className="u-film-group"><legend>{t("film2.reglages.paroles")}</legend>
        <div className="u-film-opts">{PAROLES.map(paroles => option("paroles", paroles, value.paroles === paroles, t(`film2.reglages.par.${paroles}`), t(`film2.reglages.par.${paroles}Sous`), () => set({ paroles })))}</div>
        {value.paroles !== "aucune" && <label className="u-film-field"><span>{t(value.paroles === "replique" ? "film2.reglages.par.texteReplique" : "film2.reglages.par.texteVoix")}</span>
          <input type="text" maxLength={160} value={value.texte} onChange={event => set({ texte: event.target.value })} data-film-paroles-texte="" />
        </label>}
      </fieldset>

      <fieldset className="u-film-group"><legend>{t("film2.reglages.rendu")}</legend>
        <p className="u-film-note">{t("film2.reglages.renduLead")}</p>
        <div className="u-film-opts u-film-opts-col">{RENDUS.map(rendu => { const n = cost({ rendu }) ?? cost({ rendu, duree: 5 }); return option("rendu", rendu, value.rendu === rendu, t(`film2.reglages.${rendu}`), `${t(`film2.reglages.${rendu}Sous`)} · ${credits(n)}`, () => set({ rendu })); })}</div>
      </fieldset>

      <button type="button" className="u-film-gold" data-film-reglages-ok="" onClick={onClose}><span>{t("film2.reglages.ok")}</span></button>
    </div>
  </div>;
}
