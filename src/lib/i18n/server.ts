import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, requestLocaleFrom, type Locale } from "./config";

/** The visitor's explicit choice (AA, cookie) stays; a first visit follows the browser, English otherwise. */
export async function requestLocale(): Promise<Locale> {
  const [jar, head] = await Promise.all([cookies(), headers()]);
  return requestLocaleFrom(jar.get(LOCALE_COOKIE)?.value, head.get("accept-language"));
}
