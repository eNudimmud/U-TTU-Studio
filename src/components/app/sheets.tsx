"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { costLabel } from "@/lib/coffre/model";
import { CREDITS_PER_USD, claimBasis, formatCredits } from "@/lib/credits";
import { formatUsd } from "@/lib/fal/prices";
import { folderLinkSupported } from "@/lib/coffre/link";
import { takeProfile } from "@/lib/render/take-graph";
import { assetPath } from "@/lib/site";
import { Close, Refresh, Trash } from "./glyphs";
import { PublishActions } from "./publish";
import { useStudio } from "./studio-context";

function SheetFrame({ title, label, onClose, children, tall = false }: { title: string; label: string; onClose(): void; children: ReactNode; tall?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return <div className="u-overlay" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} tabIndex={-1} className={`u-sheet${tall ? " is-tall" : ""}`} role="dialog" aria-modal="true" aria-labelledby="u-sheet-title">
      <header className="u-sheet-head">
        <div>
          <p className="u-label">{label}</p>
          <h2 id="u-sheet-title">{title}</h2>
        </div>
        <button type="button" className="u-icon" onClick={onClose} aria-label="Fermer"><Close /></button>
      </header>
      {children}
    </div>
  </div>;
}

export function ConnectSheet() {
  const { setSheet, connected, link, connectKey, sessionLinked, disconnect, setNotice } = useStudio();
  const [mode, setMode] = useState<"session" | "key">("session");
  const [signing, setSigning] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => setSheet(null);

  useEffect(() => {
    if (!signing) return;
    const timer = window.setInterval(() => {
      void sessionLinked().then(ok => {
        if (!ok) return;
        setSigning(false);
        setNotice("Compte de rendu relié.");
        setSheet(null);
      });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [signing, sessionLinked, setNotice, setSheet]);

  async function linkKey() {
    setBusy(true);
    setError("");
    const problem = await connectKey(key);
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    setNotice("Compte de rendu relié par clé.");
    setSheet(null);
  }

  return <SheetFrame title="Ton compte de rendu" label="Relier" onClose={close} tall={signing}>
    {connected
      ? <div className="u-stack">
        <p>Relié {link.mode === "key" ? "par clé" : "par ta session"}. Les prises tournent sur ce compte, et ses crédits les paient.</p>
        <button type="button" className="u-secondary" onClick={() => void disconnect()}>Délier ce compte</button>
      </div>
      : <div className="u-stack">
        <p>Le studio ne calcule rien lui-même. Tes prises tournent sur ton compte Comfy Cloud, avec tes crédits. Le studio ne garde ni ton mot de passe ni ta clé sur un serveur.</p>
        <div className="u-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "session"} onClick={() => setMode("session")}>Me connecter ici</button>
          <button type="button" role="tab" aria-selected={mode === "key"} onClick={() => setMode("key")}>J’ai une clé</button>
        </div>
        {mode === "session" && (signing
          ? <>
            <iframe className="u-signin" src={assetPath("/login")} title="Connexion au compte de rendu" allow="clipboard-write" />
            <p className="u-small">Connecte-toi dans ce cadre. Il se ferme dès que la session est là.</p>
          </>
          : <>
            <p className="u-small">La page de connexion de Comfy s’ouvre dans cette feuille. Elle charge ses propres traceurs (Google, LinkedIn). Rien n’est chargé avant ton geste.</p>
            <button type="button" className="u-primary" onClick={() => setSigning(true)}>Ouvrir la connexion</button>
          </>)}
        {mode === "key" && <>
          <label className="u-field">
            <span className="u-label">Clé API Comfy Cloud</span>
            <input type="password" value={key} autoComplete="off" spellCheck={false} placeholder="comfyui-…" onChange={event => setKey(event.target.value)} />
          </label>
          <p className="u-small">La clé reste sur cet appareil. Elle demande un abonnement Comfy Cloud payant. Aucun traceur tiers ne se charge dans ce mode.</p>
          {error && <p className="u-small is-error" role="alert">{error}</p>}
          <button type="button" className="u-primary" disabled={busy || !key.trim()} onClick={() => void linkKey()}>{busy ? "Vérification…" : "Relier"}</button>
        </>}
      </div>}
  </SheetFrame>;
}

const time = new Intl.DateTimeFormat("fr-CH", { hour: "2-digit", minute: "2-digit" });
const date = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function CreditSheet() {
  const { setSheet, connected, balance, balanceNote, refreshBalance, claim, settings, studio, engine, falLinked, falBalance, falBalanceNote, refreshFal, disconnect, disconnectFal } = useStudio();
  const measured = studio.takes.filter(take => take.costCredits !== null || take.costUsd !== null).slice(0, 5);
  return <SheetFrame title="Comptes" label="Qui paie" onClose={() => setSheet(null)}>
    <div className="u-stack">
      <p className="u-label">Compte de rendu</p>
      <div className="u-balance">
        <strong>{balance ? formatCredits(balance.credits) : "—"}</strong>
        <span>{!connected ? "non relié" : balance ? `crédits, lus à ${time.format(balance.readAt)}` : balanceNote || "solde non lu"}</span>
        {connected && <button type="button" className="u-icon" onClick={() => void refreshBalance()} aria-label="Relire le solde de rendu"><Refresh /></button>}
      </div>
      <p className="u-small">Les prises « Références » tournent sur ton compte Comfy Cloud. 1 $ = {CREDITS_PER_USD} crédits. Le studio n’encaisse rien.</p>
      {connected && <>
        <p className="u-small">Cet appareil oublie la liaison. Le coffre et le compte restent.</p>
        <button type="button" className="u-secondary" onClick={() => void disconnect()}>Délier le compte de rendu</button>
      </>}
      {engine === "comfy" && <div className="u-card">
        <p className="u-label">À ce réglage · {takeProfile(settings)}</p>
        <p>{claim.state === "measured" ? `Environ ${formatCredits(claim.credits)} crédits, mesuré sur ${claimBasis(claim)}.` : "Non calibré. Aucun chiffre n’est annoncé avant une prise mesurée à ce réglage."}</p>
      </div>}
      <p className="u-label">Compte fal</p>
      <div className="u-balance">
        <strong>{falBalance ? formatUsd(falBalance.usd) : "—"}</strong>
        <span>{falLinked ? (falBalance ? `lus à ${time.format(falBalance.readAt)}` : falBalanceNote || "solde non lu") : "non relié"}</span>
        {falLinked && <button type="button" className="u-icon" onClick={() => void refreshFal()} aria-label="Relire le solde fal"><Refresh /></button>}
      </div>
      <p className="u-small">La formation et les prises « Ton double » sont débitées ici, au prix annoncé avant le geste.</p>
      {falLinked && <>
        <p className="u-small">Cet appareil oublie la clé. Le coffre, le fichier formé et le compte restent.</p>
        <button type="button" className="u-secondary" onClick={disconnectFal}>Délier le compte fal</button>
      </>}
      {measured.length > 0 && <ul className="u-ledger" aria-label="Dernières prises mesurées">
        {measured.map(take => <li key={take.id}><span>{date.format(new Date(take.at))}</span><span>{take.sceneName || "Prise"}</span><span>{costLabel(take) ?? "en attente"}</span></li>)}
      </ul>}
      <p className="u-small">Recharger se fait sur le compte qui paie. Le studio ne vend rien.</p>
    </div>
  </SheetFrame>;
}

export function CoffreSheet() {
  const { setSheet, studio, exportCoffre, linkFolder, folder, guide, guideOff } = useStudio();
  const [usage, setUsage] = useState("");
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [linkable, setLinkable] = useState(false);

  useEffect(() => {
    setLinkable(folderLinkSupported());
    void navigator.storage?.estimate?.().then(estimate => {
      if (estimate.usage !== undefined) setUsage(`${(estimate.usage / 1048576).toFixed(1)} Mo sur cet appareil`);
    });
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  return <SheetFrame title="Ton coffre" label="Mémoire du studio" onClose={() => setSheet(null)}>
    <div className="u-stack">
      <p>Ton look, tes lieux, tes doubles et tes prises vivent ici, sur cet appareil, rangés comme un coffre Obsidian. Rien n’est envoyé au studio. La clé fal non plus.</p>
      <ul className="u-ledger">
        <li><span>Photos du look</span><span>{studio.look.photos.length}</span></li>
        <li><span>Lieux</span><span>{studio.scenes.length}</span></li>
        <li><span>Clips</span><span>{studio.clips.length}</span></li>
        <li><span>Doubles</span><span>{studio.loras.length}</span></li>
        <li><span>Prises</span><span>{studio.takes.length}</span></li>
      </ul>
      <p className="u-small">{usage}{persisted === false ? " · Le navigateur peut vider ce stockage : exporte ou relie un dossier." : persisted ? " · Stockage protégé." : ""}</p>
      <button type="button" className="u-primary" onClick={() => void exportCoffre()}>Exporter le coffre (.zip)</button>
      {linkable && <button type="button" className="u-secondary" onClick={() => void linkFolder()}>{folder ? `Relié à « ${folder} »` : "Relier mon dossier Obsidian"}</button>}
      {!linkable && <p className="u-small">Sur ordinateur, Chrome ou Edge peuvent écrire directement dans ton dossier Obsidian.</p>}
      <div className="u-row">
        <a className="u-link u-muted" href={assetPath("/compte")}>Compte U*TTU, facultatif</a>
        {!guide.off && <button type="button" className="u-link u-muted" onClick={guideOff}>Couper le guide</button>}
      </div>
    </div>
  </SheetFrame>;
}

export function ConfirmSheet() {
  const { setSheet, settings, balance, gate, confirmRun, scene, line, engine, chosenLora, loraResolution, falBalance } = useStudio();
  const format = settings.aspect === "vertical" ? "9:16" : settings.aspect === "horizontal" ? "16:9" : "1:1";
  return <SheetFrame title="Tourner cette prise ?" label="Confirmer" onClose={() => setSheet(null)}>
    <div className="u-stack">
      <ul className="u-ledger">
        <li><span>Lieu</span><span>{scene?.name ?? "—"}</span></li>
        <li><span>Plan</span><span>{line.trim() || "sans phrase"}</span></li>
        {engine === "lora"
          ? <>
            <li><span>Double</span><span>{chosenLora?.name || "Ton double"}</span></li>
            <li><span>Réglage</span><span>{format} · {settings.seconds} s · {loraResolution === "480P" ? "480p" : "768p"}</span></li>
            <li><span>Ton solde</span><span>{falBalance ? formatUsd(falBalance.usd) : "illisible"}</span></li>
          </>
          : <>
            <li><span>Réglage</span><span>{format} · {settings.seconds} s · {settings.quality === "rapide" ? "rapide" : "fin"}</span></li>
            <li><span>Ton solde</span><span>{balance ? `${formatCredits(balance.credits)} crédits` : "illisible"}</span></li>
          </>}
      </ul>
      <p className={`u-cost is-${gate.tone}`}>{gate.line}</p>
      <button type="button" className="u-primary" disabled={!gate.allowed} onClick={() => void confirmRun()}>{engine === "lora" ? "Tourner · débit sur mon compte fal" : "Tourner · débit sur mon compte"}</button>
      <p className="u-small">Rien ne part sans ce geste. Le studio n’encaisse rien.</p>
    </div>
  </SheetFrame>;
}

export function FalSheet() {
  const { setSheet, falLinked, falUsername, falBalanceNote, connectFal, disconnectFal, setNotice } = useStudio();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function linkKey() {
    setBusy(true);
    setError("");
    const problem = await connectFal(key);
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    setNotice("Compte fal relié.");
    setSheet(null);
  }

  return <SheetFrame title="Ton compte fal" label="Relier" onClose={() => setSheet(null)}>
    {falLinked
      ? <div className="u-stack">
        <p>Relié{falUsername ? ` à ${falUsername}` : ""}. La formation et les prises « Ton double » sont débitées sur ce compte.</p>
        <button type="button" className="u-secondary" onClick={disconnectFal}>Délier ce compte</button>
      </div>
      : <div className="u-stack">
        <p>Le studio ne forme rien lui-même. Ton double s’apprend sur ton compte fal, avec ton argent. Une seule visite hors de l’app : créer la clé. Ensuite tout reste ici.</p>
        <p className="u-small">fal ne montre le solde qu’à une clé de portée Admin. Crée-la avec cette portée, une fois.</p>
        <a className="u-link" href="https://fal.ai/dashboard/keys" target="_blank" rel="noreferrer">Créer une clé sur fal</a>
        <label className="u-field">
          <span className="u-label">Clé fal</span>
          <input id="u-fal-key" type="password" value={key} autoComplete="off" spellCheck={false} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:…" onChange={event => setKey(event.target.value)} />
        </label>
        <p className="u-small">La clé reste sur cet appareil. Elle part seulement vers fal, jamais dans le coffre ni dans son export. Une clé Admin peut aussi dépenser : ne la partage pas.</p>
        {(error || falBalanceNote) && <p className="u-small is-error" role="alert">{error || falBalanceNote}</p>}
        <button type="button" className="u-primary" disabled={busy || !key.trim()} onClick={() => void linkKey()}>{busy ? "Vérification…" : "Relier"}</button>
      </div>}
  </SheetFrame>;
}

export function TrainConfirmSheet() {
  const { setSheet, dataset, trainingSteps, falBalance, trainGate, confirmTraining } = useStudio();
  return <SheetFrame title="Former ton double ?" label="Confirmer" onClose={() => setSheet(null)}>
    <div className="u-stack">
      <ul className="u-ledger">
        <li><span>Clips</span><span>{dataset.clips}</span></li>
        <li><span>Apprentissage</span><span>{trainingSteps} pas</span></li>
        <li><span>Format</span><span>{dataset.aspect}</span></li>
        <li><span>Ton solde</span><span>{falBalance ? formatUsd(falBalance.usd) : "illisible"}</span></li>
      </ul>
      <p className={`u-cost is-${trainGate.tone}`}>{trainGate.line}</p>
      <button type="button" className="u-primary" disabled={!trainGate.allowed} onClick={() => void confirmTraining()}>Former · débit sur mon compte fal</button>
      <p className="u-small">Rien ne part sans ce geste. Le studio n’encaisse rien.</p>
    </div>
  </SheetFrame>;
}

export function PlayerSheet({ id }: { id: string }) {
  const { setSheet, studio, media, deleteTake } = useStudio();
  const take = studio.takes.find(item => item.id === id);
  if (!take) return null;
  return <SheetFrame title={take.line || "Prise"} label={take.sceneName || "Prise"} onClose={() => setSheet(null)} tall>
    <div className="u-stack">
      {media[take.video] && <video src={media[take.video]} poster={take.poster ? media[take.poster] : undefined} controls autoPlay muted loop playsInline className={`u-player is-${take.settings.aspect}`} />}
      <ul className="u-ledger">
        <li><span>Tournée</span><span>{date.format(new Date(take.at))}</span></li>
        <li><span>Réglage</span><span>{take.profile}</span></li>
        <li><span>Débit</span><span>{costLabel(take) ?? "pas encore lu"}</span></li>
        {take.gpuSeconds !== null && <li><span>Calcul</span><span>{take.gpuSeconds} s</span></li>}
      </ul>
      <PublishActions take={take} />
      <button type="button" className="u-link u-muted" onClick={() => { void deleteTake(take.id); setSheet(null); }}><Trash /> Retirer du coffre</button>
    </div>
  </SheetFrame>;
}
