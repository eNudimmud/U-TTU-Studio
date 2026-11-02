"use client";

// SB9 · The studio's door to /storyboard, on the studio home for everyone (SB11). Switched off in this
// browser (`?storyboard=0`): nothing is rendered and no storyboard catalog is loaded.

import { NextIntlClientProvider, useMessages, type AbstractIntlMessages } from "next-intl";
import { useEffect, useState } from "react";
import { useI18n, useLocaleSwitch } from "@/components/i18n/provider";
import { htmlLang } from "@/lib/i18n/config";
import { STORYBOARD_CLOSED } from "@/app/storyboard/closed";
import { loadStoryboardCatalog } from "@/lib/storyboard/catalogue";
import { storyboardDansCePoste } from "@/lib/storyboard/drapeau";
import { assetPath } from "@/lib/site";

function Door() {
  const { t } = useI18n();
  return <p className="u-entry-link" data-storyboard-entry="" data-storyboard-soon={STORYBOARD_CLOSED ? "" : undefined}>
    <span><strong>{t("storyboard.entry.title")}{STORYBOARD_CLOSED && <em data-storyboard-soon="">{t("storyboard.entry.soon")}</em>}</strong> · {t(STORYBOARD_CLOSED ? "storyboard.entry.soonLead" : "storyboard.entry.lead")}</span>
    <a className="u-secondary" href={assetPath("/storyboard")} style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>{t(STORYBOARD_CLOSED ? "storyboard.entry.soonOpen" : "storyboard.entry.open")}</a>
  </p>;
}

export function StoryboardEntry() {
  const { locale } = useLocaleSwitch();
  const base = useMessages();
  const [extra, setExtra] = useState<AbstractIntlMessages | null>(null);
  useEffect(() => {
    if (!storyboardDansCePoste()) return;
    let gone = false;
    void loadStoryboardCatalog(locale).then(messages => { if (!gone) setExtra(messages); });
    return () => { gone = true; };
  }, [locale]);
  if (!extra) return null;
  return <NextIntlClientProvider locale={htmlLang(locale)} messages={{ ...base, ...extra }} timeZone="Europe/Zurich"><Door /></NextIntlClientProvider>;
}
