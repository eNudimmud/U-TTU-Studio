import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { StoryboardApp } from "@/components/storyboard/storyboard-app";
import { STORYBOARD_COOKIE, storyboardActif } from "@/lib/storyboard/drapeau";
import { loadStoryboardCatalog } from "@/lib/storyboard/catalogue";
import { storyboardU11Actif } from "@/lib/storyboard/u11";
import { requestLocale } from "@/lib/i18n/server";

// /storyboard, /storyboard/<id>, /storyboard/<id>/print. Open to everyone (SB11). U1.1 is the default.
// `?storyboard=legacy` is the paper page. `?storyboard=u11` still opens U1.1. `?storyboard=0` (or its
// cookie) stays one version as an escape hatch: the address then answers the studio's own 404.

const STORYBOARD_DESCRIPTION = "Tell the story. Uttu writes a storyboard you can watch. Nothing is filmed until you approve.";

export const metadata: Metadata = {
  title: "Storyboard · U*TTU Studio",
  description: STORYBOARD_DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: { title: "Storyboard · U*TTU Studio", description: STORYBOARD_DESCRIPTION },
  twitter: { title: "Storyboard · U*TTU Studio", description: STORYBOARD_DESCRIPTION },
};

function askedStoryboard(search: Record<string, string | string[] | undefined>): string | undefined {
  const value = search.storyboard;
  return Array.isArray(value) ? value[0] : value;
}

export async function generateViewport({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Viewport> {
  const asked = askedStoryboard(await searchParams);
  const u11 = storyboardU11Actif(asked ? `?storyboard=${encodeURIComponent(asked)}` : "", null);
  return u11 ? { colorScheme: "dark", themeColor: "#0f0f11" } : { colorScheme: "light", themeColor: "#f7f4ee" };
}

export default async function StoryboardPage({ params, searchParams }: {
  params: Promise<{ id?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id = [] }, search, jar] = await Promise.all([params, searchParams, cookies()]);
  const asked = askedStoryboard(search);
  const query = asked ? `?storyboard=${encodeURIComponent(asked)}` : "";
  if (!storyboardActif(query, jar.get(STORYBOARD_COOKIE)?.value)) notFound();
  const [board = null, mode = null] = id;
  if (id.length > 2 || (mode !== null && mode !== "print") || (board !== null && !/^[a-z0-9-]{1,80}$/.test(board))) notFound();
  // The storyboard's words come with the HTML: the page paints on the first frame, not after a client fetch.
  const locale = await requestLocale();
  const messages = await loadStoryboardCatalog(locale);
  // StoryWeave mounts only here. The closed-storyboard gate can keep every other mode on its own page.
  return <StoryboardApp id={board} print={mode === "print"} u11={storyboardU11Actif(query, null)} sw={asked === "sw"} initial={{ locale, messages }} />;
}
