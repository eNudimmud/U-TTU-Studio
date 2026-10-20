"use client";

/**
 * Progressive enhancement for « Et ensuite ? ».
 * The assistant only proposes an existing tool; the Studio tool hub remains
 * responsible for quote, confirmation, execution and asset persistence.
 */
import { useId, useState } from "react";
import { assetPath } from "@/lib/site";
import { studioAgentSnapshot } from "@/lib/agent/capabilities";
import { decideStudioRequest } from "@/lib/agent/decision";
import { agentSourceId } from "@/lib/agent/source";
import { useStudio } from "./studio-session";
type SuiteSource = { kind: "image" | "video"; url: string; name: string; path?: string; aspect?: "horizontal" | "vertical" };

export function StudioAgentInline({ source, onPrepare }: { source: SuiteSource; onPrepare: () => void }) {
  const { prefs } = useStudio();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState("");
  const [submitted, setSubmitted] = useState("");
  const snapshot = studioAgentSnapshot(prefs);
  const sourceId = agentSourceId(source);
  const decision = decideStudioRequest(submitted, snapshot.capabilities, source.kind === "image" && sourceId ? { id: sourceId, kind: "image" } : undefined);
  return <div className="u-agent-inline" data-studio-agent="">
    <button type="button" className="u-secondary" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      Assistant U*TTU
    </button>
    {open && <div className="u-agent-inline-body">
      <label htmlFor={inputId}>Que veux-tu faire avec cette image ?</label>
      <form onSubmit={event => { event.preventDefault(); setSubmitted(request.trim()); }}>
        <input id={inputId} aria-label="Demande à U*TTU" value={request}
          onChange={event => setRequest(event.target.value)} maxLength={500}
          placeholder="Ex. Détoure cette image" />
        <button type="submit" className="u-secondary">Proposer</button>
      </form>
      {submitted && <div role="status">
        {decision.kind !== "propose" ? <p>{source.kind === "image" && source.url.startsWith("blob:") && !source.path && decision.kind === "missing_asset" ? "Cette image temporaire doit d’abord être enregistrée dans le coffre du Studio avant de changer d’outil." : decision.message}</p> :
          <div>
            <p>Détourage BiRefNet prêt à préparer. Aucun crédit ne sera dépensé ici.</p>
            <a className="u-secondary" href={assetPath("/studio#outils/ret-detourer")}
              onClick={onPrepare}>
              Ouvrir l'outil et vérifier le devis
            </a>
          </div>}
      </div>}
    </div>}
  </div>;
}
