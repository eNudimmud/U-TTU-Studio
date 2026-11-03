import type { Metadata } from "next";
import ROUTES from "./route-meta.json";
import { assetPath, siteOrigin } from "./site";

/** One entry per public route: English title and description (the default language), and its 1200×630 preview (scripts/brand/make_meta.py). */
export type RouteId = "accueil" | "studio" | "creations";

const LOCALES = ["fr_CH", "de_DE", "es_ES"];

/**
 * Title, description, canonical, Open Graph and Twitter card for a route.
 * The image is the studio logo, scaled and padded on graphite, with the route's English title beside it.
 */
export function routeMetadata(id: RouteId, extra: Partial<Metadata> = {}): Metadata {
  const route = (ROUTES as { id: RouteId; path: string; title: string; description: string }[]).find(item => item.id === id)!;
  // ?v= changes with the picture so link previews refetch it (English since 31.10.2026).
  const image = siteOrigin ? `${siteOrigin}/og/${id}.jpg?v=4` : assetPath(`/og/${id}.jpg?v=4`);
  const url = siteOrigin ? `${siteOrigin}${route.path}` : undefined;
  return {
    title: route.title,
    description: route.description,
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: {
      type: "website", siteName: "U*TTU Studio", locale: "en_GB", alternateLocale: LOCALES,
      title: route.title, description: route.description, ...(url ? { url } : {}),
      images: [{ url: image, width: 1200, height: 630, alt: route.title, type: "image/jpeg" }],
    },
    twitter: { card: "summary_large_image", title: route.title, description: route.description, images: [{ url: image, alt: route.title }] },
    ...extra,
  };
}
