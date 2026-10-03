import type { Metadata } from "next";
import { StudioApp } from "@/components/app/studio-app";
import { siteOrigin, studioDescription, studioTitle } from "@/lib/site";

export const metadata: Metadata = {
  title: studioTitle,
  description: studioDescription,
  ...(siteOrigin
    ? {
        alternates: { canonical: `${siteOrigin}/studio` },
        openGraph: { url: `${siteOrigin}/studio`, title: studioTitle, description: studioDescription },
      }
    : {}),
};

export default function StudioPage() {
  return <StudioApp />;
}
