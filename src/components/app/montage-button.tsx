"use client";

// « Ajouter au montage » where a result is shown: the thread and a tool's result.
// The clip lands on the cut in place, with its own duration; the page does not change.

import { useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { useStudio, type MontageInput } from "./studio-session";

export function MontageButton({ input }: { input: MontageInput }) {
  const { t } = useI18n();
  const { sendToMontage } = useStudio();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function add() {
    if (state === "busy") return;
    setState("busy");
    try {
      await sendToMontage(input);
      setState("done");
    } catch { setState("error"); }
  }

  if (state === "done") return <p className="u-small u-fil-done" data-montage-done="" role="status">{t("barre.fil.inMontage")}</p>;
  return <>
    <button type="button" className="u-secondary" data-montage-add="" aria-busy={state === "busy"} onClick={() => void add()}>{t("assets.toMontage")}</button>
    {state === "error" && <p className="u-small" role="alert" data-montage-failed="">{t("barre.fil.montageFailed")}</p>}
  </>;
}
