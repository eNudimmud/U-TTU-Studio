"use client";

import { useRef, useState, type FormEvent } from "react";
import { contactEmail } from "@/lib/site";
import { trackEvent } from "@/lib/analytics";
import { Arrow } from "./glyph";

export function WaitlistForm() {
  const [draft, setDraft] = useState<{ body: string; href: string } | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const result = useRef<HTMLDivElement>(null);
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name")).trim();
    const body = `Bonjour U*TTU Studio,\n\nJe veux l’accès anticipé à C micro (dataset → LoRA → 1 image).\n\nNom : ${name}\nComfy Cloud : ${data.get("comfy")}\nCe qui m’intéresse : ${data.get("offer")}\n\nMon projet :\n${String(data.get("project")).trim()}\n\nMerci,\n${name}`;
    setDraft({ body, href: `mailto:${contactEmail}?subject=${encodeURIComponent("Accès anticipé C micro — U*TTU Studio")}&body=${encodeURIComponent(body)}` });
    setCopyMessage("");
    trackEvent("waitlist_prepared");
    requestAnimationFrame(() => result.current?.focus());
  }
  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.body);
      setCopyMessage("Message copié. Colle-le dans ton e-mail.");
      trackEvent("waitlist_copied");
    } catch { setCopyMessage("Copie indisponible. Sélectionne le message ci-dessous."); }
  }
  return <form className="brief-form" action={`mailto:${contactEmail}`} method="post" encType="text/plain" onSubmit={prepare} onChange={() => { setDraft(null); setCopyMessage(""); }}>
    <div className="form-row">
      <div className="field"><label htmlFor="name">Ton nom <span aria-hidden="true">*</span></label><input id="name" name="name" autoComplete="name" required maxLength={100} placeholder="Nom et prénom" /></div>
      <div className="field"><label htmlFor="comfy">Comfy Cloud <span aria-hidden="true">*</span></label><select id="comfy" name="comfy" defaultValue="" required><option value="" disabled>Ton plan actuel</option><option>Pas encore de compte</option><option>Free</option><option>Standard</option><option>Creator</option><option>Pro</option></select></div>
    </div>
    <div className="field"><label htmlFor="offer">Ce qui t’intéresse <span aria-hidden="true">*</span></label><select id="offer" name="offer" defaultValue="" required><option value="" disabled>Choisir</option><option>Run guidé one-shot (prix pressenti CHF 49–149)</option><option>Crédits Comfy à ma charge + frais de guidage</option><option>La checklist seule, pour l’instant</option></select></div>
    <div className="field"><label htmlFor="project">Ton personnage ou ta marque, en deux lignes <span aria-hidden="true">*</span></label><textarea id="project" name="project" required minLength={20} maxLength={900} rows={4} placeholder={"1. Qui ou quoi doit rester reconnaissable.\n2. Où tu en es : images prêtes, LoRA déjà ratée, rien encore."} aria-describedby="project-help" /><p className="field-help" id="project-help">20 à 900 caractères. N’envoie pas d’images par ce formulaire.</p></div>
    <button className="button button-primary form-submit" type="submit">Préparer ma demande <Arrow diagonal /></button>
    <p className="form-note">Ton message reste dans cette page jusqu’à l’ouverture de ta messagerie. Aucun envoi automatique, aucun paiement.</p>
    {draft && <div className="draft-result" tabIndex={-1} ref={result}>
      <p className="eyebrow">Ta demande est prête</p><h3>Dernier geste : l’envoyer.</h3><p>Ouvre ta messagerie, relis, envoie à <strong>{contactEmail}</strong>.</p>
      <div className="draft-actions"><a className="button button-primary" href={draft.href}>Ouvrir ma messagerie <Arrow diagonal /></a><button className="text-button" type="button" onClick={copy}>Copier le message</button></div>
      <label className="sr-only" htmlFor="prepared-message">Message préparé à copier</label><textarea id="prepared-message" readOnly value={draft.body} rows={7} />
      <p role="status">{copyMessage}</p>
    </div>}
    <noscript><p>Pour demander l’accès, écris directement à <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p></noscript>
  </form>;
}
