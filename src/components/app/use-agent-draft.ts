"use client";
import { useEffect, useRef } from "react";
import { AGENT_DRAFT_FILE, AGENT_EVENT, parseAgentDraft, type AgentDraft } from "@/lib/agent/execution";
import { productionContext, projectResources, type BoundResource } from "@/lib/agent/context";
import { studioActionRegistry, type StudioAction } from "@/lib/agent/registry";
import { useStudio } from "./studio-session";

/** A prepared handoff fills fields or edits the local timeline; it cannot submit a job. */
export function useAgentDraft(accepts: (op: StudioAction) => boolean, apply: (draft: AgentDraft, resources: BoundResource[], op: StudioAction) => void | Promise<void>, enabled = true) {
  const studio = useStudio();
  const latest = useRef({ studio, accepts, apply });
  latest.current = { studio, accepts, apply };
  const consumed = useRef("");
  const busy = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    let gone = false;
    async function read() {
      if (busy.current || !latest.current.studio.ready) return;
      busy.current = true;
      const { studio: s, accepts, apply } = latest.current;
      try {
        const ops = studioActionRegistry(s.prefs);
        const snapshot = await s.readProjectFile(AGENT_DRAFT_FILE);
        const draft = parseAgentDraft(snapshot, productionContext(s, ops, []));
        if (gone || latest.current.studio.studio.project !== s.studio.project || !draft || consumed.current === `${draft.projectId}:${draft.stepId}`) return;
        const op = ops.find(op => op.id === draft.operationId)!;
        if (!accepts(op)) return;
        // Apply while this module is mounted; a later mount may safely refill the same draft.
        await apply(draft, projectResources(s).filter(r => draft.resourceIds.includes(r.id)), op);
        if (latest.current.studio.studio.project !== s.studio.project) return;
        // A newer handoff must never be cleared by a slower previous one.
        const current = await s.readProjectFile(AGENT_DRAFT_FILE);
        if (current !== snapshot || latest.current.studio.studio.project !== s.studio.project) return;
        await s.writeProjectFile(AGENT_DRAFT_FILE, "");
        consumed.current = `${draft.projectId}:${draft.stepId}`;
      } catch { /* Keep the draft for a later attempt; no request is submitted. */ }
      finally {
        busy.current = false;
        // Hydration may have replaced the effect during an asynchronous save.
        if (gone) window.dispatchEvent(new Event(AGENT_EVENT));
      }
    }
    void read();
    window.addEventListener(AGENT_EVENT, read);
    return () => { gone = true; window.removeEventListener(AGENT_EVENT, read); };
  }, [studio.ready, studio.studio.project, studio.media, enabled]);
}
