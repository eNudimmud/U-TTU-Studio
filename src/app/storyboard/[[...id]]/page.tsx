import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { StoryboardApp } from "@/components/storyboard/storyboard-app";
import { STORYBOARD_COOKIE, storyboardActif } from "@/lib/storyboard/drapeau";

// SB5 · /storyboard, /storyboard/<id>, /storyboard/<id>/print. Open to everyone (SB11). `?storyboard=0` (or its
// cookie) stays one version as an escape hatch: the address then answers the studio's own 404.

export const metadata: Metadata = { title: "Storyboard · U*TTU Studio", robots: { index: false, follow: false } };
export const viewport: Viewport = { colorScheme: "light", themeColor: "#f7f4ee" };

export default async function StoryboardPage({ params, searchParams }: {
  params: Promise<{ id?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id = [] }, search, jar] = await Promise.all([params, searchParams, cookies()]);
  const asked = Array.isArray(search.storyboard) ? search.storyboard[0] : search.storyboard;
  if (!storyboardActif(asked ? `?storyboard=${encodeURIComponent(asked)}` : "", jar.get(STORYBOARD_COOKIE)?.value)) notFound();
  const [board = null, mode = null] = id;
  if (id.length > 2 || (mode !== null && mode !== "print") || (board !== null && !/^[a-z0-9-]{1,80}$/.test(board))) notFound();
  return <StoryboardApp id={board} print={mode === "print"} />;
}
