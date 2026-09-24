import { allowRestrictedDevMetrics } from "./scripts/dev-memory.mjs";

allowRestrictedDevMetrics();

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["terminal.local"],
  images: { formats: ["image/avif", "image/webp"] },
};

export default nextConfig;
