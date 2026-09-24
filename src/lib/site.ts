export const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "HelveticVault@gmail.com";
const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
export const siteOrigin = configuredOrigin || (vercelHost ? `https://${vercelHost}` : undefined);
export const siteDescription = "Une identité visuelle verrouillée. Une bible, 10–20 stills de référence, une grille PASS / FAIL et des règles de prompt. Look-Lock Pack dès CHF 800.";
