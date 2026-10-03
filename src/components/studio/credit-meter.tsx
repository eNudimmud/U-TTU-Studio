"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { COMFY_CLOUD } from "@/lib/comfy-stack";
import { TAKE_TIMING, estimateTake, formatCreditRange, formatCredits, monthUsage, priceList } from "@/lib/credits";
import { clearUsage, creditSnapshot, serverCreditSnapshot, subscribeCredits } from "@/lib/credit-store";
import { formatUsd } from "@/lib/fal-stack";

export function useCredits() {
  return useSyncExternalStore(subscribeCredits, creditSnapshot, serverCreditSnapshot);
}

const clock = new Intl.DateTimeFormat("fr-CH", { hour: "2-digit", minute: "2-digit" });
const rate = String(COMFY_CLOUD.gpuCreditsPerSecond).replace(".", ",");

export function CreditChip() {
  const { balance, usage } = useCredits();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const month = monthUsage(usage);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <div className="credit" ref={root}>
    <button type="button" className="credit-chip" aria-expanded={open} aria-controls="credit-sheet" onClick={() => setOpen(value => !value)}>
      <span className="credit-chip-label">Crédits</span>
      <strong>{balance ? formatCredits(balance.credits) : "—"}</strong>
    </button>
    {open && <section id="credit-sheet" className="credit-sheet" aria-labelledby="credit-sheet-title">
      <header className="credit-sheet-head">
        <h2 id="credit-sheet-title">Crédits</h2>
        <button type="button" className="text-button" onClick={() => setOpen(false)}>Fermer</button>
      </header>
      <p className="credit-balance">{balance
        ? <>Ton solde : <strong>{formatCredits(balance.credits)} crédits</strong>, lu à {clock.format(balance.readAt)} dans le cadre.</>
        : "Ton solde s’affiche ici une fois connecté dans le cadre de La prise ou de Sphère."}</p>
      <p className="credit-rule">Avant chaque rendu, le cadre montre l’estimation et ton solde. Rien ne part sans ton clic.</p>

      <h3>Ce mois, sur cet appareil</h3>
      <dl className="credit-table">
        <div><dt>Rendus lancés</dt><dd>{month.comfy.count ? `${month.comfy.count} · ≈ ${formatCreditRange(month.comfy)}` : "Aucun"}</dd></div>
        <div><dt>Payé par le studio</dt><dd>{month.fal.count ? `${month.fal.count} · ≈ ${formatUsd(month.fal.high)}` : "Rien"}</dd></div>
      </dl>
      {usage.length > 0 && <>
        <ol className="credit-lines" aria-label="Derniers lancements">
          {usage.slice(-4).reverse().map(line => <li key={line.id}>
            <span>{line.date.split("-").reverse().join(".")}</span>
            <span>{line.label}</span>
            <span>{line.engine === "comfy" ? (line.high ? `≈ ${formatCredits(line.high)} max` : "non estimé") : `≈ ${formatUsd(line.high)}`}</span>
          </li>)}
        </ol>
        <button type="button" className="text-button" onClick={clearUsage}>Effacer ce journal</button>
      </>}

      <h3>Prix indicatifs</h3>
      <dl className="credit-table">
        {priceList().map(line => <div key={line.id}>
          <dt>{line.label}<small>{line.payer === "toi" ? "ton compte" : "le studio"}</small></dt>
          <dd>{line.value}</dd>
        </div>)}
      </dl>
      <p className="small-print">Non mesuré : temps de calcul supposé × {rate} crédit par seconde, {COMFY_CLOUD.creditsPerUsd} crédits pour 1 $. Le journal reste sur cet appareil. Le solde n’est ni gardé ni envoyé. Rien à payer au studio.</p>

      <div className="credit-off">
        <button type="button" className="button button-outline" disabled aria-describedby="credit-off-note">Lire le solde du studio</button>
        <p id="credit-off-note" className="small-print">Éteint. Lire le solde fal du studio demande une clé d’administration fal dans le relais (secret à créer, par exemple FAL_ADMIN_KEY) et une route qui n’existe pas encore.</p>
      </div>
    </section>}
  </div>;
}

export function TakeCost() {
  const { balance } = useCredits();
  return <p className="take-cost">
    Un tournage : ≈ {formatCreditRange(estimateTake(false).credits)} ({TAKE_TIMING.full.steps} pas), ≈ {formatCreditRange(estimateTake(true).credits)} en turbo {TAKE_TIMING.turbo.steps} pas. Estimation non mesurée, sur ton compte.{" "}
    {balance ? `Ton solde : ${formatCredits(balance.credits)} crédits.` : "Ton solde s’affiche après connexion dans le cadre."}
  </p>;
}
