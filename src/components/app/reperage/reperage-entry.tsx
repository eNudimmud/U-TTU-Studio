"use client";

// The single DÉCOR entry to the 3D repérage. The sheet and three.js load on the first tap.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import type { CaptureInput, CaptureSaved, StreetPhotoFile } from "./reperage-3d";

const Sheet = dynamic(() => import("./reperage-3d").then(module => module.Reperage3DSheet), { ssr: false, loading: () => <div className="u-rep3d is-boot" role="status" /> });

interface Props {
  quote: { credits: number | null; high: number | null };
  onCapture(input: CaptureInput): Promise<{ sceneId: string } | null>;
  onCaptured(saved: CaptureSaved): void;
  onStreetPhoto(place: { name: string; lat: number; lon: number }, photo: StreetPhotoFile): Promise<boolean>;
}

export function ReperageEntry({ quote, onCapture, onCaptured, onStreetPhoto }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    const openFromAgent = () => setOpen(true);
    window.addEventListener("u-ttu-agent-scout", openFromAgent);
    return () => window.removeEventListener("u-ttu-agent-scout", openFromAgent);
  }, []);

  return <section className="u-rep3d-entry" aria-labelledby="u-rep3d-entry-title" data-rep3d-entry="">
    <div>
      <p className="u-label" id="u-rep3d-entry-title">{t("rep3d.entryTitle")}</p>
      <p className="u-small">{t("rep3d.entryLead")}</p>
    </div>
    <button type="button" className="u-primary" data-rep3d-open="" onClick={() => setOpen(true)}>{t("rep3d.open")}</button>
    {open && <Sheet onClose={close} onCapture={onCapture} onCaptured={onCaptured} onStreetPhoto={onStreetPhoto} quote={quote} />}
  </section>;
}
