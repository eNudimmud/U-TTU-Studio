"use client";

import dynamic from "next/dynamic";
import { useStudioSession } from "./session";

const loading = () => <p className="loading-panel" role="status">Ouverture…</p>;
const DatasetStep = dynamic(() => import("../guide/dataset-step").then(m => m.DatasetStep), { loading });
const GatePanel = dynamic(() => import("../guide/gate-panel").then(m => m.GatePanel), { loading });

export function LotReview() {
  const session = useStudioSession();
  const untriaged = session.images.some(image => image.decision === "a-trier");

  return <>
    {untriaged && <div className="review-keep">
      <button type="button" className="button button-outline" onClick={session.keepProposed}>Garder les images proposées</button>
      <p>Celles qui sont illisibles ou trop petites restent de côté. Les 5 confirmations, en bas, restent à toi.</p>
    </div>}
    {session.notice && <p className="inline-status warn" role="status">{session.notice}</p>}
    <div className="preparation-layout">
      <DatasetStep reviewOnly trigger={session.trigger} invariants={session.invariants} images={session.images} previews={session.previews} result={session.result} highlight={session.highlight}
        confirmations={session.confirmations} progress={session.progress} onTrigger={session.setTrigger} onInvariants={session.setInvariants} onFiles={session.addFiles} onUpdate={session.updateImage}
        onRejectUntriaged={session.rejectUntriaged} onClear={session.clearAll} onConfirm={session.setConfirm} />
      <GatePanel result={session.result} onShowImages={session.showImages} />
    </div>
  </>;
}
