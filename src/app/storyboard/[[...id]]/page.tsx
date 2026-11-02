import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { StoryboardApp } from "@/components/storyboard/storyboard-app";
import { holdCopy, StoryboardHolding } from "@/components/storyboard/storyboard-holding";
import { StoryWeaveSlot } from "@/components/storyboard/storyweave-slot";
import { STORYBOARD_COOKIE, storyboardActif } from "@/lib/storyboard/drapeau";
import { loadStoryboardCatalog } from "@/lib/storyboard/catalogue";
import { storyboardU11Actif } from "@/lib/storyboard/u11";
import { requestLocale } from "@/lib/i18n/server";
import { STORYBOARD_CLOSED, storyboardHeld } from "../closed";

// /storyboard, /storyboard/<id>, /storyboard/<id>/print.
// Until StoryWeave ships, STORYBOARD_CLOSED in ../closed.ts shows a holding page.
// Flip that one constant to false to restore the board. `?storyboard=sw` is the only bypass.
// `?storyboard=0` (or its cookie) still answers 404. Nothing here deletes or migrates a board.

const STORYBOARD_DESCRIPTION = "Tell the story. Uttu writes a storyboard you can watch. Nothing is filmed until you approve.";
const HOLDING_DESCRIPTION = "StoryWeave is coming. Boards you already made stay where they are. Nothing is deleted or migrated.";

function askedStoryboard(search: Record<string, string | string[] | undefined>): string | undefined {
  const value = search.storyboard;
  return Array.isArray(value) ? value[0] : value;
}

function holdingMeta(): Metadata {
  return {
    title: "StoryWeave · U*TTU Studio",
    description: HOLDING_DESCRIPTION,
    robots: { index: false, follow: false },
    openGraph: { title: "StoryWeave · U*TTU Studio", description: HOLDING_DESCRIPTION },
    twitter: { title: "StoryWeave · U*TTU Studio", description: HOLDING_DESCRIPTION },
  };
}

const OPEN_META: Metadata = {
  title: "Storyboard · U*TTU Studio",
  description: STORYBOARD_DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: { title: "Storyboard · U*TTU Studio", description: STORYBOARD_DESCRIPTION },
  twitter: { title: "Storyboard · U*TTU Studio", description: STORYBOARD_DESCRIPTION },
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const asked = askedStoryboard(await searchParams);
  return asked === "sw" || storyboardHeld(asked) ? holdingMeta() : OPEN_META;
}

export async function generateViewport({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Viewport> {
  const asked = askedStoryboard(await searchParams);
  if (asked === "sw" || storyboardHeld(asked)) return { colorScheme: "dark", themeColor: "#0f0f11" };
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
  const [board = null, mode = null] = id;
  if (id.length > 2 || (mode !== null && mode !== "print") || (board !== null && !/^[a-z0-9-]{1,80}$/.test(board))) notFound();
  const locale = await requestLocale();
  const messages = await loadStoryboardCatalog(locale);
  // The only open door. A previous `?storyboard=0` cookie does not close it.
  if (asked === "sw") return <StoryWeaveSlot copy={holdCopy(messages)} id={board} print={mode === "print"} />;
  if (!storyboardActif(query, jar.get(STORYBOARD_COOKIE)?.value)) notFound();
  if (storyboardHeld(asked)) return <StoryboardHolding copy={holdCopy(messages)} gate="closed" />;
  return <StoryboardApp id={board} print={mode === "print"} u11={storyboardU11Actif(query, null)} initial={{ locale, messages }} />;
}
