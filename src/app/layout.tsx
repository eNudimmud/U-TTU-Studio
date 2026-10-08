import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./fonts.css";
import "./globals.css";
import { LocaleProvider, SkipLink } from "@/components/i18n/provider";
import { loadCatalog } from "@/lib/i18n/catalog";
import { htmlLang, readLocaleValue, type Locale } from "@/lib/i18n/config";
import { assetPath, siteOrigin, socialImage } from "@/lib/site";

const ogLocale: Record<Locale, string> = { fr: "fr_CH", en: "en_GB", de: "de_DE", es: "es_ES" };

const latinRange = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

// /fonts is the Comfy proxy. These files live under /brand so the browser
// receives the latin woff2, not Comfy's asset host.
const syneHref = assetPath("/brand/syne-latin.woff2");
const manropeHref = assetPath("/brand/manrope-latin.woff2");

const fontFaces = `@font-face{font-family:"Syne Variable";font-style:normal;font-display:swap;font-weight:400 800;src:url("${syneHref}") format("woff2");unicode-range:${latinRange}}@font-face{font-family:"Manrope Variable";font-style:normal;font-display:swap;font-weight:200 800;src:url("${manropeHref}") format("woff2");unicode-range:${latinRange}}`;

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
    icons: { icon: assetPath("/icon.svg") },
    appleWebApp: { capable: true, title: "U*TTU", statusBarStyle: "black-translucent" },
  };
}

export const viewport: Viewport = {
  themeColor: "#0B0A09",
  colorScheme: "dark",
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await requestLocale();
  const messages = await loadCatalog(locale);
  return <html lang={htmlLang(locale)}>
    <head>
      <link rel="preload" href={syneHref} as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href={manropeHref} as="font" type="font/woff2" crossOrigin="anonymous" />
      <style dangerouslySetInnerHTML={{ __html: fontFaces }} />
    </head>
    <body>
      <LocaleProvider initial={locale} messages={messages}><SkipLink />{children}</LocaleProvider>
    </body>
  </html>;
}
