"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { assetPath } from "@/lib/site";
import type { NameProposal } from "@/lib/storyboard/u11-agent";
import type { CostLine } from "@/lib/storyweave/cost";
import { Icon, ICON } from "./icons";
import type { TurnPhase } from "./use-turn";

export type ChatItem =
  | { id: string; kind: "you"; text: string }
  | { id: string; kind: "uttu"; text: string }
  | { id: string; kind: "log"; text: string; onUndo?: () => void }
  | { id: string; kind: "resync"; text: string; onAccept: () => void; onLater: () => void };

const STEPS = ["read", "library", "writing", "fitting", "quote"] as const;

function stepState(current: TurnPhase["step"], step: (typeof STEPS)[number]): "done" | "now" | "next" {
  const at = STEPS.indexOf(current);
  const index = STEPS.indexOf(step);
  if (index < at) return "done";
  if (index === at) return "now";
  return "next";
}

export function Conversation({
  items, phase, elapsed, counts, quote, proposals, onAcceptName, onConfirm, onDismiss, onStop, onSend, onOpen, seed = "",
}: {
  items: ChatItem[];
  phase: TurnPhase | null;
  elapsed: number;
  counts: { shots: number; library: number };
  quote: CostLine | null;
  proposals: NameProposal[];
  onAcceptName: (proposal: NameProposal) => void;
  onConfirm: () => void;
  onDismiss: () => void;
  onStop: () => void;
  onSend: (text: string, files: File[]) => void;
  onOpen: (view: "script" | "audio") => void;
  seed?: string;
}) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [dictateNote, setDictateNote] = useState("");
  const [folded, setFolded] = useState<number | null>(null);
  const [openThought, setOpenThought] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { if (seed) setText(current => current || seed); }, [seed]);
  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [items, phase, quote]);

  const seen = useRef(0);
  if (elapsed > 0) seen.current = elapsed;
  useEffect(() => {
    if (!phase && seen.current > 0) setFolded(seen.current);
  }, [phase]);

  const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  const dictate = () => {
    const host = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = host.SpeechRecognition || host.webkitSpeechRecognition;
    if (!Ctor) { setDictateNote(t("storyweave.dictateOff")); return; }
    if (recRef.current) { recRef.current.stop(); recRef.current = null; return; }
    const rec = new Ctor();
    rec.lang = document.documentElement.lang || "en";
    rec.onresult = event => {
      const said = event.results?.[0]?.[0]?.transcript ?? "";
      if (said) setText(current => (current ? `${current} ${said}` : said));
    };
    rec.onend = () => { recRef.current = null; };
    rec.start();
    recRef.current = rec;
  };

  const send = () => {
    const value = text.trim();
    if (!value || phase) return;
    const files = fileRef.current?.files ? [...fileRef.current.files] : [];
    if (fileRef.current) fileRef.current.value = "";
    setText("");
    onSend(value, files);
  };

  return <div className="sw-chat">
    <div className="sw-hist" ref={scroller}>
      <div className="sw-hist-in">
        {items.map(item => {
          if (item.kind === "you") return <div key={item.id} className="sw-you">{item.text}</div>;
          if (item.kind === "uttu") return <div key={item.id} className="sw-u"><img className="sw-face" src={assetPath("/brand/uttu-mark-h48.png")} alt="" /><div>
            <p>{item.text}</p>
            <div className="sw-acts">
              <button type="button" className="sw-txt" onClick={() => onOpen("script")}>{t("storyweave.readScript")}</button>
              <button type="button" className="sw-txt" onClick={() => onOpen("audio")}>{t("storyweave.listen")}</button>
            </div>
          </div></div>;
          if (item.kind === "log") return <div key={item.id} className="sw-log">{item.text}{item.onUndo && <button type="button" className="sw-txt" data-sw-undo="" onClick={item.onUndo}>{t("storyweave.undo")}</button>}</div>;
          return <div key={item.id} className="sw-log" data-sw-resync="">{item.text}
            <button type="button" className="sw-txt" onClick={item.onAccept}>{t("storyweave.resyncDo")}</button>
            <button type="button" className="sw-txt" onClick={item.onLater}>{t("storyweave.notNow")}</button>
          </div>;
        })}
        {proposals.map(proposal => <div key={`${proposal.role}:${proposal.name}`} className="sw-log">
          {proposal.name}
          <button type="button" className="sw-txt" onClick={() => onAcceptName(proposal)}>{proposal.role === "qui" ? t("storyweave.proposalCast") : t("storyweave.proposalPlace")}</button>
        </div>)}
        {phase && <div className="sw-u sw-think" data-sw-thinking="">
          <img className="sw-face" src={assetPath("/brand/uttu-mark-h48.png")} alt="" />
          <div>
            <div className="sw-head"><span className="sw-dot" /><b>{t("storyweave.thinking")}</b><span className="sw-mono sw-faint">{clock(elapsed)}</span></div>
            <ul className="sw-steps">
              {STEPS.map(step => <li key={step} className={stepState(phase.step, step) === "next" ? "" : stepState(phase.step, step) === "now" ? "is-now" : "is-done"}>{t(`storyweave.step.${step}`, { shots: String(counts.shots), library: String(counts.library) })}</li>)}
            </ul>
            {quote && <div className="sw-quote" data-sw-quote="">
              <p>{t("storyweave.quoteLead")}</p>
              <p className="sw-mono" data-sw-agent-cost="">{quote.kind === "estimated" ? t("storyboard.md.credits", { n: formatCredits(quote.credits) }) : t("storyweave.beforeLaunch")}</p>
              <div className="sw-go">
                <button type="button" className="sw-primary" data-sw-quote-go="" onClick={onConfirm}>{t("storyweave.quoteGo")}</button>
                <button type="button" className="sw-txt" onClick={onDismiss}>{t("storyweave.notNow")}</button>
              </div>
            </div>}
          </div>
        </div>}
        {!phase && folded !== null && <button type="button" className="sw-thought" aria-expanded={openThought} onClick={() => setOpenThought(open => !open)}>
          {t("storyweave.thought", { time: clock(folded) })} <Icon d={ICON.chev} size={16} />
        </button>}
        {openThought && !phase && <ul className="sw-steps">{STEPS.map(step => <li key={step} className="is-done">{t(`storyweave.step.${step}`, { shots: String(counts.shots), library: String(counts.library) })}</li>)}</ul>}
      </div>
    </div>
    <div className="sw-dock"><div className="sw-dock-in">
      <form className="sw-ask" onSubmit={event => { event.preventDefault(); send(); }}>
        <input ref={fileRef} className="sw-sr" type="file" multiple aria-hidden="true" tabIndex={-1} data-sw-file="" onChange={() => undefined} />
        <button type="button" className="sw-ib" aria-label={t("storyweave.attach")} onClick={() => fileRef.current?.click()}><Icon d={ICON.plus} /></button>
        <input value={text} placeholder={t("storyweave.ask")} aria-label={t("storyweave.ask")} data-sw-ask="" onChange={event => setText(event.target.value)} />
        <button type="button" className="sw-ib" aria-label={t("storyweave.dictate")} onClick={dictate}><Icon d={ICON.mic} /></button>
        {phase && !phase.sent && <button type="button" className="sw-stop" data-sw-stop="" aria-label={t("storyweave.stop")} onClick={onStop}><i />{t("storyweave.stop")}</button>}
        {!phase && <button type="submit" className="sw-ib" aria-label={t("storyweave.send")} data-sw-send=""><Icon d={ICON.send} /></button>}
      </form>
      <p className="sw-note">{dictateNote || t("storyweave.stopNote")}</p>
    </div></div>
  </div>;
}

interface SpeechRec {
  lang: string;
  onresult: ((event: { results?: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
