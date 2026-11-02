"use client";

import type { ReactNode } from "react";
import { AssistantPanel } from "@/components/app/assistant-panel";
import { ConnectSheet, CreditSheet } from "@/components/app/studio-frames";
import { StudioProvider, useStudio } from "@/components/app/studio-session";
import { TopBar } from "@/components/app/top-bar";
import "@/components/app/app.css";

/** The closed storyboard uses the same studio bars as /studio and /look. */
export function HoldingShell({ children }: { children: ReactNode }) {
  return <StudioProvider><HoldingFrame>{children}</HoldingFrame></StudioProvider>;
}

function HoldingFrame({ children }: { children: ReactNode }) {
  const { sheet } = useStudio();
  return <div className="u-app" data-studio="storyboard">
    <TopBar place="storyboard" />
    {children}
    <AssistantPanel />
    {sheet === "credits" && <CreditSheet />}
    {sheet === "connect" && <ConnectSheet />}
  </div>;
}
