"use client";

import { assetPath } from "@/lib/site";
import { OBSIDIAN_STEPS, STARTER_VAULT_FILE, STARTER_VAULT_HREF, VAULT_DOCUMENTS, VAULT_FOLDERS, VAULT_MODE_MAP, VAULT_ROOT } from "@/lib/vault";
import { Arrow } from "../glyph";
import { useGoToMode } from "./mode-context";

export function MaisonPanel() {
  const go = useGoToMode();

  return <section className="mode-panel" aria-labelledby="mode-title">
    <header className="mode-hero">
      <p className="eyebrow">Studio</p>
      <h1 id="mode-title" tabIndex={-1}>La maison, <em>chez toi.</em></h1>
      <p className="mode-lead">Un dossier par personne. Obsidian l’ouvre comme un coffre. Le site ne le lit pas, et n’écrit pas dedans. Un compte pourra le rejoindre plus tard. Pas aujourd’hui.</p>
    </header>

    <div className="vault-layout">
      <article className="vault-schema" aria-labelledby="vault-schema-title">
        <p className="eyebrow">Schéma</p>
        <h2 id="vault-schema-title">Cinq pièces.</h2>
        <ol className="vault-tree">
          <li className="vault-root"><code>{VAULT_ROOT}/</code><span>Le coffre.</span></li>
          {VAULT_FOLDERS.map(folder => <li key={folder.name}><code>{folder.name}/</code><span>{folder.hint}</span></li>)}
          {VAULT_DOCUMENTS.map(doc => <li key={doc.name}><code>{doc.name}</code><span>{doc.hint}</span></li>)}
        </ol>
      </article>
      <article className="vault-steps" aria-labelledby="vault-steps-title">
        <p className="eyebrow">Obsidian</p>
        <h2 id="vault-steps-title">Ouvrir le dossier.</h2>
        <ol>
          {OBSIDIAN_STEPS.map(step => <li key={step.title}><strong>{step.title}</strong><span>{step.detail}</span></li>)}
        </ol>
      </article>
    </div>

    <article className="vault-map" aria-labelledby="vault-map-title">
      <header>
        <p className="eyebrow">Modes</p>
        <h2 id="vault-map-title">Où chaque geste se range.</h2>
      </header>
      <ul>
        {VAULT_MODE_MAP.map(item => <li key={item.mode}>
          {item.mode === "studio"
            ? <div className="vault-row" aria-current="page"><strong>{item.label}</strong><span>{item.line}</span><code>{item.places.join(" · ")}</code></div>
            : <button type="button" className="vault-row" onClick={() => go(item.mode)}><strong>{item.label}</strong><span>{item.line}</span><code>{item.places.join(" · ")}</code></button>}
        </li>)}
      </ul>
    </article>

    <article className="vault-download" aria-labelledby="vault-download-title">
      <div>
        <p className="eyebrow">Coffre de départ</p>
        <h2 id="vault-download-title">Un ZIP, déjà nommé.</h2>
        <p>Dossiers vides, <code>CANON.md</code>, <code>jobs.md</code>, et le mode d’emploi. Aucune image. Aucun compte.</p>
      </div>
      <a className="button button-primary" href={assetPath(STARTER_VAULT_HREF)} download={STARTER_VAULT_FILE}>Télécharger le coffre <Arrow /></a>
      <p className="vault-hold">Hors ligne · vente HOLD</p>
    </article>
  </section>;
}
