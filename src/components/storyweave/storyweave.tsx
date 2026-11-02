"use client";

// StoryWeave shell. It renders the U1.1 board, the cinema journal and the montage export.
// It does not cancel a Comfy job. ?storyboard=sw is the only address that mounts it.

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n, useLocaleSwitch } from "@/components/i18n/provider";
import { assetPath } from "@/lib/site";
import { shotRevisionOf, storyboardRevisionOf } from "@/lib/cinema/context";
import { cinemaMetaPath, parseMeta } from "@/lib/cinema/journal";
import type { EditableShotField, Operation, Scope } from "@/lib/cinema/types";
import { exportMp4 } from "@/lib/montage/encode";
import type { Edit, VideoClip } from "@/lib/montage/edit";
import { majPlan, tousLesPlans, trouverPlan, type PlanSB, type RefPlan, type Storyboard } from "@/lib/storyboard/storyboard";
import type { ContexteEcriture } from "@/lib/storyboard/ecrire";
import {
  acceptResync, addText, audioDrift, editPath, emptySwEdit, freezeAudio, hideClip, locksPath, parseSwEdit,
  quotableDuration, shotRows, swEditJson, trimShot, type SwClip, type SwEdit,
} from "@/lib/storyweave/timeline";
import { archiveOperation, duplicateOperation, finishOperation, lockFields, parseLocks, patchOperation, reorderOperation } from "@/lib/storyweave/journal";
import { parseVersions, publishVersion, versionsJson, versionsPath, type SwVersion } from "@/lib/storyweave/versions";
import { useStudio } from "../app/studio-session";
import { useRefPicture } from "../storyboard/storyboard-ui";
import type { Storyboards } from "../storyboard/use-storyboards";
import { Conversation, type ChatItem } from "./conversation";
import { Icon, ICON } from "./icons";
import { Panel, type SwElement, type SwView } from "./panel";
import { Timeline } from "./timeline";
import { useStoryweaveTurn } from "./use-turn";
import "./storyweave.css";

const LOCALES = ["en", "fr", "de", "es"] as const;
let messageId = 0;
const mid = () => `m${messageId += 1}`;

export function StoryWeave({
  sb, data, known, aller, onStart,   filming, seed = "", ready = false,
}: {
  sb: Storyboard | null;
  data: Storyboards;
  known: ContexteEcriture;
  aller: (id: string | null) => void;
  onStart: (ids: string[]) => void;
  filming: boolean;
  seed?: string;
  ready?: boolean;
}) {
  const { t } = useI18n();
  const { locale, setLocale } = useLocaleSwitch();
  const studio = useStudio();
  const picture = useRefPicture();
  const [view, setView] = useState<SwView>("overview");
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState(false);
  const [shotId, setShotId] = useState<string | null>(null);
  const [element, setElement] = useState<SwElement | null>(null);
  const [edit, setEdit] = useState<SwEdit>(emptySwEdit());
  const [locks, setLocks] = useState<Record<string, EditableShotField[]>>({});
  const [versions, setVersions] = useState<SwVersion[]>([]);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [lang, setLang] = useState(false);
  const [clock, setClock] = useState(0);
  const undos = useRef(new Map<string, { operationId: string | null; edit: SwEdit }>());
  const dismissed = useRef("");

  const filmed = useMemo(() => new Set((sb ? tousLesPlans(sb) : []).filter(plan => data.priseDuPlan(plan)).map(plan => plan.id)), [sb, data]);

  const say = (item: ChatItem) => setItems(list => [...list, item].slice(-40));

  const turn = useStoryweaveTurn(sb, data, known, aller, locks, shotId, (text) => {
    say({ id: mid(), kind: "uttu", text });
  }, () => undefined);

  useEffect(() => {
    if (!turn.phase) return;
    const timer = window.setInterval(() => setClock(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [turn.phase]);
  void clock;

  useEffect(() => {
    if (!sb) { setEdit(emptySwEdit()); setLocks({}); setVersions([]); return; }
    let gone = false;
    void (async () => {
      const [editRaw, lockRaw, versionRaw] = await Promise.all([
        studio.readProjectFile(editPath(sb.id)),
        studio.readProjectFile(locksPath(sb.id)),
        studio.readProjectFile(versionsPath(sb.id)),
      ]);
      if (gone) return;
      setEdit(parseSwEdit(editRaw));
      setLocks(parseLocks(lockRaw));
      setVersions(parseVersions(versionRaw));
    })();
    return () => { gone = true; };
  }, [sb?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const persistEdit = (next: SwEdit) => {
    setEdit(next);
    if (sb) void studio.writeProjectFile(editPath(sb.id), swEditJson(next));
  };

  const scopeOf = (): Scope | null => sb && studio.studio.project ? { projectId: studio.studio.project, storyboardId: sb.id } : null;

  const metaOf = async () => {
    if (!sb) return null;
    return parseMeta(await studio.readProjectFile(cinemaMetaPath(sb.id)) ?? null, sb.id);
  };

  const logUndo = (text: string, operationId: string | null, previous: SwEdit) => {
    const id = mid();
    undos.current.set(id, { operationId, edit: previous });
    say({
      id, kind: "log", text, onUndo: () => {
        const entry = undos.current.get(id);
        if (!entry) return;
        const scope = scopeOf();
        if (entry.operationId && scope) void studio.cinema.undo(scope, entry.operationId).then(() => studio.cinemaChanged());
        persistEdit(entry.edit);
        say({ id: mid(), kind: "log", text: t("storyweave.undone") });
      },
    });
  };

  const commit = async (ops: Operation[], label: string, next: SwEdit, takeIds?: Record<string, string[]>) => {
    const scope = scopeOf();
    const previous = edit;
    if (!scope) { say({ id: mid(), kind: "log", text: t("storyweave.journalFail") }); return false; }
    const result = await studio.cinema.applyLocal(scope, ops, { locks, userText: label, ...(takeIds ? { takeIds } : {}) });
    if (!result.ok) { say({ id: mid(), kind: "log", text: t("storyweave.journalFail") }); return false; }
    persistEdit(next);
    studio.cinemaChanged();
    logUndo(label, result.data?.operationId ?? null, previous);
    return true;
  };

  const openView = (next: SwView) => { setView(next); setPanel(true); };
  const openShot = (id: string) => { setShotId(id); openView("shot"); };

  const onTrim = (id: string, duration: number) => {
    if (!sb) return;
    const previous = edit;
    const frozen = freezeAudio(sb, edit, filmed);
    const next = trimShot(frozen, id, duration);
    const plan = tousLesPlans(sb).find(item => item.id === id);
    const index = tousLesPlans(sb).findIndex(item => item.id === id) + 1;
    const quotable = quotableDuration(duration);
    const label = t("storyweave.youTrim", { n: String(index), from: String(plan?.duree ?? ""), to: String(Math.round(duration * 10) / 10) });
    if (plan && quotable && quotable !== plan.duree) {
      void (async () => {
        const meta = await metaOf();
        if (!meta) return;
        const trimmed = { ...next, trim: { ...next.trim } };
        delete trimmed.trim[id];
        const ok = await commit([patchOperation(scopeOf()!, id, shotRevisionOf(meta, id), { duree: quotable })], label, trimmed);
        if (ok) propose(sb, trimmed);
      })();
      return;
    }
    persistEdit(next);
    logUndo(label, null, previous);
    propose(sb, next);
  };

  const propose = (board: Storyboard, next: SwEdit) => {
    const drift = audioDrift(board, next, filmed);
    const sig = drift.map(item => `${item.id}:${item.to}`).join("|");
    if (!drift.length || sig === dismissed.current) return;
    say({
      id: mid(), kind: "resync", text: t("storyweave.resyncAsk", { label: drift.map(item => item.label).filter(Boolean).join(", ") }),
      onAccept: () => { dismissed.current = ""; persistEdit(acceptResync(next)); say({ id: mid(), kind: "log", text: t("storyweave.resyncDone", { label: drift[0]?.label || "" }) }); },
      onLater: () => { dismissed.current = sig; },
    });
  };

  const onReorder = (from: number, to: number) => {
    if (!sb) return;
    const ids = tousLesPlans(sb).map(plan => plan.id);
    const [moved] = ids.splice(from, 1);
    if (!moved) return;
    ids.splice(to, 0, moved);
    const frozen = freezeAudio(sb, edit, filmed);
    void (async () => {
      const meta = await metaOf();
      const scope = scopeOf();
      if (!meta || !scope) return;
      const ok = await commit([reorderOperation(scope, storyboardRevisionOf(meta), ids)], t("storyweave.youReorder"), frozen);
      if (ok) propose(sb, frozen);
    })();
  };

  const onSplit = (id: string) => {
    if (!sb) return;
    const index = tousLesPlans(sb).findIndex(plan => plan.id === id) + 1;
    void (async () => {
      const meta = await metaOf();
      const scope = scopeOf();
      if (!meta || !scope) return;
      await commit([duplicateOperation(scope, id, shotRevisionOf(meta, id))], t("storyweave.youSplit", { n: String(index) }), edit);
    })();
  };

  const onDelete = (clip: SwClip) => {
    if (!sb) return;
    if (clip.track === "video" && clip.shotId) {
      const index = tousLesPlans(sb).findIndex(plan => plan.id === clip.shotId) + 1;
      void (async () => {
        const meta = await metaOf();
        const scope = scopeOf();
        if (!meta || !scope || !clip.shotId) return;
        await commit([archiveOperation(scope, clip.shotId, shotRevisionOf(meta, clip.shotId))], t("storyweave.youDelete", { n: String(index) }), edit);
      })();
      return;
    }
    const previous = edit;
    persistEdit(hideClip(edit, clip.id));
    logUndo(t("storyweave.youDelete", { n: clip.label || "" }), null, previous);
  };

  const href = (path: string | null | undefined) => !path ? "" : path.startsWith("blob:") || path.startsWith("http") ? path : (studio.media[path] ?? "");

  const filesFor = (kind: SwElement["kind"], name: string) => {
    const key = name.trim().toLowerCase();
    const paths: string[] = [];
    if (kind === "cast") {
      const card = studio.studio.cast.find(item => item.name.trim().toLowerCase() === key);
      const ref = studio.references.find(item => item.category === "cast" && item.name.trim().toLowerCase() === key);
      paths.push(card?.sheet ?? "", ...(card?.photos ?? []), ...(ref?.images ?? []));
    } else if (kind === "place") {
      const scene = studio.studio.scenes.find(item => item.name.trim().toLowerCase() === key);
      const ref = studio.references.find(item => item.category === "decor" && item.name.trim().toLowerCase() === key);
      paths.push(scene?.render ?? "", ...(scene?.stills ?? []), ...(scene?.views ?? []), ...(ref?.images ?? []));
    } else {
      const ref = studio.references.find(item => item.name.trim().toLowerCase() === key);
      paths.push(...(ref?.images ?? []));
    }
    return paths.filter(Boolean).map((path, index) => ({ name: `${name}-${index + 1}`, url: href(path) })).filter(file => file.url);
  };

  const onExport = async () => {
    if (!sb) { say({ id: mid(), kind: "log", text: t("storyweave.exportEmpty") }); return; }
    const video: VideoClip[] = shotRows(sb, edit).flatMap(row => {
      const hit = data.priseDuPlan(row.plan);
      const source = href(hit?.take?.video) || href(hit?.take?.poster) || picture(row.plan.refs.find(ref => ref.role === "ou") ?? row.plan.refs[0] ?? { role: "ou", nom: "", id: null });
      if (!source) return [];
      const clip: VideoClip = {
        id: row.plan.id, kind: hit?.take?.video ? "video" : "image", source, label: row.plan.titre || row.plan.id,
        media: row.duration, start: 0, end: row.duration, takeId: hit?.prise.id ?? null,
      };
      return [clip];
    });
    if (!video.length) { say({ id: mid(), kind: "log", text: t("storyweave.exportEmpty") }); return; }
    const cut: Edit = { id: sb.id, name: sb.titre || "edit", video, audio: [] };
    try {
      const blob = await exportMp4({ edit: cut, urlOf: source => source, vertical: sb.format === "portrait", onProgress: () => undefined });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${sb.titre || "edit"}.mp4`;
      link.click();
      URL.revokeObjectURL(link.href);
      say({ id: mid(), kind: "log", text: t("storyweave.exportDone") });
    } catch {
      say({ id: mid(), kind: "log", text: t("storyweave.exportFail") });
    }
  };

  const onFinish = async (id: string) => {
    if (!sb) return;
    const plan = tousLesPlans(sb).find(item => item.id === id);
    const hit = plan ? data.priseDuPlan(plan) : null;
    const scope = scopeOf();
    const url = href(hit?.take?.video || hit?.prise.fichier);
    if (!plan || !hit || !scope || !url) { say({ id: mid(), kind: "log", text: t("storyweave.exportEmpty") }); return; }
    const meta = await metaOf();
    if (!meta) return;
    const ok = await commit([finishOperation(scope, id, shotRevisionOf(meta, id), hit.prise.id)], t("storyweave.finishGo"), edit, { [id]: [hit.prise.id] });
    if (!ok) return;
    const blob = await fetch(url).then(response => response.blob()).catch(() => null);
    if (!blob) return;
    await studio.finaliseMontage({
      project: scope.projectId, video: blob, name: plan.titre || plan.id, seconds: plan.duree,
      ratio: plan.format === "portrait" ? "9/16" : "16/9", choice: { resolution: "1080p", nettoyer: "aucun" },
      confirmed: true, onStage: () => undefined,
    });
  };

  const onKeep = (id: string) => {
    if (!sb) return;
    const found = trouverPlan(sb, id);
    if (!found) return;
    void data.sauver(majPlan(sb, id, { dialogue: { ...found.plan.dialogue, source: "visiteur" } }));
  };

  const onLine = (id: string, text: string) => {
    if (!sb) return;
    const found = trouverPlan(sb, id);
    if (!found) return;
    void data.sauver(majPlan(sb, id, { dialogue: { ...found.plan.dialogue, texte: text } }));
  };

  const onEngine = (id: string, rendu: "fidele" | "rapide") => {
    void (async () => {
      const meta = await metaOf();
      const scope = scopeOf();
      if (!meta || !scope) return;
      await commit([patchOperation(scope, id, shotRevisionOf(meta, id), { rendu })], t("storyweave.change"), edit);
    })();
  };

  const onLock = (id: string, on: boolean) => {
    const next = { ...locks, [id]: lockFields(on) };
    if (!on) delete next[id];
    setLocks(next);
    if (sb) void studio.writeProjectFile(locksPath(sb.id), `${JSON.stringify(next)}\n`);
  };

  const onPublish = () => {
    if (!sb) return;
    const next = publishVersion(versions, sb, new Date().toISOString());
    setVersions(next);
    void studio.writeProjectFile(versionsPath(sb.id), versionsJson(next));
  };

  const latest = versions.at(-1);
  const savedLabel = latest ? t("storyweave.savedAt", { time: new Date(latest.savedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) }) : t("storyweave.notSaved");
  const elapsed = turn.phase ? Math.max(0, Math.round((Date.now() - turn.phase.started) / 1000)) : 0;
  const online = studio.connected && !!studio.studio.project;
  const libraryCount = known.cast.length + known.decor.length;

  return <div className="sw-app" data-storyweave="" data-storyboard-page="" data-ready={ready ? "true" : "false"} data-sw-online={online ? "true" : "false"} data-panel={panel ? "open" : "closed"} data-focus={focus ? "panel" : "split"} data-quoting={turn.line ? "true" : "false"}>
    <header className="sw-top">
      <div className="sw-brand"><b>U<i>*</i>TTU</b><span>{sb?.titre || t("storyweave.untitled")}</span></div>
      {/* TODO(storyweave): render AnimeLookPill here when that component is exported. storyboard-u11.tsx stays untouched. */}
      <span data-sw-anime-slot="" className="sw-sr" />
      <span className="sw-sp" />
      <span className="sw-lang">
        <button type="button" className="sw-txt" aria-label={t("storyweave.lang")} aria-expanded={lang} onClick={() => setLang(open => !open)}>{locale.toUpperCase()}</button>
        {lang && <span className="sw-menu" role="menu">{LOCALES.map(code => <button key={code} type="button" role="menuitemradio" aria-checked={locale === code} onClick={() => { setLocale(code); setLang(false); }}>{code.toUpperCase()}</button>)}</span>}
      </span>
      <button type="button" className="sw-txt sw-show-narrow" data-sw-open-panel="" onClick={() => { setPanel(true); setView("overview"); }}><Icon d={ICON.panel} />{t("storyweave.panel")}</button>
      <a className="sw-ib sw-show-wide" href={assetPath("/studio")} aria-label={t("storyboard.studio")}><Icon d={ICON.back} /></a>
    </header>
    <div className="sw-stage">
      <Conversation
        items={items} phase={turn.phase} elapsed={elapsed} counts={{ shots: sb ? tousLesPlans(sb).length : 0, library: libraryCount }}
        quote={turn.line} proposals={turn.proposals} seed={seed}
        onAcceptName={turn.acceptName} onConfirm={() => void turn.confirm()} onDismiss={turn.dismiss} onStop={turn.stop}
        onOpen={openView}
        onSend={(text, files) => {
          const note = files.length ? `${text}\n${files.map(file => file.name).join(", ")}` : text;
          say({ id: mid(), kind: "you", text: note });
          void turn.send(note);
        }}
      />
      <Panel
        sb={sb} data={data} edit={edit} view={view} shotId={shotId} element={element} versions={versions} savedLabel={savedLabel}
        pictureOf={(ref: RefPlan) => picture(ref)} filesFor={filesFor}
        missingPicture={plan => plan.refs.some(ref => (ref.role === "qui" || ref.role === "ou") && !picture(ref))}
        locked={id => (locks[id]?.length ?? 0) > 0} filming={filming}
        onView={openView} onShot={openShot} onElement={item => { setElement(item); openView("element"); }}
        onClose={() => setPanel(false)} onLayout={() => setFocus(value => !value)}
        onPublish={onPublish} onRestore={version => { if (sb) void data.sauver({ ...version.board, id: sb.id, creeLe: sb.creeLe }); }}
        onExport={() => void onExport()} onLock={onLock} onEngine={onEngine} onFilm={id => onStart([id])} onFinish={id => void onFinish(id)}
        onKeep={onKeep} onRewrite={id => { const index = sb ? tousLesPlans(sb).findIndex(plan => plan.id === id) + 1 : 0; void turn.send(t("storyweave.rewriteAsk", { n: String(index) })); }}
        onLine={onLine}
      />
    </div>
    <Timeline sb={sb} edit={edit} filmed={filmed} locked={new Set(Object.keys(locks))} onOpenShot={openShot} onTrim={onTrim} onReorder={onReorder} onSplit={onSplit} onDelete={onDelete} onAddText={at => persistEdit(addText(edit, at, sb?.titre || t("storyweave.text"), `t${Date.now().toString(36)}`))} />
  </div>;
}
