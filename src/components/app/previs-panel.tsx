"use client";

// Prévis mobile de la maquette : « Phrase → scène » (règles, sans modèle), objets,
// import .glb, trajet caméra par points-clés minutés, et « Générer en 3D » sur les
// templates Comfy officiels (Hunyuan3D 2.1, TRELLIS.2), devis estimé avant toute dépense.

import { ConnectLink } from "./connect-link";
import { useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { ComfyProgress, useComfyElapsed, typicalFor } from "./comfy-progress";
import { formatCredits } from "@/lib/credits";
import { composeScene } from "@/lib/maquette/phrase-scene";
import { MAX_KEYS, MAX_PROPS, PATH_SECONDS, addKeyframe, addProp, clearPath, nextKeyTime, removeKeyframe, removeProp, type PropKind } from "@/lib/maquette/scene";
import type { CastBody, MaquetteState } from "@/lib/maquette/state";
import { MESH_GESTES, type MeshGesteId } from "@/lib/render/mesh-gestes";
import { gesteParId } from "@/lib/workflows/registre";
import { useStudio, type FinaliseStage } from "./studio-session";

const KINDS: PropKind[] = ["caisse", "mur", "voiture", "arbre", "lampadaire", "table"];

export function PrevisPanel({ state, setState, cast, neutralName, recording, onRecord }: {
  state: MaquetteState;
  setState(update: (state: MaquetteState) => MaquetteState): void;
  cast: readonly CastBody[];
  neutralName: string;
  /** Seconds left while the previs films; 0 when idle. */
  recording: number;
  onRecord(): void;
}) {
  const { t } = useI18n();
  const { connected, creating, runMeshGeste, saveModel, loose, studio } = useStudio();
  const activeProject = useRef(studio.project);
  activeProject.current = studio.project;
  const importing = useRef(false);
  const models = loose.filter(item => /\.(glb|gltf)$/i.test(item.media));
  const [phrase, setPhrase] = useState("");
  const [understood, setUnderstood] = useState("");
  const [keyTime, setKeyTime] = useState(0);
  const [engine, setEngine] = useState<MeshGesteId>("prise-volume-perso");
  const [photo, setPhoto] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [stage, setStage] = useState<{ stage: FinaliseStage; seconds?: number } | null>(null);
  const meshElapsed = useComfyElapsed(Boolean(stage));
  const [meshNote, setMeshNote] = useState("");
  const path = state.path ?? [];
  const props = state.props ?? [];
  const busy = recording > 0;
  const row = gesteParId(engine);
  const fullProps = props.length >= MAX_PROPS;

  function compose() {
    if (!phrase.trim()) return;
    const result = composeScene(state, phrase, cast, neutralName);
    setState(() => result.state);
    const r = result.reading;
    const bits = [
      r.people !== null || r.names.length ? t("previs.agent.people", { n: String(result.state.figures.length) }) : "",
      r.props.length ? t("previs.agent.props", { list: r.props.map(kind => t(`previs.prop.${kind}`)).join(", ") }) : "",
      r.move ? t(`previs.move.${r.move}`) : "",
    ].filter(Boolean);
    setUnderstood(bits.length ? t("previs.agent.done", { list: bits.join(" · ") }) : t("previs.agent.none"));
    setKeyTime(nextKeyTime(result.state.path));
  }

  async function importGlb(file: File | undefined) {
    if (!file || fullProps || importing.current) return;
    importing.current = true;
    const project = studio.project;
    try {
      const source = await saveModel(file);
      if (project && activeProject.current !== project) return;
      setState(current => addProp(current, "glb", { name: file.name.replace(/\.(glb|gltf)$/i, ""), source, x: 0, z: -1.5 }));
    } catch (error) { setMeshNote(error instanceof Error ? (error.message.startsWith("previs.") ? t(error.message) : error.message) : t("create.failed")); }
    finally { importing.current = false; }
  }

  async function generate() {
    if (!photo || !confirmed || creating || stage || fullProps || !row) return;
    const project = studio.project;
    setMeshNote("");
    setStage({ stage: "envoi" });
    const result = await runMeshGeste({ geste: engine, file: photo, confirmed, onStage: (next, seconds) => setStage({ stage: next, seconds }) });
    setStage(null);
    setConfirmed(false);
    if (!result.ok) { setMeshNote(result.message); return; }
    URL.revokeObjectURL(result.url);
    if (project && activeProject.current !== project) return;
    setState(current => addProp(current, "glb", { name: t(`gestes.${row.clef}.title`), source: result.path, x: 0, z: -1.2 }));
    setMeshNote(`${t("previs.mesh.done")} ${result.cost === null ? t("finaliser.costUnknown") : t("finaliser.cost", { credits: formatCredits(result.cost) })}`);
  }

  const can3d = connected && Boolean(photo) && confirmed && !creating && !stage && !fullProps;
  const why3d = !connected ? t("videoGeste.needLink") : !photo ? t("previs.mesh.needPhoto") : fullProps ? t("previs.propsFull", { max: String(MAX_PROPS) }) : !confirmed ? t("videoGeste.needConfirm") : "";

  return <section className="u-previs-panel" data-previs-panel="" aria-labelledby="u-previs-title">
    <h2 id="u-previs-title" className="u-label">{t("previs.title")}</h2>
    <p className="u-small">{t("previs.touch")}</p>

    <div className="u-previs-block" data-phrase-scene="">
      <label className="u-field">
        <span className="u-label">{t("previs.agent.label")}</span>
        <textarea aria-label={t("previs.agent.label")} rows={2} maxLength={300} value={phrase} placeholder={t("previs.agent.placeholder")} disabled={busy} onChange={event => setPhrase(event.target.value)} />
      </label>
      <button type="button" className="u-chip" data-composer="" disabled={busy || !phrase.trim()} aria-describedby={busy ? "u-previs-busy" : !phrase.trim() ? "u-why-phrase" : undefined} onClick={compose}>{t("previs.agent.go")}</button>
      {!phrase.trim() && <p className="u-why" id="u-why-phrase">{t("previs.agent.why")}</p>}
      {understood && <p className="u-small" aria-live="polite" data-compris="">{understood}</p>}
    </div>

    <div className="u-previs-block">
      <p className="u-label">{t("previs.props")}</p>
      <div className="u-choice-row" role="group" aria-label={t("previs.props")}>
        {KINDS.map(kind => <button key={kind} type="button" className="u-chip" data-add-prop={kind} disabled={busy || fullProps} aria-describedby={busy ? "u-previs-busy" : fullProps ? "u-why-props" : undefined} onClick={() => setState(current => addProp(current, kind, { name: t(`previs.prop.${kind}`) }))}>＋ {t(`previs.prop.${kind}`)}</button>)}
        <label className="u-chip u-file-chip" data-import-glb="">
          {t("previs.glb")}
          <input type="file" accept=".glb,.gltf,model/gltf-binary" disabled={busy || fullProps} onChange={event => { void importGlb(event.target.files?.[0]); event.target.value = ""; }} />
        </label>
      </div>
      {fullProps && <p className="u-why" id="u-why-props">{t("previs.propsFull", { max: String(MAX_PROPS) })}</p>}
      {props.length > 0 && <ul className="u-figure-row">
        {props.map(prop => <li key={prop.id}>
          <span className="u-figure-name">{prop.kind === "glb" ? `◆ ${prop.name}` : t(`previs.prop.${prop.kind}`)}</span>
          <button type="button" className="u-chip" data-retirer-prop={prop.id} disabled={busy} aria-describedby={busy ? "u-previs-busy" : undefined} aria-label={t("r7.removeName", { name: prop.name })} onClick={() => setState(current => removeProp(current, prop.id))}>{t("r7.remove")}</button>
        </li>)}
      </ul>}
      <p className="u-small">{t("previs.glbNote")}</p>
      {models.length > 0 && <label className="u-field">
        <span className="u-label">{t("previs.savedModels")}</span>
        <select aria-label={t("previs.savedModels")} value="" disabled={busy || fullProps} onChange={event => {
          const model = models.find(item => item.media === event.target.value);
          if (model) setState(current => addProp(current, "glb", { name: model.name, source: model.media }));
        }}><option value="">{t("previs.chooseModel")}</option>{models.map(model => <option key={model.media} value={model.media}>{model.name}</option>)}</select>
      </label>}
    </div>

    <div className="u-previs-block" data-trajet="">
      <p className="u-label">{t("previs.path", { seconds: String(PATH_SECONDS) })}</p>
      <p className="u-small">{t("previs.pathLead")}</p>
      <label className="u-field u-previs-time">
        <span>{t("previs.keyAt", { t: keyTime.toFixed(1) })}</span>
        <input type="range" min={0} max={PATH_SECONDS} step={0.5} value={keyTime} disabled={busy} onChange={event => setKeyTime(Number(event.target.value))} />
      </label>
      <div className="u-choice-row">
        <button type="button" className="u-chip" data-add-key="" disabled={busy || path.length >= MAX_KEYS} aria-describedby={busy ? "u-previs-busy" : path.length >= MAX_KEYS ? "u-why-keys" : undefined} onClick={() => { setState(current => addKeyframe(current, keyTime)); setKeyTime(time => Math.min(PATH_SECONDS, time + 1)); }}>{t("previs.addKey")}</button>
        <button type="button" className="u-chip" data-clear-path="" disabled={busy || path.length === 0} aria-describedby={busy ? "u-previs-busy" : path.length === 0 ? "u-why-path" : undefined} onClick={() => setState(current => clearPath(current))}>{t("previs.clearPath")}</button>
      </div>
      {path.length > 0
        ? <ol className="u-keys" data-keys-list="">{path.map(key => <li key={key.t}>
          <span>{key.t.toFixed(1)} s</span>
          <button type="button" className="u-chip" disabled={busy} aria-describedby={busy ? "u-previs-busy" : undefined} aria-label={t("previs.removeKey", { t: key.t.toFixed(1) })} onClick={() => setState(current => removeKeyframe(current, key.t))}>✕</button>
        </li>)}</ol>
        : <p className="u-why" id="u-why-path">{t("previs.noPath")}</p>}
      <button type="button" className="u-chip u-previs-film" data-filmer-previs="" disabled={busy} aria-describedby={busy ? "u-previs-busy" : undefined} onClick={onRecord}>
        {busy ? t("videoGeste.previsRecording", { seconds: String(recording) }) : t("previs.film", { seconds: String(PATH_SECONDS) })}
      </button>
      <p className="u-small" id={busy ? "u-previs-busy" : undefined} aria-live="polite">{t(path.length > 1 ? "previs.filmPath" : "previs.filmFree")}</p>
      {path.length >= MAX_KEYS && <p className="u-why" id="u-why-keys">{t("previs.keysFull", { max: String(MAX_KEYS) })}</p>}
    </div>

    <div className="u-previs-block" data-generer-3d="">
      <p className="u-label">{t("previs.mesh.title")}</p>
      <div className="u-choice-row" role="group" aria-label={t("previs.mesh.title")}>
        {MESH_GESTES.map(id => { const item = gesteParId(id); return item && <button key={id} type="button" className="u-chip" data-mesh={id} aria-pressed={engine === id} disabled={Boolean(stage)} aria-describedby={stage ? "u-mesh-busy" : undefined} onClick={() => { setEngine(id); setConfirmed(false); }}>{t(`gestes.${item.clef}.title`)}</button>; })}
      </div>
      {row && <p className="u-small">{t(`gestes.${row.clef}.phrase`)}</p>}
      {engine === "prise-volume-perso" && <p className="u-small">{t("previs.hunyuanTerms")} <a href="https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">{t("previs.modelTerms")}</a></p>}
      <label className="u-field u-video-file">
        <span className="u-label">{t("previs.mesh.photo")}</span>
        <input type="file" accept="image/*" disabled={Boolean(stage)} onChange={event => { setPhoto(event.target.files?.[0] ?? null); setConfirmed(false); }} />
      </label>
      {row && row.credits !== null && row.high !== null && <>
        <div className="u-final-quote" data-mesh-quote="estime">
          <p className="u-cost">{t("videoGeste.quote", { credits: formatCredits(row.credits), ceiling: formatCredits(row.high) })}</p>
          <p className="u-small">{t("previs.mesh.estimate")}</p>
        </div>
        <button type="button" role="checkbox" className="u-final-confirm" aria-checked={confirmed} disabled={Boolean(stage)} aria-describedby={stage ? "u-mesh-busy" : undefined} onClick={() => setConfirmed(current => !current)}>
          <span className="u-final-box" aria-hidden="true">{confirmed ? "✓" : ""}</span>
          <span>{t("videoGeste.confirm", { ceiling: formatCredits(row.high) })}</span>
        </button>
        <button type="button" className="u-secondary" data-mesh-go="" disabled={!can3d} aria-describedby={why3d ? "u-why-mesh" : undefined} onClick={() => void generate()}>{t("previs.mesh.go", { credits: formatCredits(row.credits) })}</button>
      </>}
      {why3d && !stage && <p className="u-why" id="u-why-mesh">{why3d}</p>}
      {why3d && !stage && <ConnectLink />}
      {stage && <div id="u-mesh-busy"><ComfyProgress label={t(`finaliser.${stage.stage}`, { seconds: String(stage.seconds ?? meshElapsed) })} elapsedSec={stage.seconds ?? meshElapsed} typicalSec={typicalFor("mesh")} note={t("finaliser.keepOpen")} marker="mesh" /></div>}
      {meshNote && <p className="u-small" role="status">{meshNote}</p>}
    </div>
  </section>;
}
