import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";
export const dynamic = "force-static";

/** Indexed pages. The direct-upload trial stays off this list; its page is noindex. */
const PAGES: { path: string; priority: number }[] = [
  { path: "", priority: 1 },
  { path: "/studio", priority: 0.8 },
  ...["cinema","anime"].flatMap(section=>["cast","set","shoot","edit","finish","prompts","bible"].map(step=>({path:`/studio/${section}/${step}`,priority:0.6}))),
  { path: "/guide", priority: 0.7 },
  { path: "/guide/cinema", priority: 0.5 },
  { path: "/guide/tools", priority: 0.4 },
  { path: "/guide/anime", priority: 0.4 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteOrigin) return [];
  return PAGES.map(page => ({
    url: `${siteOrigin}${page.path}`,
    changeFrequency: "monthly",
    priority: page.priority,
  }));
}
