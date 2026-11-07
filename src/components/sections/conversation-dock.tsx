"use client";

// The same Grok-style conversation as the studio home: composer, thread, quotes.
// On CINEMA/ANIME it stays in the page flow and opens Outils on /studio, not under /legacy.

import { CreationBar } from "@/components/app/creation-bar";
import { BarreFil, useFil } from "@/components/app/barre-fil";
import { AssistantPanel } from "@/components/app/assistant-panel";
import { ConnectSheet } from "@/components/app/studio-frames";
import { StudioProvider, useStudio } from "@/components/app/studio-session";
import "@/components/app/app.css";

function Dock() {
  const runner = useFil();
  const { sheet } = useStudio();
  return <>
    <section className="u-conversation-dock" data-conversation-dock="" data-threaded={runner.fil.messages.length ? "" : undefined} aria-label="Conversation">
      <BarreFil runner={runner} />
      <CreationBar onSend={input => runner.send(input)} preview={runner.preview} />
    </section>
    <AssistantPanel />
    {sheet === "connect" && <ConnectSheet />}
  </>;
}

export default function ConversationDock() {
  return <StudioProvider><Dock /></StudioProvider>;
}
