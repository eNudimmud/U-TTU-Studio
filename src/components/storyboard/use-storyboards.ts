"use client";

// The storyboards of the open project: read from `.uttu/sb-<id>.json` (the files listed under
// Storyboard/ in the vault tree), kept in memory, written back as JSON + Markdown after each change.
// An unreadable file is listed by name and never overwritten.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { quoteForCast, quoteForDecor } from "@/lib/creation/quotes";
import { lireRegistre, priseGardee, registreJson, REGISTRE_FILE, type Registre } from "@/lib/film/registre";
import { quoteCredits } from "@/lib/prise/rendu";
import { resolveTakeQuote } from "@/lib/render/billed-quote";
import { quotesToRecords } from "@/lib/render/measured-quote";
import { takeProfile, type TakeSettings } from "@/lib/render/take-graph";
import { devisPlan, devisStoryboard, type ContexteDevis } from "@/lib/storyboard/devis";
import { storyboardMarkdown, type LibellesMd } from "@/lib/storyboard/markdown";
import { cheminJson, cheminMarkdown, etatDuPlan, lireStoryboard, storyboardJson, type PlanSB, type RefPlan, type Storyboard } from "@/lib/storyboard/storyboard";
import { useStudio } from "../app/studio-session";

const WRITE_DELAY = 400;

export function useStoryboards() {
  const studio = useStudio();
  const { t } = useI18n();
  const { studio: vault, readProjectFile, writeProjectFile, ready } = studio;
  const [registre, setRegistreState] = useState<Registre>(() => lireRegistre(null));
  const [boards, setBoards] = useState<Record<string, Storyboard>>({});
  const [illisibles, setIllisibles] = useState<string[]>([]);
  const [charge, setCharge] = useState(false);
  const [echecEcriture, setEchecEcriture] = useState(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const latest = useRef<Record<string, Storyboard>>({});
  const project = vault.project;

  const ids = useMemo(() => (vault.tree.find(folder => folder.label === "Storyboards")?.files ?? [])
    .flatMap(file => /^([a-z0-9][a-z0-9-]{0,60})\.md$/.exec(file)?.[1] ?? []), [vault.tree]);
  const idsKey = ids.join(",");

  // A new project starts from its own files.
  useEffect(() => { latest.current = {}; setBoards({}); setIllisibles([]); setCharge(false); }, [project]);

  useEffect(() => {
    if (!ready) return;
    let gone = false;
    void (async () => {
      const found: Record<string, Storyboard> = {};
      const bad: string[] = [];
      for (const id of idsKey ? idsKey.split(",") : []) {
        if (latest.current[id]) continue;
        const raw = await readProjectFile(cheminJson(id));
        if (raw === undefined) continue;
        const sb = lireStoryboard(raw);
        if (sb) found[id] = sb; else bad.push(cheminJson(id));
      }
      if (gone) return;
      latest.current = { ...found, ...latest.current };
      setBoards({ ...latest.current });
      setIllisibles(bad);
      setCharge(true);
    })();
    return () => { gone = true; };
  }, [idsKey, ready, readProjectFile, project]);

  useEffect(() => {
    let gone = false;
    void readProjectFile(REGISTRE_FILE).then(text => { if (!gone) setRegistreState(lireRegistre(text)); });
    return () => { gone = true; };
  }, [readProjectFile, project, vault.takes.length]);

  const setRegistre = useCallback(async (next: Registre) => {
    setRegistreState(next);
    await writeProjectFile(REGISTRE_FILE, registreJson(next));
  }, [writeProjectFile]);

  const records = useMemo(() => quotesToRecords(vault.quotes), [vault.quotes]);
  const prixPrise = useCallback((settings: TakeSettings) => quoteCredits(resolveTakeQuote(takeProfile(settings), records)), [records]);
  const ctxDevis = useMemo<ContexteDevis>(() => ({ prixPrise, creation: { personnage: quoteForCast("texte").credits, lieu: quoteForDecor("texte").credits } }), [prixPrise]);

  const libelles = useMemo<LibellesMd>(() => ({
    ...(t.raw("storyboard.md") as Omit<LibellesMd, "cadrage" | "camera" | "landscape" | "portrait">),
    cadrage: t.raw("storyboard.sheet.cadrage") as Record<string, string>,
    camera: t.raw("storyboard.sheet.cam") as Record<string, string>,
    landscape: t("storyboard.format.paysage"),
    portrait: t("storyboard.format.portrait"),
  }), [t]);

  const lienRef = useCallback((ref: RefPlan): string | null => {
    if (!ref.id || !project) return null;
    if (ref.role === "qui") return vault.cast.some(card => card.id === ref.id) ? `Projets/${project}/Cast/${ref.id}` : null;
    if (ref.role === "ou") {
      const scene = vault.scenes.find(item => item.id === ref.id);
      return scene ? `Projets/${project}/${scene.home === "Decors" ? "Decors" : "Lieux"}/${scene.id}` : null;
    }
    return null;
  }, [project, vault.cast, vault.scenes]);

  /** The kept take of a shot, with its still, or null. */
  const priseDuPlan = useCallback((plan: PlanSB) => {
    const film = plan.planFilmId ? registre.plans.find(item => item.id === plan.planFilmId) : null;
    const prise = film ? priseGardee(film) : null;
    if (!prise) return null;
    const take = vault.takes.find(item => item.id === prise.id) ?? null;
    return { prise, take, film: film! };
  }, [registre.plans, vault.takes]);

  const markdownDe = useCallback((sb: Storyboard) => {
    const devis = devisStoryboard(sb, ctxDevis, registre);
    return storyboardMarkdown(sb, {
      projet: project ?? "",
      registre,
      lienRef,
      prise: plan => {
        const hit = priseDuPlan(plan);
        return hit && project ? { note: `Projets/${project}/Prises/${hit.prise.id}`, image: hit.take?.poster ?? null, id: hit.prise.id } : null;
      },
      devis: plan => etatDuPlan(plan, registre) === "tourne" ? null : devisPlan(plan, ctxDevis).total,
      devisRestant: devis.total,
      date: new Date().toISOString().slice(0, 10),
      credits: n => t("storyboard.md.credits", { n: formatCredits(n) }),
    }, libelles);
  }, [ctxDevis, registre, project, lienRef, priseDuPlan, libelles, t]);

  const ecrireFichiers = useCallback(async (sb: Storyboard) => {
    try {
      await writeProjectFile(cheminJson(sb.id), storyboardJson(sb));
      await writeProjectFile(cheminMarkdown(sb.id), markdownDe(sb));
      setEchecEcriture(false);
      return true;
    } catch {
      setEchecEcriture(true);
      return false;
    }
  }, [writeProjectFile, markdownDe]);

  /** Keeps a change in memory at once; the two files follow a moment later (or now with `now: true`). */
  const sauver = useCallback(async (sb: Storyboard, options: { now?: boolean } = {}) => {
    latest.current = { ...latest.current, [sb.id]: sb };
    setBoards({ ...latest.current });
    const pending = timers.current.get(sb.id);
    if (pending) clearTimeout(pending);
    if (options.now) { timers.current.delete(sb.id); return ecrireFichiers(sb); }
    timers.current.set(sb.id, setTimeout(() => { timers.current.delete(sb.id); void ecrireFichiers(latest.current[sb.id] ?? sb); }, WRITE_DELAY));
    return true;
  }, [ecrireFichiers]);

  // Nothing typed is lost when the page closes.
  useEffect(() => {
    const flush = () => { for (const [id, timer] of timers.current) { clearTimeout(timer); const sb = latest.current[id]; if (sb) void ecrireFichiers(sb); } timers.current.clear(); };
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, [ecrireFichiers]);

  const liste = useMemo(() => Object.values(boards).sort((a, b) => b.majLe.localeCompare(a.majLe)), [boards]);

  return { boards, liste, illisibles, charge, echecEcriture, registre, setRegistre, prixPrise, ctxDevis, sauver, priseDuPlan, markdownDe };
}

export type Storyboards = ReturnType<typeof useStoryboards>;
