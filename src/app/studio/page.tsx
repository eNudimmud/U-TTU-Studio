import type { Metadata } from "next";
import { preload } from "react-dom";
import { STUDIO_HERO } from "@/lib/studio-hero";
import { StudioApp } from "@/components/app/studio-app";
import { routeMetadata } from "@/lib/route-meta";
import { tabFromLocation, type Tab } from "@/lib/studio-route";
import { STUDIO_BOOT } from "@/lib/studio-boot";

export const metadata: Metadata = routeMetadata("studio");

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ step?: string | string[] }> }) {
  const params = await searchParams;
  const raw = Array.isArray(params.step) ? params.step[0] : params.step;
  const asked = tabFromLocation("", raw ? `?${new URLSearchParams({ step: raw })}` : "");
  const initialTab: Tab | null = asked;
  // The entry picture appears once the local studio opens: start its download with the HTML.
  // A #hash for another stage is not visible here; the 640/960 px file keeps that miss small.
  if (!asked || asked === "outils") preload(STUDIO_HERO.src, { as: "image", imageSrcSet: STUDIO_HERO.srcSet, imageSizes: STUDIO_HERO.sizes, fetchPriority: "high" });
  // F14 · Before the home paints: a stage address or a saved link (see studio-boot.ts).
  return <>
    <script dangerouslySetInnerHTML={{ __html: STUDIO_BOOT }} />
    <StudioApp initialTab={initialTab} />
  </>;
}
