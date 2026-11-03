// The storyboard's words live in their own catalogs (messages/storyboard/<locale>.json), loaded only
// when the page (or the studio's entry, behind its flag) needs them. Same four languages as the studio.

import type { AbstractIntlMessages } from "next-intl";
import type { Locale } from "../i18n/config";

export async function loadStoryboardCatalog(locale: Locale): Promise<AbstractIntlMessages> {
  switch (locale) {
    case "en": return (await import("../../../messages/storyboard/en.json")).default as AbstractIntlMessages;
    case "de": return (await import("../../../messages/storyboard/de.json")).default as AbstractIntlMessages;
    case "es": return (await import("../../../messages/storyboard/es.json")).default as AbstractIntlMessages;
    default: return (await import("../../../messages/storyboard/fr.json")).default as AbstractIntlMessages;
  }
}
