import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return siteOrigin ? [{ url: siteOrigin, changeFrequency: "monthly", priority: 1 }] : [];
}
