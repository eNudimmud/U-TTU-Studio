"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { filterAssets, previewAssets, type AssetFilter, type AssetKind, type AssetRecord } from "@/lib/creation/assets";
import { gesteParId } from "@/lib/workflows/registre";
import { assetPath } from "@/lib/site";
import { EtEnsuite } from "./et-ensuite";
import { Check, KindMark, Refresh, Search, Share, type MarkKind } from "./glyphs";

const FILTERS: { id: AssetFilter; key: string }[] = [
  { id: "tout", key: "creations.type.tout" },
  { id: "personnage", key: "creations.type.personnages" },
  { id: "decor", key: "creations.type.lieux" },
  { id: "plan", key: "creations.type.prises" },
  { id: "son", key: "creations.type.sons" },
  { id: "importe", key: "assets.importes" },
];

function markOf(kind: AssetKind): MarkKind {
  if (kind === "personnage") return "personnage";
  if (kind === "decor") return "lieu";
  if (kind === "plan") return "prise";
  if (kind === "son") return "son";
  return "note";
}

/** Mes créations type tabs: what each tab keeps. */
export type LibraryType = "tout" | "images" | "videos" | "3d" | "sons" | "personnages" | "lieux" | "prises";

export function AssetGallery({ assets, media, defaultFilter = "tout", onRefresh, onImport, onRename, onDuplicate, onDelete, onCopy, onUseRef, onPrise, onMontage, onEmptyDecor, projects = [], type, dense = false, sort = "recent", title }: {
  assets: AssetRecord[];
  media: Record<string, string>;
  defaultFilter?: AssetFilter;
  onRefresh?(): void;
  onImport?(files: File[]): void;
  onRename?(asset: AssetRecord, name: string): void;
  onDuplicate?(asset: AssetRecord): void;
  onDelete?(asset: AssetRecord): void;
  onCopy?(asset: AssetRecord, project: string): void;
  onUseRef?(asset: AssetRecord): void;
  onPrise?(asset: AssetRecord): void;
  onMontage?(asset: AssetRecord): void;
  onEmptyDecor?(): void;
  projects?: { slug: string; name: string }[];
  /** Set by Mes créations: its type tabs replace the kind filter row. */
  type?: LibraryType;
  dense?: boolean;
  sort?: "recent" | "nom";
  title?: string;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<AssetFilter>(defaultFilter);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const [preview, setPreview] = useState<AssetRecord[]>([]);
  const [suiteInitial, setSuiteInitial] = useState<Parameters<typeof EtEnsuite>[0]["initial"]>(null);
  const hold = useRef<number | null>(null);
  const held = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const asked = params.get("galerie");
    const extra = asked ? previewAssets(Math.max(32, Number(asked) || 32)) : [];
    setPreview(extra);
    const outil = params.get("suite");
    if (outil) setSuiteInitial(outil as Parameters<typeof EtEnsuite>[0]["initial"]);
    const item = params.get("item");
    if (item && [...extra, ...assets].some(card => card.id === item)) setOpen(item);
    if (params.get("detail") === "1") {
      const first = extra[0] ?? assets[0];
      if (first) setOpen(first.id);
    }
  }, [assets]);

  const isModel = (card: AssetRecord) => /\.(glb|gltf)$/i.test(card.media);
  const isAudio = (card: AssetRecord) => /\.(wav|mp3|m4a|ogg)$/i.test(card.media);
  const isVideo = (card: AssetRecord) => /\.(mp4|webm|mov)$/i.test(card.media || card.preview || "");
  const srcOf = (card: AssetRecord) => card.preview ? assetPath(card.preview) : (card.media && media[card.media]) || "";
  // R10: a card with no file behind it (a décor named but never rendered) is not an asset yet.
  // It stays in DÉCOR; the gallery only shows what can be seen or heard.
  const visible = useMemo(() => [...assets, ...preview].filter(card => srcOf(card)), [assets, preview, media]);
  // Only a real place waiting for its image counts: one with a description to create from.
  // Empty drafts and demo cards never trigger « … attend dans DÉCOR » on an empty studio.
  const hidden = assets.filter(card => card.kind === "decor" && card.geste !== "repere" && !card.id.startsWith("demo-") && card.prompt.trim().length > 0 && !srcOf(card)).length;
  const rows = useMemo(() => {
    const kept = type ? visible.filter(card => ofType(card, type)) : filterAssets(visible, filter, "");
    const found = filterAssets(kept, "tout", query);
    return sort === "nom" ? [...found].sort((a, b) => a.name.localeCompare(b.name)) : type ? [...found].sort((a, b) => (b.at || "").localeCompare(a.at || "")) : found;
  }, [visible, filter, query, type, sort]);

  function ofType(card: AssetRecord, wanted: LibraryType): boolean {
    if (wanted === "tout") return true;
    if (wanted === "personnages") return card.kind === "personnage";
    if (wanted === "lieux") return card.kind === "decor";
    if (wanted === "prises") return card.kind === "plan";
    if (card.kind === "personnage" || card.kind === "decor" || card.kind === "plan") return false;
    if (wanted === "3d") return isModel(card);
    if (wanted === "sons") return isAudio(card) || card.kind === "son";
    if (wanted === "videos") return isVideo(card);
    return !isModel(card) && !isAudio(card) && !isVideo(card) && card.kind !== "son";
  }
  const current = rows.find(item => item.id === open) ?? null;

  function toggle(id: string) {
    setPicked(list => list.includes(id) ? list.filter(item => item !== id) : [...list, id]);
  }

  function holdStart(id: string) {
    if (hold.current) window.clearTimeout(hold.current);
    held.current = false;
    hold.current = window.setTimeout(() => {
      held.current = true;
      setSelecting(true);
      toggle(id);
    }, 500);
  }

  function holdEnd() {
    if (hold.current) window.clearTimeout(hold.current);
    hold.current = null;
  }

  return <section className="u-assets" data-selecting={selecting || undefined} aria-labelledby="u-assets-title">
    <div className="u-assets-bar">
      <h2 id="u-assets-title" className="u-label">{title ?? t("create.gallery")}</h2>
      <p className="u-assets-count" data-asset-count={rows.length}>{t("assets.count", { count: rows.length })}</p>
      <button type="button" className="u-assets-select" aria-pressed={selecting} onClick={() => setSelecting(current => !current)}>{t("assets.select")}</button>
    </div>
    {!type && <div className="u-filter" role="group" aria-label={t("assets.search")}>
      {FILTERS.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{t(item.key)}</button>)}
    </div>}
    <div className="u-assets-tools">
      {type ? <input className="u-search" data-creations-search="" value={query} placeholder={t("creations.search")} aria-label={t("creations.search")} onChange={event => setQuery(event.target.value)} /> : <>
        <button type="button" className="u-icon" aria-pressed={searchOpen} aria-label={t("assets.search")} onClick={() => setSearchOpen(current => !current)}><Search /></button>
        {searchOpen && <input className="u-search" value={query} placeholder={t("assets.search")} aria-label={t("assets.search")} onChange={event => setQuery(event.target.value)} />}
      </>}
      {onImport && <label className="u-icon" aria-label={t("assets.import")}>
        <Share />
        <input className="sr-only" type="file" accept="image/*,video/*,audio/*" multiple onChange={event => { const files = [...(event.target.files ?? [])]; event.target.value = ""; if (files.length) onImport(files); }} />
      </label>}
      {onRefresh && <button type="button" className="u-icon" aria-label={t("assets.refresh")} onClick={onRefresh}><Refresh /></button>}
    </div>
    {hidden > 0 && onEmptyDecor && <div className="u-gallery-hidden" data-sans-image={hidden}>
      <span>{hidden === 1 ? t("assets.sansImageOne") : t("assets.sansImageMany", { count: hidden })}</span>
      <button type="button" onClick={onEmptyDecor}>{t("assets.sansImageGo")}</button>
    </div>}
    {picked.length > 0 && <p className="u-small">{t("assets.selected", { count: picked.length })}</p>}
    {current && <article className="u-detail u-asset-detail">
      {isModel(current) ? <a href={srcOf(current)} download={current.media.split("/").pop()}>{t("previs.downloadModel")}</a> : isAudio(current) ? <audio src={srcOf(current)} controls /> : srcOf(current) ? (isVideo(current) ? <video src={srcOf(current)} controls playsInline preload="metadata" /> : <img src={srcOf(current)} alt="" />) : <KindMark kind={markOf(current.kind)} />}
      <h3>{current.name}</h3>
      {current.prompt && <p>{current.prompt}</p>}
      <dl>
        <div><dt>{t("assets.geste")}</dt><dd>{gesteParId(current.geste) ? t(`gestes.${gesteParId(current.geste)!.clef}.title`) : t("assets.none")}</dd></div>
        <div><dt>{t("assets.refs")}</dt><dd>{current.refs.length > 0 ? current.refs.join(", ") : t("assets.none")}</dd></div>
        <div><dt>{t("assets.cost")}</dt><dd>{current.cout !== null ? t("assets.credits", { amount: current.cout }) : current.devis !== null ? t("assets.estimate", { amount: current.devis }) : t("assets.none")}</dd></div>
        <div><dt>{t("assets.date")}</dt><dd>{current.at || t("assets.none")}</dd></div>
      </dl>
      {type && <p className="u-label u-item-label">{t("creations.use")}</p>}
      <div className="u-card-actions" data-item-use="">
        {!current.preview && srcOf(current) && <a href={srcOf(current)} download={current.media.split("/").pop() || current.name}>{isAudio(current) || current.kind === "son" ? t("previs.downloadClip") : isVideo(current) ? t("previs.downloadClip") : isModel(current) ? t("previs.downloadModel") : t("previs.downloadClip")}</a>}
        {onUseRef && !isModel(current) && !isAudio(current) && !isVideo(current) && current.kind !== "son" && <button type="button" onClick={() => onUseRef(current)}>{t("assets.useRef")}</button>}
        {onPrise && (current.kind === "personnage" || current.kind === "decor") && <button type="button" onClick={() => onPrise(current)}>{t("assets.toPrise")}</button>}
        {onMontage && !isModel(current) && <button type="button" onClick={() => onMontage(current)}>{t("assets.toMontage")}</button>}
        {onRename && (current.kind === "personnage" || current.kind === "decor") && !current.preview && <button type="button" onClick={() => { const next = window.prompt(t("create.rename"), current.name); if (next) onRename(current, next); }}>{t("create.rename")}</button>}
        {onDuplicate && (current.kind === "personnage" || current.kind === "decor") && !current.preview && <button type="button" onClick={() => onDuplicate(current)}>{t("create.duplicate")}</button>}
        {onDelete && !current.preview && (armed === current.id
          ? <button type="button" onClick={() => { onDelete(current); setArmed(null); setOpen(null); }}>{t("create.deleteYes")}</button>
          : <button type="button" onClick={() => setArmed(current.id)}>{t("create.delete")}</button>)}
        {onCopy && (current.kind === "personnage" || current.kind === "decor") && projects.map(project => <button key={project.slug} type="button" onClick={() => onCopy(current, project.slug)}>{t("create.copyProject", { name: project.name })}</button>)}
        <button type="button" onClick={() => setOpen(null)}>{t("assets.close")}</button>
      </div>
      {!isModel(current) && !isAudio(current) && srcOf(current) && <EtEnsuite
        source={{ kind: isVideo(current) ? "video" : "image", url: srcOf(current), name: current.id, path: current.preview ? undefined : current.media || undefined }}
        onPrise={onPrise && (current.kind === "personnage" || current.kind === "decor") ? () => onPrise(current) : undefined}
        initial={suiteInitial}
        defaultOpen
        grouped={Boolean(type)}
      />}
    </article>}
    {rows.length === 0 ? <div className="u-empty" data-assets-empty="" data-creations-empty="">
      <p>{type ? t("creations.empty") : t("assets.empty")}</p>
      {type && <a className="u-primary" href={assetPath("/studio")}>{t("creations.emptyCta")}</a>}
    </div> : <div className="u-gallery u-asset-grid" data-density={dense ? "dense" : undefined}>
      {rows.map(card => {
        const src = srcOf(card);
        const selected = picked.includes(card.id);
        return <article key={card.id} className="u-card-lg" data-kind={card.kind} data-selected={selected || undefined} draggable onDragStart={event => {
          holdEnd();
          event.dataTransfer.setData("application/x-uttu-asset", card.id);
          event.dataTransfer.setData("application/x-uttu-asset-json", JSON.stringify({ id: card.id, name: card.name, url: src, kind: card.kind }));
          event.dataTransfer.setData("text/plain", card.name);
          event.dataTransfer.effectAllowed = "copy";
        }} onPointerDown={() => holdStart(card.id)} onPointerUp={holdEnd} onPointerCancel={holdEnd} onPointerLeave={holdEnd}>
          <button type="button" className="u-pick" aria-label={card.name} aria-pressed={open === card.id} onClick={() => {
            if (held.current) { held.current = false; return; }
            if (selecting) { toggle(card.id); return; }
            setOpen(card.id);
          }}>
            <span className="u-thumb">{isModel(card) ? <span className="u-card-blank">3D</span> : isAudio(card) || card.kind === "son" ? <span className="u-card-blank u-card-audio" data-audio-thumb=""><KindMark kind="son" /></span> : src ? (isVideo(card) ? <video src={`${src}#t=0.1`} muted playsInline preload="metadata" aria-hidden="true" /> : <img src={src} alt="" />) : <span className="u-card-blank"><KindMark kind={markOf(card.kind)} /></span>}</span>
          </button>
          <span className="u-asset-name">{card.name}</span>
          <button type="button" className="u-asset-check" aria-pressed={selected} aria-label={t("assets.select")} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); toggle(card.id); }}>
            <Check />
          </button>
        </article>;
      })}
    </div>}
  </section>;
}
