import { allowRestrictedDevMetrics } from "./scripts/dev-memory.mjs";

allowRestrictedDevMetrics();

const githubPages = process.env.GITHUB_PAGES === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["terminal.local"],
  basePath,
  ...(githubPages ? { output: "export", trailingSlash: true } : {}),
  images: { formats: ["image/avif", "image/webp"], unoptimized: githubPages },
};

export default nextConfig;
