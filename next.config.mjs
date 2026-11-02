import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allowRestrictedDevMetrics } from "./scripts/dev-memory.mjs";

allowRestrictedDevMetrics();

const root = path.dirname(fileURLToPath(import.meta.url));
const storyweaveReal = path.join(root, "src/components/storyweave/storyweave-app.tsx");
const storyweavePending = path.join(root, "src/components/storyboard/storyweave-pending.tsx");
const storyweaveApp = existsSync(storyweaveReal) ? storyweaveReal : storyweavePending;
const storyweaveAlias = `./${path.relative(root, storyweaveApp)}`;

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

// GitHub Pages static export cannot host src/proxy.ts. Vercel is the target.
// GITHUB_PAGES is ignored so an old env does not flip the build back to `out/`.
if (process.env.GITHUB_PAGES === "true") {
  console.warn("[U*TTU] GITHUB_PAGES est ignoré : le proxy Comfy (src/proxy.ts) ne peut pas être exporté en site statique. Cible officielle : Vercel.");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  allowedDevOrigins: ["terminal.local", "127.0.0.1", "localhost"],
  devIndicators: { position: "top-right" },
  basePath,
  images: { formats: ["image/avif", "image/webp"] },
  transpilePackages: ["three", "maplibre-gl"],
  // The paid agent route reads the knowledge pack built by `npm run knowledge`.
  outputFileTracingIncludes: { "/studio-agent/chat": ["./public/agent/knowledge.json"] },
  async headers() {
    return [{ source: "/comfy-media-sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] }];
  },
  // ?storyboard=sw mounts src/components/storyweave/storyweave-app.tsx when that file exists.
  turbopack: { resolveAlias: { "storyweave-app": storyweaveAlias } },
  webpack(config) {
    config.resolve.alias = { ...config.resolve.alias, "storyweave-app": storyweaveApp };
    return config;
  },
};

export default nextConfig;
