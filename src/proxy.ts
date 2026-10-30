import { type NextRequest, NextResponse } from "next/server";
import { proxyComfy } from "@/lib/comfy-proxy";
import { studioOriginGate } from "@/lib/studio-origin-gate";

// Every route is public. The proxy serves Comfy media on this host, and sends the studio pages
// to the login-authorized origin when this host cannot log in to Comfy (src/lib/studio-origin.ts).
export async function proxy(request: NextRequest) {
  const gate = studioOriginGate(request);
  if (gate) return gate;
  // Comfy media is same-site only when the frame is this host.
  const comfy = await proxyComfy(request);
  return comfy ?? NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    // Hashed Comfy files are excluded by the pattern above. These still have to reach the proxy.
    "/comfy-embed",
    "/assets/:path*",
    "/fonts/:path*",
    "/website/:path*",
    "/extensions/:path*",
    "/templates/:path*",
    "/internal/:path*",
    "/models/:path*",
    "/vhs/:path*",
    "/flags/:path*",
    "/cdn-cgi/:path*",
    "/materialdesignicons.min.css",
    "/ws",
  ],
};
