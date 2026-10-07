"use client";

import { NextIntlClientProvider, useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import de from "../../../messages/de.json";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import fr from "../../../messages/fr.json";
import { dateLocale, htmlLang, LOCALE_COOKIE, LOCALE_STORAGE, type Locale, readLocaleValue } from "@/lib/i18n/config";
import { phrase } from "@/lib/i18n/phrase";

const CATALOGS = { fr, en, de, es } as const;

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

export function LocaleProvider({ initial, children }: { initial: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initial);
  const setLocale = useCallback((next: Locale) => {
    const locale = readLocaleValue(next);
    setLocaleState(locale);
    persist(locale);
  }, []);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>
    <NextIntlClientProvider locale={htmlLang(locale)} messages={CATALOGS[locale]} timeZone="Europe/Zurich">
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
  return <label className={rail ? "u-lang u-lang-rail" : "u-lang"}>
    <span className="sr-only">{t("lang.label")}</span>
    <select aria-label={t("lang.label")} value={locale} onChange={event => setLocale(readLocaleValue(event.target.value))}>
      {(Object.keys(NAMES) as Locale[]).map(code => <option key={code} value={code}>{NAMES[code]}</option>)}
    </select>
  </label>;
}

export function SkipLink() {
  const t = useTranslations();
  return <a className="skip-link" href="#contenu">{t("skip")}</a>;
}
