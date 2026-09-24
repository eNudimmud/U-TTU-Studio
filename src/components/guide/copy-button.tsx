"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copier", className = "text-button" }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("error");
    }
    window.setTimeout(() => setState("idle"), 2200);
  }
  return <button type="button" className={className} onClick={copy} disabled={!text}>
    {state === "done" ? "Copié" : state === "error" ? "Sélectionne et copie" : label}
    <span className="sr-only" role="status">{state === "done" ? "Texte copié." : state === "error" ? "Copie indisponible." : ""}</span>
  </button>;
}
