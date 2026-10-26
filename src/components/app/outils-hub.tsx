"use client";

// « Outils » : every Comfy tool of the studio in one place, by family. One panel for every
// tool, always in the same order: entrée → consigne → références (repliées) → réglages
// (repliés) → one full-width button named after the action, with its estimate. The run just
// made sits next to the panel as a big preview with « Et ensuite ? » open; past runs live in
// Mes créations, never here. A tool that is not wired yet
// says « bientôt » and why; there is never a button that does nothing. No cancel.

import { useAgentDraft } from "./use-agent-draft";
import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useI18n } from "@/components/i18n/provider";
import type { AssetRecord } from "@/lib/creation/assets";
import { formatCredits } from "@/lib/credits";
import { familleVitrine, intentDe, modelesIntent, outilEtat, outilParId, outilsPublics, outilsPublicsOnglet, type Entree, type Outil, type Sortie } from "@/lib/outils/catalogue";
import { outilQuote } from "@/lib/outils/graphs";
import { loadDraft, saveDraft } from "@/lib/outils/brouillon";
import { assetPath } from "@/lib/site";
import { lastFrame, sourceFile, typeFromName, videoSeconds } from "@/lib/suite/media";
import type { Elargir } from "@/lib/suite/graphs";
import type { Onglet } from "@/lib/workflows/registre";
import { EtEnsuite, SOURCE_KEY, type HandedSource } from "./et-ensuite";
import { MontageButton } from "./montage-button";
import { resolveStudioHandoff } from "@/lib/agent/handoff";
import { BarreHome, CardThumb, StudioHome, openStudioTool } from "./studio-entry";
import { ALL_TOOLS_ID } from "./creation-bar";
import { REFS_HANDOFF_KEY, isRefsHandoff, takeHandoff } from "@/lib/barre/model";
import { ReperageTool } from "./reperage/reperage-tool";
import { REPERAGE_ID } from "@/lib/outils/vignettes";
import { useStudio, type FinaliseOutcome, type FinaliseStage } from "./studio-session";

export const SAMPLES: Record<Entree, { url: string; name: string }> = {
  image: { url: "/exemples/cast-coursiere.webp", name: "exemple-personnage.webp" },
  image2: { url: "/exemples/decor-quai-nuit.webp", name: "exemple-lieu.webp" },
  video: { url: "/exemples/outils/plan-exemple.mp4", name: "exemple-plan.mp4" },
  audio: { url: "/exemples/voix-exemple.wav", name: "exemple-voix.wav" },
};

const MEDIA: Record<Entree, "image" | "video" | "audio"> = { image: "image", image2: "image", video: "video", audio: "audio" };

/** The hash that opens the hub, optionally on one tool: #outils or #outils/<id>. */
export function outilFromHash(hash: string): string | null {
  const match = /^#outils\/([a-z0-9-]+)/.exec(hash);
  return match ? match[1] : null;
}

function openTool(id: string | null) {
  if (window.location.pathname.endsWith("/studio")) openStudioTool(id);
  else window.location.href = assetPath(`/studio${id ? `#outils/${id}` : "#outils"}`);
}

function titreCarte(t: (key: string) => string, id: string) {
  return t(`outils.t.${intentDe(id)}.title`);
}

function ligneCarte(t: (key: string) => string, id: string) {
  return t(`outils.t.${intentDe(id)}.line`);
}

const NAMED_MODELS = new Set(["vid-wan", "vid-ltx-image", "vid-animer", "vid-kling", "vid-seedance", "vid-h3max", "vid-prolonger", "vid-prolonger-grok", "3d-ouvert", "3d-tripo", "3d-hunyuan", "3d-meshy", "son-voix-ouverte", "son-voix", "son-musique-ouverte", "son-musique", "son-bruitage-ouvert", "son-bruitage"]);

function nomModele(t: (key: string) => string, id: string) {
  return NAMED_MODELS.has(id) ? t(`outils.modelName.${id}`) : t(`outils.t.${id}.title`);
}

export function OutilCard({ outil }: { outil: Outil }) {
  const { t } = useI18n();
  return <button type="button" className="u-outil-card" data-outil={outil.id} data-etat="pret" onClick={() => openTool(outil.id)}>
    <CardThumb id={outil.id} fam={familleVitrine(outil)} />
    <span className="u-outil-name">{titreCarte(t, outil.id)}</span>
    <span className="u-outil-line">{ligneCarte(t, outil.id)}</span>
  </button>;
}

/** One tab's own tools, from the same public cards, folded so the tab stays short. */
export function OutilsStrip({ onglet, open = false }: { onglet: Onglet; open?: boolean }) {
  const { t } = useI18n();
  const { prefs } = useStudio();
  const [opened, setOpened] = useState(open);
  const list = outilsPublicsOnglet(onglet, prefs);
  const panelId = useId();
  if (list.length === 0) return null;
  return <div className="u-outils-strip" data-outils-onglet={onglet}>
    <button type="button" className="u-fold-head" aria-expanded={opened} aria-controls={panelId} onClick={() => setOpened(value => !value)}>
      <span>{t("outils.tabTools")}</span><span className="u-small">{t("outils.count", { n: String(list.length) })}</span>
    </button>
    <div id={panelId} className="u-outils-strip-body" hidden={!opened}>
      <div className="u-outils-grid">{list.map(item => <OutilCard key={item.id} outil={item} />)}</div>
      <button type="button" className="u-secondary" data-outils-all="" onClick={() => openTool(ALL_TOOLS_ID)}>{t("outils.seeAll")}</button>
    </div>
  </div>;
}

export function OutilsHub({ tool }: { tool: string | null }) {
  if (tool === REPERAGE_ID) return <ReperageTool onBack={() => openTool(null)} />;
  if (tool === ALL_TOOLS_ID) return <StudioHome />;
  const outil = tool ? outilParId(tool) : null;
  if (!outil || outil.bientot) return <BarreHome />;
  const head = intentDe(outil.id);
  return <OutilWork key={head} outil={outil} head={head} />;
}

function OutilWork({ outil, head }: { outil: Outil; head: string }) {
  const { t } = useI18n();
  const { connected, setSheet } = useStudio();
  const [last, setLast] = useState<ToolRun | null>(null);
  return <div className="u-outils-work" data-outils-tool={head}>
    {!connected && <p className="u-entry-link" data-entry-link="">
      <span>{t("entry.linkTitle")}</span>
      <button type="button" className="u-secondary" onClick={() => setSheet("connect")}>{t("entry.link")}</button>
    </p>}
    <button type="button" className="u-secondary u-outils-back" data-outils-back="" onClick={() => openTool(ALL_TOOLS_ID)}>← {t("outils.back")}</button>
    <div className="u-outils-split" data-has-result={last ? "" : undefined}>
      <ToolPanel outil={outil} onResult={setLast} />
      {last && <ToolResult run={last} label={titreCarte(t, outil.id)} />}
    </div>
  </div>;
}

interface Picked { url: string; name: string; file?: File; path?: string; aspect?: "horizontal" | "vertical" }

function kindOfAsset(asset: AssetRecord, media: Record<string, string>): "image" | "video" | "audio" | "mesh" | null {
  const path = asset.media || asset.preview || "";
  if (/\.(glb|gltf)$/i.test(path)) return "mesh";
  if (/\.(mp4|webm|mov)$/i.test(path) || asset.kind === "plan") return /\.(png|jpe?g|webp)$/i.test(path) ? "image" : "video";
  if (/\.(mp3|wav|flac|ogg|m4a)$/i.test(path) || asset.kind === "son") return "audio";
  if (/\.(png|jpe?g|webp|gif)$/i.test(path)) return "image";
  return media[path] ? "image" : null;
}

export function useResultAssets(): { asset: AssetRecord; url: string; kind: "image" | "video" | "audio" | "mesh" }[] {
  const { loose, media, studio } = useStudio();
  return useMemo(() => {
    const takes: AssetRecord[] = studio.takes.map(take => ({ id: take.id, kind: "plan", name: take.line || take.id, at: take.at, prompt: take.prompt, geste: "prise-plan", template: "", refs: [], devis: take.announcedCredits, cout: take.costCredits, media: take.video, note: "", preview: null, loose: false }));
    return [...loose, ...takes]
      .map(asset => ({ asset, url: asset.preview ? assetPath(asset.preview) : (media[asset.media] ?? ""), kind: kindOfAsset(asset, media) }))
      .filter((item): item is { asset: AssetRecord; url: string; kind: "image" | "video" | "audio" | "mesh" } => Boolean(item.url && item.kind))
      .sort((a, b) => b.asset.at.localeCompare(a.asset.at));
  }, [loose, media, studio.takes]);
}

function InputSlot({ entree, label, value, busy, busyId, onChange }: { entree: Entree; label?: string; value: Picked | null; busy: boolean; busyId: string; onChange(next: Picked | null): void }) {
  const { t } = useI18n();
  const id = useId();
  const [over, setOver] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const want = MEDIA[entree];
  const own = useResultAssets().filter(item => item.kind === want).slice(0, 8);
  const accept = `${want}/*`;
  function take(file: File | undefined) {
    if (!file || !(file.type || typeFromName(file.name)).startsWith(`${want}/`)) return;
    onChange({ url: URL.createObjectURL(file), name: file.name, file });
  }
  function drop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    if (!busy) take(event.dataTransfer.files?.[0]);
  }
  return <div className="u-outil-input" data-outil-input={entree} data-over={over ? "" : undefined} onDragOver={event => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
    <span className="u-label" id={`${id}-label`}>{label ?? t(`outils.kind.${entree}`)}</span>
    {value && <div className="u-outil-preview">
      {want === "image" ? <img src={value.url} alt="" /> : want === "video" ? <video src={value.url} muted playsInline controls preload="metadata" /> : <audio src={value.url} controls />}
      <span className="u-small">{value.name}</span>
    </div>}
    <div className="u-outil-input-actions">
      <label className="u-chip u-file-chip" data-outil-file={entree}>
        <span>{value ? t("outils.replace") : t("outils.pick")}</span>
        <input type="file" accept={accept} disabled={busy} aria-labelledby={`${id}-label`} aria-describedby={busy ? busyId : undefined} onChange={event => take(event.target.files?.[0] ?? undefined)} />
      </label>
      <button type="button" className="u-chip" data-outil-sample={entree} disabled={busy} aria-describedby={busy ? busyId : undefined} onClick={() => onChange({ url: assetPath(SAMPLES[entree].url), name: SAMPLES[entree].name })}>{t("outils.sample")}</button>
      {own.length > 0 && <button type="button" className="u-chip" aria-expanded={studioOpen} data-outil-studio={entree} disabled={busy} aria-describedby={busy ? busyId : undefined} onClick={() => setStudioOpen(open => !open)}>{t("outils.fromStudio")}</button>}
    </div>
    {studioOpen && <div className="u-outil-own" role="group" aria-label={t("outils.fromStudio")}>
      {own.map(item => <button key={item.asset.id} type="button" className="u-outil-own-item" onClick={() => { onChange({ url: item.url, name: item.asset.name, path: item.asset.media || undefined }); setStudioOpen(false); }}>
        {want === "image" ? <img src={item.url} alt="" /> : <span>{want === "video" ? "▶" : "♪"}</span>}
        <span className="u-small">{item.asset.name}</span>
      </button>)}
    </div>}
  </div>;
}

const MODELS = "u-ttu-modeles-recents";

function ModelMenu({ current, onPick }: { current: string; onPick(id: string): void }) {
  const { t } = useI18n();
  const { prefs } = useStudio();
  const models = modelesIntent(current, prefs);
  const modelKey = models.map(item => item.id).join(" ");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    const ids = modelKey.split(" ").filter(Boolean);
    let saved: string[] = [];
    try { saved = JSON.parse(window.localStorage.getItem(MODELS) ?? "[]") as string[]; } catch { saved = []; }
    const next = [current, ...saved.filter(id => id !== current && ids.includes(id))].slice(0, 5);
    try { window.localStorage.setItem(MODELS, JSON.stringify(next)); } catch { /* memory only */ }
    setRecent(next.filter(id => id !== current && ids.includes(id)));
  }, [current, modelKey]);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const press = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", press, true);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", press, true); };
  }, [open]);
  if (models.length < 2) return null;
  const ordered = [...recent.map(id => models.find(item => item.id === id)).filter((item): item is Outil => Boolean(item)), ...models.filter(item => !recent.includes(item.id))];
  return <div className="u-model-menu" ref={root} data-model-menu="">
    <button type="button" className="u-chip" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)}>{t("outils.modelChange")} <span aria-hidden="true">▾</span></button>
    <div id={menuId} className="u-model-panel" hidden={!open}>
      {recent.length > 0 && <p className="u-label">{t("toolswitch.recent")}</p>}
      <ul role="list" className="u-dd-list">
        {ordered.map(item => <li key={item.id}><button type="button" aria-current={item.id === current ? "true" : undefined} data-model={item.id} onClick={() => { setOpen(false); onPick(item.id); }}>{nomModele(t, item.id)}</button></li>)}
      </ul>
    </div>
  </div>;
}

function Fold({ step, label, children }: { step: string; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="u-tool-fold" data-tool-step={step}>
    <button type="button" className="u-fold-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>{label}</button>
    <div id={id} hidden={!open}>{children}</div>
  </div>;
}

export function ToolPanel({ outil: asked, onResult }: { outil: Outil; onResult?(run: ToolRun | null): void }) {
  const { t } = useI18n();
  const { connected, creating, runOutil, balance, setSheet, prefs, media } = useStudio();
  const [modelId, setModelId] = useState(asked.id);
  const outil = outilParId(modelId) ?? asked;
  // The form you left here comes back as it was: pictures, text and settings (never the consent box).
  const draftKey = intentDe(asked.id);
  const [draft] = useState(() => loadDraft(draftKey, path => media[path]));
  const [inputs, setInputs] = useState<Partial<Record<Entree, Picked | null>>>(() => (draft?.inputs ?? {}) as Partial<Record<Entree, Picked | null>>);
  const [text, setText] = useState(draft?.text ?? "");
  const [aspect, setAspect] = useState<"horizontal" | "vertical">(draft?.aspect ?? "horizontal");
  const [side, setSide] = useState<Elargir>((draft?.side as Elargir | undefined) ?? "cotes");
  const [fluide, setFluide] = useState(draft?.fluide ?? false);
  const [mesh, setMesh] = useState<"objet" | "perso">(draft?.mesh ?? "objet");
  useEffect(() => {
    saveDraft(draftKey, { inputs: inputs as Record<string, Picked | null>, text, aspect, side, fluide, mesh });
  }, [draftKey, inputs, text, aspect, side, fluide, mesh]);
  const [consent, setConsent] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [ask, setAsk] = useState(false);
  const [why, setWhy] = useState("");
  const [stage, setStage] = useState<{ stage: FinaliseStage; seconds?: number } | null>(null);
  const [outcome, setOutcome] = useState<FinaliseOutcome | null>(null);
  const titleId = useId();
  const busyId = `${titleId}-busy`;
  const whyId = `${titleId}-why`;
  const askId = `${titleId}-ask`;
  const etat = outilEtat(outil, prefs);
  const sending = useRef(false);
  useAgentDraft(op => op.toolId === outil.id, (draft, resources) => {
    const remaining = [...resources];
    const placed: Partial<Record<Entree, Picked | null>> = {};
    for (const slot of outil.entrees) {
      const i = remaining.findIndex(r => r.kind === (slot === "image2" ? "image" : slot));
      if (i < 0) continue;
      const [r] = remaining.splice(i, 1);
      placed[slot] = { url: media[r.path], path: r.path, name: r.name };
    }
    setInputs(placed);
    setText(outil.texte === "aucun" ? "" : draft.prompt);
    setConsent(false);
    setAsk(false);
    setOutcome(null);
  });


  useEffect(() => { setModelId(asked.id); setAsk(false); }, [asked.id]);
  useEffect(() => {
    function apply() {
      let saved: HandedSource | null = null;
      try {
        const raw = sessionStorage.getItem(SOURCE_KEY);
        if (!raw) return;
        saved = JSON.parse(raw) as HandedSource;
      } catch { return; }
      if (!saved || (saved.kind !== "image" && saved.kind !== "video")) {
        try { sessionStorage.removeItem(SOURCE_KEY); } catch { /* ignore */ }
        return;
      }
      const slot: Entree | null = saved.kind === "video" && outil.entrees.includes("video") ? "video"
        : saved.kind === "image" && outil.entrees.includes("image") ? "image"
        : null;
      if (!slot) {
        try { sessionStorage.removeItem(SOURCE_KEY); } catch { /* ignore */ }
        return;
      }
      const url = resolveStudioHandoff(saved, media);
      if (!url) return;
      try { sessionStorage.removeItem(SOURCE_KEY); } catch { /* ignore */ }
      const placed = saved;
      setInputs(current => ({ ...current, [slot]: { url, name: placed.name || "creation", path: placed.path } }));
      if ((placed.aspect === "horizontal" || placed.aspect === "vertical") && outil.reglages?.includes("aspect")) setAspect(placed.aspect);
    }
    apply();
    window.addEventListener("u-ttu-source", apply);
    return () => window.removeEventListener("u-ttu-source", apply);
  }, [outil.id, outil.entrees, outil.reglages, media]);
  // The creation bar hands its photos and references over once, in slot order (image, then image2).
  useEffect(() => {
    let raw: string | null = null;
    try { raw = sessionStorage.getItem(REFS_HANDOFF_KEY); } catch { return; }
    if (!raw || !raw.includes(`"tool":"${outil.id}"`)) return;
    const handed = takeHandoff(sessionStorage, REFS_HANDOFF_KEY, isRefsHandoff);
    if (!handed || handed.tool !== outil.id) return;
    const slots = outil.entrees.filter(slot => slot === "image" || slot === "image2");
    const placed: Partial<Record<Entree, Picked>> = {};
    handed.images.slice(0, slots.length).forEach((item, index) => {
      const url = item.path && media[item.path] ? media[item.path] : item.url;
      placed[slots[index]] = { url, name: item.name, path: item.path };
    });
    setInputs(current => ({ ...current, ...placed }));
  }, [outil.id, outil.entrees, media]);
  useEffect(() => {
    if (outil.texte === "aucun") return;
    try {
      const saved = sessionStorage.getItem("u-ttu-consigne");
      if (!saved) return;
      sessionStorage.removeItem("u-ttu-consigne");
      setText(saved);
    } catch { /* the field stays empty */ }
  }, [outil.id, outil.texte]);

  // A bridge (start and end frames) needs both pictures: two visible slots, « départ » and « arrivée ».
  const bridge = outil.template.endsWith("_flf2v");
  const main = bridge ? outil.entrees : outil.entrees.filter(item => item !== "image2");
  const refs = bridge ? [] : outil.entrees.filter(item => item === "image2");
  const slotName = (entree: Entree) => bridge && entree === "image" ? "start" : bridge && entree === "image2" ? "end" : entree;
  const reglages = [...(outil.reglages ?? []), ...(outil.moteur?.kind === "mesh" ? ["mesh" as const] : [])];
  const video = inputs.video;
  useEffect(() => {
    if (!video) { setSeconds(null); return; }
    let gone = false;
    void videoSeconds(video.url).then(value => { if (!gone) setSeconds(value); });
    return () => { gone = true; };
  }, [video]);

  const quote = useMemo(() => outilQuote(outil, { seconds: seconds ?? undefined, fluidifier: fluide, mesh }), [outil, seconds, fluide, mesh]);
  const busy = stage !== null;
  const missingInput = main.find(item => !inputs[item]);
  const missingText = outil.texte === "requis" && !text.trim();
  const needConsent = Boolean(outil.consentement && inputs.audio && !consent);
  const lowBalance = Boolean(quote && balance && balance.credits < quote.high);
  const action = outil.entrees.length === 0 || outil.famille === "3d" ? t(`outils.do.${outil.sortie}`) : titreCarte(t, outil.id);
  const lock = { disabled: busy, "aria-describedby": busy ? busyId : undefined };

  function set(entree: Entree, next: Picked | null) { setInputs(current => ({ ...current, [entree]: next })); setAsk(false); setOutcome(null); setWhy(""); }
  function reset() { setAsk(false); setOutcome(null); setWhy(""); }
  function pickModel(id: string) {
    setAsk(false);
    if (intentDe(id) !== intentDe(outil.id)) { openTool(id); return; }
    setModelId(id);
    const hash = `#outils/${id}`;
    if (window.location.hash !== hash) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
  }

  function press() {
    if (busy || creating) return;
    if (!connected) { setSheet("connect"); return; }
    if (etat.kind !== "pret") { setWhy(t("gestes.unwired")); return; }
    if (missingInput) { setWhy(t("outils.needInput", { what: t(`outils.kind.${slotName(missingInput)}`) })); return; }
    if (missingText) { setWhy(t("videoGeste.needText")); return; }
    if (needConsent) { setWhy(t("outils.needConsent")); return; }
    if (!quote) return;
    if (lowBalance) { setWhy(t("finaliser.needCeiling", { ceiling: formatCredits(quote.high) })); return; }
    setWhy("");
    setAsk(true);
  }

  async function launch() {
    if (!quote || sending.current || busy) return;
    sending.current = true;
    setAsk(false);
    setOutcome(null);
    setStage({ stage: "envoi" });
    const onStage = (next: FinaliseStage, at?: number) => setStage({ stage: next, seconds: at });
    try {
      const toFile = async (entree: Entree) => {
        const picked = inputs[entree];
        if (!picked) return undefined;
        if (picked.file) return picked.file;
        const kind = MEDIA[entree];
        if (kind === "audio") {
          const blob = await (await fetch(picked.url)).blob();
          return new File([blob], picked.name, { type: blob.type || typeFromName(picked.name, "audio/wav") });
        }
        return sourceFile(picked.url, picked.name, kind);
      };
      const images: File[] = [];
      if (outil.geste === "suite-prolonger" && inputs.video) {
        const frame = await lastFrame(inputs.video.url, inputs.video.name);
        if (!frame) throw new Error(t("suite.noFrame"));
        images.push(frame);
      }
      for (const entree of ["image", "image2"] as const) {
        const file = await toFile(entree);
        if (file) images.push(file);
      }
      const from = inputs.image?.path ?? inputs.video?.path;
      onResult?.(null);
      const result = await runOutil({ outil: outil.id, images, video: await toFile("video"), audio: await toFile("audio"), prompt: text, confirmed: true, aspect, elargir: side, fluidifier: fluide, seconds: seconds ?? undefined, mesh, consent, from, onStage });
      setOutcome(result);
      if (result.ok) onResult?.({ url: result.url, path: result.path, kind: outil.sortie, poster: inputs.image?.url, aspect: outil.reglages?.includes("aspect") ? aspect : undefined });
    } catch (error) {
      setOutcome({ ok: false, message: error instanceof Error && error.message ? error.message : t("create.failed") });
    } finally {
      sending.current = false;
      setStage(null);
    }
  }

  return <section className="u-tool-panel" data-tool-panel={intentDe(outil.id)} data-tool-model={outil.id} aria-labelledby={titleId}>
    <header className="u-tool-head">
      <h1 id={titleId} tabIndex={-1}>{titreCarte(t, outil.id)}</h1>
      <ToolSwitch current={outil.id} />
    </header>
    <p className="u-small">{ligneCarte(t, outil.id)}</p>
    <div className="u-tool-step u-model-card" data-tool-step="modele">
      <span className="u-label">{t("outils.model")}</span>
      <strong data-model-current="">{nomModele(t, outil.id)}</strong>
      <ModelMenu current={outil.id} onPick={pickModel} />
    </div>
    {main.length > 0 && <fieldset className="u-tool-step" data-tool-step="entree">
      <legend className="u-label">{t("outils.input")}</legend>
      {main.map(entree => <InputSlot key={entree} entree={entree} label={bridge ? t(`outils.slot.${slotName(entree)}`) : undefined} value={inputs[entree] ?? null} busy={busy} busyId={busyId} onChange={next => set(entree, next)} />)}
      {outil.consentement && inputs.audio && <button type="button" role="checkbox" className="u-final-confirm" aria-checked={consent} data-tool-consent="" {...lock} onClick={() => { setConsent(value => !value); reset(); }}>
        <span className="u-final-box" aria-hidden="true">{consent ? "✓" : ""}</span><span>{t("outils.consent")}</span>
      </button>}
    </fieldset>}
    {outil.texte !== "aucun" && <label className="u-field u-tool-step" data-tool-step="consigne">
      <span className="u-label">{t("outils.prompt")}{outil.texte === "facultatif" ? ` ${t("suite.optional")}` : ""}</span>
      <textarea rows={3} value={text} maxLength={1200} {...lock} onChange={event => { setText(event.target.value); reset(); }} />
    </label>}
    {refs.length > 0 && <Fold step="references" label={t("outils.refs")}>
      {refs.map(entree => <InputSlot key={entree} entree={entree} value={inputs[entree] ?? null} busy={busy} busyId={busyId} onChange={next => set(entree, next)} />)}
    </Fold>}
    {reglages.length > 0 && <Fold step="reglages" label={t("outils.settings")}>
      {reglages.includes("aspect") && <div className="u-choice-row" role="group" aria-label={t("outils.format")}>
        {(["horizontal", "vertical"] as const).map(id => <button key={id} type="button" className="u-chip" aria-pressed={aspect === id} data-tool-aspect={id} {...lock} onClick={() => { setAspect(id); reset(); }}>{t(`outils.aspect.${id}`)}</button>)}
      </div>}
      {reglages.includes("elargir") && <div className="u-choice-row" role="group" aria-label={t("suite.side")}>
        {(["cotes", "haut-bas", "tout"] as const).map(id => <button key={id} type="button" className="u-chip" aria-pressed={side === id} data-tool-side={id} {...lock} onClick={() => { setSide(id); reset(); }}>{t(`suite.sides.${id}`)}</button>)}
      </div>}
      {reglages.includes("mesh") && <div className="u-choice-row" role="group" aria-label={t("outils.settings")}>
        {(["objet", "perso"] as const).map(id => <button key={id} type="button" className="u-chip" aria-pressed={mesh === id} data-tool-mesh={id} {...lock} onClick={() => { setMesh(id); reset(); }}>{t(`outils.mesh.${id}`)}</button>)}
      </div>}
      {reglages.includes("fluide") && <button type="button" role="checkbox" className="u-final-confirm" aria-checked={fluide} data-tool-fluide="" {...lock} onClick={() => { setFluide(value => !value); reset(); }}>
        <span className="u-final-box" aria-hidden="true">{fluide ? "✓" : ""}</span><span>{t("suite.fluide")}</span>
      </button>}
    </Fold>}
    <button type="button" className="u-tool-go" data-tool-go="" aria-disabled={busy || undefined} aria-describedby={busy ? busyId : why ? whyId : undefined} onClick={press}>
      <span>{action}</span>
      {quote && <span className="u-tool-go-cost">{t("outils.cost", { credits: formatCredits(quote.credits) })}</span>}
    </button>
    {why && !busy && <p className="u-why" id={whyId} data-tool-why="">{why}</p>}
    {stage && <p className="u-small" id={busyId} aria-live="polite">{t(`finaliser.${stage.stage}`, { seconds: String(stage.seconds ?? 0) })} {t("finaliser.keepOpen")}</p>}
    {outcome && !outcome.ok && <p className="u-why" role="alert" data-tool-fail="">{outcome.message} {t("suite.intact")}</p>}
    {outcome?.ok && <p className="u-small" data-tool-done="">{t("suite.done")} {outcome.cost === null ? t("finaliser.costUnknown") : t("finaliser.cost", { credits: formatCredits(outcome.cost) })}</p>}
    {ask && quote && <div className="u-confirm-layer">
      <div role="dialog" aria-modal="true" aria-labelledby={askId} className="u-confirm" data-tool-ask="">
        <h2 id={askId}>{t("outils.confirmTitle")}</h2>
        <p>{t("outils.confirmBody", { credits: formatCredits(quote.credits) })}</p>
        <div className="u-confirm-actions">
          <button type="button" className="u-primary" data-tool-confirm="" onClick={() => void launch()}>{t("outils.confirmYes")}</button>
          <button type="button" className="u-link" data-tool-cancel="" onClick={() => setAsk(false)}>{t("outils.confirmNo")}</button>
        </div>
      </div>
    </div>}
  </section>;
}

/** The run just made in this tool: what came back, shown big, never a file name. */
export interface ToolRun { url: string; path: string; kind: Sortie; poster?: string; aspect?: "horizontal" | "vertical" }

/** The fresh result, big, with « Et ensuite ? » open and a way to Mes créations. Earlier runs stay in Mes créations. */
function ToolResult({ run, label }: { run: ToolRun; label: string }) {
  const { t } = useI18n();
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    // On a phone the result lands under the panel: bring it into view once.
    if (window.matchMedia("(max-width: 959px)").matches) root.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [run.url]);
  return <section ref={root} className="u-tool-result" data-tool-result={run.kind} aria-label={t("outils.result")}>
    <h2>{t("outils.result")}</h2>
    <div className="u-tool-result-media" data-aspect={run.aspect}>
      {run.kind === "image" && <img src={run.url} alt={t("outils.result")} />}
      {run.kind === "video" && <video src={run.url} controls playsInline preload="metadata" />}
      {run.kind === "audio" && <audio src={run.url} controls />}
      {run.kind === "mesh" && <>{run.poster && <img src={run.poster} alt="" />}<a className="u-primary" href={run.url} download>{t("outils.download")}</a></>}
    </div>
    {run.kind === "video" && run.path && <div className="u-fil-actions" data-tool-result-actions="">
      <MontageButton input={{ planId: "outils", label, seconds: 5, aspect: run.aspect ?? "horizontal", still: "", video: run.path, prompt: "", sceneName: "", composeur: "" }} />
    </div>}
    {(run.kind === "image" || run.kind === "video") && <EtEnsuite source={{ kind: run.kind, url: run.url, name: t("outils.result"), path: run.path || undefined, aspect: run.aspect }} defaultOpen />}
    <a className="u-link u-tool-result-lib" data-tool-result-lib="" href={assetPath("/mon-studio")}>{t("outils.inLibrary")}</a>
  </section>;
}

const RECENTS = "u-ttu-outils-recents";

/** Remembers the last tools opened (newest first, five at most). */
function useRecents(current: string): string[] {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    let saved: string[] = [];
    try { saved = JSON.parse(window.localStorage.getItem(RECENTS) ?? "[]") as string[]; } catch { saved = []; }
    const next = [current, ...saved.filter(id => id !== current && outilParId(id))].slice(0, 6);
    try { window.localStorage.setItem(RECENTS, JSON.stringify(next)); } catch { /* memory only */ }
    setList(next.filter(id => id !== current));
  }, [current]);
  return list;
}

/** The tool card's switch: recent tools and « Voir tous les outils », without leaving the panel. */
function ToolSwitch({ current }: { current: string }) {
  const { t } = useI18n();
  const { prefs } = useStudio();
  const recents = useRecents(current);
  const here = outilParId(current);
  const family = here ? outilsPublics(prefs).filter(item => familleVitrine(item) === familleVitrine(here) && intentDe(item.id) !== intentDe(current)).slice(0, 8) : [];
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const press = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", press, true);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", press, true); };
  }, [open]);
  return <div className="u-tool-switch" ref={root} data-tool-switch="">
    <button type="button" className="u-chip" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)}>{t("toolswitch.change")} <span aria-hidden="true">▾</span></button>
    <div id={menuId} className="u-tool-switch-panel" hidden={!open}>
      {recents.length > 0 && <>
        <p className="u-label">{t("toolswitch.recent")}</p>
        <ul role="list" className="u-dd-list">
          {recents.map(id => <li key={id}><button type="button" data-recent-outil={id} onClick={() => { setOpen(false); openTool(id); }}>{titreCarte(t, id)}</button></li>)}
        </ul>
      </>}
      {family.length > 0 && <>
        <p className="u-label">{t("toolswitch.family")}</p>
        <ul role="list" className="u-dd-list">
          {family.map(item => <li key={item.id}><button type="button" data-family-outil={item.id} onClick={() => { setOpen(false); openTool(item.id); }}>{titreCarte(t, item.id)}</button></li>)}
        </ul>
      </>}
      <button type="button" className="u-secondary" data-switch-all="" onClick={() => { setOpen(false); openTool(ALL_TOOLS_ID); }}>{t("outils.seeAll")}</button>
    </div>
  </div>;
}
