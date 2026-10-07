import type { AbstractIntlMessages } from "next-intl";
import type { Locale } from "./config";

/** One catalogue. The other three stay out of the first script until the switcher asks. */
function asMessages(value: unknown): AbstractIntlMessages {
  return value as AbstractIntlMessages;
}

export async function loadCatalog(locale: Locale): Promise<AbstractIntlMessages> {
  switch (locale) {
    case "en": return asMessages((await import("../../../messages/en.json")).default);
    case "de": return asMessages((await import("../../../messages/de.json")).default);
    case "es": return asMessages((await import("../../../messages/es.json")).default);
    default: return asMessages((await import("../../../messages/fr.json")).default);
  }
}
