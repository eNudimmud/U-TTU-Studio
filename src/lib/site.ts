import { normalizeProxyUrl } from "./fal-stack.ts";

export const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "HelveticVault@gmail.com";
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const assetPath = (path: string) => `${basePath}${path}`;
const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
export const siteOrigin = configuredOrigin || (vercelHost ? `https://${vercelHost}` : undefined);
export const socialImage = siteOrigin ? `${siteOrigin}/og.jpg` : assetPath("/og.jpg");
export const siteTitle = "U*TTU Studio — Deux photos, une LoRA";
export const siteDescription = "Dépose 2 ou 3 photos, prépare un lot de 15 images, entraîne une LoRA. Créer, Sphère, Identité, Bibliothèque, Studio : une page. Vente HOLD.";
export const testPhaseEnd = "8 octobre 2026";
// The proxy URL only: the fal key never reaches this bundle.
export const falProxyUrl = normalizeProxyUrl(process.env.NEXT_PUBLIC_FAL_PROXY_URL);
