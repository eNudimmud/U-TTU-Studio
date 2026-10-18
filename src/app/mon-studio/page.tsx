import type { Metadata } from "next";
import { AtelierPage } from "@/components/app/atelier-page";
import { siteOrigin } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mes créations — U*TTU Studio",
  description: "Images, vidéos, 3D, sons, personnages, lieux et prises, sur cet appareil.",
  robots: { index: false },
  ...(siteOrigin ? { alternates: { canonical: `${siteOrigin}/mon-studio` } } : {}),
};

export default function MonStudioPage() {
  return <AtelierPage />;
}
