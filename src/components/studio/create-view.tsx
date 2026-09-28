"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { DATASET_SIZE, COMFY_APPS, estimateTrainRun } from "@/lib/comfy-stack";
import { formatEstimate } from "@/lib/gate/report";
import { Arrow } from "../glyph";
import { CreatePanel } from "./create-panel";
import { LotReview } from "./lot-review";
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
  const [tutorial, setTutorial] = useState(false);
  const [expertMounted, setExpertMounted] = useState(false);
  const [showTests, setShowTests] = useState(false);
  const reviewOpen = session.showReview || session.images.length > 0;
  const zipReady = session.shownExport.state === "done" && !session.shownExport.stale;

  function openManual() {
    session.setShowReview(true);
    requestAnimationFrame(() => document.getElementById("revue")?.scrollIntoView({ block: "start" }));
  }

  return <section className="create-studio" aria-label="Créer une LoRA">
    <header className="create-hero">
      <p className="eyebrow">Créer</p>
      <h1 id="mode-title" tabIndex={-1}>Deux photos. <em>Une identité.</em></h1>
      <p className="create-lead">Dépose 2 ou 3 photos de la même personne. Le studio prépare 15 cadrages. Tu vérifies, puis l’image reste sur cette page.</p>
    </header>

    <CreatePanel
      trigger={session.trigger} invariants={session.invariants} token={session.token} proxyOn={session.falProxyOn}
      busy={session.boot.phase !== "idle"} arrived={session.arrived} status={session.bootStatus} refs={session.refPreviews}
      onTrigger={session.setTrigger} onInvariants={session.setInvariants} onToken={session.setToken} onRefs={session.setRefs}
      onBootstrap={session.bootstrap} onManual={openManual}
    />

    <details className="disclosure create-drawer" onToggle={event => { if (event.currentTarget.open) setTutorial(true); }}>
      <summary>Comment ça marche</summary>
      {tutorial && <LoraTutorial embedded startLabel="Revenir aux photos" onStart={() => document.getElementById("create-drop")?.querySelector("input")?.focus()} />}
    </details>

    {reviewOpen && <section id="revue" className="create-review" aria-labelledby="revue-title">
      <header className="stage-heading">
        <div>
          <p className="eyebrow">Revue</p>
          <h2 id="revue-title" tabIndex={-1}>Le lot, à l’œil.</h2>
          <p>Le gate est le même : {DATASET_SIZE} images, angles, légendes. Garde ce qui est la même personne. Une fiche à la fois.</p>
        </div>
        <span className="stage-badge">{session.result.kept.length} / {DATASET_SIZE}</span>
      </header>
      <LotReview />
    </section>}

    {session.passed ? <section id="entrainer" className="create-train" aria-labelledby="entrainer-title">
      <header className="stage-heading">
        <div>
          <p className="eyebrow">Entraîner · ici</p>
          <h2 id="entrainer-title">La LoRA, puis une image.</h2>
          <p>Le lot est en PASS. <code>flux-lora-fast-training</code>, puis <code>flux-lora</code>. Le fichier <code>.safetensors</code> se télécharge sur cette page.</p>
        </div>
      </header>
      <div className="create-scene">
        <label htmlFor="create-scene">La scène de la première image, en anglais</label>
        <input id="create-scene" value={session.scene} onChange={event => session.setScene(event.target.value)} placeholder="walking in a snowy park, soft daylight" maxLength={260} spellCheck={false} />
        <p>La scène seulement. Le mot d’appel porte la personne.</p>
      </div>
      <FalRail hideTokenField token={session.token} onToken={session.setToken} onStage={onFalStage} passed={session.passed} trigger={session.trigger} scene={session.scene} seed={session.seed} signature={session.signature}
        onBuildZip={session.buildFalZip} />
    </section> : <p className="create-next">L’entraînement s’ouvre après un lot en PASS. Sans proxy fal, le rail reste éteint. Le gate et le ZIP sont aussi dans Identité.</p>}

    <details className="disclosure create-drawer expert-drawer" onToggle={event => { if (event.currentTarget.open) setExpertMounted(true); }}>
      <summary>Expert / repli — Comfy</summary>
      <p className="expert-note">Comfy ouvre un compte sur un autre site, avec ses propres traceurs au chargement du cadre. Ce n’est pas le chemin pour créer. Le cadre ne se charge qu’après un second clic.</p>
      {expertMounted && session.passed && <>
        <TrainStep captions={session.captions} steps={session.steps} plan={session.plan} count={session.count} exportState={session.shownExport} testDone={session.testDone}
          onSteps={session.setSteps} onPlan={session.setPlan} onExport={session.exportZip} onTestDone={session.setTestDone} />
        <ComfyRunPanel app="train" />
        <ImageStep trigger={session.trigger} invariants={session.invariants} scene={session.scene} strength={session.strength} seed={session.seed} count={session.count} steps={session.steps} received={session.received}
          onScene={session.setScene} onStrength={session.setStrength} onSeed={session.setSeed} onCount={session.setCount} onReceived={session.setReceived} />
        <section className="launch-summary" aria-label="Lancement Comfy"><div><h3>Lancer dans Comfy ?</h3><p>{session.steps} étapes · {session.count} image{session.count > 1 ? "s" : ""} + témoin · <strong>{formatEstimate(estimateTrainRun(session.steps, session.count))}</strong></p><p className="small-print">Estimation non mesurée, crédits du compte Comfy. La LoRA reste limitée à ce run.</p></div>
          {!session.canLaunch && <p className="inline-status warn">{!zipReady ? "Télécharge un ZIP à jour dans ce repli." : !session.testDone ? "Confirme d’abord les 3 sorties du test court." : "Réduis les étapes ou le nombre d’images pour respecter la durée du plan."}</p>}
          <a className="button button-outline" href={COMFY_APPS.train.url} target="_blank" rel="noopener noreferrer">Ouvrir Comfy ↗</a>
          <label className="check-inline"><input type="checkbox" checked={session.realLaunched && session.canLaunch} disabled={!session.canLaunch} onChange={event => session.setRealLaunched(event.target.checked)} /><span>J’ai lancé le run réel dans Comfy</span></label>
        </section>
        <details className="disclosure advanced-tools" onToggle={event => { if (event.currentTarget.open) setShowTests(true); }}><summary>Comparer les forces et tester la scène</summary>{showTests && <><TestGrid trigger={session.trigger} seed={session.seed} steps={session.steps} /><ComfyRunPanel app="prompt" /></>}</details>
      </>}
      {expertMounted && !session.passed && <p className="loading-panel">Le repli s’ouvre après un lot en PASS.</p>}
    </details>

    <section id="questions" className="create-questions" aria-labelledby="questions-title">
      <p className="eyebrow">Les repères</p>
      <h2 id="questions-title">Avant de cliquer.</h2>
      <div className="faq-list">
        <details><summary>De quoi ai-je besoin ?</summary><p>2 ou 3 photos nettes de la même personne, et les droits pour les utiliser. Le studio en prépare 15 cadrages. Tu vérifies le lot avant l’entraînement. Tu peux aussi importer tes 15 images toi-même.</p></details>
        <details><summary>Qu’est-ce qui est payant ?</summary><p>La page ne facture rien. Préparer le lot, entraîner et générer consomment la clé fal du studio, aux tarifs affichés avant chaque clic. Le repli Comfy, lui, consomme les crédits de ton compte Comfy. L’offre de guidage U*TTU n’est pas en vente (HOLD).</p></details>
        <details><summary>Où vont mes images ?</summary><p>Rien ne part tant que tu ne cliques pas. Au clic sur « Préparer les 15 images » ou « Entraîner chez fal », les photos passent par le proxy du studio, jamais avec une clé dans la page. Le ZIP du gate, lui, reste dans ton navigateur.</p></details>
        <details><summary>Est-ce que je récupère un fichier LoRA ?</summary><p>Oui, sur le rail fal : un fichier .safetensors à télécharger. Le repli Comfy entraîne et produit une image dans le même lancement, sans fichier à emporter.</p></details>
        <details><summary>Et si je connais déjà les LoRA ?</summary><p>Dépose tes photos, ou ouvre « Importer mes 15 images ». Le tuto est dans « Comment ça marche ». Comfy est dans « Expert / repli ». Identité reprend le gate, les légendes et le ZIP.</p></details>
      </div>
    </section>
  </section>;
}
