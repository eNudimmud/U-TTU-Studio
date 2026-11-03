"use client";

// Refonte FILM · PR 5 — the Qui and Où sheets. CAST and DÉCOR open as libraries over the plan:
// pick a card, or make a new one (photos or a description) that is created inside the same quote.
// F16: a photo already in the gallery (same SHA-256) is offered back instead of a second import.

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { basculerQui, trierPhotos, type ChoixOu, type ChoixQui, type GalerieImage } from "@/lib/film/choix";
import { sha256Hex } from "@/lib/film/envois";
import { REFS_MAX } from "@/lib/film/registre";

export interface CarteChoix { id: string; nom: string; thumb: string; paths: string[] }
type Mode = null | "photos" | "texte";

const hashes = new Map<string, string>();
async function hashOfUrl(url: string): Promise<string | null> {
  const hit = hashes.get(url);
  if (hit) return hit;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const sha = await sha256Hex(await response.blob());
    hashes.set(url, sha);
    return sha;
  } catch {
    return null;
  }
}

export function FilmChoix({ kind, cartes, media, choisis, credits, onDone, onClose, onBibliotheque }: {
  kind: "qui" | "ou";
  cartes: CarteChoix[];
  media: Record<string, string>;
  choisis: (ChoixQui | ChoixOu)[];
  credits: { photos: number; texte: number };
  onDone(choix: (ChoixQui | ChoixOu)[], files: Record<string, File[]>): void;
  onClose(): void;
  onBibliotheque(): void;
}) {
  const { t } = useI18n();
  const qui = kind === "qui";
  const max = qui ? REFS_MAX : 1;
  const [pick, setPick] = useState<(ChoixQui | ChoixOu)[]>(choisis);
  const [mode, setMode] = useState<Mode>(null);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [tri, setTri] = useState<{ doublons: number; dejaLa: { id: string; nom: string } | null }>({ doublons: 0, dejaLa: null });
  const [erreur, setErreur] = useState("");
  const [hashing, setHashing] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const fichiers = useRef<Record<string, File[]>>({});

  useEffect(() => { requestAnimationFrame(() => sheet.current?.querySelector<HTMLElement>("h2")?.focus()); }, []);

  const toggle = (item: ChoixQui | ChoixOu) => {
    if (!qui) { setPick(current => current[0]?.id === item.id && item.id ? [] : [item]); return; }
    setPick(current => basculerQui(current as ChoixQui[], item as ChoixQui));
  };
  const picked = (id: string) => pick.some(item => item.id === id);

  const onFiles = async (list: FileList | null) => {
    const all = Array.from(list ?? []).filter(file => file.type.startsWith("image/"));
    setErreur("");
    if (!all.length) return;
    setHashing(true);
    try {
      const shas = await Promise.all(all.map(file => sha256Hex(file)));
      const galerie: GalerieImage[] = [];
      for (const carte of cartes) for (const path of carte.paths) {
        const url = media[path];
        const sha = url ? await hashOfUrl(url) : null;
        if (sha) galerie.push({ sha256: sha, id: carte.id, nom: carte.nom });
      }
      const sorted = trierPhotos(shas, galerie, qui ? REFS_MAX : 1);
      setFiles(sorted.garder.map(index => all[index]!));
      setTri({ doublons: sorted.doublons, dejaLa: sorted.dejaLa });
    } catch {
      setErreur(t("film2.choix.photoIllisible"));
    } finally {
      setHashing(false);
    }
  };

  const ajouterNouveau = () => {
    const clean = nom.trim().slice(0, 40);
    if (!clean) { setErreur(t("film2.choix.nomVide")); return; }
    if (mode === "photos" && !files.length) { setErreur(t("film2.choix.photoVide")); return; }
    if (mode === "texte" && !description.trim()) { setErreur(t("film2.choix.descriptionVide")); return; }
    const source = mode === "photos" ? (qui ? "photos" : "photo") : "texte";
    const item = { id: null, nom: clean, source, ...(description.trim() ? { description: description.trim().slice(0, 240) } : {}) } as ChoixQui | ChoixOu;
    if (mode === "photos") fichiers.current[clean.toLowerCase()] = files;
    setPick(current => qui ? basculerQui(current as ChoixQui[], item as ChoixQui) : [item]);
    setMode(null); setNom(""); setDescription(""); setFiles([]); setTri({ doublons: 0, dejaLa: null }); setErreur("");
  };
  const utiliserDejaLa = () => {
    const hit = tri.dejaLa;
    const carte = hit ? cartes.find(item => item.id === hit.id) : undefined;
    if (!carte) return;
    if (!picked(carte.id)) toggle({ id: carte.id, nom: carte.nom });
    setMode(null); setFiles([]); setTri({ doublons: 0, dejaLa: null });
  };

  const names = pick.map(item => item.nom);
  const label = names.length === 0 ? t(qui ? "film2.choix.personne" : "film2.choix.lieuPhrase") : names.length === 1 ? t("film2.choix.utiliser", { nom: names[0]! }) : t("film2.choix.utiliserN", { n: String(names.length) });

  return <div className="u-film-sheet-back" onClick={onClose}>
    <div ref={sheet} className="u-film-sheet u-film-choix" role="dialog" aria-modal="true" aria-labelledby="u-film-choix-title" data-film-choix={kind} onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") onClose(); }}>
      <h2 id="u-film-choix-title" tabIndex={-1}>{t(qui ? "film2.choix.quiTitre" : "film2.choix.ouTitre")}</h2>
      <p className="u-film-lead">{t(qui ? "film2.choix.quiLead" : "film2.choix.ouLead")}</p>
      <div className="u-film-cartes" role="group" aria-label={t(qui ? "film2.choix.quiTitre" : "film2.choix.ouTitre")}>
        {cartes.map(carte => <button key={carte.id} type="button" className="u-film-carte" aria-pressed={picked(carte.id)} data-film-carte={carte.id} onClick={() => toggle({ id: carte.id, nom: carte.nom })}>
          {carte.thumb ? <img src={carte.thumb} alt="" width={88} height={88} /> : <span className="u-film-slot-ph" aria-hidden="true">?</span>}
          <span>{carte.nom}{picked(carte.id) ? " ✓" : ""}</span>
        </button>)}
        {pick.filter(item => !item.id).map(item => <button key={`new-${item.nom}`} type="button" className="u-film-carte" aria-pressed="true" data-film-carte-nouveau="" onClick={() => toggle(item)}>
          <span className="u-film-slot-ph" aria-hidden="true">+</span><span>{item.nom} ✓</span>
        </button>)}
      </div>
      {cartes.length === 0 && <p className="u-film-note">{t(qui ? "film2.choix.aucunPersonnage" : "film2.choix.aucunLieu")}</p>}

      <p className="u-film-eyebrow">{t(qui ? "film2.choix.nouveauPersonnage" : "film2.choix.nouveauLieu")}</p>
      {mode === null && <div className="u-film-options">
        <button type="button" className="u-film-option" data-film-nouveau="photos" onClick={() => setMode("photos")} disabled={pick.length >= max && qui} aria-describedby={pick.length >= max && qui ? "u-film-choix-max" : undefined}>
          <strong>{t(qui ? "film2.choix.depuisPhotos" : "film2.choix.depuisPhoto")}</strong>
          <small>{t(qui ? "film2.choix.depuisPhotosSous" : "film2.choix.depuisPhotoSous", { prix: t("film2.credits", { n: formatCredits(credits.photos) }) })}</small>
        </button>
        <button type="button" className="u-film-option" data-film-nouveau="texte" onClick={() => setMode("texte")} disabled={pick.length >= max && qui} aria-describedby={pick.length >= max && qui ? "u-film-choix-max" : undefined}>
          <strong>{t("film2.choix.depuisDescription")}</strong>
          <small>{t(qui ? "film2.choix.depuisDescriptionSous" : "film2.choix.depuisDescriptionLieuSous", { prix: t("film2.credits", { n: formatCredits(credits.texte) }) })}</small>
        </button>
        {!qui && <button type="button" className="u-film-option" data-film-nouveau="3d" onClick={onBibliotheque}>
          <strong>{t("film2.choix.lieuReel")}</strong>
          <small>{t("film2.choix.lieuReelSous")}</small>
        </button>}
        {qui && pick.length >= max && <p id="u-film-choix-max" className="u-film-note">{t("film2.choix.max")}</p>}
      </div>}
      {mode !== null && <div className="u-film-nouveau" data-film-form={mode}>
        <label className="u-film-field"><span>{t("film2.choix.nom")}</span>
          <input type="text" value={nom} maxLength={40} onChange={event => setNom(event.target.value)} placeholder={t(qui ? "film2.choix.nomPh" : "film2.choix.nomLieuPh")} data-film-nom="" />
        </label>
        {mode === "texte" && <label className="u-film-field"><span>{t("film2.choix.description")}</span>
          <textarea rows={2} maxLength={240} value={description} onChange={event => setDescription(event.target.value)} placeholder={t(qui ? "film2.choix.descriptionPh" : "film2.choix.descriptionLieuPh")} data-film-description="" />
        </label>}
        {mode === "photos" && <label className="u-film-field u-film-file"><span>{t(qui ? "film2.choix.photos" : "film2.choix.photo")}</span>
          <input className="sr-only" type="file" accept="image/*" multiple={qui} onChange={event => void onFiles(event.target.files)} data-film-photos="" />
          <span className="u-secondary u-film-pick" aria-hidden="true">{t(qui ? "film2.choix.choisirPhotos" : "film2.choix.choisirPhoto")}</span>
          {hashing ? <small role="status">{t("film2.choix.verification")}</small> : files.length > 0 || tri.dejaLa ? <small role="status">{t("film2.choix.photosPretes", { n: String(files.length) })}{tri.doublons ? ` · ${t("film2.choix.doublons", { n: String(tri.doublons) })}` : ""}</small> : null}
        </label>}
        {tri.dejaLa && <div className="u-film-deja" role="status" data-film-deja="">
          <span>{t("film2.choix.dejaLa", { nom: tri.dejaLa.nom })}</span>
          <button type="button" className="u-secondary" data-film-deja-utiliser="" onClick={utiliserDejaLa}>{t("film2.choix.lUtiliser")}</button>
        </div>}
        {erreur && <p className="u-film-error" role="alert">{erreur}</p>}
        <div className="u-film-sheet-row">
          <button type="button" className="u-secondary" onClick={() => { setMode(null); setErreur(""); setFiles([]); setTri({ doublons: 0, dejaLa: null }); }}>{t("film2.choix.retour")}</button>
          <button type="button" className="u-secondary" data-film-ajouter="" onClick={ajouterNouveau}>{t("film2.choix.ajouter")}</button>
        </div>
      </div>}

      <button type="button" className="u-film-gold" data-film-choix-ok="" onClick={() => onDone(pick, fichiers.current)}><span>{label}</span></button>
      <button type="button" className="u-film-link" onClick={onBibliotheque}>{t(qui ? "film2.choix.toutCast" : "film2.choix.toutDecor")}</button>
    </div>
  </div>;
}
