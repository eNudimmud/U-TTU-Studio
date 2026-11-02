"use client";

import { LanguageSwitcher, useI18n } from "@/components/i18n/provider";
import { Brand } from "@/components/brand";
import { assetPath } from "@/lib/site";
import { guideHome } from "@/lib/guide/home-copy";
import { useLocaleSwitch } from "@/components/i18n/provider";

export function GuideBar({ crumb }: { crumb?: string }) {
  const { locale } = useLocaleSwitch();
  const copy = guideHome(locale);
  const { t } = useI18n();
  return <header className="g-top">
    <Brand href={assetPath("/")} />
    <span className="g-crumb">/ {crumb ?? t("chrome.guide")}</span>
    <span className="g-sp" />
    <LanguageSwitcher />
    <a className="u-secondary" href={assetPath("/studio")}>{copy.openStudio}</a>
  </header>;
}
