import { cookies } from "next/headers";
import { LOCALE_COOKIE, requestLocaleFrom, type Locale } from "./config";

/** The visitor's explicit choice (cookie) stays; a first visit is in English. */
export async function requestLocale(): Promise<Locale> {
  const jar = await cookies();
  return requestLocaleFrom(jar.get(LOCALE_COOKIE)?.value);
}
