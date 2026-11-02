import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";
export const dynamic = "force-static";

/** Indexed pages. The direct-upload trial stays off this list; its page is noindex. */
const PAGES: { path: string; priority: number }[] = [
  { path: "", priority: 1 },
  { path: "/studio", priority: 0.8 },
  { path: "/look", priority: 0.6 },
  { path: "/look/bible", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteOrigin) return [];
  return PAGES.map(page => ({
    url: `${siteOrigin}${page.path}`,
    changeFrequency: "monthly",
    priority: page.priority,
  }));
}
