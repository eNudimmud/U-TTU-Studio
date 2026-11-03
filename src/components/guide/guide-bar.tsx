"use client";

import { LanguageSwitcher, useI18n } from "@/components/i18n/provider";
import { Brand } from "@/components/brand";
import { assetPath } from "@/lib/site";
import { guideHome } from "@/lib/guide/home-copy";
import { useLocaleSwitch } from "@/components/i18n/provider";

const TOOLS_LABEL: Record<string, string> = { en: "Tools", fr: "Outils", de: "Werkzeuge", es: "Herramientas" };

/** One slim bar: logo · Guide | Tools tabs · language · Studio. No breadcrumb to wrap on a phone. */
export function GuideBar({ page = "home" }: { page?: "home" | "tools" }) {
  const { locale } = useLocaleSwitch();
  const copy = guideHome(locale);
  const { t } = useI18n();
  return <header className="g-top">
    <Brand href={assetPath("/")} />
    <nav className="g-tabs" aria-label={t("chrome.guide")}>
      <a href={assetPath("/guide")} aria-current={page === "home" ? "page" : undefined}>{t("chrome.guide")}</a>
      <a href={assetPath("/guide/tools")} aria-current={page === "tools" ? "page" : undefined}>{TOOLS_LABEL[locale] ?? TOOLS_LABEL.en}</a>
    </nav>
    <span className="g-sp" />
    <LanguageSwitcher />
    <a className="g-studio" href={assetPath("/studio")} aria-label={copy.openStudio}>Studio <span aria-hidden="true">→</span></a>
  </header>;
}
