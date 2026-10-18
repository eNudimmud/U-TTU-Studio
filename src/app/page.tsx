import type { Metadata } from "next";
import { HomeLanding } from "@/components/landing/home";
import { routeMetadata } from "@/lib/route-meta";

export const metadata: Metadata = routeMetadata("accueil");

export default function Home() {
  return <HomeLanding />;
}
