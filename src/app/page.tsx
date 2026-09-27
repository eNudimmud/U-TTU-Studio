import { LoraGuide } from "@/components/guide/lora-guide";
import { contactEmail } from "@/lib/site";

export default function Home() {
  return <>
    <header className="studio-header"><div className="shell header-inner">
      <a href="#parcours" className="wordmark" aria-label="U*TTU Studio — le guide">U<span className="wordmark-star">*</span>TTU<span className="wordmark-studio">STUDIO</span></a>
      <span className="header-caption">Le studio, étape par étape.</span>
      <a className="header-help" href="#questions">Une question ? <span aria-hidden="true">↗</span></a>
    </div></header>
    <main id="contenu" className="shell studio-main">
      <LoraGuide />
      <section id="questions" className="quick-help" aria-labelledby="questions-title">
        <div><p className="eyebrow">Les repères</p><h2 id="questions-title">Avant de te lancer.</h2></div>
        <div className="faq-list">
          <details><summary>De quoi ai-je besoin ?</summary><p>15 images nettes d’un même personnage, vues de face, de trois quarts et de profil. Prévois aussi des cadrages variés et les droits nécessaires sur les images. Le guide te dit quoi corriger avant l’entraînement.</p></details>
          <details><summary>Qu’est-ce qui est payant ?</summary><p>Le tutoriel et la préparation se font ici. L’entraînement et les tests consomment les crédits de ton compte Comfy Cloud. Une estimation apparaît avant le lancement ; le montant réel dépend du temps de calcul. L’offre de guidage U*TTU n’est pas encore en vente (HOLD).</p></details>
          <details><summary>Où vont mes images ?</summary><p>L’import et l’analyse restent dans ton navigateur. Rien n’est transmis automatiquement. Tu envoies toi-même le lot à Comfy Cloud si tu décides de l’entraîner. Ton travail reste disponible pendant cette session ; télécharge le ZIP avant de fermer ou de recharger la page.</p></details>
          <details><summary>Est-ce que je récupère un fichier LoRA ?</summary><p>Le parcours Comfy actuel entraîne la LoRA et produit une image dans le même lancement. Il ne permet pas d’exporter la LoRA. L’option fal, qui vise un fichier réutilisable, reste expérimentale et réservée au studio.</p></details>
          <details><summary>Et si je connais déjà les LoRA ?</summary><p>Ouvre directement « Préparer ». Les contrôles détaillés, les réglages et les tests comparatifs sont accessibles à leur étape, à la demande.</p></details>
        </div>
      </section>
    </main>
    <footer className="studio-footer shell"><span><span className="iii">iii</span> THE BLOC · SUISSE</span><span>Une LoRA. Une première image.</span><a href={`mailto:${contactEmail}`}>Contacter le studio ↗</a></footer>
  </>;
}
