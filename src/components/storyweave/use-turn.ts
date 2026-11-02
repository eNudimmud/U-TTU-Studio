"use client";

// One turn with Uttu. prepareIntent does not post. submitIntent runs only after
// the visitor accepts the quote. Stop drops the turn before that post and never
// cancels a job that has already been sent.

import { useRef, useState } from "react";
import { useMessages } from "next-intl";
import { useI18n, useLocaleSwitch } from "@/components/i18n/provider";
import { userApproval } from "@/lib/cinema/intent-job";
import type { PreparedIntent } from "@/lib/cinema/controller";
import type { EditableShotField } from "@/lib/cinema/types";
import { referencesDuCatalogue } from "@/lib/storyboard/identites";
import { lireDemande, appliquerATous, appliquerNote, ciblesNote } from "@/lib/storyboard/note";
import { appliquerCorrection } from "@/lib/storyboard/corriger";
import { ecrireDepuisRecit } from "@/lib/storyboard/recit";
import { reglagesDuPlan } from "@/lib/storyboard/devis";
import type { ContexteEcriture, Gabarits } from "@/lib/storyboard/ecrire";
import {
  U11_AGENT_CEILING, agentChange, agentReading, answerOf, boardFromProposal, confirmProposal,
  describeOperations, shellForStory, withQuotableDurations, withSettings, type NameProposal,
} from "@/lib/storyboard/u11-agent";
import { tousLesPlans, type Storyboard } from "@/lib/storyboard/storyboard";
import { useStudio } from "../app/studio-session";
import type { Storyboards } from "../storyboard/use-storyboards";
import { costLine } from "@/lib/storyweave/cost";

export type ThinkStep = "read" | "library" | "writing" | "fitting" | "quote";

export interface TurnPhase { step: ThinkStep; started: number; elapsed: number; sent: boolean }

const nouvelId = () => Math.random().toString(36).slice(2, 8);

export function useStoryweaveTurn(
  sb: Storyboard | null,
  data: Storyboards,
  known: ContexteEcriture,
  aller: (id: string | null) => void,
  locks: Record<string, EditableShotField[]>,
  selectedShotId: string | null,
  onReply: (text: string, proposals: NameProposal[]) => void,
  onFold: (seconds: number) => void,
) {
  const studio = useStudio();
  const { t } = useI18n();
  const { locale } = useLocaleSwitch();
  const messages = useMessages() as { storyboard: { gabarits: Gabarits } };
  const [phase, setPhase] = useState<TurnPhase | null>(null);
  const [pending, setPending] = useState<PreparedIntent | null>(null);
  const [proposals, setProposals] = useState<NameProposal[]>([]);
  const cancel = useRef(false);
  const sent = useRef(false);
  const started = useRef(0);
  const boardRef = useRef(sb);
  boardRef.current = sb;

  const tick = (step: ThinkStep, posted = sent.current) => {
    setPhase({ step, started: started.current, elapsed: Math.max(0, Math.round((Date.now() - started.current) / 1000)), sent: posted });
  };

  const finish = (text: string, asked: NameProposal[] = []) => {
    const seconds = Math.max(1, Math.round((Date.now() - started.current) / 1000));
    sent.current = false;
    setPending(null);
    setPhase(null);
    setProposals(asked);
    onFold(seconds);
    onReply(text, asked);
  };

  const stop = () => {
    // A posted intent is a Comfy job. Leave it. Only an unsent turn is dropped.
    if (sent.current) return;
    cancel.current = true;
    setPending(null);
    const seconds = Math.max(1, Math.round((Date.now() - started.current) / 1000));
    setPhase(null);
    onFold(seconds);
  };

  const priced = (duree: 5 | 8 | 10, format = sb?.format ?? "paysage" as const, rendu = "fidele" as const) => data.prixPrise(reglagesDuPlan({ duree, format, rendu })) !== null;

  const saveLocal = async (board: Storyboard, note: string) => {
    if (await data.sauver(board, { now: true }) === false) { finish(t("storyboard.writer.failed")); return; }
    if (!boardRef.current || boardRef.current.id !== board.id) aller(board.id);
    finish(note);
  };

  const offlineChange = async (texte: string, before: Storyboard) => {
    const read = lireDemande(texte);
    let next = before;
    let uttu = t("storyweave.offline");
    if (read.kind === "toutes") {
      next = appliquerATous(before, read.correction, data.registre);
      uttu = t("storyweave.applied");
    } else if (read.kind === "correction") {
      const applied = appliquerCorrection(before, read.correction, data.registre, nouvelId());
      if (applied) { next = applied.sb; uttu = t("storyweave.applied"); }
    } else {
      next = appliquerNote(before, ciblesNote(before, texte, read.kind === "note" ? read.n : null), texte);
      uttu = t("storyweave.applied");
    }
    await saveLocal(next, uttu);
  };

  const catalogue = () => [
    ...known.cast.map(item => ({ id: item.id, category: "cast" as const, name: item.name, description: "" })),
    ...known.decor.map(item => ({ id: item.id, category: "decor" as const, name: item.name, description: "" })),
  ];

  const prepare = async (userText: string, boardId: string) => {
    const lang = locale === "fr" || locale === "de" || locale === "es" ? locale : "en";
    tick("library");
    return studio.cinema.prepareIntent({
      scope: { projectId: studio.studio.project ?? "", storyboardId: boardId },
      locale: lang, selectedShotId, userText, locks,
      references: referencesDuCatalogue(studio.studio.cast, studio.studio.scenes, studio.references),
      capabilities: [], purpose: "qualification", estimate: null,
    });
  };

  const send = async (raw: string) => {
    const texte = raw.trim();
    if (!texte || phase) return;
    cancel.current = false;
    sent.current = false;
    started.current = Date.now();
    tick("read");
    const current = boardRef.current;
    const online = studio.connected && !!studio.studio.project;
    if (!online) {
      if (!current) {
        const written = ecrireDepuisRecit(texte, known, {
          dureeCible: null, format: "paysage", formatChoisi: false, gabarits: messages.storyboard.gabarits,
          now: new Date().toISOString(), suffixe: nouvelId(), rendu: "fidele",
        });
        await saveLocal(withSettings(written.storyboard, "paysage", "fidele"), t("storyweave.wroteLocal"));
        return;
      }
      await offlineChange(texte, current);
      return;
    }
    let boardId = current?.id ?? "";
    let userText = texte;
    if (!current) {
      const reading = agentReading(texte, catalogue());
      const shell = shellForStory(texte, reading, { format: "paysage", rendu: "fidele", suffix: nouvelId(), now: new Date().toISOString() });
      if (await data.sauver(shell, { now: true }) === false) { finish(t("storyboard.writer.failed")); return; }
      aller(shell.id);
      boardId = shell.id;
      userText = reading.userText;
    } else {
      if (await data.sauver(current, { now: true }) === false) { finish(t("storyboard.writer.failed")); return; }
      userText = agentChange(texte);
    }
    if (cancel.current) return;
    const prepared = await prepare(userText, boardId);
    if (cancel.current) return;
    if (!prepared.ok || !prepared.data) { if (current) await offlineChange(texte, current); else finish(t("storyweave.agentFailed")); return; }
    tick("quote");
    setPending(prepared.data);
  };

  const confirm = async () => {
    const prepared = pending;
    const current = boardRef.current;
    if (!prepared || !current || cancel.current) return;
    setPending(null);
    const quote = prepared.preparation.quote;
    const measured = quote.estimatedCredits !== null && quote.basis !== "unavailable" && quote.basis !== undefined
      ? Math.ceil(quote.estimatedCredits + (quote.uncertaintyCredits ?? 0))
      : U11_AGENT_CEILING;
    const approval = userApproval(prepared.preparation, measured, { id: crypto.randomUUID(), trancheId: "storyweave-agent" }, new Date());
    sent.current = true;
    tick("writing", true);
    const posted = await studio.cinema.submitIntent(prepared, approval);
    if (cancel.current) return;
    if (!posted.ok) { sent.current = false; finish(t("storyweave.agentFailed")); return; }
    tick("fitting", true);
    let collected = await studio.cinema.collectIntent();
    let waits = 0;
    while (collected.code === "INTENT_WAITING" && waits < 20) {
      await new Promise(resolve => setTimeout(resolve, Math.max(500, collected.data?.retryAfterMs ?? 1500)));
      collected = await studio.cinema.collectIntent();
      waits += 1;
    }
    const parsed = collected.data?.parsed;
    if (!parsed || parsed.status === "invalid" || !parsed.envelope) { sent.current = false; finish(t("storyweave.agentFailed")); return; }
    const answer = answerOf(parsed.status, parsed.envelope);
    if (answer.status !== "ready") { sent.current = false; finish(t("storyweave.agentFailed")); return; }
    const format = current.format;
    const next = withSettings(withQuotableDurations(boardFromProposal(current, answer.envelope, new Date().toISOString()), duree => priced(duree, format, "fidele")), format, "fidele");
    if (await data.sauver(next, { now: true }) === false) { finish(t("storyboard.writer.failed")); return; }
    const titles = new Map(tousLesPlans(current).map(plan => [plan.id, plan.titre]));
    const lines = describeOperations(answer.envelope.operations, titles);
    const said = answer.envelope.expectedResult || lines.join(" ") || t("storyweave.applied");
    finish(said, answer.proposals);
  };

  const dismiss = () => { if (!sent.current) { cancel.current = true; setPending(null); finish(t("storyweave.notNow")); } };

  const acceptName = (proposal: NameProposal) => {
    const current = boardRef.current;
    if (!current) return;
    void data.sauver(confirmProposal(current, proposal, new Date().toISOString()));
    setProposals(list => list.filter(item => item.name !== proposal.name || item.role !== proposal.role));
  };

  const line = pending ? costLine((() => {
    const quote = pending.preparation.quote;
    if (quote.estimatedCredits !== null && quote.basis !== "unavailable") return Math.ceil(quote.estimatedCredits + (quote.uncertaintyCredits ?? 0));
    return U11_AGENT_CEILING;
  })()) : null;

  return { phase, pending, proposals, line, send, confirm, dismiss, stop, acceptName, busy: !!phase };
}
