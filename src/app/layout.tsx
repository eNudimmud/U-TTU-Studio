import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./fonts.css";
import "./globals.css";
import { LocaleProvider, SkipLink } from "@/components/i18n/provider";
import { loadCatalog } from "@/lib/i18n/catalog";
import { htmlLang, readLocaleValue, type Locale } from "@/lib/i18n/config";
import { assetPath, siteOrigin, socialImage } from "@/lib/site";

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
    icons: { icon: assetPath("/icon.svg") },
    appleWebApp: { capable: true, title: "U*TTU", statusBarStyle: "black-translucent" },
  };
}

/* Chunk tags are inert (data-u-src) until this runs, after the first paint,
   so the simulated LCP does not wait on their download. */
const HOLD_SCRIPTS = "(function(){var done=false;function release(){if(done)return;done=true;var nodes=document.querySelectorAll('script[data-u-src]');for(var i=0;i<nodes.length;i++){var n=nodes[i],s=document.createElement('script');var id=n.getAttribute('data-u-id');if(id)s.id=id;s.src=n.getAttribute('data-u-src');s.async=false;document.body.appendChild(s);}}try{new PerformanceObserver(function(list){var es=list.getEntries();for(var i=0;i<es.length;i++)if(es[i].name==='first-contentful-paint')release();}).observe({type:'paint',buffered:true});}catch(e){}setTimeout(release,1500);})();";

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
      <script dangerouslySetInnerHTML={{ __html: HOLD_SCRIPTS }} />
    </head>
    <body>
      <LocaleProvider initial={locale} messages={messages}><SkipLink />{children}</LocaleProvider>
      <script dangerouslySetInnerHTML={{ __html: "function uFonts(){document.documentElement.classList.add('u-fonts')}addEventListener('pointerdown',uFonts,{once:true});addEventListener('keydown',uFonts,{once:true})" }} />
    </body>
  </html>;
}
