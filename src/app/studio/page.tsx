import type { Metadata } from "next";
import { StudioApp } from "@/components/app/studio-app";
import { routeMetadata } from "@/lib/route-meta";
import { tabFromLocation, type Tab } from "@/lib/studio-route";

export const metadata: Metadata = routeMetadata("studio");

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ step?: string | string[] }> }) {
  const params = await searchParams;
  const raw = Array.isArray(params.step) ? params.step[0] : params.step;
  const asked = tabFromLocation("", raw ? `?${new URLSearchParams({ step: raw })}` : "");
  const initialTab: Tab | null = asked && asked !== "compte" ? asked : null;
  return <StudioApp initialTab={initialTab} />;
}
