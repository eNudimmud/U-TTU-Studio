import { clerkClientEnabled } from "@/lib/clerk-config";
import { ACCOUNT_CREER_HASH } from "@/lib/account";
import { assetPath } from "@/lib/site";

export function AuthScreen({ kicker, title, note, children }: {
  kicker: string;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  const enabled = clerkClientEnabled();
  return <main id="contenu" className="auth-page">
    <a href={assetPath(ACCOUNT_CREER_HASH)} className="wordmark" aria-label="U*TTU Studio — Créer">U<span className="wordmark-star">*</span>TTU<span className="wordmark-studio">STUDIO</span></a>
    <header className="auth-copy">
      <p className="eyebrow">{kicker}</p>
      <h1>{title}</h1>
      <p>{enabled ? note : "Les clés Clerk ne sont pas posées. Google et GitHub s’ouvriront ici quand elles le seront. Créer et le coffre restent ouverts, sans compte."}</p>
    </header>
    {enabled ? children : <p className="auth-hold">Hors ligne · vente HOLD</p>}
    <a className="text-button" href={assetPath(ACCOUNT_CREER_HASH)}>Retour à Créer</a>
  </main>;
}
