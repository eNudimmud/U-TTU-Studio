"use client";

/**
 * Progressive enhancement for « Et ensuite ? ».
 * The assistant only proposes an existing tool; the Studio tool hub remains
 * responsible for quote, confirmation, execution and asset persistence.
 */
import { useState } from "react";
import { assetPath } from "@/lib/site";
import { outilParId, outilsPublics } from "@/lib/outils/catalogue";
import { studioAgentSnapshot } from "@/lib/agent/capabilities";
import { decideStudioRequest } from "@/lib/agent/decision";
import { useStudio } from "./studio-session";
type SuiteSource = { kind: "image" | "video"; url: string; name: string; path?: string; aspect?: "horizontal" | "vertical" };

export function StudioAgentInline({ source, onPrepare }: { source: SuiteSource; onPrepare: () => void }) {
  const { prefs } = useStudio();
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState("");
  const [submitted, setSubmitted] = useState("");
  const snapshot = studioAgentSnapshot(prefs);
  const capability = snapshot.capabilities.find(item => item.id === "suite-detourer");
  const tool = outilParId("ret-detourer");
  const accessible = Boolean(capability?.enabled && tool && outilsPublics(prefs).some(item => item.id === tool.id));
  const eligible = accessible && source.kind === "image" && Boolean(source.url);
  const decision = decideStudioRequest(submitted, snapshot.capabilities, source.kind === "image" && source.url ? { id: source.path ?? source.name, kind: "image" } : undefined);
  const matched = decision.kind !== "unrecognized";
  return <div className="u-agent-inline" data-studio-agent="">
    <button type="button" className="u-secondary" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      Assistant U*TTU
    </button>
    {open && <div className="u-agent-inline-body">
      <label htmlFor="uttu-agent-intent">Que veux-tu faire avec cette image ?</label>
      <form onSubmit={event => { event.preventDefault(); setSubmitted(request.trim()); }}>
        <input id="uttu-agent-intent" aria-label="Demande à U*TTU" value={request}
          onChange={event => setRequest(event.target.value)} maxLength={500}
          placeholder="Ex. Détoure cette image" />
        <button type="submit" className="u-secondary">Proposer</button>
      </form>
      {submitted && <div role="status">
        {!matched ? <p>Je ne peux pas encore préparer cette opération. Utilise les outils du Studio.</p> :
          !eligible ? <p>Le détourage n'est pas disponible pour cette source actuellement.</p> :
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
