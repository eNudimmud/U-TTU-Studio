export const LOCALES = ["fr", "en", "de", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "u-ttu-locale";
export const LOCALE_STORAGE = "u-ttu-locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "fr" || value === "en" || value === "de" || value === "es";
}

export function readLocaleValue(value: string | undefined | null): Locale {
  return isLocale(value) ? value : "fr";
}

/** French stays fr-CH, the live document language. Other locales stay language-only. */
export function htmlLang(locale: Locale): string {
  if (locale === "fr") return "fr-CH";
  return locale;
}

/** Dates follow the chosen language. Amounts stay on the fr-CH formatter. */
export function dateLocale(locale: Locale): string {
  if (locale === "fr") return "fr-CH";
  if (locale === "en") return "en-GB";
  if (locale === "de") return "de-DE";
  return "es-ES";
}
