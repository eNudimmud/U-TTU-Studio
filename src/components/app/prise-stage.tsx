"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { assetPath } from "@/lib/site";
import { DEMO_CAST, DEMO_DECOR } from "@/lib/creation/demo";
import {
  ACTION_EXAMPLES, ACTION_MAX, CADRAGE_LABEL, CADRAGES, CAMERA_LABEL, CAMERAS,
  CHOISIS, DUREE_DIX, ETAT_LABEL, PAS_MESURE, TOURNE_DABORD, TROIS,
  type Cadrage, type CameraMove, type PlanEtat,
} from "@/lib/prise/copy";
import { decide, emptyPlan, hasAnchor, primaryIntent, type Decision, type PlanInput } from "@/lib/prise/decision";
import { chooseFinaliser, finaliserDefaults, type FinaliserInput, type FinalMedia } from "@/lib/prise/finaliser";
import { buildPrompt } from "@/lib/prise/prompt";
import { moveId, planFromJson, planMarkdown, planStateFromJson, priseMarkdown, type StoredPlan } from "@/lib/prise/vault";
import type { Shot } from "@/lib/coffre/model";
import { useI18n } from "@/components/i18n/provider";
import { useFormat } from "./format-switch";
import { useStudio } from "./studio-session";

type Seed = "vide" | "compose" | "final";

interface Draft {
  id: string;
  name: string;
  input: PlanInput;
  kept: boolean;
  finalised: boolean;
  hasTake: boolean;
  before: string;
  after: string;
}

function fr(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function etatOf(draft: Draft): PlanEtat {
  if (draft.finalised) return "finalisee";
  if (draft.kept) return "gardee";
  if (draft.hasTake) return "prise";
  if (draft.input.imageCle === "validee") return "validee";
  if (draft.input.imageCle === "proposee") return "image-cle";
  return "vide";
}

function personSrc(preview: string | null | undefined, sheet: string | null | undefined, media: Record<string, string>): string {
  if (preview) return assetPath(preview);
  if (sheet && media[sheet]) return media[sheet];
  return "";
}

export function PriseStage({ goCast, goDecor, onMontage }: { goCast(): void; goDecor(): void; onMontage(): void }) {
  const { ready, cast, decor, media, studio, requestRun, writeProjectFile, pickCast, pickDecor, run, cancelRun } = useStudio();
  const { t } = useI18n();
  const { format } = useFormat();
  const [seed, setSeed] = useState<Seed>("vide");
  const [drafts, setDrafts] = useState<Draft[]>(() => [blank("plan-01", "Plan 01", "16:9")]);
  const [currentId, setCurrentId] = useState("plan-01");
  const [dragId, setDragId] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const [mediaKind, setMediaKind] = useState<FinalMedia>("video");
  const [finaliser, setFinaliser] = useState<FinaliserInput>(finaliserDefaults("video", 5));
  const [details, setDetails] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [ask, setAsk] = useState<"composer" | null>(null);
  const booted = useRef(false);

  useEffect(() => {
    if (!ready || booted.current) return;
    booted.current = true;
    const asked = new URLSearchParams(window.location.search).get("prise");
    if (asked === "compose" || asked === "final") {
      const next = demoDraft(asked, format);
      setSeed(asked);
      setDrafts([next]);
      setCurrentId(next.id);
      setPanel(asked === "final");
      setFinaliser(finaliserDefaults("video", next.input.duree));
      return;
    }
    const stored = studio.shots.filter(shot => shot.composeur);
    if (stored.length === 0) return;
    const next = stored
      .slice()
      .sort((a, b) => a.ordre - b.ordre)
      .map(shot => draftFromShot(shot, format));
    setDrafts(next);
    setCurrentId(next[0]?.id ?? "plan-01");
  }, [ready, format, studio.shots]);

  const people = useMemo(() => {
    const cards = cast.length > 0 ? cast : seed === "vide" ? [] : DEMO_CAST;
    return cards.map(card => ({
      id: card.id,
      name: card.name,
      planche: Boolean(card.sheet),
      src: personSrc(card.preview, card.sheet, media),
    }));
  }, [cast, media, seed]);

  const places = useMemo(() => {
    if (decor.length > 0) {
      return decor.map(card => ({
        id: card.id,
        name: card.name,
        note: card.prompt ?? "",
        src: card.preview ? assetPath(card.preview) : card.sheet && media[card.sheet] ? media[card.sheet] : "",
      }));
    }
    if (seed === "vide") return [];
    return DEMO_DECOR.map(card => ({ id: card.id, name: card.name, note: card.prompt, src: card.preview ? assetPath(card.preview) : "" }));
  }, [decor, media, seed]);

  const index = Math.max(0, drafts.findIndex(item => item.id === currentId));
  const draft = drafts[index] ?? drafts[0];
  const previous = index > 0 ? drafts[index - 1] : null;

  function patch(partial: Partial<PlanInput>) {
    const next = drafts.map(item => item.id === draft.id ? { ...item, input: { ...item.input, ...partial, format } } : item);
    setDrafts(next);
    setAsk(null);
    persist(next);
  }

  useEffect(() => {
    setDrafts(list => list.map(item => item.input.format === format ? item : { ...item, input: { ...item.input, format } }));
  }, [format]);

  if (!draft) return null;

  const chosen = draft.input.castIds.flatMap(id => {
    const person = people.find(item => item.id === id);
    return person ? [{ name: person.name, planche: person.planche }] : [];
  });
  const input: PlanInput = {
    ...draft.input,
    format,
    castNames: chosen.map(person => person.name),
    castPlanche: chosen.map(person => person.planche),
    decorName: places.find(place => place.id === draft.input.decorId)?.name ?? "",
    decorNote: places.find(place => place.id === draft.input.decorId)?.note ?? "",
    speakerName: draft.input.speakerName || people.find(person => person.id === draft.input.castIds[0])?.name || "",
    previousKept: Boolean(previous && (previous.kept || previous.finalised)),
    hasKeptTake: draft.kept || draft.finalised,
  };
  const intent = primaryIntent(input);
  const cardDecision = decide(input, intent);
  const composer = decide(input, "composer");
  const essai = decide(input, "essai");
  const tourner = decide(input, "tourner");
  const fin = chooseFinaliser({ ...finaliser, media: mediaKind, seconds: input.duree });
  const showFinal = panel || draft.finalised;
  const prompt = buildPrompt(input, showFinal ? { graph: fin.graph, son: false } : cardDecision);
  const etat = etatOf(draft);
  const total = drafts.reduce((sum, item) => sum + item.input.duree, 0);
  const previewSrc = draft.before || places.find(place => place.id === input.decorId)?.src || people.find(person => person.id === input.castIds[0])?.src || "";

  function persist(next: Draft[], focus = draft.id) {
    const shot = next.find(item => item.id === focus);
    if (!shot) return;
    const ordre = next.findIndex(item => item.id === focus);
    const decision = decide({ ...shot.input, format }, primaryIntent({ ...shot.input, format }));
    const record: StoredPlan = {
      id: shot.id,
      name: shot.name,
      ordre,
      etat: etatOf(shot),
      input: { ...shot.input, format },
      graph: decision.graph ?? "",
      pourquoi: decision.pourquoi,
      takeIds: [],
      imageCle: shot.before,
      imageFin: "",
      finalVideo: shot.finalised ? shot.after : "",
    };
    void writeProjectFile(`Shots/${shot.id}.md`, planMarkdown(record));
  }

  function addPlan() {
    const n = drafts.length + 1;
    const id = `plan-${String(n).padStart(2, "0")}`;
    const next = [...drafts, blank(id, `Plan ${String(n).padStart(2, "0")}`, format)];
    setDrafts(next);
    setCurrentId(id);
    setPanel(false);
    persist(next, id);
  }

  function dropOn(id: string) {
    if (!dragId || dragId === id) return;
    const order = moveId(drafts.map(item => item.id), dragId, id);
    const next = order.flatMap(key => {
      const found = drafts.find(item => item.id === key);
      return found ? [found] : [];
    });
    setDrafts(next);
    setDragId(null);
    persist(next, id);
  }

  function toggleCast(id: string) {
    const selected = input.castIds.includes(id);
    if (!selected && input.castIds.length >= 3) return;
    const castIds = selected ? input.castIds.filter(item => item !== id) : [...input.castIds, id];
    patch({ castIds });
    if (!selected && cast.some(card => card.id === id)) void pickCast(id);
  }

  function choosePlace(id: string) {
    const on = input.decorId === id;
    patch({ decorId: on ? null : id });
    if (!on && decor.some(card => card.id === id)) void pickDecor(id);
  }

  function keep() {
    if (!(draft.hasTake || draft.kept || draft.finalised)) return;
    const next = drafts.map(item => item.id === draft.id ? { ...item, kept: true } : item);
    setDrafts(next);
    setPanel(true);
    setFinaliser(finaliserDefaults("video", input.duree));
    persist(next);
    const video = `Prises/${draft.id}-prise.mp4`;
    void writeProjectFile(`Prises/${draft.id}-prise.md`, priseMarkdown({
      id: `${draft.id}-prise`,
      planId: draft.id,
      template: tourner.graph ?? "",
      entrees: [...input.castIds.map(id => `Cast/${id}`), ...(input.decorId ? [`Lieux/${input.decorId}`] : [])],
      camera: input.camera,
      duree: input.duree,
      devis: tourner.quote ?? "inconnu",
      plafond: tourner.cap,
      cout: 0,
      promptId: "",
      etat: "gardee",
      date: "2026-10-08",
      video,
      finalVideo: "",
      prompt: prompt.text,
    }));
  }

  const card = showFinal
    ? {
      titre: "Finaliser",
      mots: fin.sentence,
      pourquoi: fin.sentence,
      quote: fin.quote,
      cap: fin.cap,
      statut: fin.statut,
      graph: fin.graph,
      enabled: fin.enabled,
      reason: fin.reason,
    }
    : cardDecision;

  return <section className="u-stage u-prise" data-section="prise" data-prise-ready={ready ? "true" : undefined} data-prise-seed={seed} aria-labelledby="u-title">
    <aside className="u-prise-strip" aria-label="Plans">
      <p className="u-label">Plans</p>
      <div className="u-prise-film">
        {drafts.map((item, at) => {
          const mark = etatOf(item);
          const thumb = item.before || "";
          return <button
            key={item.id}
            type="button"
            className="u-plan-card"
            draggable
            aria-current={item.id === draft.id ? "true" : undefined}
            data-etat={mark}
            onDragStart={() => setDragId(item.id)}
            onDragOver={event => event.preventDefault()}
            onDrop={() => dropOn(item.id)}
            onClick={() => { setCurrentId(item.id); setPanel(item.finalised || item.kept); setAsk(null); }}
          >
            <span className="u-plan-num">{String(at + 1).padStart(2, "0")}</span>
            <span className="u-plan-thumb">{thumb ? <img src={thumb} alt="" /> : <i />}</span>
            <span className="u-plan-etat">{ETAT_LABEL[mark]}</span>
            <span className="u-plan-time">{item.input.duree} s</span>
          </button>;
        })}
        <button type="button" className="u-plan-add" onClick={addPlan}>＋ Plan</button>
      </div>
      <p className="u-plan-sum">Séquence : {clock(total)} / {drafts.length} {drafts.length > 1 ? "plans" : "plan"}</p>
    </aside>

    <div className="u-prise-side">
    <div className="u-prise-preview">
      <p className="u-label">Aperçu</p>
      {run.phase === "running" && <div className="u-card u-run" role="status">
        <p className="u-run-label">{t("job.running")}</p>
        <button type="button" className="u-link" onClick={cancelRun}>{t("verb.cancel")}</button>
      </div>}
      {draft.finalised && draft.before && draft.after
        ? <Compare before={draft.before} after={draft.after} ratio={format} />
        : <div className="u-prise-frame" data-ratio={format}>
          {previewSrc ? <img src={previewSrc} alt="" /> : <span className="u-prise-empty">Aucune image</span>}
        </div>}
      {(etat === "gardee" || etat === "finalisee") && <button type="button" className="u-link" data-lire-sequence="" onClick={onMontage}>Voir au montage</button>}
    </div>

    <aside className="u-prise-dock" aria-label="Ce que l'app va faire">
      <div className="u-prise-card" id="u-prise-card" data-row={showFinal ? "final" : cardDecision.row}>
        <p className="u-label">Ce que l'app va faire</p>
        <h2>{card.titre || "En attente"}</h2>
        {card.mots && <p>{card.mots}</p>}
        {card.pourquoi && card.pourquoi !== card.mots && <p>{card.pourquoi}</p>}
        <p className="u-prise-quote">
          {card.quote === null ? "Devis : inconnu" : `Devis : ${fr(card.quote)} · ${card.statut === "mesure" ? "mesuré" : card.statut === "hypothese" ? "hypothèse" : "inconnu"}`}
          {card.cap !== null && ` · Plafond ${fr(card.cap)}`}
        </p>
        <button type="button" className="u-link" aria-expanded={details} onClick={() => setDetails(open => !open)}>Détails</button>
        {details && <div className="u-prise-details">
          {card.graph && <p>Graphe : {card.graph}</p>}
          {showFinal && fin.graphs.filter(item => !item.choisi).map(item => <p key={item.id}>{item.role} : {item.note}</p>)}
          <button type="button" className="u-link" aria-expanded={textOpen} onClick={() => setTextOpen(open => !open)}>Texte envoyé</button>
          {textOpen && <textarea className="u-prise-prompt" readOnly value={prompt.text} aria-label="Texte envoyé" />}
        </div>}
      </div>

      {showFinal && <FinalPanel
        value={{ ...finaliser, media: mediaKind, seconds: input.duree }}
        onMedia={next => { setMediaKind(next); setFinaliser(finaliserDefaults(next, input.duree)); }}
        onChange={setFinaliser}
        plan={fin}
      />}

      <div className="u-prise-actions">
        {!showFinal && <>
          <ActionButton
            gold
            marker="data-composer-gold"
            label={input.imageCle === "validee" ? "Refaire l'image" : "1 · Composer l'image"}
            decision={composer}
            onClick={() => { if (composer.enabled) setAsk("composer"); }}
          />
          {ask === "composer" && composer.enabled && <p className="u-why" id="u-why-branch">L'envoi de l'image clé n'est pas branché dans cette version. Rien ne part.</p>}
          <ActionButton label="2 · Tourner" decision={tourner} onClick={() => {}} />
          <ActionButton label="Essai rapide" decision={essai} onClick={() => { if (essai.enabled) void requestRun(); }} />
        </>}
        <button type="button" className="u-secondary" aria-pressed={draft.kept || draft.finalised} disabled={!(draft.hasTake || draft.kept || draft.finalised)} aria-describedby={draft.hasTake || draft.kept || draft.finalised ? undefined : "u-why-garder"} onClick={keep}>★ Garder</button>
        {!(draft.hasTake || draft.kept || draft.finalised) && <p className="u-why" id="u-why-garder">{TOURNE_DABORD}</p>}
        {(draft.kept || draft.finalised) && !showFinal && <button type="button" className="u-primary" disabled aria-describedby="u-why-final" onClick={() => setPanel(true)}>Finaliser (agrandir)</button>}
        {(draft.kept || draft.finalised) && !showFinal && <p className="u-why" id="u-why-final">{fin.reason || PAS_MESURE}</p>}
        {!hasAnchor(input) && <p className="u-why">{CHOISIS}</p>}
      </div>
    </aside>
    </div>

    <div className="u-prise-work">
      <header className="u-prise-head">
        <h1 id="u-title" tabIndex={-1}>{draft.name}</h1>
        <p className="u-plan-etat">{ETAT_LABEL[etat]}</p>
      </header>

      <Row label="Qui ?">
        <div className="u-choice-row">
          {people.map(person => {
            const on = input.castIds.includes(person.id);
            const blocked = !on && input.castIds.length >= 3;
            return <button key={person.id} type="button" className="u-avatar" aria-pressed={on} disabled={blocked} aria-describedby={blocked ? "u-why-trois" : undefined} onClick={() => toggleCast(person.id)}>
              <span className="u-avatar-face">{person.src ? <img src={person.src} alt="" /> : <i />}</span>
              <span>{person.name}</span>
            </button>;
          })}
          <button type="button" className="u-avatar" onClick={goCast}><span className="u-avatar-face"><i /></span><span>＋</span></button>
        </div>
        {input.castIds.length >= 3 && <p className="u-why" id="u-why-trois">{TROIS}</p>}
      </Row>

      <Row label="Où ?">
        <div className="u-choice-row">
          {places.map(place => {
            const on = input.decorId === place.id;
            return <button key={place.id} type="button" className="u-place" aria-pressed={on} onClick={() => choosePlace(place.id)}>
              <span className="u-place-face">{place.src ? <img src={place.src} alt="" /> : <i />}</span>
              <span>{place.name}</span>
            </button>;
          })}
          <button type="button" className="u-place" onClick={goDecor}><span className="u-place-face"><i /></span><span>＋ Lieu</span></button>
        </div>
      </Row>

      <Row label="Cadrage">
        <div className="u-choice-row">
          {CADRAGES.map(id => (
            <button key={id} type="button" className="u-tile" aria-pressed={input.cadrage === id} onClick={() => patch({ cadrage: id })}>
              <FrameIcon kind={id} />
              <span>{CADRAGE_LABEL[id]}</span>
            </button>
          ))}
        </div>
      </Row>

      <Row label="Action">
        <label className="u-field">
          <span className="u-label">Ce qui se passe</span>
          <textarea value={input.action} rows={2} maxLength={ACTION_MAX} placeholder={ACTION_PLACEHOLDER} onChange={event => patch({ action: event.target.value })} />
        </label>
        <div className="u-choice-row">
          {ACTION_EXAMPLES.map(example => (
            <button key={example} type="button" className="u-chip" aria-pressed={input.action === example} onClick={() => patch({ action: example })}>{example}</button>
          ))}
        </div>
      </Row>

      <Row label="Caméra">
        <div className="u-choice-row">
          {CAMERAS.map(id => (
            <button key={id} type="button" className="u-tile u-cam-tile" data-cam={id} aria-pressed={input.camera === id} onClick={() => patch({ camera: id })}>
              <CameraIcon kind={id} />
              <span>{CAMERA_LABEL[id]}</span>
            </button>
          ))}
        </div>
      </Row>

      <Row label="Durée">
        <div className="u-choice-row">
          {([5, 8] as const).map(seconds => (
            <button key={seconds} type="button" className="u-tile" aria-pressed={input.duree === seconds} onClick={() => patch({ duree: seconds })}>{seconds} s</button>
          ))}
          <button type="button" className="u-tile" disabled aria-describedby="u-why-dix">10 s</button>
        </div>
        <p className="u-why" id="u-why-dix">{DUREE_DIX}</p>
      </Row>

      <details className="u-fold">
        <summary>Paroles · {input.paroles === "aucune" ? "Aucune" : input.paroles === "voix-off" ? "Voix off" : "Réplique"}</summary>
        <div className="u-choice-row">
          {(["aucune", "replique", "voix-off"] as const).map(mode => (
            <button key={mode} type="button" className="u-tile" aria-pressed={input.paroles === mode} onClick={() => patch({ paroles: mode })}>
              {mode === "aucune" ? "Aucune" : mode === "replique" ? "Réplique" : "Voix off"}
            </button>
          ))}
        </div>
        {input.paroles === "replique" && <>
          <div className="u-choice-row">
            {input.castIds.map(id => {
              const person = people.find(item => item.id === id);
              if (!person) return null;
              return <button key={id} type="button" className="u-chip" aria-pressed={input.speakerName === person.name || (!input.speakerName && input.castIds[0] === id)} onClick={() => patch({ speakerName: person.name })}>{person.name}</button>;
            })}
          </div>
          <label className="u-field">
            <span className="u-label">La phrase</span>
            <textarea value={input.replique} rows={2} maxLength={ACTION_MAX} onChange={event => patch({ replique: event.target.value })} />
          </label>
        </>}
      </details>

      <details className="u-fold">
        <summary>Enchaîner · {input.enchainer ? "oui" : "non"}</summary>
        <button type="button" className="u-tile" aria-pressed={input.enchainer} onClick={() => patch({ enchainer: !input.enchainer })}>Commencer là où le plan précédent s'arrête</button>
        {!input.previousKept && input.enchainer && <p className="u-why">Le plan précédent n'est pas encore gardé.</p>}
        <button type="button" className="u-tile" aria-pressed={input.imageFin} onClick={() => patch({ imageFin: !input.imageFin })}>Imposer l'image de fin</button>
      </details>
    </div>

  </section>;
}

const ACTION_PLACEHOLDER = "reste immobile, respire";

function blank(id: string, name: string, format: PlanInput["format"]): Draft {
  return { id, name, input: emptyPlan(format), kept: false, finalised: false, hasTake: false, before: "", after: "" };
}

function demoDraft(seed: "compose" | "final", format: PlanInput["format"]): Draft {
  const input = emptyPlan(format);
  input.castIds = ["demo-mira", "demo-coursiere"];
  input.decorId = "demo-quai";
  input.cadrage = "moyen";
  input.camera = "travelling-avant";
  input.action = "se retourne";
  input.duree = 5;
  if (seed === "final") {
    input.imageCle = "validee";
    return {
      id: "plan-03",
      name: "Plan 03",
      input,
      kept: true,
      finalised: true,
      hasTake: true,
      before: assetPath("/exemples/decor-quai-nuit.webp"),
      after: assetPath("/exemples/decor-gare.webp"),
    };
  }
  return { id: "plan-03", name: "Plan 03", input, kept: false, finalised: false, hasTake: false, before: "", after: "" };
}

function draftFromShot(shot: Shot, format: PlanInput["format"]): Draft {
  const input = planFromJson(shot.composeur, emptyPlan(format));
  const state = planStateFromJson(shot.composeur);
  return {
    id: shot.id,
    name: shot.name || shot.id,
    input,
    kept: state.etat === "gardee" || state.etat === "finalisee",
    finalised: state.etat === "finalisee",
    hasTake: state.etat === "prise" || state.etat === "gardee" || state.etat === "finalisee" || shot.takeIds.length > 0,
    before: state.before,
    after: state.after,
  };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="u-prise-row">
    <p className="u-label">{label}</p>
    {children}
  </div>;
}

function ActionButton({ label, decision, onClick, gold = false }: { label: string; decision: Decision; onClick(): void; gold?: boolean; marker?: string }) {
  const price = decision.quote !== null ? ` · ${fr(decision.quote)}` : "";
  const whyId = `u-why-${decision.intent}`;
  return <>
    <button type="button" className={gold ? "u-primary" : "u-secondary"} data-composer-gold={gold ? "" : undefined} data-intent={decision.intent} disabled={!decision.enabled} aria-describedby={decision.enabled ? undefined : whyId} onClick={onClick}>{label}{price}</button>
    {!decision.enabled && decision.reason && <p className="u-why" id={whyId}>{decision.reason}</p>}
    {decision.enabled && decision.cap !== null && <p className="u-ceiling">Plafond {fr(decision.cap)} · {decision.statut === "mesure" ? "mesuré" : "hypothèse"}</p>}
  </>;
}

function FinalPanel({ value, onMedia, onChange, plan }: {
  value: FinaliserInput;
  onMedia(next: FinalMedia): void;
  onChange(next: FinaliserInput): void;
  plan: ReturnType<typeof chooseFinaliser>;
}) {
  return <div className="u-final" data-finaliser="">
    <p className="u-label">Finaliser</p>
    <div className="u-choice-row" role="group" aria-label="Ce qu'on agrandit">
      <button type="button" className="u-tile" aria-pressed={value.media === "video"} onClick={() => onMedia("video")}>La prise</button>
      <button type="button" className="u-tile" aria-pressed={value.media === "image"} onClick={() => onMedia("image")}>L'image</button>
    </div>
    <p className="u-label">Résolution</p>
    <div className="u-choice-row">
      <button type="button" className="u-tile" aria-pressed={value.resolution === "1080p"} onClick={() => onChange({ ...value, resolution: "1080p" })}>1080p</button>
      <button type="button" className="u-tile" disabled aria-describedby="u-why-4k" aria-pressed={false}>4K</button>
    </div>
    <p className="u-why" id="u-why-4k">{plan.resolution4k.reason}</p>
    <button type="button" className="u-tile" aria-pressed={value.nettete} onClick={() => onChange({ ...value, nettete: !value.nettete })}>Netteté et détails</button>
    {value.media === "video" && <button type="button" className="u-tile" aria-pressed={value.fluidifier} onClick={() => onChange({ ...value, fluidifier: !value.fluidifier })}>Fluidifier</button>}
    <p className="u-prise-quote">{plan.quote === null ? "Devis : inconnu" : `Devis : ${fr(plan.quote)} · hypothèse`}{plan.cap !== null ? ` · Plafond ${fr(plan.cap)}` : ""}</p>
    <button type="button" className="u-primary" disabled aria-describedby="u-why-final-go">Finaliser (agrandir)</button>
    <p className="u-why" id="u-why-final-go">{plan.reason}</p>
  </div>;
}

function Compare({ before, after, ratio }: { before: string; after: string; ratio: string }) {
  const [pos, setPos] = useState(58);
  return <div className="u-compare">
    <p className="u-compare-legend"><span>Avant</span><span>Après</span></p>
    <div className="u-prise-frame" data-ratio={ratio}>
      <img src={after} alt="" />
      <img src={before} alt="" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
    </div>
    <input type="range" min={0} max={100} value={pos} aria-label="Comparer avant et après" onChange={event => setPos(Number(event.target.value))} />
  </div>;
}

function FrameIcon({ kind }: { kind: Cadrage }) {
  const person = kind === "tgp" ? 3 : kind === "gros" ? 5 : kind === "americain" ? 7 : kind === "large" ? 4 : 6;
  return <svg className="u-ico" viewBox="0 0 32 24" aria-hidden="true">
    <rect x="1.5" y="1.5" width="29" height="21" rx="2" />
    {kind === "plongee" && <path d="M16 3 12 8h8z" />}
    {kind === "contre" && <path d="M16 21 12 16h8z" />}
    {kind === "epaule" && <path d="M4 18c4-6 8-6 12 0" />}
    <circle cx={kind === "epaule" ? 20 : 16} cy={kind === "plongee" ? 14 : 11} r={person > 5 ? 2.2 : 3} />
    {person > 4 && <path d={`M${kind === "epaule" ? 20 : 16} ${kind === "plongee" ? 17 : 14} v${person}`} />}
  </svg>;
}

function CameraIcon({ kind }: { kind: CameraMove }) {
  return <svg className="u-ico u-cam-ico" viewBox="0 0 32 24" aria-hidden="true">
    <g className="u-cam-move" data-cam={kind}>
      <rect x="3" y="7" width="16" height="11" rx="2" />
      <path d="M19 11.5 28 7.5v10l-9-4z" />
    </g>
  </svg>;
}
