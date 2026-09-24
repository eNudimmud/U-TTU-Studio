import Image from "next/image";
import { LoraGuide } from "@/components/guide/lora-guide";
import { LossCurve } from "@/components/loss-curve";
import { WaitlistForm } from "@/components/waitlist-form";
import { Arrow } from "@/components/glyph";
import { COMFY_CLOUD, DATASET_SIZE, FLUX_STACK, TIMING, estimatePromptTest, estimateTrainRun } from "@/lib/comfy-stack";
import { formatCredits, formatDuration } from "@/lib/gate/report";
import { assetPath, contactEmail, testPhaseEnd } from "@/lib/site";

const nav = [["#probleme", "Le piège"], ["#parcours", "Le parcours"], ["#cout", "Le coût"], ["#acces", "Accès anticipé"]] as const;

const costs = [
  ["Test de prompt sans LoRA", "1 image, pour régler la scène", estimatePromptTest()],
  ["Test à blanc", `${FLUX_STACK.training.testSteps} étapes, 1 image : l’app tourne, rien n’est cassé`, estimateTrainRun(FLUX_STACK.training.testSteps, 1)],
  ["Run réel", `${FLUX_STACK.training.steps} étapes, 1 image + témoin`, estimateTrainRun(FLUX_STACK.training.steps, 1)],
] as const;

export default function Home() {
  return <>
    <header className="site-header"><div className="shell header-inner">
      <a href="#" className="wordmark" aria-label="U*TTU Studio — accueil">U<span className="wordmark-star">*</span>TTU<span className="wordmark-studio">STUDIO</span></a>
      <nav className="desktop-nav" aria-label="Navigation principale">{nav.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>
      <a className="header-cta" href="#parcours">Vérifier mon dataset <Arrow diagonal /></a>
      <details className="mobile-menu"><summary>Menu <span aria-hidden="true">+</span></summary><nav aria-label="Navigation mobile">{nav.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav></details>
    </div></header>
    <main id="contenu">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-visual"><Image src={assetPath("/images/uttu-canon-portrait.webp")} alt="U*TTU, la tisseuse du studio, sous sa capuche noire : visage minéral parcouru de fines fissures d’or." fill preload sizes="(max-width: 600px) 100vw, (max-width: 800px) 72vw, 59vw" className="hero-image" /><div className="hero-shade" /></div>
        <div className="shell hero-inner">
          <div className="hero-top"><p className="eyebrow"><span className="tiny-line" /> C micro · LoRA Flux.1 · Comfy Cloud</p><span className="hero-index">iii / THE BLOC</span></div>
          <div className="hero-copy">
            <h1 id="hero-title">On t’empêche de cramer une LoRA.<span>Dataset → train → 1 image.</span></h1>
            <p className="hero-description">Une checklist qui refuse l’entraînement tant que ton dataset est sale. Puis un seul run Comfy Cloud : ta LoRA, ta première image, et un témoin sans LoRA pour comparer.</p>
            <div className="hero-actions"><a href="#parcours" className="button button-primary">Vérifier mon dataset <Arrow /></a><a href="#acces" className="quiet-link">Accès anticipé <span aria-hidden="true">↓</span></a></div>
            <p className="hero-meta">Analyse dans ton navigateur <span>·</span> aucune image envoyée au studio <span>·</span> coût affiché avant le run</p>
          </div>
          <div className="hero-art-caption"><span className="caption-line" /><span>U*TTU / La tisseuse<br /><span className="muted">Référence du studio, pas une sortie du parcours</span></span></div>
          <div className="hero-bottom"><p>UNE LORA. UNE IMAGE. PAS DE VIDÉO, PAS DE 3D, PAS DE VOIX.</p><a href="#probleme">Le piège du run « réussi » <span aria-hidden="true">↓</span></a></div>
        </div>
      </section>
      <div className="facts-strip"><div className="shell facts-inner">
        <p><strong>{DATASET_SIZE} images</strong>face, 3/4 et profil</p><i aria-hidden="true" />
        <p><strong>Légendes</strong>trigger + variables, rien d’autre</p><i aria-hidden="true" />
        <p><strong>Coût Comfy</strong>affiché avant chaque run</p>
      </div></div>

      <section id="probleme" className="section shell" aria-labelledby="probleme-title">
        <div className="section-head"><div><p className="eyebrow">01 — Le piège</p><h2 id="probleme-title">Un run réussi<br /><span className="muted">≠ une LoRA saine.</span></h2></div><p className="section-intro">Comfy affiche « terminé » dans les deux cas. La courbe de loss descend dans les deux cas. Seul le corpus décide si ta LoRA porte une identité ou recopie tes erreurs.</p></div>
        <div className="trap-grid">
          <article className="trap-card trap-dirty">
            <div className="trap-label"><span>Corpus sale</span><span className="verdict fail">× FAIL AU GATE</span></div>
            <ul className="trap-inputs"><li>8 images, dont 6 de face</li><li>Légendes : « redhead woman, green eyes, freckles, … » partout</li><li>Deux photos quasi identiques, une floue</li></ul>
            <LossCurve label="Courbe de loss qui descend régulièrement : run terminé." />
            <p className="trap-run">Run Comfy : terminé ✓</p>
            <ul className="trap-outputs"><li>L’identité n’apparaît que si tu réécris les traits</li><li>Profil impossible, pose figée</li><li>Le décor des photos revient partout</li></ul>
          </article>
          <article className="trap-card trap-clean">
            <div className="trap-label"><span>Corpus propre</span><span className="verdict pass">✓ PASS AU GATE</span></div>
            <ul className="trap-inputs"><li>{DATASET_SIZE} images : face, 3/4, profil, plans serrés et larges</li><li>Légendes : « mira_v1, side profile view, full body shot, red coat, snowy park »</li><li>Doublons et flous écartés avant le run</li></ul>
            <LossCurve label="Même courbe de loss, qui descend de la même façon : run terminé." />
            <p className="trap-run">Run Comfy : terminé ✓</p>
            <ul className="trap-outputs"><li>Le trigger porte l’identité à lui seul</li><li>Le profil tient, la silhouette aussi</li><li>Le décor suit ton prompt</li></ul>
          </article>
        </div>
        <p className="illustration-note">Illustration pédagogique : les deux courbes sont volontairement identiques. Ce n’est pas un résultat mesuré.</p>
        <div className="principle-line"><span className="iii" aria-hidden="true">iii</span><p>La loss ne juge pas ton corpus. <strong>Le gate, si.</strong></p><span className="line-end" aria-hidden="true">+</span></div>
      </section>

      <section id="parcours" className="guide-section section" aria-labelledby="parcours-title"><div className="shell">
        <div className="section-head"><div><p className="eyebrow">02 — Le parcours</p><h2 id="parcours-title">Trois étapes.<br /><span className="muted">Un seul run payant.</span></h2></div><p className="section-intro">Tout se fait ici jusqu’au bouton Run de Comfy. Tant qu’un contrôle est en FAIL, l’étape 2 reste fermée.</p></div>
        <LoraGuide />
      </div></section>

      <section id="cout" className="section shell" aria-labelledby="cout-title">
        <div className="section-head"><div><p className="eyebrow">03 — Le coût</p><h2 id="cout-title">Deux factures.<br /><span className="muted">Aucune surprise.</span></h2></div><p className="section-intro">Les crédits Comfy se paient chez Comfy. Le guidage se paiera chez nous, quand son prix sera fixé.</p></div>
        <div className="pricing-grid">
          <article className="price-card">
            <div className="price-card-top"><span className="eyebrow">Crédits Comfy Cloud</span><span className="small-tag">À TA CHARGE</span></div>
            <h3>Payés chez Comfy.</h3>
            <dl className="cost-table">{costs.map(([title, detail, estimate]) => <div key={title}><dt>{title}<small>{detail}</small></dt><dd>{formatCredits(estimate)}<small>{formatDuration(estimate)}</small></dd></div>)}</dl>
            <p className="price-footnote">{TIMING.measured ? "Durées mesurées." : "Estimations non mesurées : le premier run sert de calibration."} GPU : {COMFY_CLOUD.gpuCreditsPerSecond} crédit/s, {COMFY_CLOUD.creditsPerUsd} crédits ≈ 1 $. Limite : {COMFY_CLOUD.runtimeLimitMinutes.standard} min par run en Standard et Creator, {COMFY_CLOUD.runtimeLimitMinutes.pro} min en Pro. Tarifs Comfy relevés le {COMFY_CLOUD.checkedOn.split("-").reverse().join(".")}.</p>
          </article>
          <article className="price-card featured">
            <div className="price-card-top"><span className="eyebrow">Run guidé U*TTU</span><span className="small-tag">PRIX PRESSENTI</span></div>
            <h3>Une fois, bien.</h3>
            <p className="price"><span className="currency">CHF</span> 49–149</p>
            <p className="price-term">Run guidé one-shot, ou crédits Comfy + frais de guidage</p>
            <ul className="price-includes"><li>Checklist dataset et rapport du gate</li><li>App Comfy prête : dataset → LoRA → 1 image</li><li>Coût Comfy affiché avant chaque run</li></ul>
            <a className="button button-primary" href="#acces">Rejoindre l’accès anticipé <Arrow diagonal /></a>
            <span className="price-footnote">Prix non confirmé. Rien n’est facturé aujourd’hui.</span>
          </article>
        </div>
        <p className="scope-line"><strong>Hors périmètre :</strong> vidéo, clips, 3D, voix, avatars, plateforme d’identité. Une LoRA, une image.</p>
      </section>

      <section id="acces" className="section shell contact-section" aria-labelledby="acces-title"><div className="contact-intro"><p className="eyebrow">04 — Accès anticipé</p><h2 id="acces-title">Ton prochain run,<br /><span>sans cramer.</span></h2><p>Phase test jusqu’au {testPhaseEnd}. Dis-nous où tu en es : on te répond avec la suite concrète.</p><div className="contact-detail"><span className="tiny-line" /><span>Une personne lit ta demande et te répond.<br />Le prix est confirmé avant tout paiement.</span></div><a className="contact-email" href={`mailto:${contactEmail}`}>{contactEmail} <Arrow diagonal /></a><p className="contact-placeholder">Adresse de contact provisoire du studio.</p></div><WaitlistForm /></section>
    </main>
    <footer className="site-footer"><div className="shell"><div className="footer-top"><a className="wordmark" href="#" aria-label="U*TTU Studio — retour en haut">U<span className="wordmark-star">*</span>TTU<span className="wordmark-studio">STUDIO</span></a><p>DATASET → TRAIN → 1 IMAGE</p><a href="#parcours">Vérifier mon dataset <Arrow diagonal /></a></div><div className="footer-bottom"><span><span className="iii">iii</span> THE BLOC · SUISSE</span><p>C micro · LoRA guidée · {FLUX_STACK.name} sur Comfy Cloud</p><a href="https://github.com/eNudimmud/U-TTU-Studio" target="_blank" rel="noopener noreferrer">GitHub Studio <span className="sr-only">(nouvel onglet)</span><Arrow diagonal /></a></div></div></footer>
  </>;
}
