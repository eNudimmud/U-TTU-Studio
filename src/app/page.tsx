import type { Metadata } from "next";
import { HomeLanding } from "@/components/landing/home";
import { loadCatalog } from "@/lib/i18n/catalog";
import { requestLocale } from "@/lib/i18n/server";
import { routeMetadata } from "@/lib/route-meta";

/** The home title and description follow the visitor's language (a juror on en-US reads English). */
export async function generateMetadata(): Promise<Metadata> {
  const base = routeMetadata("accueil");
  const copy = (await loadCatalog(await requestLocale())).meta as { title: string; description: string };
  return {
    ...base,
    title: copy.title,
    description: copy.description,
    openGraph: { ...base.openGraph, title: copy.title, description: copy.description },
    twitter: { ...base.twitter, title: copy.title, description: copy.description },
  };
}

export default function Home() {
  return <HomeLanding />;
}
