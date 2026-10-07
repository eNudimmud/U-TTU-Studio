import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/syne";
import "@fontsource-variable/manrope";
import "./globals.css";
import { LocaleProvider, SkipLink } from "@/components/i18n/provider";
import { htmlLang, readLocaleValue, type Locale } from "@/lib/i18n/config";
import { assetPath, siteOrigin, socialImage } from "@/lib/site";
import de from "../../messages/de.json";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import fr from "../../messages/fr.json";

const catalogs = { fr, en, de, es } as const;
const ogLocale: Record<Locale, string> = { fr: "fr_CH", en: "en_GB", de: "de_DE", es: "es_ES" };

async function requestLocale(): Promise<Locale> {
  const jar = await cookies();
  return readLocaleValue(jar.get("u-ttu-locale")?.value);
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  const copy = catalogs[locale].meta;
  return {
    metadataBase: new URL(siteOrigin || "http://localhost:3000"),
    title: copy.title,
    description: copy.description,
    applicationName: "U*TTU Studio",
    ...(siteOrigin ? { alternates: { canonical: `${siteOrigin}/` } } : {}),
    openGraph: {
      type: "website", locale: ogLocale[locale], siteName: "U*TTU Studio",
      title: copy.title, description: copy.description,
      ...(siteOrigin ? { url: siteOrigin } : {}),
      images: [{ url: socialImage, width: 1200, height: 630, alt: copy.title }],
    },
    twitter: { card: "summary_large_image", title: copy.title, description: copy.description, images: [socialImage] },
    icons: { icon: assetPath("/icon.svg") },
    appleWebApp: { capable: true, title: "U*TTU", statusBarStyle: "black-translucent" },
  };
}

export const viewport: Viewport = { themeColor: "#0B0A09", colorScheme: "dark", viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await requestLocale();
  return <html lang={htmlLang(locale)}><body><LocaleProvider initial={locale}><SkipLink />{children}</LocaleProvider></body></html>;
}
