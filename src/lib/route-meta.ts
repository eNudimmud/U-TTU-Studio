import type { Metadata } from "next";
import ROUTES from "./route-meta.json";
import { assetPath, siteOrigin } from "./site";

/** One entry per public route: FR title and description, and its 1200×630 preview (scripts/brand/make_meta.py). */
export type RouteId = "accueil" | "studio" | "creations";

const LOCALES = ["en_GB", "de_DE", "es_ES"];

/**
 * Title, description, canonical, Open Graph and Twitter card for a route.
 * The image is JD's logo, scaled and padded on graphite, with the route's French title beside it.
 */
export function routeMetadata(id: RouteId, extra: Partial<Metadata> = {}): Metadata {
  const route = (ROUTES as { id: RouteId; path: string; title: string; description: string }[]).find(item => item.id === id)!;
  const image = siteOrigin ? `${siteOrigin}/og/${id}.jpg` : assetPath(`/og/${id}.jpg`);
  const url = siteOrigin ? `${siteOrigin}${route.path}` : undefined;
  return {
    title: route.title,
    description: route.description,
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: {
      type: "website", siteName: "U*TTU Studio", locale: "fr_CH", alternateLocale: LOCALES,
      title: route.title, description: route.description, ...(url ? { url } : {}),
      images: [{ url: image, width: 1200, height: 630, alt: route.title, type: "image/jpeg" }],
    },
    twitter: { card: "summary_large_image", title: route.title, description: route.description, images: [{ url: image, alt: route.title }] },
    ...extra,
  };
}
