export const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "HelveticVault@gmail.com";
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const assetPath = (path: string) => `${basePath}${path}`;
const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
export const siteOrigin = configuredOrigin || (vercelHost ? `https://${vercelHost}` : undefined);
export const socialImage = siteOrigin ? `${siteOrigin}/og.jpg` : assetPath("/og.jpg");
export const siteDescription = "Une identité visuelle verrouillée. Une bible, 10–20 stills de référence, une grille PASS / FAIL et des règles de prompt. Look-Lock Pack dès CHF 800.";
