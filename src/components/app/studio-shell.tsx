"use client";

// The studio frame for pages outside the studio itself (compte, connexion, inscription):
// the shared top bar, the docked assistant and the credit/connect sheets, around any content.

import type { ReactNode } from "react";
import { useI18n } from "@/components/i18n/provider";
import { ConnectSheet, CreditSheet } from "./studio-frames";
import { StudioProvider, useStudio } from "./studio-session";
import { TopBar, type Place } from "./top-bar";
import { AssistantPanel } from "./assistant-panel";
import "./app.css";

export function StudioShell({ place, className, children }: { place: Place; className?: string; children: ReactNode }) {
  return <StudioProvider><ShellFrame place={place} className={className}>{children}</ShellFrame></StudioProvider>;
}

function ShellFrame({ place, className, children }: { place: Place; className?: string; children: ReactNode }) {
  const { say } = useI18n();
  const { notice, sheet } = useStudio();
  return <div className="u-app">
    <TopBar place={place} />
    <main id="contenu" className={className ? `u-main ${className}` : "u-main"} tabIndex={-1}>{children}</main>
    {notice && <p className="u-toast" role="status">{say(notice)}</p>}
    <AssistantPanel />
    {sheet === "credits" && <CreditSheet />}
    {sheet === "connect" && <ConnectSheet />}
  </div>;
}
