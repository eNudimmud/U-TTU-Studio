import Image from "next/image";
import { Comparison } from "@/components/comparison";
import { BriefForm } from "@/components/brief-form";
import { Arrow, Glyph } from "@/components/glyph";
import { contactEmail } from "@/lib/site";

const deliverables = [
  { n: "01", kind: "bible" as const, title: "La bible d’identité", text: "Traits. Silhouette. Palette. Lumière. Ce qui fait votre identité — et ce qui n’y entre jamais.", detail: "LE CANON, NOIR SUR BLANC" },
  { n: "02", kind: "stills" as const, title: "Les stills de référence", text: "Environ 10 à 20 images repères. Une base visuelle lisible pour guider chaque nouvelle génération.", detail: "UNE IDENTITÉ, PLUSIEURS ANGLES" },
  { n: "03", kind: "gate" as const, title: "La grille PASS / FAIL", text: "Des critères précis pour accepter ou refuser une image. Le frein avant de relancer une série.", detail: "UN NON SUFFIT À ARRÊTER" },
  { n: "04", kind: "thread" as const, title: "Les règles de prompt", text: "Les invariants à conserver. Les variables à explorer. Des instructions de tissage, pas une « vibe ».", detail: "L’INTENTION DEVIENT INSTRUCTION" },
];

export default function Home() {
  return <>
    <header className="site-header"><div className="shell header-inner">
      <a href="#" className="wordmark" aria-label="U*TTU Studio — accueil">U<span className="wordmark-star">*</span>TTU<span className="wordmark-studio">STUDIO</span></a>
      <nav className="desktop-nav" aria-label="Navigation principale"><a href="#pack">Le pack</a><a href="#methode">La méthode</a><a href="#tarifs">Tarifs</a></nav>
      <a className="header-cta" href="#demande">Parlons de votre identité <Arrow diagonal /></a>
      <details className="mobile-menu"><summary>Menu <span aria-hidden="true">+</span></summary><nav aria-label="Navigation mobile"><a href="#pack">Le pack</a><a href="#methode">La méthode</a><a href="#tarifs">Tarifs</a><a href="#demande">Demander un pack</a></nav></details>
    </div></header>
    <main id="contenu">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-visual"><Image src="/images/uttu-hero.webp" alt="U*TTU, tisseuse humanoïde au regard calme, entre architecture noire et fils d’or ancien. Interprétation visuelle du studio." fill preload sizes="(max-width: 700px) 100vw, 65vw" className="hero-image" /><div className="hero-shade" /></div>
        <div className="shell hero-inner">
          <div className="hero-top"><p className="eyebrow"><span className="tiny-line" /> Direction artistique · Suisse</p><span className="hero-index">iii / THE BLOC</span></div>
          <div className="hero-copy"><p className="eyebrow hero-product">Le Look-Lock Pack</p>
            <h1 id="hero-title">On verrouille<br />l’identité.<span>Vous arrêtez de brûler<br className="desktop-break" /> des crédits.</span></h1>
            <p className="hero-description">Votre personnage change à chaque image ?<br />On fixe son canon, ses références et ses critères de refus. Vous repartez avec un dossier. Et un frein.</p>
            <div className="hero-actions"><a href="#demande" className="button button-primary">Demander un pack <Arrow diagonal /></a><a href="#pack" className="quiet-link">Explorer le pack <span aria-hidden="true">↓</span></a></div>
            <p className="hero-price">CHF 800–2 500 <span>·</span> Un personnage ou une ligne visuelle</p>
          </div>
          <div className="hero-art-caption"><span className="caption-line" /><span>U*TTU / La tisseuse<br /><span className="muted">Étude visuelle · prototype</span></span></div>
          <div className="hero-bottom"><p>ELLE TISSE. ELLE ORDONNE. ELLE CRÉE.</p><a href="#derive" aria-label="Découvrir le problème de dérive">Le canon avant les crédits <span aria-hidden="true">↓</span></a></div>
        </div>
      </section>
      <div className="audience-strip"><div className="shell audience-inner"><span>POUR CEUX QUI GÉNÈRENT DÉJÀ.</span><p>Studios <i /> Labels <i /> Marques <i /> Founders</p><span>COMFYUI / FLUX / RUNWAY / MIDJOURNEY</span></div></div>

      <section id="derive" className="section shell" aria-labelledby="derive-title">
        <div className="section-head"><div><p className="eyebrow">01 — Le coût de la dérive</p><h2 id="derive-title">Le même prompt.<br /><span className="muted">Un autre visage.</span></h2></div><p className="section-intro">Une image réussie ne fait pas une identité.<br />Sans repères stables, chaque génération renégocie vos choix. Et chaque correction coûte.</p></div>
        <Comparison />
        <div className="principle-line"><span className="iii" aria-hidden="true">iii</span><p>La cohérence ne se souhaite pas. <strong>Elle se construit.</strong></p><span className="line-end" aria-hidden="true">+</span></div>
      </section>

      <section id="pack" className="pack-section section" aria-labelledby="pack-title"><div className="shell">
        <div className="section-head"><div><p className="eyebrow">02 — Le dossier livré</p><h2 id="pack-title">Quatre pièces.<br />Une seule identité.</h2></div><div className="dossier-stamp"><span className="iii" aria-hidden="true">iii</span><span>LOOK-LOCK<br />IDENTITY SYSTEM / 01</span></div></div>
        <div className="deliverables">{deliverables.map(item => <article className="deliverable" key={item.n}><div className="deliverable-top"><Glyph kind={item.kind} /><span>{item.n}</span></div><h3>{item.title}</h3><p>{item.text}</p><div className="deliverable-detail"><span aria-hidden="true">↳</span>{item.detail}</div></article>)}</div>
        <p className="pack-note"><span>Un pack = un personnage <strong>ou</strong> une ligne visuelle.</span><span>Un dossier à utiliser avec vos outils de génération.</span></p>
      </div></section>

      <section id="methode" className="section shell method-section" aria-labelledby="method-title"><div className="section-head"><div><p className="eyebrow">03 — Le protocole</p><h2 id="method-title">Moins de hasard.<br /><span className="muted">Plus d’intention.</span></h2></div><p className="section-intro">On décide ce qui doit rester.<br />Puis on laisse le reste respirer.</p></div>
        <ol className="method-list">{[
          ["L’intention", "Vous posez le sujet.", "Vos références, vos outils, vos dérives. On délimite ensemble ce qu’il faut verrouiller."],
          ["Le canon", "On fixe les invariants.", "La bible et les stills rendent les choix visibles. Vous validez l’identité de référence."],
          ["Le gate", "On écrit les critères de refus.", "Traits, tenue, lumière : chaque invariant devient un contrôle PASS / FAIL concret."],
          ["Le tissage", "Vous générez sous contrôle.", "Vous utilisez le dossier, contrôlez les sorties et corrigez avant de lancer la suite."],
        ].map(([title, lead, text], i) => <li key={title}><span className="step-number">0{i + 1}<span className="step-node" /></span><div><span className="step-kicker">{title}</span><h3>{lead}</h3><p>{text}</p></div></li>)}</ol>
        <div className="gate-rule"><div><span className="gate-square" aria-hidden="true">×</span><p>Un FAIL n’est pas un détail.<br /><strong>C’est le signal d’arrêter.</strong></p></div><p>Le dossier guide la décision.<br />Le contrôle reste humain.</p></div>
      </section>

      <section id="tarifs" className="pricing-section section" aria-labelledby="pricing-title"><div className="shell"><div className="section-head"><div><p className="eyebrow">04 — L’investissement</p><h2 id="pricing-title">Un cadre clair.<br />Un prix en CHF.</h2></div><p className="section-intro">Le périmètre se fixe avant le travail.<br />Vous savez ce que vous recevez.</p></div>
        <div className="pricing-grid"><article className="price-card featured"><div className="price-card-top"><span className="eyebrow">La base</span><span className="small-tag">MISSION PONCTUELLE</span></div><h3>Look-Lock Pack</h3><p className="price-description">Verrouiller une identité. Une fois, proprement.</p><p className="price"><span className="currency">CHF</span> 800–2 500</p><p className="price-term">Un personnage ou une ligne visuelle</p><ul className="price-includes"><li>Bible d’identité complète</li><li>Environ 10–20 stills de référence</li><li>Grille de contrôle PASS / FAIL</li><li>Règles de prompt documentées</li></ul><a className="button button-primary" href="#demande">Demander un pack <Arrow diagonal /></a><span className="price-footnote">Prix final selon le périmètre du brief.</span></article>
        <article className="price-card"><div className="price-card-top"><span className="eyebrow">La continuité</span><span className="small-tag">DIRECTION LÉGÈRE</span></div><h3>Garder le cap.</h3><p className="price-description">Faire évoluer le travail sans perdre le canon.</p><p className="price"><span className="currency">CHF</span> 400–900<span className="per-month"> / mois</span></p><p className="price-term">Accompagnement mensuel sur périmètre convenu</p><ul className="price-includes"><li>Relecture de vos nouvelles directions</li><li>Contrôle de cohérence des sorties</li><li>Ajustements documentés du dossier</li><li>Cadence et volume définis ensemble</li></ul><a className="button button-outline" href="#demande">Parler de la suite <Arrow diagonal /></a><span className="price-footnote">Modalités précisées dans la proposition.</span></article></div>
        <p className="pricing-note">Les crédits de vos outils restent à votre charge. La demande n’engage aucun paiement.</p>
      </div></section>

      <section className="manifesto shell section" aria-labelledby="manifesto-title"><div className="manifesto-label"><p className="eyebrow">La position du studio</p><span className="iii" aria-hidden="true">iii</span></div><div><h2 id="manifesto-title">Du chaos,<br />extraire <span>la forme.</span></h2><p>La création n’est pas l’opposé du contrôle.<br />Le prompt est une instruction de tissage.<br />On protège les invariants. On laisse vivre l’imprévisible.<br />Rien ne devient canon par accident.<br /><strong>Elle tisse. Elle ordonne. Elle crée.</strong></p></div></section>

      <section className="sanctuary" aria-labelledby="sanctuary-title"><Image src="/images/sanctuary.webp" alt="Un atelier sombre de pierre et de métal, des archives et une table traversée de fins fils dorés sous une lumière chaude." fill sizes="100vw" /><div className="sanctuary-overlay" /><div className="shell sanctuary-content"><div><p className="eyebrow">Le lieu de la trame</p><h2 id="sanctuary-title">Le Sanctuaire.</h2><p>Atelier. Laboratoire. Archive. Observatoire.</p></div><span className="sanctuary-note">ÉTUDE D’ATMOSPHÈRE<br />PROTOTYPE / U*TTU STUDIO</span></div></section>

      <section id="demande" className="section shell contact-section" aria-labelledby="contact-title"><div className="contact-intro"><p className="eyebrow">05 — Votre prochain fil</p><h2 id="contact-title">L’identité mérite<br />de <span>rester.</span></h2><p>Un personnage. Une marque. Une direction.<br />Dites-nous ce qui doit tenir.</p><div className="contact-detail"><span className="tiny-line" /><span>Demande de pack ou direction mensuelle.<br />Le périmètre et le prix sont confirmés avant commande.</span></div><a className="contact-email" href={`mailto:${contactEmail}`}>{contactEmail} <Arrow diagonal /></a><p className="contact-placeholder">Adresse de contact provisoire du studio.</p></div><BriefForm /></section>
    </main>
    <footer className="site-footer"><div className="shell"><div className="footer-top"><a className="wordmark" href="#" aria-label="U*TTU Studio — retour en haut">U<span className="wordmark-star">*</span>TTU<span className="wordmark-studio">STUDIO</span></a><p>ELLE TISSE. ELLE ORDONNE. ELLE CRÉE.</p><a href="#demande">Entrer en contact <Arrow diagonal /></a></div><div className="footer-bottom"><span><span className="iii">iii</span> THE BLOC · SUISSE</span><p>Direction artistique & cohérence visuelle</p><a href="https://github.com/eNudimmud/U-TTU-Studio" target="_blank" rel="noopener noreferrer">GitHub Studio <span className="sr-only">(nouvel onglet)</span><Arrow diagonal /></a></div></div></footer>
  </>;
}
