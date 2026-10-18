import type { Metadata } from "next";
import { AtelierPage } from "@/components/app/atelier-page";
import { routeMetadata } from "@/lib/route-meta";

export const metadata: Metadata = routeMetadata("creations", { robots: { index: false } });

export default function MonStudioPage() {
  return <AtelierPage />;
}
