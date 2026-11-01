"use client";

// SB5 · The storyboard page shell: its own word catalog (messages/storyboard/<locale>.json) on top of the
// studio's, the studio session (same vault, same Comfy link, same quotes), and the « Papier » theme.

import { NextIntlClientProvider, useMessages, type AbstractIntlMessages } from "next-intl";
import { useEffect, useState } from "react";
import { useLocaleSwitch } from "@/components/i18n/provider";
import { htmlLang } from "@/lib/i18n/config";
import { loadStoryboardCatalog } from "@/lib/storyboard/catalogue";
import { storyboardDansCePoste } from "@/lib/storyboard/drapeau";
import { StudioProvider } from "../app/studio-session";
import { StoryboardPage } from "./storyboard-page";
import "../app/app.css";
import "./storyboard.css";

export function StoryboardApp({ id, print, u11 = false, initial = null }: { id: string | null; print: boolean; u11?: boolean; initial?: { locale: string; messages: AbstractIntlMessages } | null }) {
  const { locale } = useLocaleSwitch();
  const base = useMessages();
  // `initial` is the server's catalog for the request locale: no empty first frame. A language switch loads the next one.
  const [extra, setExtra] = useState<{ locale: string; messages: AbstractIntlMessages } | null>(initial);
  const ready = extra?.locale === locale;
  // An explicit ?storyboard=0 / =1 is kept for this browser, like the studio's other flags.
  useEffect(() => { storyboardDansCePoste(); }, []);
  useEffect(() => {
    if (ready) return;
    let gone = false;
    void loadStoryboardCatalog(locale).then(messages => { if (!gone) setExtra({ locale, messages }); });
    return () => { gone = true; };
  }, [locale, ready]);
  if (!extra) return <div className="sb-root" data-theme="paper" aria-busy="true" />;
  return <NextIntlClientProvider locale={htmlLang(locale)} messages={{ ...base, ...extra.messages }} timeZone="Europe/Zurich">
    <StudioProvider>
      <StoryboardPage initialId={id} print={print} initialU11={u11} />
    </StudioProvider>
  </NextIntlClientProvider>;
}
