import type { Metadata } from "next";
import { StudioApp } from "@/components/app/studio-app";
import { siteOrigin, studioDescription, studioTitle } from "@/lib/site";
import { tabFromLocation, type Tab } from "@/lib/studio-route";

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

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ step?: string | string[] }> }) {
  const params = await searchParams;
  const raw = Array.isArray(params.step) ? params.step[0] : params.step;
  const asked = tabFromLocation("", raw ? `?${new URLSearchParams({ step: raw })}` : "");
  const initialTab: Tab | null = asked && asked !== "compte" ? asked : null;
  return <StudioApp initialTab={initialTab} />;
}
