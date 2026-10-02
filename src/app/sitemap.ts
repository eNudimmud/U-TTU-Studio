import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteOrigin) return [];
  return [
    { url: siteOrigin, changeFrequency: "monthly", priority: 1 },
    { url: `${siteOrigin}/studio`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
