import { clerkClientEnabled } from "@/lib/clerk-config";
import { STUDIO_PATH } from "@/lib/account";
import { assetPath } from "@/lib/site";

export function AuthScreen({ kicker, title, note, children }: {
  kicker: string;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  const enabled = clerkClientEnabled();
  return <main id="contenu" className="auth-page">
    <a href={assetPath(STUDIO_PATH)} className="wordmark" aria-label="U*TTU Studio">U<span className="wordmark-star">*</span>TTU<span className="wordmark-studio">STUDIO</span></a>
    <header className="auth-copy">
      <p className="eyebrow">{kicker}</p>
      <h1>{title}</h1>
      <p>{enabled ? note : "Comptes U*TTU fermés pour l’instant. Le studio reste ouvert, sans compte."}</p>
    </header>
    {enabled ? children : <p className="auth-hold">Hors ligne</p>}
    <a className="text-button" href={assetPath(STUDIO_PATH)}>Retour au studio</a>
  </main>;
}
