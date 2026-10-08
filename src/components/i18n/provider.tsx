"use client";

import { NextIntlClientProvider, useTranslations, type AbstractIntlMessages } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadCatalog } from "@/lib/i18n/catalog";
import { dateLocale, htmlLang, LOCALE_COOKIE, LOCALE_STORAGE, type Locale, readLocaleValue } from "@/lib/i18n/config";
import { phrase } from "@/lib/i18n/phrase";

const LocaleContext = createContext<{ locale: Locale; setLocale(locale: Locale): void }>({
  locale: "fr",
  setLocale() {},
});

function persist(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE, locale);
  } catch {}
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.documentElement.lang = htmlLang(locale);
}

export function LocaleProvider({ initial, messages, children }: { initial: Locale; messages: AbstractIntlMessages; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initial);
  const [catalog, setCatalog] = useState<AbstractIntlMessages>(messages);
  const setLocale = useCallback((next: Locale) => {
    const locale = readLocaleValue(next);
    void loadCatalog(locale).then(nextMessages => {
      setCatalog(nextMessages);
      setLocaleState(locale);
      persist(locale);
    });
  }, []);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>
    <NextIntlClientProvider locale={htmlLang(locale)} messages={catalog} timeZone="Europe/Zurich">
      {children}
    </NextIntlClientProvider>
  </LocaleContext.Provider>;
}

export function useLocaleSwitch() {
  return useContext(LocaleContext);
}

export function useI18n() {
  const t = useTranslations();
  const say = (line: string) => phrase((key, values) => t(key, values), line);
  return { t, say };
}

export function useStudioDates() {
  const { locale } = useLocaleSwitch();
  const tag = dateLocale(locale);
  return useMemo(() => ({
    time: new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit" }),
    date: new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
  }), [tag]);
}

const NAMES: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  de: "Deutsch",
  es: "Español",
};

export function LanguageSwitcher({ rail = false }: { rail?: boolean }) {
  const { locale, setLocale } = useLocaleSwitch();
  const t = useTranslations();
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 799px)");
    const apply = () => setCompact(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return <label className={rail ? "u-lang u-lang-rail" : "u-lang is-live"}>
    <span className="sr-only">{t("lang.label")}</span>
    <select aria-label={t("lang.label")} value={locale} onChange={event => setLocale(readLocaleValue(event.target.value))}>
      {(Object.keys(NAMES) as Locale[]).map(code => <option key={code} value={code}>{compact ? code.toUpperCase() : NAMES[code]}</option>)}
    </select>
  </label>;
}

export function SkipLink() {
  const t = useTranslations();
  return <a className="skip-link" href="#contenu">{t("skip")}</a>;
}
