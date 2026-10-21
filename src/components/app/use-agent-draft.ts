"use client";
import { useEffect, useRef } from "react";
import { AGENT_DRAFT_FILE, AGENT_EVENT, parseAgentDraft, type AgentDraft } from "@/lib/agent/execution";
import { productionContext, projectResources, type BoundResource } from "@/lib/agent/context";
import { studioActionRegistry, type StudioAction } from "@/lib/agent/registry";
import { useStudio } from "./studio-session";

/** A prepared handoff fills fields only; it cannot click confirmation or submit a job. */
export function useAgentDraft(accepts: (op: StudioAction) => boolean, apply: (draft: AgentDraft, resources: BoundResource[], op: StudioAction) => void) {
  const studio = useStudio();
  const latest = useRef({ studio, accepts, apply });
  latest.current = { studio, accepts, apply };
  const consumed = useRef("");
  useEffect(() => {
    let gone = false;
    let busy = false;
    async function read() {
      if (busy || !latest.current.studio.ready) return;
      busy = true;
      const { studio: s, accepts, apply } = latest.current;
      try {
        const ops = studioActionRegistry(s.prefs);
        const draft = parseAgentDraft(await s.readProjectFile(AGENT_DRAFT_FILE), productionContext(s, ops, []));
        if (gone || latest.current.studio.studio.project !== s.studio.project || !draft || consumed.current === draft.stepId) return;
        const op = ops.find(op => op.id === draft.operationId)!;
        if (!accepts(op)) return;
        // Apply while this module is mounted; a later mount may safely refill the same draft.
        apply(draft, projectResources(s).filter(r => draft.resourceIds.includes(r.id)), op);
        await s.writeProjectFile(AGENT_DRAFT_FILE, "");
        consumed.current = draft.stepId;
      } catch { /* Keep the draft for a later attempt; no request is submitted. */ }
      finally { busy = false; }
    }
    void read();
    window.addEventListener(AGENT_EVENT, read);
    return () => { gone = true; window.removeEventListener(AGENT_EVENT, read); };
  }, [studio.ready, studio.studio.project, studio.media]);
}
