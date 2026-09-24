"use client";

import { useRef, useState, type FormEvent } from "react";
import { contactEmail } from "@/lib/site";
import { trackEvent } from "@/lib/analytics";
import { Arrow } from "./glyph";

export function BriefForm() {
  const [draft, setDraft] = useState<{ body: string; href: string } | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const result = useRef<HTMLDivElement>(null);
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = `Bonjour U*TTU Studio,\n\nJe souhaite discuter d’un Look-Lock.\n\nNom : ${String(data.get("name")).trim()}\nStudio / marque : ${String(data.get("studio") || "Indépendant·e").trim()}\nBudget : ${data.get("budget")}\n\nBrief :\n${String(data.get("brief")).trim()}\n\nMerci,\n${String(data.get("name")).trim()}`;
    setDraft({ body, href: `mailto:${contactEmail}?subject=${encodeURIComponent("Demande Look-Lock — U*TTU Studio")}&body=${encodeURIComponent(body)}` });
    setCopyMessage("");
    trackEvent("brief_prepared");
    requestAnimationFrame(() => result.current?.focus());
  }
  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.body);
      setCopyMessage("Brief copié. Collez-le dans votre e-mail.");
      trackEvent("brief_copied");
    } catch { setCopyMessage("Copie indisponible. Sélectionnez le brief ci-dessous pour le copier."); }
  }
  return <form className="brief-form" action={`mailto:${contactEmail}`} method="post" encType="text/plain" onSubmit={prepare} onChange={() => { setDraft(null); setCopyMessage(""); }}>
    <div className="form-row"><div className="field"><label htmlFor="name">Votre nom <span aria-hidden="true">*</span></label><input id="name" name="name" autoComplete="name" required maxLength={100} placeholder="Nom et prénom" /></div><div className="field"><label htmlFor="studio">Studio / marque <span className="optional">facultatif</span></label><input id="studio" name="studio" autoComplete="organization" maxLength={100} placeholder="Ou votre nom de projet" /></div></div>
    <div className="field"><label htmlFor="budget">Budget envisagé <span aria-hidden="true">*</span></label><select id="budget" name="budget" defaultValue="" required><option value="" disabled>Sélectionner une fourchette</option><option>Pack · CHF 800–1 500</option><option>Pack · CHF 1 500–2 500</option><option>Direction légère · CHF 400–900 / mois</option><option>À préciser ensemble</option></select></div>
    <div className="field"><label htmlFor="brief">Votre intention, en trois lignes <span aria-hidden="true">*</span></label><textarea id="brief" name="brief" required minLength={20} maxLength={900} rows={4} placeholder={"1. Le personnage ou la ligne visuelle.\n2. Ce qui dérive aujourd’hui.\n3. Vos outils et votre prochain objectif."} aria-describedby="brief-help" /><p className="field-help" id="brief-help">20 à 900 caractères. Ajoutez un lien vers vos références si vous en avez.</p></div>
    <button className="button button-primary form-submit" type="submit">Préparer ma demande <Arrow diagonal /></button>
    <p className="form-note">Votre brief reste dans cette page jusqu’à l’ouverture de votre messagerie. Aucun envoi automatique, aucun paiement.</p>
    {draft && <div className="draft-result" tabIndex={-1} ref={result}>
      <p className="eyebrow">Votre demande est prête</p><h3>Un dernier geste : l’envoyer.</h3><p>Ouvrez votre messagerie, vérifiez le brief et envoyez-le à <strong>{contactEmail}</strong>.</p>
      <div className="draft-actions"><a className="button button-primary" href={draft.href}>Ouvrir ma messagerie <Arrow diagonal /></a><button className="text-button" type="button" onClick={copy}>Copier le brief</button></div>
      <label className="sr-only" htmlFor="prepared-brief">Brief préparé à copier</label><textarea id="prepared-brief" readOnly value={draft.body} rows={7} />
      <p role="status">{copyMessage}</p>
    </div>}
    <noscript><p>Pour envoyer votre brief, écrivez directement à <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p></noscript>
  </form>;
}
