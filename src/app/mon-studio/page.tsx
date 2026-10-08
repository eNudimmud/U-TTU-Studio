import type { Metadata } from "next";
import { AtelierPage } from "@/components/app/atelier-page";
import { siteOrigin } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mon studio — U*TTU",
  description: "Personnages, lieux, prises et notes, sur cet appareil.",
  robots: { index: false },
  ...(siteOrigin ? { alternates: { canonical: `${siteOrigin}/mon-studio` } } : {}),
};

export default function MonStudioPage() {
  return <AtelierPage />;
}
