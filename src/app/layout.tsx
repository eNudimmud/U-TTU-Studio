import type { Metadata, Viewport } from "next";
import "@fontsource-variable/syne";
import "@fontsource-variable/manrope";
import "./globals.css";
import { assetPath, siteDescription, siteOrigin, siteTitle, socialImage } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin || "http://localhost:3000"),
  title: siteTitle,
  description: siteDescription,
  applicationName: "U*TTU Studio",
  ...(siteOrigin ? { alternates: { canonical: `${siteOrigin}/` } } : {}),
  openGraph: {
    type: "website", locale: "fr_CH", siteName: "U*TTU Studio",
    title: siteTitle, description: siteDescription,
    ...(siteOrigin ? { url: siteOrigin } : {}),
    images: [{ url: socialImage, width: 1200, height: 630, alt: "U*TTU Studio — Ton personnage, ta scène, la prise." }],
  },
  twitter: { card: "summary_large_image", title: siteTitle, description: siteDescription, images: [socialImage] },
  icons: { icon: assetPath("/icon.svg") },
  appleWebApp: { capable: true, title: "U*TTU", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#0B0A09", colorScheme: "dark", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr-CH"><body><a className="skip-link" href="#contenu">Aller au contenu</a>{children}</body></html>;
}
