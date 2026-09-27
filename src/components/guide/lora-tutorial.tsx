import Image from "next/image";
import { assetPath } from "@/lib/site";
import { Arrow } from "../glyph";

export function LoraTutorial({ onStart }: { onStart: () => void }) {
  return <div className="tutorial">
    <div className="tutorial-intro">
      <div className="tutorial-copy">
        <p className="eyebrow">01 / Comprendre · 2 minutes</p>
        <h1 id="guide-title-0" tabIndex={-1}>Ta première LoRA,<br /><span>pas à pas.</span></h1>
        <p className="tutorial-lead">Un personnage reconnaissable.<br />De nouvelles scènes. On te montre comment.</p>
        <div className="definition"><h2>Une LoRA, c’est quoi ?</h2><p>Un petit complément que tu entraînes avec tes images. Il aide un modèle d’IA existant à retrouver <strong>l’identité de ton personnage</strong>, sans réentraîner tout le modèle.</p></div>
        <button className="button button-primary" type="button" onClick={onStart}>Préparer mes 15 images <Arrow /></button>
        <p className="tutorial-footnote">Aucun compte pour préparer · aucun envoi automatique</p>
      </div>
      <figure className="tutorial-reference">
        <div className="reference-image"><Image src={assetPath("/images/uttu-canon-portrait.webp")} alt="U*TTU : capuche noire, visage minéral et fissures dorées." fill preload sizes="(max-width: 700px) 94px, (max-width: 1050px) 30vw, 320px" /></div>
        <figcaption><span>U*TTU / La tisseuse</span>Référence du studio.<br />Pas un résultat d’entraînement.</figcaption>
        <span className="reference-label" aria-hidden="true">Une identité à apprendre</span>
      </figure>
    </div>
    <section className="lora-explainer" aria-labelledby="lora-explainer-title">
      <h2 id="lora-explainer-title">Trois éléments. Une nouvelle image.</h2>
      <ol className="concept-flow">
        <li><span className="concept-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><rect x="8" y="8" width="32" height="32" rx="4"/><path d="M8 19h32M19 19v21M25 26h9M25 32h9"/></svg></span><div><h3>Le modèle</h3><p>Il sait déjà créer des images.</p><span>Ex. : Flux.1 dev</span></div></li>
        <li><span className="concept-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><rect x="12" y="8" width="26" height="32" rx="3"/><path d="M7 13v26a6 6 0 0 0 6 6M18 31c0-7 14-7 14 0"/><circle cx="25" cy="20" r="4"/></svg></span><div><h3>Ta LoRA</h3><p>Elle apprend ton personnage.</p><span>À partir de tes 15 images</span></div></li>
        <li><span className="concept-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M8 10h32v24H22l-9 7v-7H8zM15 18h18M15 25h12"/></svg></span><div><h3>Ta consigne</h3><p>Tu choisis la nouvelle scène.</p><span>C’est le « prompt »</span></div></li>
      </ol>
      <div className="prompt-example"><span className="example-label">Exemple de prompt</span><p lang="en"><mark>mira_v1</mark><span>, walking in a snowy park</span></p><div><span>↑ Le mot qui appelle ton personnage</span><span>↑ La scène que tu veux créer</span></div></div>
    </section>
    <details className="disclosure tutorial-details"><summary>Les 3 choses à retenir</summary><ul className="takeaways"><li><strong>Le lot d’images = le dataset.</strong> Des références cohérentes, avec des angles et des décors variés.</li><li><strong>Le mot d’appel = le trigger.</strong> Ici, <code>mira_v1</code>. Tu l’utilises dans les légendes et dans ton prompt.</li><li><strong>Le résultat se vérifie à l’œil.</strong> Un entraînement terminé ne garantit pas une identité fidèle.</li></ul><a className="quiet-link" href="https://huggingface.co/docs/diffusers/training/lora" target="_blank" rel="noopener noreferrer">Comprendre la technique · Hugging Face ↗</a></details>
  </div>;
}
