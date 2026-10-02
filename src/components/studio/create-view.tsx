"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { DATASET_SIZE, COMFY_APPS, estimateTrainRun } from "@/lib/comfy-stack";
import { BURN_CONFIRM_LABEL, BURN_HOLD_LABEL, BURN_WARN, admitBurn, lookHeld } from "@/lib/doctrine";
import { formatEstimate } from "@/lib/gate/report";
import { processAction, processById } from "@/lib/processes";
import { Arrow } from "../glyph";
import { CreatePanel } from "./create-panel";
import { DoctrineBurn } from "./doctrine-burn";
import { LotReview } from "./lot-review";
import { LookStatus } from "./look-status";
import { useGoToMode, useGoToStep } from "./mode-context";
import { useProcessLaunch } from "./process-launch";
import { useStudioSession } from "./session";

const loading = () => <p className="loading-panel" role="status">Ouverture…</p>;
const TrainStep = dynamic(() => import("../guide/train-step").then(m => m.TrainStep), { loading });
const ImageStep = dynamic(() => import("../guide/image-step").then(m => m.ImageStep), { loading });
const ComfyRunPanel = dynamic(() => import("../guide/comfy-run-panel").then(m => m.ComfyRunPanel), { loading });
const TestGrid = dynamic(() => import("../guide/test-grid").then(m => m.TestGrid), { loading });
const FalRail = dynamic(() => import("../guide/fal-rail").then(m => m.FalRail), { loading });
const LoraTutorial = dynamic(() => import("../guide/lora-tutorial").then(m => m.LoraTutorial), { loading });
const onFalStage = () => {};

export function CreateView() {
  const session = useStudioSession();
  const go = useGoToMode();
  const goStep = useGoToStep();
  const launch = useProcessLaunch();
  const former = processById("former");
  const tester = processById("tester");
  const formerAction = former ? processAction(former, !session.passed) : null;
  const canon = { refCount: session.refPreviews.length, trigger: session.trigger, invariants: session.invariants, canonNoted: session.canonNoted };
  const held = lookHeld(canon);
  const [tutorial, setTutorial] = useState(false);
  const [expertMounted, setExpertMounted] = useState(false);
  const [showTests, setShowTests] = useState(false);
  const [burnOpen, setBurnOpen] = useState(false);
  const [expertArmed, setExpertArmed] = useState(false);
  const reviewOpen = session.showReview || session.images.length > 0;
  const zipReady = session.shownExport.state === "done" && !session.shownExport.stale;

  function openManual() {
    session.setShowReview(true);
    requestAnimationFrame(() => document.getElementById("revue")?.scrollIntoView({ block: "start" }));
  }

  function launchFormer() {
    if (!former) return;
    launch.request(former.id);
    go("sphere");
  }

  function onFormer() {
    if (!formerAction?.enabled) return;
    if (admitBurn("train", held, false)) {
      launchFormer();
      return;
    }
    setBurnOpen(true);
  }

  function confirmFormer() {
    if (!admitBurn("train", held, true)) return;
    setBurnOpen(false);
    launchFormer();
  }

  return <section className="create-studio" aria-label="Ton style">
    <header className="create-hero">
      <p className="eyebrow">Look</p>
      <h1 id="mode-title" tabIndex={-1}>Dépose tes photos.</h1>
      <LookStatus held={held} />
      <button type="button" className="text-button" onClick={() => goStep("plateau")}>Ensuite, poser le monde</button>
    </header>

    <CreatePanel
      trigger={session.trigger} invariants={session.invariants} token={session.token} proxyOn={session.falProxyOn}
      busy={session.boot.phase !== "idle"} arrived={session.arrived} status={session.bootStatus} refs={session.refPreviews}
      onTrigger={session.setTrigger} onInvariants={session.setInvariants} onToken={session.setToken} onRefs={session.setRefs}
      onBootstrap={session.bootstrap} onManual={openManual}
    />

    <details className="disclosure create-drawer">
      <summary>Avant un long entraînement</summary>
      <DoctrineBurn input={canon} onCanonNoted={session.setCanonNoted} />
    </details>

    {former && formerAction && tester && <section className="create-process" aria-labelledby="former-access">
      <div>
        <p className="eyebrow">Ensuite</p>
        <h2 id="former-access">{former.title}</h2>
        <p>{session.passed ? "Tes images sont prêtes. La suite s’ouvre après un second clic." : "D’abord tes photos. Ce bouton s’ouvre ensuite."}</p>
      </div>
      <div className="create-process-actions">
        <button type="button" className="button button-outline" onClick={() => { launch.request(tester.id); go("sphere"); }}>{tester.title}</button>
        <button type="button" className={`button ${formerAction.enabled ? "button-primary" : "button-outline"}`} disabled={!formerAction.enabled} onClick={onFormer}>{formerAction.label}</button>
      </div>
      {burnOpen && <div className="burn-confirm" role="region" aria-label="Confirmation du burn">
        <p>{BURN_WARN}</p>
        <div className="burn-actions">
          <button type="button" className="button button-outline" onClick={() => setBurnOpen(false)}>{BURN_HOLD_LABEL}</button>
          <button type="button" className="button button-primary" onClick={confirmFormer}>{BURN_CONFIRM_LABEL}</button>
        </div>
      </div>}
    </section>}

    <details className="disclosure create-drawer" onToggle={event => { if (event.currentTarget.open) setTutorial(true); }}>
      <summary>Comment ça marche</summary>
      {tutorial && <LoraTutorial embedded startLabel="Revenir aux photos" onStart={() => document.getElementById("create-drop")?.querySelector("input")?.focus()} />}
    </details>

    {reviewOpen && <section id="revue" className="create-review" aria-labelledby="revue-title">
      <header className="stage-heading">
        <div>
          <p className="eyebrow">Revue</p>
          <h2 id="revue-title" tabIndex={-1}>Le lot, à l’œil.</h2>
          <p>Même vérification : {DATASET_SIZE} images, angles, légendes. Garde ce qui est la même personne. Une fiche à la fois.</p>
        </div>
        <span className="stage-badge">{session.result.kept.length} / {DATASET_SIZE}</span>
      </header>
      <LotReview />
    </section>}

    {session.passed && <section id="entrainer" className="create-train" aria-labelledby="entrainer-title">
      <header className="stage-heading">
        <div>
          <p className="eyebrow">Entraîner · ici</p>
          <h2 id="entrainer-title">Ton style, puis une image.</h2>
          <p>Tes images sont prêtes. Le fichier se télécharge sur cette page.</p>
        </div>
      </header>
      <div className="create-scene">
        <label htmlFor="create-scene">La scène de la première image, en anglais</label>
        <input id="create-scene" value={session.scene} onChange={event => session.setScene(event.target.value)} placeholder="walking in a snowy park, soft daylight" maxLength={260} spellCheck={false} />
        <p>La scène seulement. Le mot d’appel porte la personne.</p>
      </div>
      <FalRail hideTokenField armTrain={!held} token={session.token} onToken={session.setToken} onStage={onFalStage} passed={session.passed} trigger={session.trigger} scene={session.scene} seed={session.seed} signature={session.signature}
        onBuildZip={session.buildFalZip} />
    </section>}

    <details className="disclosure create-drawer expert-drawer" onToggle={event => { if (event.currentTarget.open) setExpertMounted(true); }}>
      <summary>Expert</summary>
      <p className="expert-note">Comfy ouvre un compte sur un autre site, avec ses propres traceurs au chargement du cadre. Ce n’est pas le chemin pour créer. Le cadre ne se charge qu’après un second clic.</p>
      {expertMounted && session.passed && <>
        <TrainStep captions={session.captions} steps={session.steps} plan={session.plan} count={session.count} exportState={session.shownExport} testDone={session.testDone}
          onSteps={session.setSteps} onPlan={session.setPlan} onExport={session.exportZip} onTestDone={session.setTestDone} />
        <ComfyRunPanel app="train" />
        <ImageStep trigger={session.trigger} invariants={session.invariants} scene={session.scene} strength={session.strength} seed={session.seed} count={session.count} steps={session.steps} received={session.received}
          onScene={session.setScene} onStrength={session.setStrength} onSeed={session.setSeed} onCount={session.setCount} onReceived={session.setReceived} />
        <section className="launch-summary" aria-label="Lancement Comfy"><div><h3>Lancer dans Comfy ?</h3><p>{session.steps} étapes · {session.count} image{session.count > 1 ? "s" : ""} + témoin · <strong>{formatEstimate(estimateTrainRun(session.steps, session.count))}</strong></p><p className="small-print">Estimation non mesurée, crédits du compte Comfy. La LoRA reste limitée à ce run.</p></div>
          {!session.canLaunch && <p className="inline-status warn">{!zipReady ? "Télécharge un ZIP à jour dans ce repli." : !session.testDone ? "Confirme d’abord les 3 sorties du test court." : "Réduis les étapes ou le nombre d’images pour respecter la durée du plan."}</p>}
          {admitBurn("train", held, expertArmed)
            ? <a className="button button-outline" href={COMFY_APPS.train.url} target="_blank" rel="noopener noreferrer">Ouvrir Comfy ↗</a>
            : <button type="button" className="button button-outline" onClick={() => setExpertArmed(true)}>{BURN_CONFIRM_LABEL}</button>}
          <label className="check-inline"><input type="checkbox" checked={session.realLaunched && session.canLaunch} disabled={!session.canLaunch} onChange={event => session.setRealLaunched(event.target.checked)} /><span>J’ai lancé le run réel dans Comfy</span></label>
        </section>
        <details className="disclosure advanced-tools" onToggle={event => { if (event.currentTarget.open) setShowTests(true); }}><summary>Comparer les forces et tester la scène</summary>{showTests && <><TestGrid trigger={session.trigger} seed={session.seed} steps={session.steps} /><ComfyRunPanel app="prompt" /></>}</details>
      </>}
      {expertMounted && !session.passed && <p className="loading-panel">Le repli s’ouvre quand tes images sont prêtes.</p>}
    </details>

    <section id="questions" className="create-questions" aria-labelledby="questions-title">
      <p className="eyebrow">Questions</p>
      <h2 id="questions-title">En bref.</h2>
      <div className="faq-list">
        <details><summary>De quoi ai-je besoin ?</summary><p>2 ou 3 photos nettes de la même personne, et les droits pour les utiliser. Le studio en prépare 15 cadrages. Tu vérifies avant la suite. Tu peux aussi importer tes 15 images toi-même.</p></details>
        <details><summary>Qu’est-ce qui est payant ?</summary><p>La page ne facture rien. Préparer les images, puis en créer, a un coût affiché avant chaque clic. Le repli Expert dépense les crédits d’un autre compte. Rien n’est en vente.</p></details>
        <details><summary>Où vont mes images ?</summary><p>Rien ne part tant que tu ne cliques pas. Au clic sur « Préparer les 15 images », les photos passent par le studio, jamais avec une clé dans la page. Ce que tu télécharges reste dans ton navigateur.</p></details>
        <details><summary>Est-ce que je récupère un fichier ?</summary><p>Oui. Un fichier à télécharger sur cette page, une fois tes images prêtes. Le repli Expert produit une image dans le même lancement, sans fichier à emporter.</p></details>
        <details><summary>Et si j’ai déjà mes images ?</summary><p>Ouvre « J’ai déjà 15 images ». Sans la préparation automatique, c’est le bouton principal. Le tuto est dans « Comment ça marche ». Le repli est dans « Expert ».</p></details>
        <details><summary>Où vit le studio, une fois la page fermée ?</summary><p>Sur ta machine. Le mode Studio donne le schéma et un fichier de départ. Cette page n’écrit pas dans ce dossier.</p></details>
      </div>
    </section>
  </section>;
}
