"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CREDITS_PER_USD, claimBasis, formatCredits } from "@/lib/credits";
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
  const { setSheet, balance, balanceNote, refreshBalance, claim, settings, studio } = useStudio();
  const measured = studio.takes.filter(take => take.costCredits !== null).slice(0, 5);
  return <SheetFrame title="Crédits" label="Ton compte de rendu" onClose={() => setSheet(null)}>
    <div className="u-stack">
      <div className="u-balance">
        <strong>{balance ? formatCredits(balance.credits) : "—"}</strong>
        <span>{balance ? `crédits, lus à ${time.format(balance.readAt)}` : balanceNote || "solde non lu"}</span>
        <button type="button" className="u-icon" onClick={() => void refreshBalance()} aria-label="Relire le solde"><Refresh /></button>
      </div>
      <p className="u-small">Un seul payeur : ton compte Comfy Cloud. Le solde vient de lui, avant et après chaque prise. 1 $ = {CREDITS_PER_USD} crédits.</p>
      <div className="u-card">
        <p className="u-label">À ce réglage · {takeProfile(settings)}</p>
        <p>{claim.state === "measured" ? `Environ ${formatCredits(claim.credits)} crédits, mesuré sur ${claimBasis(claim)}.` : "Non calibré. Aucun chiffre n’est annoncé avant une prise mesurée à ce réglage."}</p>
      </div>
      {measured.length > 0 && <ul className="u-ledger" aria-label="Dernières prises mesurées">
        {measured.map(take => <li key={take.id}><span>{date.format(new Date(take.at))}</span><span>{take.sceneName || "Prise"}</span><span>{formatCredits(take.costCredits ?? 0)} cr.</span></li>)}
      </ul>}
      <p className="u-small">Recharger se fait sur ton compte Comfy. Le studio ne vend pas de crédits.</p>
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
      <p>Ton look, tes lieux et tes prises vivent ici, sur cet appareil, rangés comme un coffre Obsidian. Rien n’est envoyé au studio.</p>
      <ul className="u-ledger">
        <li><span>Photos du look</span><span>{studio.look.photos.length}</span></li>
        <li><span>Lieux</span><span>{studio.scenes.length}</span></li>
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
  const { setSheet, settings, balance, gate, confirmRun, scene, line } = useStudio();
  return <SheetFrame title="Tourner cette prise ?" label="Confirmer" onClose={() => setSheet(null)}>
    <div className="u-stack">
      <ul className="u-ledger">
        <li><span>Lieu</span><span>{scene?.name ?? "—"}</span></li>
        <li><span>Plan</span><span>{line.trim() || "sans phrase"}</span></li>
        <li><span>Réglage</span><span>{settings.aspect === "vertical" ? "9:16" : settings.aspect === "horizontal" ? "16:9" : "1:1"} · {settings.seconds} s · {settings.quality === "rapide" ? "rapide" : "fin"}</span></li>
        <li><span>Ton solde</span><span>{balance ? `${formatCredits(balance.credits)} crédits` : "illisible"}</span></li>
      </ul>
      <p className={`u-cost is-${gate.tone}`}>{gate.line}</p>
      <button type="button" className="u-primary" disabled={!gate.allowed} onClick={() => void confirmRun()}>Tourner · débit sur mon compte</button>
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
        <li><span>Débit</span><span>{take.costCredits !== null ? `${formatCredits(take.costCredits)} crédits` : "pas encore lu"}</span></li>
        {take.gpuSeconds !== null && <li><span>Calcul</span><span>{take.gpuSeconds} s</span></li>}
      </ul>
      <PublishActions take={take} />
      <button type="button" className="u-link u-muted" onClick={() => { void deleteTake(take.id); setSheet(null); }}><Trash /> Retirer du coffre</button>
    </div>
  </SheetFrame>;
}
