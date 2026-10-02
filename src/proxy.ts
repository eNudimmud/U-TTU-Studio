import { clerkMiddleware } from "@clerk/nextjs/server";
import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";
import { hasClerkKeys } from "@/lib/clerk-config";
import { proxyComfy } from "@/lib/comfy-proxy";

// Routes stay public. Créer, Sphère and the vault ZIP do not require a session.
const withClerk = clerkMiddleware();

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // Before Clerk: Comfy media is same-site only when the frame is this host.
  const comfy = await proxyComfy(request);
  if (comfy) return comfy;
  if (!hasClerkKeys(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, process.env.CLERK_SECRET_KEY)) {
    return NextResponse.next();
  }
  return withClerk(request, event);
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
