export const LOCALES = ["fr", "en", "de", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "u-ttu-locale";
export const LOCALE_STORAGE = "u-ttu-locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "fr" || value === "en" || value === "de" || value === "es";
}

/** English is the studio's default language. */
export const DEFAULT_LOCALE: Locale = "en";

export function readLocaleValue(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * First visit, no explicit choice yet: follow the browser (Accept-Language, by q order).
 * fr, en, de and es are served as such; any other language gets English.
 */
export function negotiateLocale(acceptLanguage: string | undefined | null): Locale {
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map(param => param.trim()).find(param => param.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { lang: tag.trim().toLowerCase().split("-")[0], weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter(item => item.lang && item.lang !== "*" && item.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return ranked.map(item => item.lang).find(isLocale) ?? "en";
}

/**
 * The explicit choice (cookie, set by the language switcher) wins. Without one, every visitor
 * starts in English, whatever the browser says: English is the default (decision 31.10.2026),
 * and link previews must read the same for everyone. Accept-Language is deliberately ignored;
 * negotiateLocale stays available but is not used for the first visit.
 */
export function requestLocaleFrom(cookie: string | undefined | null, _acceptLanguage?: string | undefined | null): Locale {
  return isLocale(cookie) ? cookie : DEFAULT_LOCALE;
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
