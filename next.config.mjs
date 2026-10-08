import { allowRestrictedDevMetrics } from "./scripts/dev-memory.mjs";

allowRestrictedDevMetrics();

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

// GitHub Pages static export cannot host src/proxy.ts. Vercel is the target.
// GITHUB_PAGES is ignored so an old env does not flip the build back to `out/`.
if (process.env.GITHUB_PAGES === "true") {
  console.warn("[U*TTU] GITHUB_PAGES est ignoré : le proxy Clerk ne peut pas être exporté en site statique. Cible officielle : Vercel. Voir docs/AUTH.md.");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  allowedDevOrigins: ["terminal.local", "127.0.0.1", "localhost"],
  basePath,
  env: { NEXT_PUBLIC_CLERK_KEYLESS_DISABLED: "true" },
  images: { formats: ["image/avif", "image/webp"] },
  async headers() {
    return [{ source: "/comfy-media-sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] }];
  },
};

export default nextConfig;
