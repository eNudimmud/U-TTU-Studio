import { LoraGuide } from "@/components/guide/lora-guide";
import { contactEmail } from "@/lib/site";

export default function Home() {
  return <>
    <header className="studio-header"><div className="shell header-inner">
      <a href="#parcours" className="wordmark" aria-label="U*TTU Studio — créer">U<span className="wordmark-star">*</span>TTU<span className="wordmark-studio">STUDIO</span></a>
      <span className="header-caption">Créer, sans quitter la page.</span>
      <a className="header-help" href="#questions">Une question ? <span aria-hidden="true">↗</span></a>
    </div></header>
    <main id="contenu" className="shell studio-main">
      <LoraGuide />
      <section id="questions" className="quick-help" aria-labelledby="questions-title">
        <div><p className="eyebrow">Les repères</p><h2 id="questions-title">Avant de cliquer.</h2></div>
        <div className="faq-list">
          <details><summary>De quoi ai-je besoin ?</summary><p>2 ou 3 photos nettes de la même personne, et les droits pour les utiliser. Le studio en prépare 15 cadrages. Tu vérifies le lot avant l’entraînement. Tu peux aussi importer tes 15 images toi-même.</p></details>
          <details><summary>Qu’est-ce qui est payant ?</summary><p>La page ne facture rien. Préparer le lot, entraîner et générer consomment la clé fal du studio, aux tarifs affichés avant chaque clic. Le repli Comfy, lui, consomme les crédits de ton compte Comfy. L’offre de guidage U*TTU n’est pas en vente (HOLD).</p></details>
          <details><summary>Où vont mes images ?</summary><p>Rien ne part tant que tu ne cliques pas. Au clic sur « Préparer les 15 images » ou « Entraîner chez fal », les photos passent par le proxy du studio, jamais avec une clé dans la page. Le ZIP du gate, lui, reste dans ton navigateur.</p></details>
          <details><summary>Est-ce que je récupère un fichier LoRA ?</summary><p>Oui, sur le rail fal : un fichier .safetensors à télécharger. Le repli Comfy entraîne et produit une image dans le même lancement, sans fichier à emporter.</p></details>
          <details><summary>Et si je connais déjà les LoRA ?</summary><p>Dépose tes photos, ou ouvre « J’ai déjà 15 images ». Le tuto est dans « Comment ça marche ». Comfy est dans « Expert / repli ».</p></details>
        </div>
      </section>
    </main>
    <footer className="studio-footer shell"><span><span className="iii">iii</span> THE BLOC · SUISSE</span><span>Deux photos. Une première image.</span><a href={`mailto:${contactEmail}`}>Contacter le studio ↗</a></footer>
  </>;
}
