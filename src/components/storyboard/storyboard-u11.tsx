"use client";

// U1.1 · one story, one plan, one place to ask for a change, the price only at approval.
// Writing and editing stay on this device (0 credits). Filming uses the existing queue and only starts
// from « Start filming ». A shot already running is never cancelled.

import { useMessages } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { assetPath } from "@/lib/site";
import { opensPicker } from "@/lib/creation/mentions";
import { appliquerCorrection } from "@/lib/storyboard/corriger";
import { devisStoryboard, reglagesDuPlan } from "@/lib/storyboard/devis";
import type { ContexteEcriture, Gabarits } from "@/lib/storyboard/ecrire";
import { appliquerATous, appliquerNote, ciblesNote, lireDemande } from "@/lib/storyboard/note";
import { ecrireDepuisRecit, type EcritRecit } from "@/lib/storyboard/recit";
import {
  dureeTotale, tousLesPlans, trouverPlan, type DureeCible, type Format, type PlanSB, type Rendu, type Storyboard,
} from "@/lib/storyboard/storyboard";
import { useStudio } from "../app/studio-session";
import { useRefPicture } from "./storyboard-ui";
import type { Storyboards } from "./use-storyboards";
import "./storyboard-u11.css";

const nouvelId = () => Math.random().toString(36).slice(2, 8);

function tone(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 38% 46%)`;
}

function namedIn(text: string, name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}@])@?${escaped}(?![\\p{L}\\p{N}])`, "iu").test(text);
}

function lignes(plan: PlanSB): { qui: string | null; texte: string }[] {
  const found = [...plan.dialogue.texte.matchAll(/([\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,3})\s*:\s*[«"“„]([^»"”“]+)[»"”“]/gu)];
  if (found.length) return found.map(match => ({ qui: match[1]!.trim(), texte: match[2]!.trim() }));
  if (plan.dialogue.texte.trim()) return [{ qui: plan.dialogue.qui, texte: plan.dialogue.texte.trim() }];
  return [];
}

function Sketch({ plan, caption }: { plan: PlanSB; caption?: string }) {
  const picture = useRefPicture();
  const place = plan.refs.find(ref => ref.role === "ou");
  const who = plan.refs.filter(ref => ref.role === "qui");
  const src = place ? picture(place) : "";
  const rainy = /\brain\b|pluie|regen|\blluvia\b/i.test(`${plan.titre} ${plan.action}`);
  return <div className="u11-art">
    {src ? <img src={src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <div className="castle" />}
    <div className="ground" />
    {rainy && !src && <div className="rain" />}
    {who.map((ref, index) => <span key={`${ref.nom}-${index}`} className="fig" style={{ left: `${26 + index * 16}%`, background: tone(ref.nom) }} />)}
    {caption && <span className="lbl">{caption}</span>}
  </div>;
}

function Avatar({ name, place, src }: { name: string; place?: boolean; src?: string }) {
  return <span className={`u11-av${place ? " is-place" : ""}`} style={src ? undefined : { background: place ? "#3c4654" : tone(name) }} aria-hidden="true">
    {src ? <img src={src} alt="" /> : place ? "⌂" : (name.trim().charAt(0).toUpperCase() || "?")}
  </span>;
}

type Chip = { id: string; name: string; role: "qui" | "ou"; photos: number };
type Phase = "write" | "work" | "plan";
type Reply = { you: string; uttu: string; undo: boolean };

export function U11Storyboard({
  sb, data, known, aller, onOpen, onStart, filming, onStopAfter, askAgent,
}: {
  sb: Storyboard | null;
  data: Storyboards;
  known: ContexteEcriture;
  aller(id: string | null): void;
  onOpen(planId: string): void;
  onStart(ids: string[]): void;
  filming: boolean;
  onStopAfter(): void;
  askAgent(text: string): Promise<boolean>;
}) {
  const { t } = useI18n();
  const messages = useMessages() as { storyboard: { gabarits: Gabarits } };
  const studio = useStudio();
  const picture = useRefPicture();
  const { studio: vault } = studio;
  const [text, setText] = useState("");
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<null | "length" | "format" | "look" | "quality">(null);
  const [length, setLength] = useState<"fit" | DureeCible>("fit");
  const [format, setFormat] = useState<Format>("paysage");
  const [quality, setQuality] = useState<Rendu>("fidele");
  const [forced, setForced] = useState<Chip[]>([]);
  const [empty, setEmpty] = useState(false);
  const [phase, setPhase] = useState<Phase>(sb ? "plan" : "write");
  const [boards, setBoards] = useState(false);
  const [job, setJob] = useState<{ result: EcritRecit; story: string; refs: Chip[] } | null>(null);
  const [shown, setShown] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [worked, setWorked] = useState(0);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<Storyboard | null>(null);
  const [approve, setApprove] = useState(false);
  const [anim, setAnim] = useState(false);
  const [frame, setFrame] = useState(0);
  const [progress, setProgress] = useState(0);
  const [stopped, setStopped] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const cancel = useRef(false);
  const started = useRef(0);

  useEffect(() => {
    if (sb && phase !== "work") setPhase("plan");
    if (!sb && phase === "plan") setPhase("write");
  }, [sb]); // eslint-disable-line react-hooks/exhaustive-deps

  const library = useMemo<Chip[]>(() => {
    const photosQui = (id: string) => {
      const card = vault.cast.find(item => item.id === id);
      const ref = studio.references.find(item => item.id === id && item.category === "cast");
      return Math.max(card?.photos.length ?? 0, card?.sheet ? 1 : 0, ref?.images.length ?? 0);
    };
    const photosOu = (id: string) => {
      const scene = vault.scenes.find(item => item.id === id);
      const ref = studio.references.find(item => item.id === id && item.category === "decor");
      return Math.max(scene?.stills.length ?? 0, scene?.render ? 1 : 0, ref?.images.length ?? 0);
    };
    const people: Chip[] = known.cast.map(item => ({ id: item.id, name: item.name, role: "qui", photos: photosQui(item.id) }));
    const places: Chip[] = known.decor.map(item => ({ id: item.id, name: item.name, role: "ou", photos: photosOu(item.id) }));
    const extra = forced.filter(item => !people.concat(places).some(have => have.name.toLowerCase() === item.name.toLowerCase() && have.role === item.role));
    return [...people, ...places, ...extra];
  }, [known, vault.cast, vault.scenes, studio.references, forced]);

  const chips = useMemo(() => library.filter(item => namedIn(text, item.name)), [library, text]);
  const people = library.filter(item => item.role === "qui" && (!query || item.name.toLowerCase().includes(query.toLowerCase())));
  const places = library.filter(item => item.role === "ou" && (!query || item.name.toLowerCase().includes(query.toLowerCase())));

  const insert = (item: Chip) => {
    const node = area.current;
    const caret = node?.selectionStart ?? text.length;
    const upto = text.slice(0, caret);
    const at = upto.lastIndexOf("@");
    const before = at >= 0 && !/[\p{L}\p{N}_]/u.test(upto[at - 1] ?? "") ? text.slice(0, at) : text.slice(0, caret);
    const after = text.slice(caret);
    const lead = before && !/\s$/.test(before) ? " " : "";
    const next = `${before}${lead}@${item.name} ${after.replace(/^\s+/, "")}`;
    setText(next);
    setPicker(false);
    setQuery("");
    requestAnimationFrame(() => node?.focus());
  };

  const declareNew = (role: "qui" | "ou") => {
    const name = query.trim().slice(0, 80);
    if (name.length < 2) return;
    setForced(all => all.some(item => item.name.toLowerCase() === name.toLowerCase() && item.role === role) ? all : [...all, { id: "", name, role, photos: 0 }]);
    insert({ id: "", name, role, photos: 0 });
  };

  const onType = (value: string, caret: number) => {
    if (opensPicker(text, value, caret)) { setPicker(true); setQuery(""); }
    else if (picker) {
      const upto = value.slice(0, caret);
      const at = upto.lastIndexOf("@");
      const q = at >= 0 ? upto.slice(at + 1) : "";
      if (at < 0 || /\s/.test(q)) setPicker(false);
      else setQuery(q);
    }
    setText(value);
    setEmpty(false);
  };

  const write = () => {
    const idee = text.trim();
    if (!idee) { setEmpty(true); return; }
    const ctx: ContexteEcriture = {
      ...known,
      cast: [...known.cast, ...forced.filter(item => item.role === "qui" && !known.cast.some(have => have.name.toLowerCase() === item.name.toLowerCase())).map(item => ({ id: item.id, name: item.name }))],
      decor: [...known.decor, ...forced.filter(item => item.role === "ou" && !known.decor.some(have => have.name.toLowerCase() === item.name.toLowerCase())).map(item => ({ id: item.id, name: item.name }))],
    };
    const result = ecrireDepuisRecit(idee, ctx, {
      dureeCible: length === "fit" ? null : length,
      format,
      formatChoisi: true,
      gabarits: messages.storyboard.gabarits,
      now: new Date().toISOString(),
      suffixe: nouvelId(),
      rendu: quality,
      dureeChiffree: duree => data.prixPrise(reglagesDuPlan({ duree, format, rendu: quality })) !== null,
    });
    cancel.current = false;
    started.current = Date.now();
    setElapsed(0);
    setShown(0);
    setJob({ result, story: idee, refs: chips });
    setBoards(false);
    setApprove(false);
    setPhase("work");
  };

  useEffect(() => {
    if (phase !== "work" || !job) return;
    const clock = window.setInterval(() => setElapsed(Math.max(0, Math.round((Date.now() - started.current) / 1000))), 400);
    let step = 0;
    const reveal = window.setInterval(() => {
      step += 1;
      setShown(step);
      if (step < 6) return;
      window.clearInterval(reveal);
      window.clearInterval(clock);
      if (cancel.current) return;
      const seconds = Math.max(1, Math.round((Date.now() - started.current) / 1000));
      setWorked(seconds);
      void data.sauver(job.result.storyboard, { now: true }).then(ok => {
        if (cancel.current) return;
        if (!ok) { setPhase("write"); return; }
        setPhase("plan");
        aller(job.result.storyboard.id);
      });
    }, 480);
    return () => { window.clearInterval(clock); window.clearInterval(reveal); };
  }, [phase, job]); // eslint-disable-line react-hooks/exhaustive-deps

  const halt = () => {
    cancel.current = true;
    setPhase("write");
    setJob(null);
  };

  const plans = sb ? tousLesPlans(sb) : [];
  const devis = sb ? devisStoryboard(sb, data.ctxDevis, data.registre) : null;
  const total = devis?.total ?? null;
  const price = (n: number) => t("storyboard.md.credits", { n: formatCredits(n) });
  const who = [...new Map(plans.flatMap(plan => plan.refs.filter(ref => ref.role === "qui")).map(ref => [ref.nom.toLowerCase(), ref])).values()];
  const where = plans.flatMap(plan => plan.refs.filter(ref => ref.role === "ou"))[0] ?? null;
  const lineCount = plans.filter(plan => plan.dialogue.texte.trim()).length;
  const rainy = sb ? /\brain\b|pluie|regen|\blluvia\b/i.test(`${sb.idee} ${plans.map(plan => `${plan.titre} ${plan.action}`).join(" ")}`) : false;
  const closeAt = Math.max(1, (plans.findIndex(plan => plan.cadrage !== "serre") + 1) || plans.length || 1);
  const suggestions = [
    plans.length ? { label: t("storyboard.u11.ask.closeup", { n: String(closeAt) }), text: t("storyboard.u11.ask.closeup", { n: String(closeAt) }) } : null,
    rainy ? { label: t("storyboard.u11.ask.rain"), text: t("storyboard.u11.ask.rain") } : null,
    { label: t("storyboard.u11.ask.closing"), text: t("storyboard.u11.ask.closing") },
  ].filter((item): item is { label: string; text: string } => Boolean(item)).slice(0, 3);

  const ask = async (raw: string) => {
    if (!sb) return;
    const texte = raw.trim();
    if (!texte) return;
    const before = sb;
    const order = tousLesPlans(sb).map(plan => plan.id);
    const read = lireDemande(texte);
    let next = sb;
    let uttu = "";
    if (read.kind === "note") {
      if (await askAgent(texte)) {
        setReplies(all => [...all, { you: texte, uttu: "", undo: false }]);
        return;
      }
      const shots = ciblesNote(sb, texte, read.n).filter(n => n >= 1 && n <= tousLesPlans(sb).length);
      next = appliquerNote(sb, shots, texte);
      const whereLabel = shots.length === tousLesPlans(sb).length ? t("storyboard.u11.ask.whereAll") : shots.map(n => t("storyboard.u11.ask.whereOne", { n: String(n) })).join(", ");
      uttu = t("storyboard.u11.ask.doneNote", { text: texte, where: whereLabel });
    } else if (read.kind === "toutes") {
      next = appliquerATous(sb, read.correction, data.registre);
      uttu = t("storyboard.u11.ask.doneAll", { text: texte });
    } else {
      const applied = appliquerCorrection(sb, read.correction, data.registre, nouvelId());
      if (!applied) {
        const shots = ciblesNote(sb, texte, null);
        next = appliquerNote(sb, shots, texte);
        uttu = t("storyboard.u11.ask.doneNote", { text: texte, where: t("storyboard.u11.ask.whereAll") });
      } else {
        next = applied.sb;
        const correction = read.correction;
        if (correction.type === "reglage" && correction.cadrage === "serre") {
          const plan = tousLesPlans(next)[correction.n - 1];
          uttu = t("storyboard.u11.ask.doneClose", { n: String(correction.n), title: plan?.titre ?? "" });
        } else if (correction.type === "ajouter") {
          uttu = t("storyboard.u11.ask.added", { n: String(applied.n ?? tousLesPlans(next).length) });
        } else {
          uttu = t("storyboard.u11.ask.doneOne", { text: texte, n: String(applied.n ?? "") });
        }
      }
    }
    const ids = tousLesPlans(next).map(plan => plan.id);
    const orderKept = order.every((id, index) => ids[index] === id);
    if (!orderKept && read.kind !== "correction") next = appliquerNote(before, ciblesNote(before, texte, read.kind === "note" ? read.n : null), texte);
    const ok = await data.sauver(next);
    if (ok === false) return;
    setUndo(before);
    setChanged(new Set(tousLesPlans(next).filter(plan => {
      const prev = tousLesPlans(before).find(item => item.id === plan.id);
      return !prev || prev.action !== plan.action || prev.cadrage !== plan.cadrage || prev.camera !== plan.camera || prev.titre !== plan.titre;
    }).map(plan => plan.id)));
    setReplies(all => [...all, { you: texte, uttu, undo: true }]);
  };

  const restore = async () => {
    if (!undo) return;
    const ok = await data.sauver(undo);
    if (ok === false) return;
    setChanged(new Set());
    setUndo(null);
    setReplies(all => [...all, { you: "", uttu: t("storyboard.u11.ask.undone"), undo: false }]);
  };

  useEffect(() => {
    if (!anim || !sb) return;
    const rows = tousLesPlans(sb);
    let index = 0;
    let acc = 0;
    const sum = rows.reduce((totalSeconds, plan) => totalSeconds + plan.duree, 0) || 1;
    let timer = 0;
    const tick = () => {
      if (index >= rows.length) { setAnim(false); return; }
      setFrame(index);
      acc += rows[index]!.duree;
      setProgress(Math.min(100, Math.round((acc / sum) * 100)));
      const wait = Math.max(480, rows[index]!.duree * 160);
      index += 1;
      timer = window.setTimeout(tick, wait);
    };
    tick();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setAnim(false); };
    window.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(timer); window.removeEventListener("keydown", onKey); };
  }, [anim, sb]);

  const steps = job ? [
    t("storyboard.u11.work.read"),
    job.result.etapes.personnages.length
      ? t(job.result.etapes.personnagesConnus ? "storyboard.u11.work.cast" : "storyboard.u11.work.castNew", { names: job.result.etapes.personnages.join(", ") })
      : t("storyboard.u11.work.noCast"),
    job.result.etapes.lieu
      ? t(job.result.etapes.lieuConnu ? "storyboard.u11.work.place" : "storyboard.u11.work.placeNew", { name: job.result.etapes.lieu })
      : t("storyboard.u11.work.noPlace"),
    t("storyboard.u11.work.split", { n: job.result.etapes.plans }),
    t("storyboard.u11.work.dialogue"),
    t("storyboard.u11.work.sketch"),
  ] : [];
  const lengthLabel = length === "fit" ? t("storyboard.u11.write.fit") : t("storyboard.u11.write.seconds", { n: String(length) });
  const formatLabel = t(format === "portrait" ? "storyboard.u11.write.formatPortrait" : "storyboard.u11.write.formatLandscape");
  const qualityLabel = t(quality === "rapide" ? "storyboard.u11.write.fast" : "storyboard.u11.write.faithful");
  const screen: Phase = phase === "work" ? "work" : sb && !boards ? "plan" : "write";
  const showApprove = approve && sb && screen === "plan";

  return <>
    <header className="u11-bar">
      <button type="button" className="u11-logo" onClick={() => { setBoards(false); setApprove(false); aller(null); }}>
        <span className="u11-mark"><img src={assetPath("/brand/uttu-mark-h48.png")} alt="" width={18} height={18} /></span>
        <span>U<b>*</b>TTU</span>
      </button>
      <span className="u11-crumb">· {t("storyboard.u11.header.crumb")}</span>
      <span className="u11-sp" />
      <button type="button" className="u11-ghost" data-u11-boards="" onClick={() => { setBoards(open => !open); setApprove(false); }}>{t("storyboard.u11.header.boards")}</button>
    </header>
    <main className={`u11${screen === "plan" && !showApprove && !boards ? " is-dock" : ""}`} data-u11-phase={showApprove ? "approve" : screen}>
      {boards && <section className="u11-list" aria-label={t("storyboard.u11.header.boards")}>
        <button type="button" className="u11-primary" onClick={() => { setBoards(false); aller(null); }}>{t("storyboard.u11.header.newStory")}</button>
        {data.liste.filter(item => !item.archive).length === 0 && <p className="u11-note">{t("storyboard.u11.list.empty")}</p>}
        {data.liste.filter(item => !item.archive).map(item => <button key={item.id} type="button" className="u11-card" onClick={() => { setBoards(false); aller(item.id); }}>
          <b>{item.titre}</b>
          <span>{t("storyboard.u11.plan.facts", { shots: tousLesPlans(item).length, seconds: dureeTotale(item), characters: new Set(tousLesPlans(item).flatMap(plan => plan.refs.filter(ref => ref.role === "qui").map(ref => ref.nom))).size, places: new Set(tousLesPlans(item).flatMap(plan => plan.refs.filter(ref => ref.role === "ou").map(ref => ref.nom))).size })}</span>
        </button>)}
      </section>}

      {!boards && screen === "write" && <section aria-label={t("storyboard.u11.write.label")}>
        <h1 className="u11-title">{t("storyboard.u11.write.titleA")} <em>{t("storyboard.u11.write.titleB")}</em></h1>
        <p className="u11-lede">{t("storyboard.u11.write.lead")}</p>
        <div className="u11-composer">
          <div className="u11-refs" aria-label={t("storyboard.u11.write.refs")}>
            {chips.map(item => <span key={`${item.role}:${item.name}`} className="u11-chip" data-u11-chip={item.role}>
              <Avatar name={item.name} place={item.role === "ou"} src={picture({ role: item.role, nom: item.name, id: item.id || null }) || undefined} />
              {item.name} <small>{item.role === "ou" ? t("storyboard.u11.write.place") : t("storyboard.u11.write.cast")}</small>
            </span>)}
            <button type="button" className="u11-chip is-add" data-u11-add="" onClick={() => { setPicker(open => !open); setQuery(""); }}>{t("storyboard.u11.write.add")}</button>
          </div>
          <label className="u11-note" htmlFor="u11-story" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>{t("storyboard.u11.write.label")}</label>
          <textarea id="u11-story" ref={area} className="u11-story" data-u11-story="" rows={8} maxLength={4000} value={text} placeholder={t("storyboard.u11.write.placeholder")} aria-invalid={empty || undefined} onChange={event => onType(event.target.value, event.target.selectionStart ?? event.target.value.length)} onKeyDown={event => { if (event.key === "Escape") setPicker(false); }} />
          {empty && <p className="u11-note" role="alert" data-u11-empty="">{t("storyboard.u11.write.empty")}</p>}
          {picker && <div className="u11-picker" role="listbox" aria-label={t("storyboard.u11.write.picker")} data-u11-picker="">
            <h6>{t("storyboard.u11.write.characters")}</h6>
            {people.map(item => <button key={`q-${item.id || item.name}`} type="button" className="u11-row" role="option" onClick={() => insert(item)}>
              <Avatar name={item.name} />{item.name}<span className="meta">{t("storyboard.u11.write.photos", { n: item.photos })}</span>
            </button>)}
            <h6>{t("storyboard.u11.write.places")}</h6>
            {places.map(item => <button key={`o-${item.id || item.name}`} type="button" className="u11-row" role="option" onClick={() => insert(item)}>
              <Avatar name={item.name} place />{item.name}<span className="meta">{t("storyboard.u11.write.photos", { n: item.photos })}</span>
            </button>)}
            {query.trim().length >= 2 && !library.some(item => item.name.toLowerCase() === query.trim().toLowerCase()) && <>
              <h6>{t("storyboard.u11.write.newAsk")}</h6>
              <button type="button" className="u11-row" onClick={() => declareNew("qui")}>{t("storyboard.u11.write.newCast")}: {query.trim()}</button>
              <button type="button" className="u11-row" onClick={() => declareNew("ou")}>{t("storyboard.u11.write.newPlace")}: {query.trim()}</button>
            </>}
          </div>}
          <div className="u11-settings" aria-label={t("storyboard.u11.write.length")}>
            {(["length", "format", "look", "quality"] as const).map(key => <span key={key} style={{ position: "relative" }}>
              <button type="button" className="u11-pill" aria-expanded={menu === key} data-u11-pill={key} onClick={() => setMenu(open => open === key ? null : key)}>
                {key === "length" && <>{t("storyboard.u11.write.length")}: {lengthLabel}</>}
                {key === "format" && formatLabel}
                {key === "look" && <>{t("storyboard.u11.write.look")}: {t("storyboard.u11.write.lookRefs")}</>}
                {key === "quality" && <>{t("storyboard.u11.write.quality")}: {qualityLabel}</>}
              </button>
              {menu === key && <span className="u11-menu" role="menu">
                {key === "length" && (["fit", 15, 30, 60] as const).map(value => <button key={String(value)} type="button" role="menuitemradio" aria-checked={length === value} onClick={() => { setLength(value); setMenu(null); }}>{value === "fit" ? t("storyboard.u11.write.fit") : t("storyboard.u11.write.seconds", { n: String(value) })}</button>)}
                {key === "format" && (["paysage", "portrait"] as const).map(value => <button key={value} type="button" role="menuitemradio" aria-checked={format === value} onClick={() => { setFormat(value); setMenu(null); }}>{t(value === "portrait" ? "storyboard.u11.write.formatPortrait" : "storyboard.u11.write.formatLandscape")}</button>)}
                {key === "look" && <button type="button" role="menuitemradio" aria-checked="true" onClick={() => setMenu(null)}>{t("storyboard.u11.write.lookRefs")}</button>}
                {key === "quality" && (["fidele", "rapide"] as const).map(value => <button key={value} type="button" role="menuitemradio" aria-checked={quality === value} onClick={() => { setQuality(value); setMenu(null); }}>{t(value === "rapide" ? "storyboard.u11.write.fast" : "storyboard.u11.write.faithful")}</button>)}
              </span>}
            </span>)}
          </div>
        </div>
        <div className="u11-go">
          <button type="button" className="u11-primary" data-u11-write="" onClick={write}>{t("storyboard.u11.write.go")}</button>
          <span className="u11-note">{t("storyboard.u11.write.cost")}</span>
        </div>
        <p className="u11-hint">{t("storyboard.u11.write.tip")}</p>
      </section>}

      {!boards && screen === "work" && job && <section aria-label={t("storyboard.u11.work.working", { n: String(elapsed) })} data-u11-working="">
        <div className="u11-you">
          <div className="u11-refs">{job.refs.map(item => <span key={`${item.role}:${item.name}`} className="u11-chip"><Avatar name={item.name} place={item.role === "ou"} />{item.name}</span>)}</div>
          <p>{job.story}</p>
        </div>
        <div className="u11-echo">
          <b>{t("storyboard.u11.work.asWritten", { title: job.result.storyboard.titre })}</b><br />
          {t("storyboard.u11.work.look")}<br />
          {t("storyboard.u11.work.settings", { length: lengthLabel, format: formatLabel, quality: qualityLabel })}
        </div>
        <details className="u11-worked" open>
          <summary>{t("storyboard.u11.work.working", { n: String(elapsed) })}</summary>
          <ol className="u11-steps">
            {steps.map((label, index) => <li key={label} className={index < shown ? "is-done" : index === shown ? "is-now" : ""}>{label}</li>)}
          </ol>
        </details>
        <div className="u11-foot">
          <button type="button" className="u11-ghost" data-u11-halt="" onClick={halt}>{t("storyboard.u11.work.stop")}</button>
          <span className="u11-zero">{t("storyboard.u11.work.zero")}</span>
        </div>
      </section>}

      {!boards && screen === "plan" && sb && !showApprove && <section aria-label={t("storyboard.u11.plan.kicker")} data-u11-plan="">
        <div className="u11-you"><p>{sb.idee}</p></div>
        {worked > 0 && <details className="u11-worked">
          <summary>{t("storyboard.u11.work.worked", { n: String(worked) })}</summary>
          <ol className="u11-steps">{steps.map(label => <li key={label} className="is-done">{label}</li>)}</ol>
        </details>}
        <div className="u11-uttu">
          <span className="u11-face" aria-hidden="true">U</span>
          <p data-u11-kept="">
            {lineCount ? t("storyboard.u11.plan.keptLines", { n: lineCount }) : t("storyboard.u11.plan.keptStory")}
            {" "}
            {who.length > 0 && t("storyboard.u11.plan.keptWho", { names: who.map(ref => ref.nom).join(", ") })}
            {" "}
            {where && t("storyboard.u11.plan.keptPlace", { place: where.nom })}
          </p>
        </div>
        <article className="u11-plan">
          <div className="u11-plan-h">
            <span className="u11-kicker">{t("storyboard.u11.plan.kicker")}</span>
            <h2>{sb.titre}</h2>
            <p className="u11-facts" data-u11-facts="">{t("storyboard.u11.plan.facts", { shots: plans.length, seconds: dureeTotale(sb), characters: who.length, places: where ? 1 : 0 })}</p>
          </div>
          <div className="u11-strip" style={{ gridTemplateColumns: `repeat(${Math.max(plans.length, 1)}, minmax(0, 1fr))` }}>
            {plans.map(plan => <div key={plan.id} className="u11-frame"><Sketch plan={plan} /></div>)}
          </div>
          <button type="button" className="u11-play" data-u11-play="" onClick={() => { setFrame(0); setProgress(0); setAnim(true); }}>{t("storyboard.u11.plan.play", { n: String(dureeTotale(sb)) })}</button>
          <div className="u11-cast" data-u11-locked="">
            {who.map(ref => <span key={ref.nom} className="u11-chip" data-u11-role="qui"><Avatar name={ref.nom} src={picture(ref) || undefined} />{ref.nom}</span>)}
            {where && <span className="u11-chip" data-u11-role="ou"><Avatar name={where.nom} place src={picture(where) || undefined} />{where.nom}</span>}
            <span className="u11-lock">{t("storyboard.u11.plan.same")}</span>
          </div>
        </article>
        {plans.length === 0 && <p className="u11-note">{t("storyboard.u11.plan.empty")}</p>}
        <div className="u11-shots">
          {plans.map((plan, index) => {
            const found = trouverPlan(sb, plan.id);
            return <article key={plan.id} className={`u11-shot${changed.has(plan.id) ? " is-changed" : ""}`} data-u11-shot={index + 1}>
              <button type="button" onClick={() => onOpen(plan.id)} style={{ display: "block", width: "100%", padding: 0, border: 0, background: "transparent", color: "inherit", textAlign: "left" }}>
                <div className="thumb"><Sketch plan={plan} caption={t("storyboard.u11.plan.sketch")} /></div>
                <div className="body">
                  <div className="u11-num">{t("storyboard.u11.plan.shot", { n: String(found?.numero ?? index + 1) })}{changed.has(plan.id) && <span className="u11-chg">· {t("storyboard.u11.plan.changed")}</span>}<span className="dur">{t("storyboard.u11.plan.seconds", { n: String(plan.duree) })}</span></div>
                  <h3 data-u11-title="">{plan.titre}</h3>
                  <p className="u11-act">{plan.action}</p>
                  {lignes(plan).map((line, lineIndex) => <q key={lineIndex}>{line.qui && <span>{line.qui}</span>}“{line.texte}”</q>)}
                  <div className="u11-tags">
                    {plan.refs.filter(ref => ref.role === "ou").map(ref => <span key={ref.nom} className="u11-tag is-place">⌂ {ref.nom}</span>)}
                    {plan.refs.filter(ref => ref.role === "qui").map(ref => <span key={ref.nom} className="u11-tag is-who">{ref.nom}</span>)}
                    {plan.cadrage && <span className="u11-tag" data-u11-framing="">{t(`storyboard.sheet.cadrage.${plan.cadrage}`)}</span>}
                    {plan.camera && <span className="u11-tag">{t(`storyboard.sheet.cam.${plan.camera}`)}</span>}
                  </div>
                </div>
              </button>
            </article>;
          })}
        </div>
        <div data-u11-replies="">
          {replies.map((reply, index) => <div key={index} style={{ marginTop: 16 }}>
            {reply.you && <div className="u11-you"><p>{reply.you}</p></div>}
            {reply.uttu && <div className="u11-uttu"><span className="u11-face" aria-hidden="true">U</span><div className="u11-reply" data-u11-reply=""><p>{reply.uttu}</p><span className="u11-zero">{t("storyboard.u11.ask.zero")}</span>{reply.undo && undo && <button type="button" className="u11-undo" data-u11-undo="" onClick={() => void restore()}>{t("storyboard.u11.ask.undo")}</button>}</div></div>}
          </div>)}
        </div>
        <p className="u11-closing">{t("storyboard.u11.plan.close")}</p>
        {filming && <div className="u11-foot">
          <span className="u11-note" role="status">{stopped ? t("storyboard.u11.film.stopped") : t("storyboard.u11.film.filming", { n: "…" })}</span>
          <button type="button" className="u11-ghost" data-u11-stop="" onClick={() => { onStopAfter(); setStopped(true); }}>{t("storyboard.u11.film.stop")}</button>
        </div>}
        <div className="u11-dock"><div className="u11-dock-in">
          <div className="u11-sugs" aria-label={t("storyboard.u11.ask.suggestions")}>
            {suggestions.map(item => <button key={item.text} type="button" className="u11-sug" data-u11-suggest="" onClick={() => void ask(item.text)}>{item.label}</button>)}
          </div>
          <form className="u11-ask" onSubmit={event => { event.preventDefault(); const field = event.currentTarget.elements.namedItem("q"); const value = field instanceof HTMLInputElement ? field.value : ""; void ask(value); if (field instanceof HTMLInputElement) field.value = ""; }}>
            <input name="q" data-u11-ask="" placeholder={t("storyboard.u11.ask.placeholder")} aria-label={t("storyboard.u11.ask.placeholder")} autoComplete="off" />
            <button type="submit" className="u11-send" aria-label={t("storyboard.u11.ask.send")}>↑</button>
          </form>
          <button type="button" className="u11-primary" data-u11-approve="" onClick={() => setApprove(true)}>
            <span>{t("storyboard.u11.ask.approve")}</span>
            <span className="cost" data-u11-quote="">{total === null ? t("storyboard.u11.ask.noQuote") : price(total)}</span>
          </button>
        </div></div>
      </section>}

      {!boards && showApprove && sb && <section className="u11-sheet" aria-label={t("storyboard.u11.film.kicker")} data-u11-approve-sheet="">
        <span className="u11-kicker">{t("storyboard.u11.film.kicker")}</span>
        <h2>{t("storyboard.u11.film.title")} <em>{sb.titre}</em></h2>
        <p className="u11-note">{t("storyboard.u11.film.meta", { shots: plans.length, seconds: dureeTotale(sb), format: t(sb.format === "portrait" ? "storyboard.u11.write.formatPortrait" : "storyboard.u11.write.formatLandscape") })}</p>
        <ul className="u11-lines">
          {plans.map((plan, index) => {
            const row = devis?.plans.find(item => item.id === plan.id);
            return <li key={plan.id}><span className="n">{index + 1}</span><span>{plan.titre}</span><span className="q">{t("storyboard.u11.film.line", { seconds: plan.duree, n: row?.total === null || row?.total === undefined ? "–" : formatCredits(row.total) })}</span></li>;
          })}
        </ul>
        <p className="u11-total"><span>{t("storyboard.u11.film.total")}</span><b data-u11-total="">{total === null ? t("storyboard.u11.ask.noQuote") : price(total)}</b></p>
        <ul className="u11-rules">
          <li>{t("storyboard.u11.film.rule1")}</li>
          <li>{t("storyboard.u11.film.rule2")}</li>
          <li>{t("storyboard.u11.film.rule3")}</li>
        </ul>
        <div className="u11-actions">
          {total === null
            ? <p className="u11-note" role="status" data-u11-no-quote="">{t("storyboard.u11.ask.noQuote")}</p>
            : <button type="button" className="u11-primary" data-u11-start="" onClick={() => { setApprove(false); onStart(plans.map(plan => plan.id)); }}>
              <span>{t("storyboard.u11.film.start")}</span>
              <span className="cost">{price(total)}</span>
            </button>}
          <button type="button" className="u11-ghost" data-u11-back="" onClick={() => setApprove(false)}>{t("storyboard.u11.film.back")}</button>
        </div>
      </section>}
      {data.echecEcriture && <p className="u11-note" role="alert">{t("storyboard.writer.failed")}</p>}
    </main>
    {anim && sb && <div className="u11-anim" role="dialog" aria-modal="true" aria-label={t("storyboard.u11.anim.label")} data-u11-animatic="">
      <button type="button" className="u11-ghost" style={{ position: "absolute", top: 16, right: 16 }} data-u11-anim-close="" onClick={() => setAnim(false)}>{t("storyboard.u11.anim.close")}</button>
      <div className="screen">{plans[frame] && <Sketch plan={plans[frame]!} />}</div>
      <div className="bar" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
      <div className="cap"><b>{frame + 1} · {plans[frame]?.titre}</b>{lignes(plans[frame] ?? plans[0]!).map((line, index) => <q key={index}>{line.qui ? `${line.qui}: ` : ""}{line.texte}</q>)}</div>
    </div>}
  </>;
}
