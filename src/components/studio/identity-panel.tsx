"use client";

import dynamic from "next/dynamic";
import { DATASET_SIZE } from "@/lib/comfy-stack";
import { lookHeld } from "@/lib/doctrine";
import { Arrow } from "../glyph";
import { DoctrineBurn } from "./doctrine-burn";
import { LotReview } from "./lot-review";
import { useGoToMode } from "./mode-context";
import { useStudioSession } from "./session";

const loading = () => <p className="loading-panel" role="status">Ouverture…</p>;
const FalRail = dynamic(() => import("../guide/fal-rail").then(m => m.FalRail), { loading });
const onFalStage = () => {};

export function IdentityPanel() {
  const session = useStudioSession();
  const go = useGoToMode();
  const building = session.shownExport.state === "building";
  const canon = { refCount: session.refPreviews.length, trigger: session.trigger, invariants: session.invariants, canonNoted: session.canonNoted };
  const held = lookHeld(canon);

  return <section className="mode-panel" aria-labelledby="mode-title">
    <header className="mode-hero">
      <p className="eyebrow">Identité</p>
      <h1 id="mode-title" tabIndex={-1}>Le personnage, <em>tenu.</em></h1>
      <p className="mode-lead">Gate, légendes, ZIP. Le rail fal s’allume seulement si le proxy est branché. Sans lui, tout reste dans cette page.</p>
      <div className="mode-links">
        <button type="button" className="text-button" onClick={() => go("creer")}>Déposer 2 ou 3 photos</button>
        <button type="button" className="text-button" onClick={() => go("studio")}>Ranger le canon dans le coffre</button>
      </div>
    </header>

    {!session.falProxyOn && <aside className="offline-fal" role="status">
      <p><strong>Hors ligne.</strong> Proxy fal absent. Tu peux trier, légender et préparer le ZIP. Aucune requête.</p>
    </aside>}

    <DoctrineBurn input={canon} onCanonNoted={session.setCanonNoted} />

    <section className="identity-surface" aria-labelledby="identity-lot">
      <header className="stage-heading">
        <div>
          <p className="eyebrow">Lot</p>
          <h2 id="identity-lot">Gate, images, légendes.</h2>
          <p>{DATASET_SIZE} images, angles, confirmations. Une fiche à la fois. Rien n’est envoyé par l’import.</p>
        </div>
        <span className="stage-badge">{session.passed ? "PASS" : "À compléter"} · {session.result.kept.length} / {DATASET_SIZE}</span>
      </header>
      <LotReview />
      {session.captions.trim() && <details className="disclosure identity-captions">
        <summary>Légendes du lot</summary>
        <pre className="caption-block">{session.captions}</pre>
      </details>}
    </section>

    <section className="identity-zip" aria-labelledby="identity-zip">
      <div>
        <p className="eyebrow">Archive</p>
        <h2 id="identity-zip">ZIP du gate</h2>
        <p>{DATASET_SIZE} images, leurs légendes, le rapport. Le fichier se télécharge sur cet appareil.</p>
      </div>
      <button type="button" className="button button-primary" onClick={session.exportZip} disabled={!session.passed || building}>
        {building ? `Préparation ${session.shownExport.state === "building" ? `${session.shownExport.done} / ${session.shownExport.total}` : ""}…` : "Télécharger le ZIP"} <Arrow />
      </button>
      {!session.passed && <p>Disponible quand le lot est en PASS.</p>}
      {session.shownExport.state === "done" && <p className={`inline-status ${session.shownExport.stale ? "warn" : "pass"}`} role="status">{session.shownExport.stale ? "Le lot a changé. Télécharge un nouveau ZIP." : `ZIP prêt · ${(session.shownExport.size / 1048576).toFixed(1)} Mo`}</p>}
      {session.shownExport.state === "error" && <p className="inline-status fail" role="alert">{session.shownExport.message}</p>}
    </section>

    <section className="identity-surface identity-fal" aria-labelledby="identity-fal">
      <header className="stage-heading">
        <div>
          <p className="eyebrow">Rail</p>
          <h2 id="identity-fal">Entraîner, quand le proxy est là.</h2>
          <p>Même gate. Le bouton reste éteint tant que l’adresse du proxy manque.</p>
        </div>
      </header>
      {session.passed && <div className="create-scene">
        <label htmlFor="identity-scene">La scène de la première image, en anglais</label>
        <input id="identity-scene" value={session.scene} onChange={event => session.setScene(event.target.value)} placeholder="walking in a snowy park, soft daylight" maxLength={260} spellCheck={false} />
        <p>La scène seulement. Le mot d’appel porte la personne.</p>
      </div>}
      {session.falProxyOn && session.passed && <div className="create-scene">
        <label htmlFor="identity-token">Code d’accès du studio</label>
        <input id="identity-token" type="password" autoComplete="off" spellCheck={false} value={session.token} onChange={event => session.setToken(event.target.value)} />
        <p>La clé fal du studio paie. Le code reste dans cette page.</p>
      </div>}
      <FalRail hideTokenField armTrain={!held} token={session.token} onToken={session.setToken} onStage={onFalStage} passed={session.passed} trigger={session.trigger} scene={session.scene} seed={session.seed} signature={session.signature}
        onBuildZip={session.buildFalZip} />
    </section>
  </section>;
}
