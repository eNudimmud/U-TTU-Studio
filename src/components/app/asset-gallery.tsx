"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { filterAssets, previewAssets, type AssetFilter, type AssetKind, type AssetRecord } from "@/lib/creation/assets";
import { gesteParId } from "@/lib/workflows/registre";
import { assetPath } from "@/lib/site";
import { Check, KindMark, Refresh, Search, Share, type MarkKind } from "./glyphs";

const FILTERS: { id: AssetFilter; key: string }[] = [
  { id: "tout", key: "assets.all" },
  { id: "personnage", key: "assets.personnages" },
  { id: "decor", key: "assets.decors" },
  { id: "plan", key: "assets.plans" },
  { id: "son", key: "assets.sons" },
  { id: "importe", key: "assets.importes" },
];

function markOf(kind: AssetKind): MarkKind {
  if (kind === "personnage") return "personnage";
  if (kind === "decor") return "lieu";
  if (kind === "plan") return "prise";
  if (kind === "son") return "sequence";
  return "note";
}

export function AssetGallery({ assets, media, defaultFilter = "tout", onRefresh, onImport, onRename, onDuplicate, onDelete, onCopy, onUseRef, onPrise, onMontage, projects = [] }: {
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
  projects?: { slug: string; name: string }[];
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
  const hold = useRef<number | null>(null);
  const held = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const asked = params.get("galerie");
    const extra = asked ? previewAssets(Math.max(32, Number(asked) || 32)) : [];
    setPreview(extra);
    if (params.get("detail") === "1") {
      const first = extra[0] ?? assets[0];
      if (first) setOpen(first.id);
    }
  }, [assets]);

  const rows = useMemo(() => filterAssets([...assets, ...preview], filter, query), [assets, preview, filter, query]);
  const current = rows.find(item => item.id === open) ?? null;
  const srcOf = (card: AssetRecord) => card.preview ? assetPath(card.preview) : (card.media && media[card.media]) || "";

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
      <h2 id="u-assets-title" className="u-label">{t("create.gallery")}</h2>
      <p className="u-assets-count" data-asset-count={rows.length}>{t("assets.count", { count: rows.length })}</p>
      <button type="button" className="u-assets-select" aria-pressed={selecting} onClick={() => setSelecting(current => !current)}>{t("assets.select")}</button>
    </div>
    <div className="u-filter" role="group" aria-label={t("assets.search")}>
      {FILTERS.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{t(item.key)}</button>)}
    </div>
    <div className="u-assets-tools">
      <button type="button" className="u-icon" aria-pressed={searchOpen} aria-label={t("assets.search")} onClick={() => setSearchOpen(current => !current)}><Search /></button>
      {searchOpen && <input className="u-search" value={query} placeholder={t("assets.search")} aria-label={t("assets.search")} onChange={event => setQuery(event.target.value)} />}
      {onImport && <label className="u-icon" aria-label={t("assets.import")}>
        <Share />
        <input className="sr-only" type="file" accept="image/*,video/*,audio/*" multiple onChange={event => { const files = [...(event.target.files ?? [])]; event.target.value = ""; if (files.length) onImport(files); }} />
      </label>}
      {onRefresh && <button type="button" className="u-icon" aria-label={t("assets.refresh")} onClick={onRefresh}><Refresh /></button>}
    </div>
    {picked.length > 0 && <p className="u-small">{t("assets.selected", { count: picked.length })}</p>}
    {current && <article className="u-detail u-asset-detail">
      {srcOf(current) ? <img src={srcOf(current)} alt="" /> : <KindMark kind={markOf(current.kind)} />}
      <h3>{current.name}</h3>
      {current.prompt && <p>{current.prompt}</p>}
      <dl>
        <div><dt>{t("assets.geste")}</dt><dd>{gesteParId(current.geste) ? t(`gestes.${gesteParId(current.geste)!.clef}.title`) : t("assets.none")}</dd></div>
        <div><dt>{t("assets.refs")}</dt><dd>{current.refs.length > 0 ? current.refs.join(", ") : t("assets.none")}</dd></div>
        <div><dt>{t("assets.cost")}</dt><dd>{current.cout !== null ? t("assets.credits", { amount: current.cout }) : current.devis !== null ? t("assets.estimate", { amount: current.devis }) : t("assets.none")}</dd></div>
        <div><dt>{t("assets.date")}</dt><dd>{current.at || t("assets.none")}</dd></div>
        <div><dt>{t("assets.path")}</dt><dd>{current.media || current.preview || t("assets.none")}</dd></div>
      </dl>
      <div className="u-card-actions">
        {onUseRef && <button type="button" onClick={() => onUseRef(current)}>{t("assets.useRef")}</button>}
        {onPrise && <button type="button" onClick={() => onPrise(current)}>{t("assets.toPrise")}</button>}
        {onMontage && <button type="button" onClick={() => onMontage(current)}>{t("assets.toMontage")}</button>}
        {onRename && !current.preview && <button type="button" onClick={() => { const next = window.prompt(t("create.rename"), current.name); if (next) onRename(current, next); }}>{t("create.rename")}</button>}
        {onDuplicate && !current.preview && <button type="button" onClick={() => onDuplicate(current)}>{t("create.duplicate")}</button>}
        {onDelete && !current.preview && (armed === current.id
          ? <button type="button" onClick={() => { onDelete(current); setArmed(null); setOpen(null); }}>{t("create.deleteYes")}</button>
          : <button type="button" onClick={() => setArmed(current.id)}>{t("create.delete")}</button>)}
        {onCopy && projects.map(project => <button key={project.slug} type="button" onClick={() => onCopy(current, project.slug)}>{t("create.copyProject", { name: project.name })}</button>)}
        <button type="button" onClick={() => setOpen(null)}>{t("assets.close")}</button>
      </div>
    </article>}
    {rows.length === 0 ? <p className="u-small">{t("assets.empty")}</p> : <div className="u-gallery u-asset-grid">
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
            <span className="u-thumb">{src ? <img src={src} alt="" /> : <span className="u-card-blank"><KindMark kind={markOf(card.kind)} /></span>}</span>
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
