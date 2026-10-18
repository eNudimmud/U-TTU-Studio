import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import localFont from "next/font/local";
import "./globals.css";
import { LocaleProvider, SkipLink } from "@/components/i18n/provider";
import { loadCatalog } from "@/lib/i18n/catalog";
import { htmlLang, readLocaleValue, type Locale } from "@/lib/i18n/config";
import { assetPath, siteOrigin, socialImage } from "@/lib/site";

/* Instrument Serif (OFL, src/app/fonts/InstrumentSerif-OFL.txt): one display title per screen, never body text. */
const display = localFont({
  src: [
    { path: "./fonts/InstrumentSerif-Regular.woff", weight: "400", style: "normal" },
    { path: "./fonts/InstrumentSerif-Italic.woff", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const ogLocale: Record<Locale, string> = { fr: "fr_CH", en: "en_GB", de: "de_DE", es: "es_ES" };

async function requestLocale(): Promise<Locale> {
  const jar = await cookies();
  return readLocaleValue(jar.get("u-ttu-locale")?.value);
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  const copy = (await loadCatalog(locale)).meta as { title: string; description: string };
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
        appleWebApp: { capable: true, title: "U*TTU", statusBarStyle: "black-translucent" },
  };
}

export const viewport: Viewport = {
  themeColor: "#0F0F11",
  colorScheme: "dark",
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await requestLocale();
  const messages = await loadCatalog(locale);
  return <html lang={htmlLang(locale)} className={display.variable}><body><LocaleProvider initial={locale} messages={messages}><SkipLink />{children}</LocaleProvider></body></html>;
}
