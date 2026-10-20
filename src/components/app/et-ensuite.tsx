"use client";

// « Et ensuite ? » : the next step on an image or a take. Each action opens the real tool
// page of the public grid, with the file already in place and one estimated cost on the
// label. Nothing runs from this panel. The original file is only read.

import { useEffect, useId, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { outilParId, outilsPublics } from "@/lib/outils/catalogue";
import { outilQuote } from "@/lib/outils/graphs";
import { assetPath } from "@/lib/site";
import { videoSeconds } from "@/lib/suite/media";
import { useStudio } from "./studio-session";
import { StudioAgentInline } from "./studio-agent-inline";
import { safeHandoffUrl } from "@/lib/agent/source";

export interface SuiteSource {
  kind: "image" | "video";
  /** What the browser shows (blob, data or site URL). */
  url: string;
  name: string;
  /** Vault path of the validated asset, written as the result's reference. */
  path?: string;
  aspect?: "horizontal" | "vertical";
}

type Outil = "suite-modifier" | "suite-finaliser-image" | "suite-detourer" | "suite-elargir" | "suite-3d" | "suite-animer" | "suite-parler" | "suite-finaliser-video" | "suite-fluidifier" | "suite-prolonger";

const IMAGE_TOOLS: Outil[] = ["suite-modifier", "suite-finaliser-image", "suite-detourer", "suite-elargir", "suite-3d", "suite-animer", "suite-parler"];
const VIDEO_TOOLS: Outil[] = ["suite-finaliser-video", "suite-fluidifier", "suite-prolonger"];

/** The public tool page each action opens. */
export const SUITE_PAGE: Record<Outil, string> = {
  "suite-modifier": "ret-modifier",
  "suite-finaliser-image": "ret-finaliser",
  "suite-detourer": "ret-detourer",
  "suite-elargir": "ret-elargir",
  "suite-3d": "3d-ouvert",
  "suite-animer": "vid-wan",
  "suite-parler": "vid-parler",
  "suite-finaliser-video": "vid-finaliser",
  "suite-fluidifier": "vid-fluidifier",
  "suite-prolonger": "vid-prolonger",
};

/** Item sheet split: what turns the asset into another medium, and what refines it in place. */
export const SUITE_CONVERTIR: Outil[] = ["suite-3d", "suite-animer", "suite-parler", "suite-prolonger", "suite-fluidifier"];
export const SUITE_RETOUCHER: Outil[] = ["suite-modifier", "suite-finaliser-image", "suite-detourer", "suite-elargir", "suite-finaliser-video"];

export const SOURCE_KEY = "u-ttu-source";

export interface HandedSource {
  url: string;
  name: string;
  path?: string;
  kind: "image" | "video";
  aspect?: "horizontal" | "vertical";
}

/** Remember the open file so the tool page can place it. A blob URL does not survive the navigation. */
export function rememberSource(source: SuiteSource) {
  const payload: HandedSource = {
    url: safeHandoffUrl(source.url),
    name: source.name,
    path: source.path,
    kind: source.kind,
    aspect: source.aspect,
  };
  try { sessionStorage.setItem(SOURCE_KEY, JSON.stringify(payload)); } catch { /* the tool still opens */ }
  window.dispatchEvent(new Event("u-ttu-source"));
}

export function EtEnsuite({ source, onPrise, initial = null, defaultOpen = false, only, grouped = false }: {
  source: SuiteSource;
  /** Animer: also offer to open the image in a shot. */
  onPrise?(): void;
  /** Deep link: marks that action, without opening a second panel. */
  initial?: Outil | null;
  /** Results show the menu open, visible without opening a detail panel. */
  defaultOpen?: boolean;
  /** Keeps only these tools (item sheet: Convertir or Retoucher). */
  only?: Outil[];
  /** Item sheet: the same tools, under « Convertir » then « Retoucher ». */
  grouped?: boolean;
}) {
  const { t } = useI18n();
  const { prefs } = useStudio();
  const [open, setOpen] = useState(initial !== null || defaultOpen);
  const [seconds, setSeconds] = useState<number | null>(null);
  const menuId = useId();
  const pages = new Set(outilsPublics(prefs).map(item => item.id));
  useEffect(() => { setOpen(initial !== null || defaultOpen); }, [source.url, initial, defaultOpen]);
  useEffect(() => {
    if (source.kind !== "video") return;
    let gone = false;
    void videoSeconds(source.url).then(value => { if (!gone) setSeconds(value); });
    return () => { gone = true; };
  }, [source.url, source.kind]);
  const tools = (source.kind === "image" ? IMAGE_TOOLS : VIDEO_TOOLS).filter(id => !only || only.includes(id)).filter(id => pages.has(SUITE_PAGE[id]));
  if (!source.url || tools.length === 0) return null;

  return <section className="u-suite" data-et-ensuite={source.kind} aria-label={t("suite.title")}>
    <button type="button" className="u-suite-toggle" aria-expanded={open} aria-controls={menuId} data-suite-toggle="" onClick={() => setOpen(value => !value)}>
      <span>{t("suite.title")}</span><span aria-hidden="true">{open ? "−" : "+"}</span>
    </button>
    {open && <div id={menuId} className="u-suite-menu" role="group" aria-label={t("suite.title")}>
      {(grouped ? [["convert", tools.filter(id => SUITE_CONVERTIR.includes(id))], ["retouch", tools.filter(id => SUITE_RETOUCHER.includes(id))]] as const : [["", tools]] as const).map(([group, list]) => list.length === 0 ? null : <div key={group || "all"} className="u-suite-group" data-suite-group={group || undefined}>
        {group && <p className="u-label">{t(group === "convert" ? "creations.convert" : "creations.retouch")}</p>}
        {list.map(id => {
          const page = SUITE_PAGE[id];
          const outil = outilParId(page);
          const quote = outil ? outilQuote(outil, { seconds: seconds ?? undefined }) : null;
          return <a key={id} className="u-suite-item" data-suite-item={id} href={assetPath(`/studio#outils/${page}`)} aria-current={initial === id ? "true" : undefined} onClick={() => rememberSource(source)}>
            <span className="u-suite-name">{t(`outils.t.${page}.title`)}</span>
            {quote && <span className="u-suite-cost">{t("outils.cost", { credits: formatCredits(quote.credits) })}</span>}
          </a>;
        })}
      </div>)}
      <StudioAgentInline source={source} onPrepare={() => rememberSource(source)} />
      {onPrise && <button type="button" className="u-secondary u-suite-prise" data-suite-prise="" onClick={onPrise}>{t("suite.toPrise")}</button>}
    </div>}
  </section>;
}
